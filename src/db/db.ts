import Dexie, { type Table } from 'dexie'
import type {
  Project,
  Task,
  Activity,
  Session,
  Note,
  Resource,
  Attachment,
  Tag,
  TagAssignment,
  EntityLink,
  WorkflowTemplate,
} from '@/types'
import type { ScheduledWorkBlock } from '@/types/calendar'

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class AlteraDB extends Dexie {
  projects!: Table<Project, string>
  tasks!: Table<Task, string>
  activities!: Table<Activity, string>
  sessions!: Table<Session, string>
  notes!: Table<Note, string>
  resources!: Table<Resource, string>
  attachments!: Table<Attachment, string>
  tags!: Table<Tag, string>
  tagAssignments!: Table<TagAssignment, string>
  entityLinks!: Table<EntityLink, string>
  metadata!: Table<{ key: string; value: boolean }, string>
  scheduledWorkBlocks!: Table<ScheduledWorkBlock, string>
  workflowTemplates!: Table<WorkflowTemplate, string>

  constructor(dbName: string = 'AlteraDB') {
    super(dbName)

    // ── v1: original schema (never touch this) ─────────────────────────────
    this.version(1).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
    })

    // ── v2: add sessions table ─────────────────────────────────────────────
    // Dexie merges the schema – existing tables and their data are preserved.
    // Only `sessions` is new; no upgrade() callback needed.
    this.version(2).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      // Indexed on projectId (history per project), status (find active sessions),
      // startedAt (chronological ordering) and updatedAt (recency).
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
    })

    // ── v3: add knowledge hub tables ────────────────────────────────────────
    this.version(3).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
      notes: 'id, isFavorite, deletedAt, updatedAt, createdAt, revision',
      resources: 'id, type, isFavorite, deletedAt, updatedAt, createdAt',
      attachments: 'id, filename, mimeType, createdAt',
      tags: 'id, &name, normalizedName, createdAt',
      tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId]',
    })

    // Existing workspaces, including empty ones, must never be reseeded on upgrade.
    this.version(4).stores({ metadata: 'key' }).upgrade(async (tx) => {
      await tx.table('metadata').put({ key: 'initialized', value: true })
    })

    // ── v5: add a type-aware relationship index and normalize exact dupes ────
    // Separate cleanup from the unique-index migration so legacy databases
    // cannot fail to open merely because old raw data contains duplicate rows.
    this.version(5).stores({
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId], [sourceType+sourceId+targetType+targetId]',
    }).upgrade(async (tx) => {
      const linksTable = tx.table('entityLinks')
      const links = await linksTable.toArray() as EntityLink[]
      const firstByKey = new Map<string, EntityLink>()

      for (const link of links) {
        const key = JSON.stringify([link.sourceType, link.sourceId, link.targetType, link.targetId])
        const first = firstByKey.get(key)
        if (!first) {
          firstByKey.set(key, link)
          continue
        }

        const firstCreatedAt = new Date(first.createdAt).getTime()
        const linkCreatedAt = new Date(link.createdAt).getTime()
        if (Number.isFinite(linkCreatedAt) && (!Number.isFinite(firstCreatedAt) || linkCreatedAt < firstCreatedAt)) {
          await linksTable.delete(first.id)
          firstByKey.set(key, link)
        } else {
          await linksTable.delete(link.id)
        }
      }
    })

    // ── v6: enforce full directed edge identity with a unique index ─────────
    this.version(6).stores({
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId], &[sourceType+sourceId+targetType+targetId]',
    })

    // ── v7: indexes for project-scoped knowledge queries ────────────────────
    // These are additive indexes only; all existing records and other indexes
    // remain unchanged.
    this.version(7).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
      notes: 'id, projectId, isFavorite, deletedAt, updatedAt, createdAt, revision',
      resources: 'id, projectId, type, isFavorite, deletedAt, updatedAt, createdAt',
      attachments: 'id, filename, mimeType, createdAt',
      tags: 'id, &name, normalizedName, createdAt',
      tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId], &[sourceType+sourceId+targetType+targetId]',
      metadata: 'key',
    })

    // ── v8: scheduled work blocks and indexed task deadlines ───────────────
    // Additive only: existing records and all released migrations are preserved.
    this.version(8).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, dueDate, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
      notes: 'id, projectId, isFavorite, deletedAt, updatedAt, createdAt, revision',
      resources: 'id, projectId, type, isFavorite, deletedAt, updatedAt, createdAt',
      attachments: 'id, filename, mimeType, createdAt',
      tags: 'id, &name, normalizedName, createdAt',
      tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId], &[sourceType+sourceId+targetType+targetId]',
      metadata: 'key',
      scheduledWorkBlocks: 'id, projectId, taskId, scheduledStart, scheduledEnd, status, createdAt, updatedAt',
    })

    // ── v9: link real work sessions to planned calendar blocks ─────────────
    // Additive index only; existing session history is preserved unchanged.
    this.version(9).stores({
      sessions: 'id, projectId, taskId, scheduledBlockId, status, startedAt, updatedAt, createdAt',
    })

    // ── v10: reusable task and project workflow templates ──────────────────
    // Additive only; all existing records and released migrations are preserved.
    this.version(10).stores({
      workflowTemplates: 'id, kind, name, updatedAt',
    })
  }
}

export const db = new AlteraDB()

export class DataIntegrityError extends Error {
  code: 'PROJECT_NOT_FOUND' | 'PROJECT_HAS_ACTIVE_SESSION'

  constructor(
    message: string,
    code: 'PROJECT_NOT_FOUND' | 'PROJECT_HAS_ACTIVE_SESSION'
  ) {
    super(message)
    this.name = 'DataIntegrityError'
    this.code = code
  }
}

export async function getNextProjectIdentifier(): Promise<string> {
  const projects = await db.projects.toArray()
  let maxNum = 0
  for (const p of projects) {
    const match = p.identifier.match(/ALT-(\d+)/i)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }
  const nextNum = maxNum + 1
  return `ALT-${nextNum.toString().padStart(3, '0')}`
}

export async function logActivity(activity: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  const newActivity: Activity = {
    ...activity,
    id: generateId(),
    createdAt: new Date(),
  }
  await db.activities.add(newActivity)
  return newActivity
}

export async function recalculateProjectProgress(projectId: string): Promise<number> {
  const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray()
  const progress = projectTasks.length === 0
    ? 0
    : Math.round((projectTasks.filter((t) => t.status === 'done').length / projectTasks.length) * 100)

  await db.projects.update(projectId, {
    progress,
    updatedAt: new Date(),
  })
  return progress
}

export async function touchProject(projectId: string): Promise<void> {
  const project = await db.projects.get(projectId)
  if (project) {
    await db.projects.update(projectId, {
      lastVisitedAt: new Date(),
    })
  }
}

/** Explicit destructive operation used only by the confirmed Settings action. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.tasks,
      db.activities,
      db.sessions,
      db.notes,
      db.resources,
      db.attachments,
      db.tags,
      db.tagAssignments,
      db.entityLinks,
      db.metadata,
      db.scheduledWorkBlocks,
      db.workflowTemplates,
    ],
    async () => {
      await db.metadata.put({ key: 'initialized', value: true })
      await db.projects.clear()
      await db.tasks.clear()
      await db.activities.clear()
      await db.sessions.clear()
      await db.notes.clear()
      await db.resources.clear()
      await db.attachments.clear()
      await db.tags.clear()
      await db.tagAssignments.clear()
      await db.entityLinks.clear()
      await db.scheduledWorkBlocks.clear()
      await db.workflowTemplates.clear()
    }
  )
}

export async function createProject(
  data: Omit<Project, 'id' | 'identifier' | 'progress' | 'createdAt' | 'updatedAt'> & { identifier?: string }
): Promise<Project> {
  return db.transaction('rw', db.projects, db.activities, async () => {
    const now = new Date()
    const identifier = data.identifier || (await getNextProjectIdentifier())
    const project: Project = {
      ...data,
      id: generateId(),
      identifier,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      lastVisitedAt: now,
    }

    await db.projects.add(project)
    await logActivity({
      type: 'project_created',
      projectId: project.id,
      description: `Created project "${project.name}" (${project.identifier})`,
    })

    if (project.nextAction && project.nextAction.trim()) {
      await logActivity({
        type: 'next_action_set',
        projectId: project.id,
        description: `Set initial next action: "${project.nextAction.trim()}"`,
      })
    }

    return project
  })
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  await db.transaction('rw', db.projects, db.activities, async () => {
    const existing = await db.projects.get(projectId)
    if (!existing) return

    const now = new Date()
    await db.projects.update(projectId, {
      ...updates,
      id: existing.id,
      identifier: existing.identifier,
      createdAt: existing.createdAt,
      updatedAt: now,
    })

    if (updates.nextAction !== undefined && updates.nextAction !== existing.nextAction) {
      await logActivity({
        type: 'next_action_set',
        projectId,
        description: updates.nextAction.trim()
          ? `Updated next action: "${updates.nextAction.trim()}"`
          : `Cleared next action`,
      })
    } else if (updates.name || updates.status || updates.priority || updates.description) {
      await logActivity({
        type: 'project_updated',
        projectId,
        description: `Updated project "${updates.name || existing.name}"`,
      })
    }
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const project = await db.projects.get(projectId)
    if (!project) return
    const activeSession = await db.sessions
      .where('projectId')
      .equals(projectId)
      .filter((session) => session.status !== 'completed')
      .first()
    if (activeSession) {
      throw new DataIntegrityError(
        'Complete or delete the active work session before deleting this project.',
        'PROJECT_HAS_ACTIVE_SESSION'
      )
    }
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    const taskIds = new Set(tasks.map(task => task.id))
    await db.sessions.where('projectId').equals(projectId).modify(session => {
      session.projectSnapshot = { id: project.id, name: project.name, identifier: project.identifier }
      delete session.taskId
    })
    await db.notes.filter(note => note.projectId === projectId).modify(note => {
      delete note.projectId
      note.revision += 1
      note.updatedAt = new Date()
    })
    await db.resources.filter(resource => resource.projectId === projectId).modify(resource => {
      delete resource.projectId
      resource.updatedAt = new Date()
    })
    // Calendar blocks are user-authored records: preserve them, but remove
    // references to the project and its tasks before those entities are deleted.
    await db.scheduledWorkBlocks.where('projectId').equals(projectId).modify(block => {
      delete block.projectId
      delete block.taskId
    })
    const removed = (type: string, id: string) => (type === 'project' && id === projectId) || (type === 'task' && taskIds.has(id))
    await db.tagAssignments.filter(a => removed(a.entityType, a.entityId)).delete()
    await db.entityLinks.filter(link => removed(link.sourceType, link.sourceId) || removed(link.targetType, link.targetId)).delete()
    await db.tasks.where('projectId').equals(projectId).delete()
    await db.activities.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}

export async function createTask(
  data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'> & { order?: number }
): Promise<Task> {
  return db.transaction('rw', db.projects, db.tasks, db.activities, async () => {
    const project = await db.projects.get(data.projectId)
    if (!project) {
      throw new DataIntegrityError(
        `Project "${data.projectId}" not found`,
        'PROJECT_NOT_FOUND'
      )
    }

    const now = new Date()
    const existingTasks = await db.tasks.where('projectId').equals(data.projectId).toArray()
    const order = data.order !== undefined ? data.order : existingTasks.length
    const task: Task = {
      ...data,
      id: generateId(),
      order,
      completedAt: data.status === 'done' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }

    await db.tasks.add(task)
    await recalculateProjectProgress(data.projectId)
    await logActivity({
      type: 'task_created',
      projectId: data.projectId,
      taskId: task.id,
      description: `Created task "${task.title}"`,
    })
    return task
  })
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.activities, async () => {
    const existing = await db.tasks.get(taskId)
    if (!existing) return

    const now = new Date()
    const updatedData: Partial<Task> = {
      ...updates,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: now,
    }

    if (updates.status !== undefined) {
      if (updates.status === 'done' && existing.status !== 'done') {
        updatedData.completedAt = now
      } else if (updates.status !== 'done') {
        updatedData.completedAt = undefined
      }
    }

    await db.tasks.update(taskId, updatedData)
    await recalculateProjectProgress(existing.projectId)

    if (updates.status === 'done' && existing.status !== 'done') {
      await logActivity({
        type: 'task_completed',
        projectId: existing.projectId,
        taskId,
        description: `Completed task "${existing.title}"`,
      })
    }
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const existing = await db.tasks.get(taskId)
    if (!existing) return

    await db.sessions.where('taskId').equals(taskId).modify(session => { delete session.taskId })
    await db.activities.where('taskId').equals(taskId).modify(activity => { delete activity.taskId })
    await db.scheduledWorkBlocks.where('taskId').equals(taskId).modify(block => { delete block.taskId })
    await db.tagAssignments.filter(a => a.entityType === 'task' && a.entityId === taskId).delete()
    await db.entityLinks.filter(link => (link.sourceType === 'task' && link.sourceId === taskId) || (link.targetType === 'task' && link.targetId === taskId)).delete()
    await db.tasks.delete(taskId)
    await recalculateProjectProgress(existing.projectId)
    await logActivity({
      type: 'task_deleted',
      projectId: existing.projectId,
      description: `Deleted task "${existing.title}"`,
    })
  })
}
