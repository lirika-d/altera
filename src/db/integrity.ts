import type { KnowledgeEntityType } from '@/types'
import { db, type AlteraDB } from './db'

export interface IntegrityIssue {
  code: string
  table: string
  rowId: string
  reference?: string
}

/**
 * Read-only relational integrity scan. It reports broken references without
 * changing records, so callers can present or export diagnostics safely.
 */
export async function inspectDatabaseIntegrity(dbInstance: AlteraDB = db): Promise<IntegrityIssue[]> {
  return dbInstance.transaction('r', dbInstance.tables, async () => {
    const [projects, tasks, activities, sessions, notes, resources, attachments, tags, assignments, links, workBlocks] = await Promise.all([
      dbInstance.projects.toArray(),
      dbInstance.tasks.toArray(),
      dbInstance.activities.toArray(),
      dbInstance.sessions.toArray(),
      dbInstance.notes.toArray(),
      dbInstance.resources.toArray(),
      dbInstance.attachments.toArray(),
      dbInstance.tags.toArray(),
      dbInstance.tagAssignments.toArray(),
      dbInstance.entityLinks.toArray(),
      dbInstance.scheduledWorkBlocks.toArray(),
    ])

    const issues: IntegrityIssue[] = []
    const projectIds = new Set(projects.map(project => project.id))
    const taskById = new Map(tasks.map(task => [task.id, task]))
    const noteIds = new Set(notes.map(note => note.id))
    const resourceIds = new Set(resources.map(resource => resource.id))
    const sessionIds = new Set(sessions.map(session => session.id))
    const attachmentIds = new Set(attachments.map(attachment => attachment.id))
    const tagIds = new Set(tags.map(tag => tag.id))
    const workBlockIds = new Set(workBlocks.map(block => block.id))
    const entityIds: Record<KnowledgeEntityType, Set<string>> = {
      project: projectIds,
      task: new Set(taskById.keys()),
      session: sessionIds,
      note: noteIds,
      resource: resourceIds,
    }
    const addIssue = (code: string, table: string, rowId: string, reference?: string) => {
      issues.push({ code, table, rowId, ...(reference ? { reference } : {}) })
    }

    for (const task of tasks) {
      if (!projectIds.has(task.projectId)) addIssue('task.project.missing', 'tasks', task.id, `projects:${task.projectId}`)
    }

    for (const block of workBlocks) {
      if (block.projectId && !projectIds.has(block.projectId)) {
        addIssue('calendar_block.project.missing', 'scheduledWorkBlocks', block.id, `projects:${block.projectId}`)
      }
      if (block.taskId) {
        const task = taskById.get(block.taskId)
        if (!task) addIssue('calendar_block.task.missing', 'scheduledWorkBlocks', block.id, `tasks:${block.taskId}`)
        else if (block.projectId !== task.projectId) {
          addIssue('calendar_block.task.project_mismatch', 'scheduledWorkBlocks', block.id, `tasks:${block.taskId}`)
        }
      }
      if (!(block.scheduledStart instanceof Date) || !(block.scheduledEnd instanceof Date)
        || !Number.isFinite(block.scheduledStart.getTime()) || !Number.isFinite(block.scheduledEnd.getTime())
        || block.scheduledEnd <= block.scheduledStart) {
        addIssue('calendar_block.interval.invalid', 'scheduledWorkBlocks', block.id)
      }
    }

    for (const activity of activities) {
      if (activity.projectId && !projectIds.has(activity.projectId)) {
        addIssue('activity.project.missing', 'activities', activity.id, `projects:${activity.projectId}`)
      }
      if (activity.taskId) {
        const task = taskById.get(activity.taskId)
        if (!task) addIssue('activity.task.missing', 'activities', activity.id, `tasks:${activity.taskId}`)
        else if (activity.projectId && task.projectId !== activity.projectId) {
          addIssue('activity.task.project_mismatch', 'activities', activity.id, `tasks:${activity.taskId}`)
        }
      }
    }

    const unfinishedSessions = sessions.filter(session => session.status !== 'completed')
    if (unfinishedSessions.length > 1) {
      for (const session of unfinishedSessions) addIssue('session.multiple_active', 'sessions', session.id)
    }
    for (const session of sessions) {
      const hasHistoricalProject = session.status === 'completed'
        && session.projectSnapshot?.id === session.projectId
      if (!projectIds.has(session.projectId) && !hasHistoricalProject) {
        addIssue('session.project.missing', 'sessions', session.id, `projects:${session.projectId}`)
      }
      if (session.projectSnapshot && session.projectSnapshot.id !== session.projectId) {
        addIssue('session.project_snapshot.mismatch', 'sessions', session.id, `projects:${session.projectSnapshot.id}`)
      }
      if (session.taskId) {
        const task = taskById.get(session.taskId)
        if (!task) addIssue('session.task.missing', 'sessions', session.id, `tasks:${session.taskId}`)
        else if (task.projectId !== session.projectId) {
          addIssue('session.task.project_mismatch', 'sessions', session.id, `tasks:${session.taskId}`)
        }
      }
      if (session.scheduledBlockId && !workBlockIds.has(session.scheduledBlockId)) {
        addIssue('session.calendar_block.missing', 'sessions', session.id, `scheduledWorkBlocks:${session.scheduledBlockId}`)
      }
    }

    for (const note of notes) {
      if (note.projectId && !projectIds.has(note.projectId)) {
        addIssue('note.project.missing', 'notes', note.id, `projects:${note.projectId}`)
      }
      if (!Number.isInteger(note.revision) || note.revision < 1) addIssue('note.revision.invalid', 'notes', note.id)
    }
    for (const resource of resources) {
      if (resource.projectId && !projectIds.has(resource.projectId)) {
        addIssue('resource.project.missing', 'resources', resource.id, `projects:${resource.projectId}`)
      }
      if (resource.attachmentId && !attachmentIds.has(resource.attachmentId)) {
        addIssue('resource.attachment.missing', 'resources', resource.id, `attachments:${resource.attachmentId}`)
      }
    }

    for (const assignment of assignments) {
      if (!tagIds.has(assignment.tagId)) addIssue('tag_assignment.tag.missing', 'tagAssignments', assignment.id, `tags:${assignment.tagId}`)
      if (!entityIds[assignment.entityType]?.has(assignment.entityId)) {
        addIssue('tag_assignment.entity.missing', 'tagAssignments', assignment.id, `${assignment.entityType}:${assignment.entityId}`)
      }
    }

    const seenLinks = new Set<string>()
    for (const link of links) {
      if (!entityIds[link.sourceType]?.has(link.sourceId)) {
        addIssue('entity_link.source.missing', 'entityLinks', link.id, `${link.sourceType}:${link.sourceId}`)
      }
      if (!entityIds[link.targetType]?.has(link.targetId)) {
        addIssue('entity_link.target.missing', 'entityLinks', link.id, `${link.targetType}:${link.targetId}`)
      }
      if (link.sourceType === link.targetType && link.sourceId === link.targetId) {
        addIssue('entity_link.self_link', 'entityLinks', link.id)
      }
      const key = JSON.stringify([link.sourceType, link.sourceId, link.targetType, link.targetId])
      if (seenLinks.has(key)) addIssue('entity_link.duplicate', 'entityLinks', link.id)
      seenLinks.add(key)
    }

    return issues
  })
}
