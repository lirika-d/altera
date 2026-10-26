import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getScheduledWorkBlocksInRange } from '@/db/calendar'
import { addCalendarDays } from '@/lib/calendarDates'
import { sumPlannedDuration } from '@/lib/planner'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Task } from '@/types'

export interface ProjectCalendarSummary {
  blocks: ScheduledWorkBlock[]
  deadlines: Task[]
  plannedDurationMs: number
}

const EMPTY_SUMMARY: ProjectCalendarSummary = { blocks: [], deadlines: [], plannedDurationMs: 0 }

/** Upcoming, project-scoped calendar data only; past calendar history is not loaded. */
export function useProjectCalendar(projectId: string | undefined): ProjectCalendarSummary {
  return useLiveQuery(async () => {
    if (!projectId) return EMPTY_SUMMARY
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = addCalendarDays(start, 90)
    const [blocks, projectTasks] = await Promise.all([
      getScheduledWorkBlocksInRange(start, end)
        .then(blocks => blocks.filter(block => block.projectId === projectId && block.status === 'planned')),
      db.tasks.where('projectId').equals(projectId).toArray(),
    ])
    const deadlines = projectTasks.filter(task => task.dueDate && task.dueDate < end && task.status !== 'done' && task.status !== 'cancelled')
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    blocks.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
    return { blocks, deadlines, plannedDurationMs: sumPlannedDuration(blocks) }
  }, [projectId]) ?? EMPTY_SUMMARY
}
