import { db, type AlteraDB } from '@/db/db'
import { getScheduledWorkBlocksInRange } from '@/db/calendar'
import type { AnalyticsDateRange, AnalyticsSourceData } from './analytics.types'

/**
 * Reads analytics source records. Session and activity windows use existing
 * IndexedDB indexes; scheduled blocks are a separate planned-time source and
 * are never counted as actual work. Binary attachments are not read.
 */
export async function getAnalyticsSourceData(
  range: AnalyticsDateRange,
  database: AlteraDB = db,
  previousRange?: AnalyticsDateRange
): Promise<AnalyticsSourceData> {
  const queryStart = range.start && previousRange?.start
    ? new Date(Math.min(range.start.getTime(), previousRange.start.getTime()))
    : previousRange?.start ?? range.start
  const sessionQuery = queryStart
    ? database.sessions.where('startedAt').between(queryStart, range.end, true, false)
    : database.sessions.where('startedAt').below(range.end)
  const activityQuery = queryStart
    ? database.activities.where('createdAt').between(queryStart, range.end, true, false)
    : database.activities.where('createdAt').below(range.end)
  const planningQuery = queryStart
    ? getScheduledWorkBlocksInRange(queryStart, range.end, database)
    : database.scheduledWorkBlocks.where('scheduledStart').below(range.end).toArray()

  const [projects, tasks, sessions, activities, scheduledWorkBlocks] = await Promise.all([
    database.projects.toArray(),
    database.tasks.toArray(),
    sessionQuery.toArray(),
    activityQuery.toArray(),
    planningQuery,
  ])

  return { projects, tasks, sessions, activities, scheduledWorkBlocks }
}
