import type { Activity, Project, Session, Task } from '@/types'
import type { ScheduledWorkBlock } from '@/types/calendar'

export type AnalyticsRangeKey = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom'
export type AnalyticsGranularity = 'day' | 'month'

/** Range boundaries are local calendar dates and use [start, endExclusive). */
export interface AnalyticsDateRange {
  key: AnalyticsRangeKey
  start?: Date
  end: Date
  granularity: AnalyticsGranularity
}

export interface AnalyticsSourceData {
  projects: Project[]
  tasks: Task[]
  sessions: Session[]
  activities: Activity[]
  scheduledWorkBlocks: ScheduledWorkBlock[]
}

export interface AnalyticsPeriodBucket {
  key: string
  start: Date
  focusMs: number
  sessionCount: number
  activityCount: number
  taskActivityCount: number
  taskCompletionCount: number
}

export interface ProjectFocusSummary {
  projectId: string
  name: string
  identifier?: string
  color?: string
  status?: Project['status']
  isHistorical: boolean
  focusMs: number
  sessionCount: number
}

export interface ProjectTaskSummary {
  projectId: string
  name: string
  identifier?: string
  status?: Project['status']
  isHistorical: boolean
  total: number
  completed: number
  open: number
  overdue: number
}

export interface ProjectActivitySummary {
  projectId: string
  name: string
  status: Project['status']
  lastActivityAt?: Date
}

export interface AnalyticsMetrics {
  range: AnalyticsDateRange
  focus: {
    totalMs: number
    completedMs: number
    unfinishedMs: number
    completedSessions: number
    unfinishedSessions: number
    averageCompletedMs: number
    excludedSessionCount: number
    overlapConflictCount: number
  }
  focusSeries: AnalyticsPeriodBucket[]
  activitySeries: AnalyticsPeriodBucket[]
  projects: {
    active: number
    completed: number
    archived: number
    focus: ProjectFocusSummary[]
    tasks: ProjectTaskSummary[]
    activity: ProjectActivitySummary[]
    withoutActivity: ProjectActivitySummary[]
  }
  tasks: {
    total: number
    completed: number
    completedInRange: number
    completedWithoutTimestamp: number
    open: number
    overdue: number
    completionPercent: number | null
    byStatus: Record<Task['status'], number>
    byPriority: Record<Task['priority'], number>
  }
}
