import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AlteraDB, clearAllData, createProject, createTask, db, deleteProject, deleteTask, updateTask } from '@/db/db'
import { createScheduledWorkBlock, deleteScheduledWorkBlock, getScheduledWorkBlocksInRange, updateScheduledWorkBlock } from '@/db/calendar'
import { startSession, completeSession, getSessionsByScheduledBlock } from '@/db/sessions'
import { addCalendarDays, getCalendarRange, localDateTimeAfterMinutes, parseLocalDateTime, startOfLocaleWeek } from '@/lib/calendarDates'
import { layoutOverlappingBlocks } from '@/lib/calendarLayout'
import type { ScheduledWorkBlock } from '@/types/calendar'

const projectInput = (name: string) => ({
  name, description: '', status: 'active' as const, priority: 'medium' as const,
  color: '#71805d', icon: 'A', nextAction: '',
})

const blockInput = (start: Date, end: Date, extras: Partial<Parameters<typeof createScheduledWorkBlock>[0]> = {}) => ({
  title: 'Focus block', scheduledStart: start, scheduledEnd: end, ...extras,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await clearAllData()
})

describe('scheduled work blocks', () => {
  it('creates, updates, queries intersecting ranges, and deletes blocks', async () => {
    const start = new Date(2026, 4, 12, 9)
    const spanning = await createScheduledWorkBlock(blockInput(new Date(2026, 4, 12, 8), new Date(2026, 4, 12, 10)))
    await createScheduledWorkBlock(blockInput(new Date(2026, 4, 12, 11), new Date(2026, 4, 12, 12), { title: 'Later' }))
    const rows = await getScheduledWorkBlocksInRange(start, new Date(2026, 4, 12, 11))
    expect(rows.map(item => item.id)).toEqual([spanning.id])

    const updated = await updateScheduledWorkBlock(spanning.id, { title: 'Updated' })
    expect(updated.title).toBe('Updated')
    await deleteScheduledWorkBlock(spanning.id)
    expect(await db.scheduledWorkBlocks.get(spanning.id)).toBeUndefined()
  })

  it('rejects blank titles, invalid intervals, and broken task/project links', async () => {
    const project = await createProject(projectInput('Calendar validation'))
    const task = await createTask({ projectId: project.id, title: 'Existing task', status: 'todo', priority: 'medium' })
    const start = new Date(2026, 5, 1, 9)
    await expect(createScheduledWorkBlock(blockInput(start, new Date(start.getTime() + 60_000), { title: '  ' }))).rejects.toMatchObject({ code: 'WORK_BLOCK_INVALID_INPUT' })
    await expect(createScheduledWorkBlock(blockInput(start, start))).rejects.toMatchObject({ code: 'WORK_BLOCK_INVALID_INPUT' })
    await expect(createScheduledWorkBlock(blockInput(start, new Date(start.getTime() + 60_000), { taskId: task.id, projectId: 'missing' }))).rejects.toMatchObject({ code: 'TASK_PROJECT_MISMATCH' })
  })

  it('keeps blocks and clears references to deleted tasks and projects', async () => {
    const project = await createProject(projectInput('Calendar detach'))
    const task = await createTask({ projectId: project.id, title: 'Delete me', status: 'todo', priority: 'medium' })
    const block = await createScheduledWorkBlock(blockInput(new Date(2026, 6, 1, 9), new Date(2026, 6, 1, 10), { projectId: project.id, taskId: task.id }))

    await deleteTask(task.id)
    expect(await db.scheduledWorkBlocks.get(block.id)).toMatchObject({ id: block.id, projectId: project.id })
    expect((await db.scheduledWorkBlocks.get(block.id))?.taskId).toBeUndefined()

    const task2 = await createTask({ projectId: project.id, title: 'Delete with project', status: 'todo', priority: 'low' })
    await updateScheduledWorkBlock(block.id, { taskId: task2.id })
    await deleteProject(project.id)
    const preserved = await db.scheduledWorkBlocks.get(block.id)
    expect(preserved).toMatchObject({ id: block.id, title: 'Focus block', scheduledStart: block.scheduledStart, scheduledEnd: block.scheduledEnd })
    expect(preserved?.projectId).toBeUndefined()
    expect(preserved?.taskId).toBeUndefined()
  })

  it('links actual work sessions to a block and detaches the link when that block is deleted', async () => {
    const project = await createProject(projectInput('Linked focus'))
    const task = await createTask({ projectId: project.id, title: 'Linked task', status: 'todo', priority: 'high' })
    const block = await createScheduledWorkBlock(blockInput(new Date(2026, 6, 1, 9), new Date(2026, 6, 1, 10), { projectId: project.id, taskId: task.id }))
    const session = await startSession(project.id, { taskId: task.id, scheduledBlockId: block.id })
    await completeSession(session.id)
    const secondSession = await startSession(project.id, { taskId: task.id, scheduledBlockId: block.id })

    expect(new Set((await getSessionsByScheduledBlock(block.id)).map(item => item.id))).toEqual(new Set([session.id, secondSession.id]))
    await deleteScheduledWorkBlock(block.id)
    expect((await db.sessions.get(session.id))?.scheduledBlockId).toBeUndefined()
    expect(await db.sessions.get(session.id)).toMatchObject({ id: session.id, projectId: project.id, taskId: task.id })
    expect((await db.sessions.get(secondSession.id))?.scheduledBlockId).toBeUndefined()
  })

  it('rejects linking a session to another project block', async () => {
    const first = await createProject(projectInput('First project'))
    const second = await createProject(projectInput('Second project'))
    const block = await createScheduledWorkBlock(blockInput(new Date(2026, 6, 2, 9), new Date(2026, 6, 2, 10), { projectId: first.id }))
    await expect(startSession(second.id, { scheduledBlockId: block.id })).rejects.toMatchObject({ code: 'WORK_BLOCK_PROJECT_MISMATCH' })
  })

  it('only starts sessions from planned blocks', async () => {
    const project = await createProject(projectInput('Planned block guard'))
    const block = await createScheduledWorkBlock(blockInput(new Date(2026, 6, 3, 9), new Date(2026, 6, 3, 10), { projectId: project.id }))

    await updateScheduledWorkBlock(block.id, { status: 'completed' })
    await expect(startSession(project.id, { scheduledBlockId: block.id })).rejects.toMatchObject({ code: 'WORK_BLOCK_NOT_PLANNED' })

    await updateScheduledWorkBlock(block.id, { status: 'cancelled' })
    await expect(startSession(project.id, { scheduledBlockId: block.id })).rejects.toMatchObject({ code: 'WORK_BLOCK_NOT_PLANNED' })
  })

  it('persists and clears task deadlines through the task update path', async () => {
    const project = await createProject(projectInput('Deadline editing'))
    const task = await createTask({ projectId: project.id, title: 'Task with editable due date', status: 'todo', priority: 'medium' })
    const dueDate = new Date(2026, 6, 4, 12)

    await updateTask(task.id, { dueDate })
    expect((await db.tasks.get(task.id))?.dueDate).toEqual(dueDate)

    await updateTask(task.id, { dueDate: undefined })
    expect((await db.tasks.get(task.id))?.dueDate).toBeUndefined()
  })

  it('positions overlapping events in separate lanes', () => {
    const day = new Date(2026, 7, 1)
    const make = (id: string, from: number, to: number): ScheduledWorkBlock => ({
      id, title: id, scheduledStart: new Date(2026, 7, 1, from), scheduledEnd: new Date(2026, 7, 1, to), status: 'planned', createdAt: day, updatedAt: day,
    })
    const result = layoutOverlappingBlocks([make('a', 9, 11), make('b', 10, 12), make('c', 12, 13)], day)
    expect(result[0].width).toBe(50)
    expect(result[1].left).toBe(50)
    expect(result[2].width).toBe(100)
  })
})

describe('local calendar dates and daylight saving transitions', () => {
  it('uses locale week starts and calendar-day arithmetic', () => {
    const wednesday = new Date(2026, 0, 7, 12)
    expect(startOfLocaleWeek(wednesday, 'ru').getDay()).toBe(1)
    expect(startOfLocaleWeek(wednesday, 'en').getDay()).toBe(0)
    expect(getCalendarRange(wednesday, 'month', 'ru').end.getTime() - getCalendarRange(wednesday, 'month', 'ru').start.getTime()).toBeGreaterThan(40 * 24 * 60 * 60 * 1000)
  })

  it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/New_York')('handles spring-forward and fall-back dates in a DST zone', () => {
    const before = new Date(2026, 2, 8)
    const after = addCalendarDays(before, 1)
    expect(after.getDate()).toBe(9)
    expect(after.getHours()).toBe(0)
    expect(after.getTime() - before.getTime()).toBe(23 * 60 * 60 * 1000)
    expect(() => parseLocalDateTime('2026-03-08', '02:30')).toThrow('NONEXISTENT_LOCAL_TIME')
    const fallBackStart = parseLocalDateTime('2026-11-01', '01:00')
    expect(fallBackStart.getHours()).toBe(1)
    expect(localDateTimeAfterMinutes(fallBackStart, 60)).toEqual({ date: '2026-11-01', time: '02:00' })
  })
})

describe('v7 to v10 schema migration', () => {
  it('preserves project/task/session records and adds calendar and session-link indexes', async () => {
    const name = `AlteraCalendarMigration-${Date.now()}`
    // Build an independent v7 database with the released v7 indexes.
    const Dexie = (await import('dexie')).default
    const v7 = new Dexie(name)
    v7.version(7).stores({
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
    await v7.open()
    const now = new Date(2026, 0, 1)
    await v7.table('projects').put({ id: 'p', identifier: 'ALT-001', name: 'Keep', description: '', status: 'active', priority: 'medium', color: '#000', icon: 'A', progress: 0, nextAction: '', createdAt: now, updatedAt: now })
    await v7.table('tasks').put({ id: 't', projectId: 'p', title: 'Keep due date', status: 'todo', priority: 'low', order: 0, dueDate: now, createdAt: now, updatedAt: now })
    await v7.table('sessions').put({ id: 's', projectId: 'p', title: 'Keep session', objective: '', status: 'completed', startedAt: now, endedAt: now, lastResumedAt: now, accumulatedDurationMs: 1200, accomplishments: '', blockers: '', nextStep: '', outcome: '', createdAt: now, updatedAt: now })
    await v7.close()

    const upgraded = new AlteraDB(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(10)
      expect((await upgraded.projects.get('p'))?.name).toBe('Keep')
      expect((await upgraded.tasks.get('t'))?.dueDate).toEqual(now)
      expect((await upgraded.sessions.get('s'))?.title).toBe('Keep session')
      expect(upgraded.tables.map(table => table.name)).toContain('scheduledWorkBlocks')
      expect(upgraded.tables.map(table => table.name)).toContain('workflowTemplates')
      expect(upgraded.tasks.schema.indexes.map(index => index.name)).toContain('dueDate')
      expect(upgraded.sessions.schema.indexes.map(index => index.name)).toContain('scheduledBlockId')
    } finally {
      upgraded.close()
      await upgraded.delete()
    }
  })
})
