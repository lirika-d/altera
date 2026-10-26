import { computeElapsedMs } from '@/db/sessions'
import { addCalendarDays, startOfLocalDay } from '@/lib/calendarDates'
import type { Activity, Project, Session, Task } from '@/types'
import type {
  AnalyticsDateRange,
  AnalyticsMetrics,
  AnalyticsPeriodBucket,
  AnalyticsSourceData,
  ProjectFocusSummary,
  ProjectTaskSummary,
} from './analytics.types'
import { dateTimestamp, getAnalyticsPeriodKey, isWithinAnalyticsRange, saturatingAdd } from './analytics.utils'

interface NormalizedSession {
  session: Session
  startMs: number
  wallEndMs: number
  durationMs: number
}

const SESSION_STATUSES = new Set<Session['status']>(['running', 'paused', 'completed'])
const SESSION_ACTIVITY_TYPES = new Set<Activity['type']>(['session_started', 'session_completed'])

function normalizeSession(session: Session, nowMs: number): NormalizedSession | undefined {
  const startMs = dateTimestamp(session.startedAt)
  const rawDuration = session.accumulatedDurationMs
  if (
    startMs === undefined || startMs > nowMs || !SESSION_STATUSES.has(session.status)
    || !Number.isFinite(rawDuration) || rawDuration < 0
  ) return undefined

  if (session.status === 'running') {
    const resumedAt = dateTimestamp(session.lastResumedAt)
    if (resumedAt === undefined || resumedAt < startMs || resumedAt > nowMs) return undefined
  }

  const wallEndMs = session.status === 'completed'
    ? dateTimestamp(session.endedAt)
    : nowMs
  if (wallEndMs === undefined || wallEndMs < startMs || wallEndMs > nowMs) return undefined

  const durationMs = computeElapsedMs(session, nowMs)
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > wallEndMs - startMs) return undefined
  return { session, startMs, wallEndMs, durationMs }
}

function excludeOverlappingSessions(sessions: NormalizedSession[]): Set<string> {
  const ordered = [...sessions].sort((a, b) => a.startMs - b.startMs || a.wallEndMs - b.wallEndMs)
  const conflicts = new Set<string>()
  let latestEnd = Number.NEGATIVE_INFINITY
  let latestEndId: string | undefined

  for (const entry of ordered) {
    if (entry.startMs < latestEnd && latestEndId) {
      conflicts.add(entry.session.id)
      conflicts.add(latestEndId)
    }
    if (entry.wallEndMs > latestEnd) {
      latestEnd = entry.wallEndMs
      latestEndId = entry.session.id
    }
  }
  return conflicts
}

/** IDs used by charts and project timelines; shares validation and overlap rules with totals. */
export function getAnalyticsCountedSessionIds(sessions: Session[], range: AnalyticsDateRange, now: Date): Set<string> {
  const seen = new Set<string>()
  const normalized: NormalizedSession[] = []
  for (const session of sessions) {
    if (seen.has(session.id)) continue
    seen.add(session.id)
    const entry = normalizeSession(session, now.getTime())
    if (entry && isWithinAnalyticsRange(entry.startMs, range)) normalized.push(entry)
  }
  const conflicts = excludeOverlappingSessions(normalized)
  return new Set(normalized.filter(entry => !conflicts.has(entry.session.id)).map(entry => entry.session.id))
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthAfter(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function createPeriodStarts(
  range: AnalyticsDateRange,
  observedTimes: number[],
  now: Date
): Date[] {
  if (range.granularity === 'day' && range.start) {
    const days: Date[] = []
    for (let day = startOfLocalDay(range.start); day < range.end; day = addCalendarDays(day, 1)) {
      days.push(day)
    }
    return days
  }

  if (range.granularity !== 'month') return []
  const earliest = observedTimes.length
    ? Math.min(...observedTimes)
    : now.getTime()
  const firstMonth = monthStart(new Date(earliest))
  const currentMonth = monthStart(now)
  const months: Date[] = []
  for (let month = firstMonth; month <= currentMonth; month = monthAfter(month)) months.push(month)
  return months
}

function makeSeries(
  range: AnalyticsDateRange,
  sessions: NormalizedSession[],
  activities: Activity[],
  now: Date
): AnalyticsPeriodBucket[] {
  const activityEvents = activities.filter(activity => !SESSION_ACTIVITY_TYPES.has(activity.type))
  const observed = [
    ...sessions.map(entry => entry.startMs),
    ...activityEvents.flatMap(activity => {
      const timestamp = dateTimestamp(activity.createdAt)
      return timestamp === undefined ? [] : [timestamp]
    }),
  ]
  const periods = createPeriodStarts(range, observed, now)
  const byKey = new Map<string, AnalyticsPeriodBucket>()

  for (const start of periods) {
    const key = getAnalyticsPeriodKey(start, range.granularity)
    byKey.set(key, { key, start, focusMs: 0, sessionCount: 0, activityCount: 0, taskActivityCount: 0, taskCompletionCount: 0 })
  }

  for (const entry of sessions) {
    const key = getAnalyticsPeriodKey(new Date(entry.startMs), range.granularity)
    const bucket = byKey.get(key)
    if (!bucket) continue
    bucket.focusMs = saturatingAdd(bucket.focusMs, entry.durationMs)
    bucket.sessionCount++
    bucket.activityCount++
  }

  for (const activity of activityEvents) {
    const timestamp = dateTimestamp(activity.createdAt)
    if (timestamp === undefined || timestamp > now.getTime()) continue
    const key = getAnalyticsPeriodKey(new Date(timestamp), range.granularity)
    const bucket = byKey.get(key)
    if (!bucket) continue
    bucket.activityCount++
    if (activity.type.startsWith('task_')) bucket.taskActivityCount++
    if (activity.type === 'task_completed') bucket.taskCompletionCount++
  }

  return [...byKey.values()]
}

function isOpenTask(task: Task): boolean {
  return task.status === 'todo' || task.status === 'in_progress'
}

function getLastSessionActivity(entry: NormalizedSession, nowMs: number): number {
  if (entry.session.status === 'completed') {
    return dateTimestamp(entry.session.endedAt) ?? entry.startMs
  }
  if (entry.session.status === 'running') return nowMs
  return dateTimestamp(entry.session.lastResumedAt) ?? entry.startMs
}

function buildProjectFocus(
  sessions: NormalizedSession[],
  projectsById: Map<string, Project>
): ProjectFocusSummary[] {
  const totals = new Map<string, { focusMs: number; sessionCount: number }>()
  for (const entry of sessions) {
    const current = totals.get(entry.session.projectId) ?? { focusMs: 0, sessionCount: 0 }
    current.focusMs = saturatingAdd(current.focusMs, entry.durationMs)
    current.sessionCount++
    totals.set(entry.session.projectId, current)
  }

  return [...totals].map(([projectId, total]) => {
    const project = projectsById.get(projectId)
    const snapshot = project ? undefined : sessions.find(entry => entry.session.projectId === projectId)?.session.projectSnapshot
    const matchesSnapshot = snapshot?.id === projectId
    return {
      projectId,
      name: project?.name ?? (matchesSnapshot ? snapshot.name : ''),
      identifier: project?.identifier ?? (matchesSnapshot ? snapshot.identifier : undefined),
      color: project?.color,
      status: project?.status,
      isHistorical: !project,
      ...total,
    }
  }).sort((a, b) => b.focusMs - a.focusMs || a.name.localeCompare(b.name))
}

function buildProjectTasks(tasks: Task[], projectsById: Map<string, Project>, today: Date): ProjectTaskSummary[] {
  const todayStart = startOfLocalDay(today).getTime()
  const totals = new Map<string, ProjectTaskSummary>()
  for (const task of tasks) {
    let summary = totals.get(task.projectId)
    if (!summary) {
      const project = projectsById.get(task.projectId)
      summary = {
        projectId: task.projectId,
        name: project?.name ?? '',
        identifier: project?.identifier,
        status: project?.status,
        isHistorical: !project,
        total: 0,
        completed: 0,
        open: 0,
        overdue: 0,
      }
      totals.set(task.projectId, summary)
    }
    summary.total++
    if (task.status === 'done') summary.completed++
    if (isOpenTask(task)) {
      summary.open++
      const dueDate = dateTimestamp(task.dueDate)
      if (dueDate !== undefined && dueDate < todayStart) summary.overdue++
    }
  }
  return [...totals.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
}

function taskScopedActivity(
  activities: Activity[],
  tasksById: Map<string, Task>,
  selectedProjectId: string | undefined,
  range: AnalyticsDateRange,
  nowMs: number
): Activity[] {
  return activities.filter(activity => {
    if (SESSION_ACTIVITY_TYPES.has(activity.type)) return false
    const timestamp = dateTimestamp(activity.createdAt)
    if (timestamp === undefined || timestamp > nowMs || !isWithinAnalyticsRange(timestamp, range)) return false
    if (!selectedProjectId) return true
    const projectId = activity.projectId ?? (activity.taskId ? tasksById.get(activity.taskId)?.projectId : undefined)
    return projectId === selectedProjectId
  })
}

export function calculateAnalyticsMetrics(
  source: AnalyticsSourceData,
  range: AnalyticsDateRange,
  selectedProjectId: string | undefined,
  now: Date
): AnalyticsMetrics {
  const nowMs = now.getTime()
  const projectList = selectedProjectId
    ? source.projects.filter(project => project.id === selectedProjectId)
    : source.projects
  const tasksById = new Map(source.tasks.map(task => [task.id, task]))
  const tasks = source.tasks.filter(task => !selectedProjectId || task.projectId === selectedProjectId)

  const seenSessionIds = new Set<string>()
  const uniqueSessions: Session[] = []
  let invalidSessionCount = 0
  for (const session of source.sessions) {
    if (seenSessionIds.has(session.id)) {
      invalidSessionCount++
      continue
    }
    seenSessionIds.add(session.id)
    uniqueSessions.push(session)
  }

  const normalizedInRange: NormalizedSession[] = []
  for (const session of uniqueSessions) {
    const normalized = normalizeSession(session, nowMs)
    if (!normalized) {
      invalidSessionCount++
      continue
    }
    if (isWithinAnalyticsRange(normalized.startMs, range)) normalizedInRange.push(normalized)
  }

  const overlapIds = excludeOverlappingSessions(normalizedInRange)
  const validSessions = normalizedInRange.filter(entry => !overlapIds.has(entry.session.id))
  const selectedSessions = validSessions.filter(entry => !selectedProjectId || entry.session.projectId === selectedProjectId)
  const relevantActivities = taskScopedActivity(source.activities, tasksById, selectedProjectId, range, nowMs)

  let totalMs = 0
  let completedMs = 0
  let unfinishedMs = 0
  let completedSessions = 0
  let unfinishedSessions = 0
  for (const entry of selectedSessions) {
    totalMs = saturatingAdd(totalMs, entry.durationMs)
    if (entry.session.status === 'completed') {
      completedSessions++
      completedMs = saturatingAdd(completedMs, entry.durationMs)
    } else {
      unfinishedSessions++
      unfinishedMs = saturatingAdd(unfinishedMs, entry.durationMs)
    }
  }

  const focusSeries = makeSeries(range, selectedSessions, [], now)
  const activitySeries = makeSeries(range, selectedSessions, relevantActivities, now)

  const byStatus: Record<Task['status'], number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 }
  const byPriority: Record<Task['priority'], number> = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 }
  let overdue = 0
  let completedInRange = 0
  let completedWithoutTimestamp = 0
  const completionEvents = relevantActivities.filter(activity => activity.type === 'task_completed')
  const eventTaskIds = new Set<string>()
  const completionBucketsByKey = new Map(activitySeries.map(bucket => [bucket.key, bucket]))
  for (const activity of completionEvents) {
    completedInRange++
    if (activity.taskId) eventTaskIds.add(activity.taskId)
  }
  const todayStart = startOfLocalDay(now).getTime()
  for (const task of tasks) {
    byStatus[task.status]++
    byPriority[task.priority]++
    if (task.status !== 'done' && task.status !== 'cancelled') {
      const dueDate = dateTimestamp(task.dueDate)
      if (dueDate !== undefined && dueDate < todayStart) overdue++
    }
    if (task.status === 'done') {
      const completedAt = dateTimestamp(task.completedAt)
      if (completedAt === undefined) completedWithoutTimestamp++
      else if (!eventTaskIds.has(task.id) && completedAt <= nowMs && isWithinAnalyticsRange(completedAt, range)) {
        completedInRange++
        const bucket = completionBucketsByKey.get(getAnalyticsPeriodKey(new Date(completedAt), range.granularity))
        if (bucket) bucket.taskCompletionCount++
      }
    }
  }

  const totalTasks = tasks.length
  const completedTasks = byStatus.done
  const openTasks = byStatus.todo + byStatus.in_progress
  const currentProjectsById = new Map(projectList.map(project => [project.id, project]))
  const filteredSessions = selectedSessions
  const projectFocus = buildProjectFocus(filteredSessions, currentProjectsById)
  const projectTasks = buildProjectTasks(tasks, currentProjectsById, now)

  const lastActivityByProject = new Map<string, number>()
  for (const entry of selectedSessions) {
    const existing = lastActivityByProject.get(entry.session.projectId) ?? 0
    lastActivityByProject.set(entry.session.projectId, Math.max(existing, getLastSessionActivity(entry, nowMs)))
  }
  for (const activity of relevantActivities) {
    if (!activity.projectId) continue
    const timestamp = dateTimestamp(activity.createdAt)
    if (timestamp === undefined) continue
    const existing = lastActivityByProject.get(activity.projectId) ?? 0
    lastActivityByProject.set(activity.projectId, Math.max(existing, timestamp))
  }
  const projectActivity = projectList
    .map(project => ({
      projectId: project.id,
      name: project.name,
      status: project.status,
      lastActivityAt: lastActivityByProject.has(project.id)
        ? new Date(lastActivityByProject.get(project.id)!)
        : undefined,
    }))
    .sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
  const withoutActivity = projectActivity.filter(project => !project.lastActivityAt && project.status === 'active')

  return {
    range,
    focus: {
      totalMs,
      completedMs,
      unfinishedMs,
      completedSessions,
      unfinishedSessions,
      averageCompletedMs: completedSessions === 0 ? 0 : Math.round(completedMs / completedSessions),
      excludedSessionCount: invalidSessionCount + overlapIds.size,
      overlapConflictCount: overlapIds.size,
    },
    focusSeries,
    activitySeries,
    projects: {
      active: projectList.filter(project => project.status === 'active').length,
      completed: projectList.filter(project => project.status === 'completed').length,
      archived: projectList.filter(project => project.status === 'archived').length,
      focus: projectFocus,
      tasks: projectTasks,
      activity: projectActivity,
      withoutActivity,
    },
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      completedInRange,
      completedWithoutTimestamp,
      open: openTasks,
      overdue,
      completionPercent: totalTasks === 0 ? null : Math.round(completedTasks / totalTasks * 100),
      byStatus,
      byPriority,
    },
  }
}

