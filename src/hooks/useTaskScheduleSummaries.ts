import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Task } from '@/types'

export interface TaskScheduleSummary {
  count: number
  nextBlock?: ScheduledWorkBlock
}

const EMPTY_SUMMARIES: Record<string, TaskScheduleSummary> = {}

/** Batch-loads upcoming block counts/next times for the currently rendered task rows. */
export function useTaskScheduleSummaries(tasks: Task[]): Record<string, TaskScheduleSummary> {
  const taskIds = tasks.map(task => task.id).sort()
  const taskIdsKey = taskIds.join('\u0000')
  const now = useMinuteNow()
  const nowMs = now.getTime()
  return useLiveQuery(async () => {
    if (!taskIds.length) return EMPTY_SUMMARIES
    const blocks = await db.scheduledWorkBlocks.where('taskId').anyOf(taskIds)
      .filter(block => block.status === 'planned' && block.scheduledEnd.getTime() > nowMs)
      .toArray()
    const grouped: Record<string, ScheduledWorkBlock[]> = {}
    for (const block of blocks) {
      if (!block.taskId) continue
      ;(grouped[block.taskId] ??= []).push(block)
    }
    return Object.fromEntries(Object.entries(grouped).map(([taskId, taskBlocks]) => {
      taskBlocks.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
      return [taskId, { count: taskBlocks.length, nextBlock: taskBlocks[0] }]
    }))
  }, [taskIdsKey, nowMs]) ?? EMPTY_SUMMARIES
}
