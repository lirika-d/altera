import { db, generateId } from './db'
import type { AlteraDB } from './db'
import type { ScheduledWorkBlock, ScheduledWorkBlockInput, ScheduledWorkBlockUpdate, WorkBlockStatus } from '@/types/calendar'
import { isValidDate } from '@/lib/calendarDates'

export type WorkBlockErrorCode =
  | 'WORK_BLOCK_NOT_FOUND'
  | 'WORK_BLOCK_INVALID_INPUT'
  | 'PROJECT_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'TASK_PROJECT_MISMATCH'

export class WorkBlockError extends Error {
  readonly code: WorkBlockErrorCode

  constructor(message: string, code: WorkBlockErrorCode) {
    super(message)
    this.name = 'WorkBlockError'
    this.code = code
  }
}

const statuses: WorkBlockStatus[] = ['planned', 'completed', 'cancelled']

function validationError(message: string): never {
  throw new WorkBlockError(message, 'WORK_BLOCK_INVALID_INPUT')
}

type ValidatedWorkBlockInput = Omit<ScheduledWorkBlockInput, 'status'> & { status: WorkBlockStatus }

async function validateInput(input: ScheduledWorkBlockInput, database: AlteraDB): Promise<ValidatedWorkBlockInput> {
  const title = input.title.trim()
  if (!title) validationError('WORK_BLOCK_TITLE_REQUIRED')
  if (!isValidDate(input.scheduledStart) || !isValidDate(input.scheduledEnd)) validationError('WORK_BLOCK_INVALID_DATE')
  if (input.scheduledEnd.getTime() <= input.scheduledStart.getTime()) validationError('WORK_BLOCK_INVALID_DURATION')
  const status = input.status ?? 'planned'
  if (!statuses.includes(status)) validationError('WORK_BLOCK_INVALID_STATUS')

  let projectId = input.projectId?.trim() || undefined
  const taskId = input.taskId?.trim() || undefined
  if (taskId) {
    const task = await database.tasks.get(taskId)
    if (!task) throw new WorkBlockError('TASK_NOT_FOUND', 'TASK_NOT_FOUND')
    if (projectId && task.projectId !== projectId) {
      throw new WorkBlockError('TASK_PROJECT_MISMATCH', 'TASK_PROJECT_MISMATCH')
    }
    projectId ??= task.projectId
  }
  if (projectId && !(await database.projects.get(projectId))) {
    throw new WorkBlockError('PROJECT_NOT_FOUND', 'PROJECT_NOT_FOUND')
  }

  return {
    title,
    description: input.description?.trim() || undefined,
    projectId,
    taskId,
    scheduledStart: new Date(input.scheduledStart),
    scheduledEnd: new Date(input.scheduledEnd),
    status,
  }
}

function validateRange(start: Date, end: Date): void {
  if (!isValidDate(start) || !isValidDate(end) || start.getTime() >= end.getTime()) {
    validationError('WORK_BLOCK_INVALID_RANGE')
  }
}

export async function createScheduledWorkBlock(
  input: ScheduledWorkBlockInput,
  database: AlteraDB = db
): Promise<ScheduledWorkBlock> {
  return database.transaction('rw', database.projects, database.tasks, database.scheduledWorkBlocks, async () => {
    const valid = await validateInput(input, database)
    const now = new Date()
    const block: ScheduledWorkBlock = { ...valid, id: generateId(), createdAt: now, updatedAt: now }
    await database.scheduledWorkBlocks.add(block)
    return block
  })
}

export async function updateScheduledWorkBlock(
  id: string,
  updates: ScheduledWorkBlockUpdate,
  database: AlteraDB = db
): Promise<ScheduledWorkBlock> {
  return database.transaction('rw', database.projects, database.tasks, database.scheduledWorkBlocks, async () => {
    const existing = await database.scheduledWorkBlocks.get(id)
    if (!existing) throw new WorkBlockError('WORK_BLOCK_NOT_FOUND', 'WORK_BLOCK_NOT_FOUND')
    const valid = await validateInput({ ...existing, ...updates }, database)
    const updated: ScheduledWorkBlock = { ...existing, ...valid, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date() }
    await database.scheduledWorkBlocks.put(updated)
    return updated
  })
}

export async function deleteScheduledWorkBlock(id: string, database: AlteraDB = db): Promise<void> {
  await database.transaction('rw', database.scheduledWorkBlocks, database.sessions, async () => {
    const existing = await database.scheduledWorkBlocks.get(id)
    if (!existing) throw new WorkBlockError('WORK_BLOCK_NOT_FOUND', 'WORK_BLOCK_NOT_FOUND')
    await database.scheduledWorkBlocks.delete(id)
    await database.sessions.where('scheduledBlockId').equals(id).modify(session => {
      delete session.scheduledBlockId
      session.updatedAt = new Date()
    })
  })
}

export async function getScheduledWorkBlockById(id: string, database: AlteraDB = db): Promise<ScheduledWorkBlock | undefined> {
  return database.scheduledWorkBlocks.get(id)
}

/** Returns blocks intersecting [start, end), including blocks that begin earlier and continue into the range. */
export async function getScheduledWorkBlocksInRange(
  start: Date,
  end: Date,
  database: AlteraDB = db
): Promise<ScheduledWorkBlock[]> {
  validateRange(start, end)
  const [startingInRange, endingAfterStart] = await Promise.all([
    database.scheduledWorkBlocks.where('scheduledStart').between(start, end, true, false).toArray(),
    database.scheduledWorkBlocks.where('scheduledEnd').above(start).filter(block => block.scheduledStart < start).toArray(),
  ])
  const unique = new Map([...startingInRange, ...endingAfterStart].map(block => [block.id, block]))
  return [...unique.values()].filter(block => block.scheduledEnd > start && block.scheduledStart < end)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
}

export async function getScheduledWorkBlocksByProject(projectId: string, database: AlteraDB = db): Promise<ScheduledWorkBlock[]> {
  return database.scheduledWorkBlocks.where('projectId').equals(projectId).sortBy('scheduledStart')
}

export async function getScheduledWorkBlocksByTask(taskId: string, database: AlteraDB = db): Promise<ScheduledWorkBlock[]> {
  return database.scheduledWorkBlocks.where('taskId').equals(taskId).sortBy('scheduledStart')
}
