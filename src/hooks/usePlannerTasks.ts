import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getScheduledWorkBlocksInRange } from '@/db/calendar'
import { addCalendarDays } from '@/lib/calendarDates'
import type { PlannerTask } from '@/lib/planner'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Session } from '@/types'

export interface PlannerTasksData {
  tasks: PlannerTask[]
  scheduledTaskIds: Set<string>
  todayTaskIds: Set<string>
  todayBlocks: ScheduledWorkBlock[]
  todaySessions: Session[]
}

const EMPTY_PLANNER_TASKS: PlannerTasksData = {
  tasks: [],
  scheduledTaskIds: new Set(),
  todayTaskIds: new Set(),
  todayBlocks: [],
  todaySessions: [],
}

/** Reads only open tasks plus indexed work blocks attached to those tasks. */
export function usePlannerTasks(today: Date, now: Date): PlannerTasksData {
  const todayStartMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const tomorrowMs = addCalendarDays(new Date(todayStartMs), 1).getTime()
  const nowMs = now.getTime()

  return useLiveQuery(async () => {
    const [allTasks, projects] = await Promise.all([
      db.tasks.where('status').anyOf('todo', 'in_progress').toArray(),
      db.projects.toArray(),
    ])
    const schedulableProjectIds = new Set(projects.filter(project => project.status !== 'archived' && project.status !== 'completed').map(project => project.id))
    const tasks = allTasks.filter(task => schedulableProjectIds.has(task.projectId))
    const taskIds = tasks.map(task => task.id)
    if (!taskIds.length) {
      const todayBlocks = await getScheduledWorkBlocksInRange(new Date(todayStartMs), new Date(tomorrowMs))
      const todaySessions = todayBlocks.length
        ? await db.sessions.where('scheduledBlockId').anyOf(todayBlocks.map(block => block.id)).toArray()
        : []
      return { ...EMPTY_PLANNER_TASKS, todayBlocks, todaySessions }
    }

    const [attachedBlocks, todayBlocks] = await Promise.all([
      db.scheduledWorkBlocks.where('taskId').anyOf(taskIds)
        .filter(block => block.status === 'planned' && block.scheduledEnd.getTime() > nowMs)
        .toArray(),
      getScheduledWorkBlocksInRange(new Date(todayStartMs), new Date(tomorrowMs)),
    ])
    const todaySessions = todayBlocks.length
      ? await db.sessions.where('scheduledBlockId').anyOf(todayBlocks.map(block => block.id)).toArray()
      : []
    const projectById = new Map(projects.map(project => [project.id, project]))
    return {
      tasks: tasks.map(task => ({ ...task, project: projectById.get(task.projectId) })),
      scheduledTaskIds: new Set(attachedBlocks.flatMap(block => block.taskId ? [block.taskId] : [])),
      todayTaskIds: new Set(todayBlocks.flatMap(block => block.status === 'planned' && block.taskId ? [block.taskId] : [])),
      todayBlocks,
      todaySessions,
    }
  }, [todayStartMs, tomorrowMs, nowMs]) ?? EMPTY_PLANNER_TASKS
}
