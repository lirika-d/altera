import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllData, db } from '@/db/db'
import { inspectDatabaseIntegrity } from '@/db/integrity'

const now = new Date('2026-10-26T08:00:00.000Z')

async function addProject(id: string) {
  await db.projects.put({
    id,
    identifier: `ALT-${id}`,
    name: id,
    description: '',
    status: 'active',
    priority: 'medium',
    color: '#3b82f6',
    icon: '📁',
    progress: 0,
    nextAction: '',
    createdAt: now,
    updatedAt: now,
  })
}

async function addNote(id: string, projectId?: string) {
  await db.notes.put({
    id,
    title: id,
    contentJSON: '{}',
    plainText: '',
    isFavorite: false,
    revision: 1,
    ...(projectId ? { projectId } : {}),
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  await db.open()
  await clearAllData()
})

describe('database integrity scan', () => {
  it('accepts valid references and completed historical project snapshots', async () => {
    await addProject('project-valid')
    await db.tasks.put({
      id: 'task-valid',
      projectId: 'project-valid',
      title: 'Task',
      status: 'todo',
      priority: 'medium',
      order: 0,
      createdAt: now,
      updatedAt: now,
    })
    await addNote('note-valid', 'project-valid')
    await db.attachments.put({
      id: 'attachment-valid',
      filename: 'reference.txt',
      mimeType: 'text/plain',
      size: 0,
      blob: new Blob([], { type: 'text/plain' }),
      createdAt: now,
    })
    await db.resources.put({
      id: 'resource-valid',
      type: 'file',
      title: 'Reference',
      attachmentId: 'attachment-valid',
      projectId: 'project-valid',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.sessions.bulkPut([
      {
        id: 'session-valid',
        projectId: 'project-valid',
        taskId: 'task-valid',
        scheduledBlockId: 'calendar-valid',
        title: 'Valid session',
        objective: '',
        status: 'completed',
        startedAt: now,
        endedAt: now,
        lastResumedAt: now,
        accumulatedDurationMs: 0,
        accomplishments: '',
        blockers: '',
        nextStep: '',
        outcome: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'session-historical',
        projectId: 'deleted-project',
        projectSnapshot: { id: 'deleted-project', name: 'Historical', identifier: 'ALT-OLD' },
        title: 'Historical session',
        objective: '',
        status: 'completed',
        startedAt: now,
        endedAt: now,
        lastResumedAt: now,
        accumulatedDurationMs: 0,
        accomplishments: '',
        blockers: '',
        nextStep: '',
        outcome: '',
        createdAt: now,
        updatedAt: now,
      },
    ])
    await db.activities.put({
      id: 'activity-valid',
      projectId: 'project-valid',
      taskId: 'task-valid',
      type: 'task_created',
      description: 'Task created',
      createdAt: now,
    })
    await db.scheduledWorkBlocks.put({
      id: 'calendar-valid', title: 'Valid block', projectId: 'project-valid', taskId: 'task-valid',
      scheduledStart: new Date(now.getTime() + 60_000), scheduledEnd: new Date(now.getTime() + 3_600_000), status: 'planned', createdAt: now, updatedAt: now,
    })
    await db.tags.put({ id: 'tag-valid', name: 'Valid', normalizedName: 'valid', color: '#fff', createdAt: now })
    await db.tagAssignments.put({ id: 'assignment-valid', tagId: 'tag-valid', entityType: 'note', entityId: 'note-valid' })
    await db.entityLinks.put({
      id: 'link-valid',
      sourceType: 'note',
      sourceId: 'note-valid',
      targetType: 'resource',
      targetId: 'resource-valid',
      createdAt: now,
    })

    expect(await inspectDatabaseIntegrity()).toEqual([])
  })

  it('reports orphan references without mutating data', async () => {
    await db.tasks.put({
      id: 'task-orphan',
      projectId: 'missing-project',
      title: 'Orphan',
      status: 'todo',
      priority: 'medium',
      order: 0,
      createdAt: now,
      updatedAt: now,
    })
    await db.activities.put({
      id: 'activity-orphan',
      projectId: 'missing-project',
      taskId: 'missing-task',
      type: 'task_created',
      description: 'Broken references',
      createdAt: now,
    })
    await db.scheduledWorkBlocks.put({
      id: 'calendar-orphan', title: 'Broken block', projectId: 'missing-project', taskId: 'missing-task',
      scheduledStart: new Date(now.getTime() + 60_000), scheduledEnd: now, status: 'planned', createdAt: now, updatedAt: now,
    })
    await db.sessions.put({
      id: 'session-orphan',
      projectId: 'missing-project',
      taskId: 'missing-task',
      scheduledBlockId: 'missing-calendar-block',
      title: 'Orphan',
      objective: '',
      status: 'running',
      startedAt: now,
      lastResumedAt: now,
      accumulatedDurationMs: 0,
      accomplishments: '',
      blockers: '',
      nextStep: '',
      outcome: '',
      createdAt: now,
      updatedAt: now,
    })
    await addNote('note-orphan', 'missing-project')
    await db.resources.put({
      id: 'resource-orphan',
      type: 'file',
      title: 'Orphan attachment',
      attachmentId: 'missing-attachment',
      projectId: 'missing-project',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.tagAssignments.put({ id: 'assignment-orphan', tagId: 'missing-tag', entityType: 'note', entityId: 'missing-note' })
    await db.entityLinks.put({
      id: 'link-orphan',
      sourceType: 'note',
      sourceId: 'missing-note',
      targetType: 'project',
      targetId: 'missing-project',
      createdAt: now,
    })
    const before = await Promise.all(db.tables.map(table => table.toArray()))

    const issues = await inspectDatabaseIntegrity()
    const codes = new Set(issues.map(issue => issue.code))

    expect([...codes]).toEqual(expect.arrayContaining([
      'task.project.missing',
      'activity.project.missing',
      'activity.task.missing',
      'calendar_block.project.missing',
      'calendar_block.task.missing',
      'calendar_block.interval.invalid',
      'session.project.missing',
      'session.task.missing',
      'session.calendar_block.missing',
      'note.project.missing',
      'resource.project.missing',
      'resource.attachment.missing',
      'tag_assignment.tag.missing',
      'tag_assignment.entity.missing',
      'entity_link.source.missing',
      'entity_link.target.missing',
    ]))
    expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before)
  })
})
