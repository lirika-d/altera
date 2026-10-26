import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getScheduledWorkBlocksInRange } from '@/db/calendar'
import type { Project, Session, Task } from '@/types'
import type { ScheduledWorkBlock } from '@/types/calendar'

export interface CalendarData {
  blocks: ScheduledWorkBlock[]
  deadlines: Task[]
  projects: Project[]
  tasksById: Map<string, Task>
  sessionsByBlockId: Map<string, Session[]>
}

const EMPTY_CALENDAR_DATA: CalendarData = {
  blocks: [],
  deadlines: [],
  projects: [],
  tasksById: new Map(),
  sessionsByBlockId: new Map(),
}

/** Loads only scheduled blocks and due tasks intersecting the visible date range. */
export function useCalendarData(start: Date, end: Date, enabled = true): CalendarData {
  const startMs = start.getTime()
  const endMs = end.getTime()

  return useLiveQuery(async () => {
    if (!enabled) return EMPTY_CALENDAR_DATA
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) return EMPTY_CALENDAR_DATA
    const rangeStart = new Date(startMs)
    const rangeEnd = new Date(endMs)
    const [blocks, deadlines] = await Promise.all([
      getScheduledWorkBlocksInRange(rangeStart, rangeEnd),
      db.tasks.where('dueDate').between(rangeStart, rangeEnd, true, false).toArray(),
    ])
    const sessions = blocks.length
      ? await db.sessions.where('scheduledBlockId').anyOf(blocks.map(block => block.id)).toArray()
      : []
    const taskIds = new Set([...deadlines.map(task => task.id), ...blocks.flatMap(block => block.taskId ? [block.taskId] : [])])
    const tasks = (await db.tasks.bulkGet([...taskIds])).filter((task): task is Task => Boolean(task))
    const projectIds = new Set([
      ...blocks.flatMap(block => block.projectId ? [block.projectId] : []),
      ...tasks.map(task => task.projectId),
    ])
    const projects = (await db.projects.bulkGet([...projectIds])).filter((project): project is Project => Boolean(project))
    return {
      blocks,
      deadlines: deadlines.sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()),
      projects,
      tasksById: new Map(tasks.map(task => [task.id, task])),
      sessionsByBlockId: new Map(sessions.reduce((grouped, session) => {
        const blockId = session.scheduledBlockId
        if (!blockId) return grouped
        const current = grouped.get(blockId) ?? []
        current.push(session)
        grouped.set(blockId, current)
        return grouped
      }, new Map<string, Session[]>())),
    }
  }, [startMs, endMs, enabled]) ?? EMPTY_CALENDAR_DATA
}
