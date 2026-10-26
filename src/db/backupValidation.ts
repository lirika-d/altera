import type { Project, Task, Activity, Session, Note, Resource, Tag, TagAssignment, EntityLink, Attachment, WorkflowTemplate } from '@/types'
import type { ScheduledWorkBlock } from '@/types/calendar'
import { isValidResourceUrl } from '@/lib/resourceUrl'
import { isValidNoteDocument } from '@/lib/noteDocumentValidation'
import { isValidBackupPreferences, type BackupPreferences } from '@/db/backupPreferences'

type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] }
export interface BackupV3 {
  app: 'ALTERA'
  schemaVersion: 3
  exportedAt: string
  /** Optional to keep previously exported v3 backups compatible. */
  preferences?: BackupPreferences
  tables: {
    projects: Serialized<Project>[]
    tasks: Serialized<Task>[]
    activities: Serialized<Activity>[]
    sessions: Serialized<Session>[]
    notes: Serialized<Note>[]
    resources: Serialized<Resource>[]
    tags: Serialized<Tag>[]
    tagAssignments: TagAssignment[]
    entityLinks: Serialized<EntityLink>[]
    attachments: (Omit<Serialized<Attachment>, 'blob'> & { blobDataUrl: string })[]
    /** Optional for compatibility with backups exported before schema v8. */
    scheduledWorkBlocks?: Serialized<ScheduledWorkBlock>[]
    /** Optional to keep previously exported v3 backups compatible. */
    workflowTemplates?: Serialized<WorkflowTemplate>[]
  }
}

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
export function isBackupSizeAllowed(byteSize: number): boolean {
  return Number.isSafeInteger(byteSize) && byteSize >= 0 && byteSize <= MAX_BACKUP_BYTES
}
const MAX_ROWS = 100_000
const entityTables = { project: 'projects', task: 'tasks', session: 'sessions', note: 'notes', resource: 'resources' } as const
const required: Record<string, string[]> = {
  projects: ['identifier', 'name', 'description', 'status', 'priority', 'color', 'icon', 'nextAction'],
  tasks: ['projectId', 'title', 'status', 'priority'],
  activities: ['type', 'description'],
  sessions: ['projectId', 'title', 'objective', 'status', 'accomplishments', 'blockers', 'nextStep', 'outcome'],
  notes: ['title', 'contentJSON', 'plainText'],
  resources: ['type', 'title'],
  tags: ['name', 'normalizedName', 'color'],
  tagAssignments: ['tagId', 'entityType', 'entityId'],
  entityLinks: ['sourceType', 'sourceId', 'targetType', 'targetId'],
  attachments: ['filename', 'mimeType', 'blobDataUrl'],
  scheduledWorkBlocks: ['title', 'status', 'scheduledStart', 'scheduledEnd'],
  workflowTemplates: ['name', 'kind'],
}
const statuses = {
  projects: ['active', 'backlog', 'paused', 'archived', 'completed'],
  tasks: ['todo', 'in_progress', 'done', 'cancelled'],
  sessions: ['running', 'paused', 'completed'],
  scheduledWorkBlocks: ['planned', 'completed', 'cancelled'],
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
  return value as Record<string, unknown>
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function validDate(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value)
  if (!dateParts || !Number.isFinite(Date.parse(value))) return false

  const year = Number(dateParts[1])
  const month = Number(dateParts[2])
  const day = Number(dateParts[3])
  const calendarDate = new Date(0)
  calendarDate.setUTCFullYear(year, month - 1, day)
  calendarDate.setUTCHours(0, 0, 0, 0)
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
}

/** Validate the entire input before allowing a destructive import transaction. */
export function validateBackup(value: unknown): BackupV3 {
  const backup = record(value)
  check(backup.app === 'ALTERA' && backup.schemaVersion === 3, 'Expected ALTERA backup version 3')
  check(validDate(backup.exportedAt), 'Invalid export timestamp')
  if (backup.preferences !== undefined) check(isValidBackupPreferences(backup.preferences), 'Invalid backup preferences')
  const tables = record(backup.tables)
  const ids: Record<string, Set<string>> = {}
  const rows: Record<string, Record<string, unknown>[]> = {}
  let count = 0
  for (const [name, fields] of Object.entries(required)) {
    const items = (name === 'scheduledWorkBlocks' || name === 'workflowTemplates') && tables[name] === undefined ? [] : tables[name]
    check(Array.isArray(items), `Missing table: ${name}`)
    count += items.length
    check(count <= MAX_ROWS, 'Backup contains too many records')
    ids[name] = new Set()
    rows[name] = items.map(record)
    for (const row of rows[name]) {
      check(typeof row.id === 'string' && row.id.length > 0 && !ids[name].has(row.id), `${name}: invalid or duplicate id`)
      ids[name].add(row.id)
      for (const field of fields) check(typeof row[field] === 'string', `${name}: invalid ${field}`)
      if (name !== 'tagAssignments') check(validDate(row.createdAt), `${name}: invalid createdAt`)
      if (['projects', 'tasks', 'sessions', 'notes', 'resources', 'scheduledWorkBlocks', 'workflowTemplates'].includes(name)) check(validDate(row.updatedAt), `${name}: invalid updatedAt`)
      for (const field of ['dueDate', 'completedAt', 'lastVisitedAt', 'deletedAt', 'endedAt', 'startedAt', 'lastResumedAt', 'scheduledStart', 'scheduledEnd']) {
        if (row[field] !== undefined) check(validDate(row[field]), `${name}: invalid ${field}`)
      }
      for (const field of ['projectId', 'taskId', 'attachmentId', 'description', 'url', 'snippetContent', 'language']) {
        if (row[field] !== undefined) check(typeof row[field] === 'string', `${name}: invalid ${field}`)
      }
      if (row.scheduledBlockId !== undefined) check(name === 'sessions' && typeof row.scheduledBlockId === 'string', `${name}: invalid scheduledBlockId`)
      if (name in statuses) check(statuses[name as keyof typeof statuses].includes(row.status as never), `${name}: invalid status`)
      if (name === 'projects' || name === 'tasks') check(['urgent', 'high', 'medium', 'low', 'none'].includes(row.priority as string), 'Invalid priority')
      if (name === 'notes' || name === 'resources') check(typeof row.isFavorite === 'boolean', 'Invalid favorite flag')
      if (name === 'notes') check(Number.isInteger(row.revision) && Number(row.revision) >= 1, 'Invalid note revision')
      if (name === 'tasks') check(Number.isFinite(row.order), 'Invalid task order')
      if (name === 'scheduledWorkBlocks') check(Date.parse(row.scheduledEnd as string) > Date.parse(row.scheduledStart as string), 'Invalid work block duration')
      if (name === 'projects') check(Number.isFinite(row.progress) && Number(row.progress) >= 0 && Number(row.progress) <= 100, 'Invalid progress')
      if (name === 'resources') check(['link', 'snippet', 'file'].includes(row.type as string), 'Invalid resource type')
      if (name === 'resources') {
        if (typeof row.url === 'string' && row.url.trim()) check(isValidResourceUrl(row.url), 'Resource URLs must use HTTP or HTTPS')
      }
      if (name === 'notes') {
        let content: unknown
        try {
          content = JSON.parse(row.contentJSON as string)
        } catch {
          // Older v3 backups used an empty or plain-text editor payload.
          content = undefined
        }
        if (content && typeof content === 'object' && (content as Record<string, unknown>).type === 'doc') {
          check(isValidNoteDocument(content), 'Invalid note document structure')
        }
      }
      if (name === 'workflowTemplates') {
        check(row.kind === 'task' || row.kind === 'project', 'Invalid workflow template kind')
        check(['urgent', 'high', 'medium', 'low', 'none'].includes(row.priority as string), 'Invalid workflow template priority')
        if (row.kind === 'task') {
          check(typeof row.title === 'string' && row.title.trim().length > 0 && row.title.length <= 160, 'Invalid task template title')
        } else {
          check(typeof row.projectName === 'string' && row.projectName.trim().length > 0 && row.projectName.length <= 120, 'Invalid project template name')
          check(typeof row.description === 'string' && row.description.length <= 2000, 'Invalid project template description')
          check(typeof row.color === 'string' && /^#[\da-f]{6}$/i.test(row.color), 'Invalid project template color')
          check(typeof row.icon === 'string' && row.icon.trim().length > 0 && row.icon.length <= 12, 'Invalid project template icon')
          check(typeof row.nextAction === 'string' && row.nextAction.length <= 300, 'Invalid project template next action')
          check(Array.isArray(row.tasks) && row.tasks.length <= 30, 'Invalid project template tasks')
          for (const task of row.tasks as unknown[]) {
            const seed = record(task)
            check(typeof seed.title === 'string' && seed.title.trim().length > 0 && seed.title.length <= 160, 'Invalid project template task title')
            check(['urgent', 'high', 'medium', 'low', 'none'].includes(seed.priority as string), 'Invalid project template task priority')
          }
        }
      }
      if (name === 'activities') check(['project_created', 'project_updated', 'task_created', 'task_completed', 'task_deleted', 'next_action_set', 'session_started', 'session_completed'].includes(row.type as string), 'Invalid activity type')
      if (name === 'sessions') {
        check(validDate(row.startedAt) && validDate(row.lastResumedAt), 'Invalid session timestamps')
        check(Number.isFinite(row.accumulatedDurationMs) && Number(row.accumulatedDurationMs) >= 0, 'Invalid session duration')
        check(row.status !== 'completed' || validDate(row.endedAt), 'Completed session needs an end timestamp')
        check(row.status === 'completed' || row.endedAt === undefined, 'Active session cannot have an end timestamp')
        check(Date.parse(row.lastResumedAt as string) >= Date.parse(row.startedAt as string), 'Invalid session chronology')
        if (row.endedAt) check(Date.parse(row.endedAt as string) >= Date.parse(row.startedAt as string), 'Invalid session chronology')
      }
      if (name === 'attachments') {
        check(Number.isInteger(row.size) && Number(row.size) >= 0 && Number(row.size) <= 10 * 1024 * 1024, 'Invalid attachment size')
        const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(row.blobDataUrl as string)
        check(match && match[1] === row.mimeType, 'Attachment MIME does not match data URL')
        check(atob(match[2]).length === row.size, 'Attachment data length does not match size')
      }
    }
  }
  const unique = (table: string, key: (r: Record<string, unknown>) => string) => {
    const seen = new Set<string>()
    for (const row of rows[table]) {
      const value = key(row)
      check(!seen.has(value), `${table}: duplicate value`)
      seen.add(value)
    }
  }
  unique('projects', r => String(r.identifier).toUpperCase())
  unique('tags', r => String(r.name).trim().toLowerCase())
  unique('tagAssignments', r => JSON.stringify([r.tagId, r.entityType, r.entityId]))
  unique('entityLinks', r => JSON.stringify([r.sourceType, r.sourceId, r.targetType, r.targetId]))
  const entityExists = (type: unknown, id: unknown) => typeof type === 'string' && Object.hasOwn(entityTables, type) && ids[entityTables[type as keyof typeof entityTables]].has(id as string)
  const taskById = new Map(rows.tasks.map(task => [task.id as string, task]))
  for (const activity of rows.activities) {
    if (activity.projectId !== undefined) {
      check(ids.projects.has(activity.projectId as string), 'activities: missing project')
    }
    if (activity.taskId !== undefined) {
      const task = taskById.get(activity.taskId as string)
      check(task, 'activities: missing task')
      if (activity.projectId !== undefined) {
        check(task.projectId === activity.projectId, 'activities: task does not belong to project')
      }
    }
  }
  for (const row of rows.tags) check(row.normalizedName === String(row.name).trim().toLowerCase() && row.normalizedName !== '', 'Invalid normalized tag name')
  for (const name of ['tasks', 'notes', 'resources', 'sessions', 'scheduledWorkBlocks']) {
    for (const row of rows[name]) {
      if (row.projectSnapshot !== undefined) {
        const snapshot = record(row.projectSnapshot)
        check(name === 'sessions' && row.status === 'completed' && snapshot.id === row.projectId && typeof snapshot.name === 'string' && typeof snapshot.identifier === 'string', 'Invalid historical project snapshot')
      }
      if (row.projectId !== undefined) check(ids.projects.has(row.projectId as string) || (name === 'sessions' && row.projectSnapshot !== undefined), `${name}: missing project`)
      if (row.attachmentId !== undefined) check(ids.attachments.has(row.attachmentId as string), 'Missing attachment')
      if (row.taskId !== undefined) {
        const task = taskById.get(row.taskId as string)
        check(task && task.projectId === row.projectId, `${name} task does not belong to project`)
      }
    }
  }
  check(rows.sessions.filter(s => s.status !== 'completed').length <= 1, 'Multiple active sessions')
  const workBlockIds = new Set(rows.scheduledWorkBlocks.map(row => row.id))
  for (const session of rows.sessions) {
    if (session.scheduledBlockId !== undefined) {
      check(workBlockIds.has(session.scheduledBlockId as string), 'Session references a missing work block')
    }
  }
  for (const row of rows.tagAssignments) check(ids.tags.has(row.tagId as string) && entityExists(row.entityType, row.entityId), 'Dangling tag assignment')
  for (const row of rows.entityLinks) {
    check(entityExists(row.sourceType, row.sourceId) && entityExists(row.targetType, row.targetId), 'Dangling entity link')
    check(row.sourceType !== row.targetType || row.sourceId !== row.targetId, 'Self link')
  }
  return value as BackupV3
}
