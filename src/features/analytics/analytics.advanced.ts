import { computeElapsedMs } from '@/db/sessions'
import { getAnalyticsCountedSessionIds } from './analytics.metrics'
import type { AnalyticsDateRange, AnalyticsMetrics, AnalyticsSourceData } from './analytics.types'
import { dateTimestamp, isWithinAnalyticsRange, saturatingAdd } from './analytics.utils'
import type { ScheduledWorkBlock } from '@/types/calendar'

export interface ComparedValue {
  current: number
  previous: number
  difference: number
  percentage: number | null
}

export interface AnalyticsComparison {
  focusMs: ComparedValue
  completedSessions: ComparedValue
  completedTasks: ComparedValue
  plannedMs: ComparedValue
}

export interface PlanActualBucket {
  key: string
  start: Date
  plannedMs: number
  actualMs: number
}

export interface PlannedProjectSummary {
  projectId: string
  name: string
  plannedMs: number
  actualMs: number
  blockCount: number
  uncompletedBlockCount: number
  isHistorical: boolean
}

export interface PlannedActualSummary {
  plannedMs: number
  actualMs: number
  uncompletedBlockCount: number
  buckets: PlanActualBucket[]
  projects: PlannedProjectSummary[]
}

export type ProjectTimelineKind = 'session' | 'task' | 'project' | 'calendar'

export interface ProjectTimelineItem {
  id: string
  kind: ProjectTimelineKind
  at: Date
  label: string
  durationMs?: number
  scheduledBlockId?: string
  linkedBlockTitle?: string
}

export interface ProjectDeepDive {
  projectId: string
  name: string
  isHistorical: boolean
  focusMs: number
  completedSessions: number
  openTasks: number
  completedTasks: number
  overdueTasks: number
  completedInRange: number
  plannedMs: number
  actualMs: number
  uncompletedBlockCount: number
  lastRecordedActivityAt?: Date
  timeline: ProjectTimelineItem[]
}

export interface DeterministicInsight {
  id: 'focus_change' | 'project_inactivity' | 'overdue_tasks' | 'planning_gap' | 'project_concentration'
  projectId?: string
  value: number
  secondaryValue?: number
}

/** Prevents later session edits from leaking into a historical comparison window. */
export function sourceAsOfRangeEnd(source: AnalyticsSourceData, range: AnalyticsDateRange): AnalyticsSourceData {
  const endMs = range.end.getTime()
  return {
    ...source,
    sessions: source.sessions.filter(session => {
      const updatedAt = dateTimestamp(session.updatedAt)
      return updatedAt !== undefined && updatedAt < endMs
    }),
  }
}

function clampPercentage(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous * 100
}

export function compareValues(current: number, previous: number): ComparedValue {
  return {
    current,
    previous,
    difference: current - previous,
    percentage: clampPercentage(current, previous),
  }
}

export function calculateAnalyticsComparison(
  current: AnalyticsMetrics,
  previous: AnalyticsMetrics,
  currentPlannedMs: number,
  previousPlannedMs: number
): AnalyticsComparison {
  return {
    focusMs: compareValues(current.focus.totalMs, previous.focus.totalMs),
    completedSessions: compareValues(current.focus.completedSessions, previous.focus.completedSessions),
    completedTasks: compareValues(current.tasks.completedInRange, previous.tasks.completedInRange),
    plannedMs: compareValues(currentPlannedMs, previousPlannedMs),
  }
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function localDayOrdinal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

function bucketStart(date: Date, mode: 'day' | 'week' | 'month'): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (mode === 'day') return day
  if (mode === 'month') return monthStart(day)
  const mondayOffset = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - mondayOffset)
  return day
}

function bucketKey(date: Date, mode: 'day' | 'week' | 'month'): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return mode === 'month' ? `${year}-${month}` : `${year}-${month}-${day}`
}

function dateAtOrBefore(date: Date, boundary: Date | undefined): Date {
  return boundary && boundary.getTime() < date.getTime() ? new Date(boundary) : date
}

function dateAtOrAfter(date: Date, boundary: Date): Date {
  return date.getTime() < boundary.getTime() ? new Date(boundary) : date
}

function makePlanActualBuckets(
  source: AnalyticsSourceData,
  range: AnalyticsDateRange,
  metrics: AnalyticsMetrics,
  now: Date
): PlanActualBucket[] {
  const earliestObserved = [
    ...source.scheduledWorkBlocks.map(block => block.scheduledStart.getTime()),
    ...metrics.focusSeries.map(bucket => bucket.start.getTime()),
  ].filter(timestamp => timestamp < range.end.getTime())
  const observedStart = earliestObserved.length
    ? new Date(Math.min(...earliestObserved))
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const start = range.start ? new Date(range.start) : observedStart
  const dayCount = Math.max(1, localDayOrdinal(range.end) - localDayOrdinal(start))
  const mode = range.granularity === 'month' ? 'month' : dayCount <= 14 ? 'day' : 'week'
  let cursor = bucketStart(start, mode)
  const buckets: PlanActualBucket[] = []
  const byKey = new Map<string, PlanActualBucket>()
  while (cursor < range.end) {
    const entry: PlanActualBucket = { key: bucketKey(cursor, mode), start: new Date(cursor), plannedMs: 0, actualMs: 0 }
    buckets.push(entry)
    byKey.set(entry.key, entry)
    cursor = mode === 'day'
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      : mode === 'week'
        ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
        : addMonth(cursor)
  }

  for (const block of source.scheduledWorkBlocks) {
    if (block.status === 'cancelled') continue
    const clippedStart = dateAtOrAfter(block.scheduledStart, start)
    const clippedEnd = dateAtOrBefore(block.scheduledEnd, range.end)
    if (clippedEnd <= clippedStart) continue

    for (let day = new Date(clippedStart.getFullYear(), clippedStart.getMonth(), clippedStart.getDate()); day < clippedEnd; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
      const segmentStart = dateAtOrAfter(clippedStart, day)
      const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      const segmentEnd = dateAtOrBefore(clippedEnd, nextDay)
      const bucket = byKey.get(bucketKey(bucketStart(day, mode), mode))
      if (bucket && segmentEnd > segmentStart) bucket.plannedMs = saturatingAdd(bucket.plannedMs, segmentEnd.getTime() - segmentStart.getTime())
    }
  }

  for (const bucket of metrics.focusSeries) {
    const entry = byKey.get(bucketKey(bucketStart(bucket.start, mode), mode))
    if (entry) entry.actualMs = saturatingAdd(entry.actualMs, bucket.focusMs)
  }
  return buckets
}

export function calculatePlannedActual(
  source: AnalyticsSourceData,
  range: AnalyticsDateRange,
  selectedProjectId: string | undefined,
  metrics: AnalyticsMetrics,
  now: Date
): PlannedActualSummary {
  const blocks = source.scheduledWorkBlocks.filter((block: ScheduledWorkBlock) => (
    block.status !== 'cancelled'
    && (!selectedProjectId || block.projectId === selectedProjectId)
    && block.scheduledStart < range.end
    && (!range.start || block.scheduledEnd > range.start)
  ))
  let plannedMs = 0
  let uncompletedBlockCount = 0
  const projectMap = new Map<string, PlannedProjectSummary>()
  for (const block of blocks) {
    const start = Math.max(block.scheduledStart.getTime(), range.start?.getTime() ?? Number.NEGATIVE_INFINITY)
    const end = Math.min(block.scheduledEnd.getTime(), range.end.getTime())
    const duration = Math.max(0, end - start)
    plannedMs = saturatingAdd(plannedMs, duration)
    if (block.status === 'planned' && block.scheduledEnd.getTime() <= now.getTime()) uncompletedBlockCount++
    const projectId = block.projectId ?? '__unassigned__'
    const row = projectMap.get(projectId) ?? {
      projectId,
      name: source.projects.find(project => project.id === projectId)?.name ?? '',
      plannedMs: 0,
      actualMs: 0,
      blockCount: 0,
      uncompletedBlockCount: 0,
      isHistorical: projectId !== '__unassigned__' && !source.projects.some(project => project.id === projectId),
    }
    row.plannedMs = saturatingAdd(row.plannedMs, duration)
    row.blockCount++
    if (block.status === 'planned' && block.scheduledEnd.getTime() <= now.getTime()) row.uncompletedBlockCount++
    projectMap.set(projectId, row)
  }

  for (const project of metrics.projects.focus) {
    const row = projectMap.get(project.projectId) ?? {
      projectId: project.projectId,
      name: project.name,
      plannedMs: 0,
      actualMs: 0,
      blockCount: 0,
      uncompletedBlockCount: 0,
      isHistorical: project.isHistorical,
    }
    row.name ||= project.name
    row.actualMs = project.focusMs
    projectMap.set(project.projectId, row)
  }

  const buckets = makePlanActualBuckets(source, range, metrics, now)
  const actualMs = metrics.focus.totalMs
  return {
    plannedMs,
    actualMs,
    uncompletedBlockCount,
    buckets,
    projects: [...projectMap.values()].sort((a, b) => (b.plannedMs + b.actualMs) - (a.plannedMs + a.actualMs) || a.name.localeCompare(b.name)),
  }
}

function inRange(date: Date | string | number | undefined, range: AnalyticsDateRange): Date | undefined {
  const timestamp = dateTimestamp(date)
  return timestamp !== undefined && isWithinAnalyticsRange(timestamp, range) ? new Date(timestamp) : undefined
}

export function buildProjectDeepDive(
  source: AnalyticsSourceData,
  range: AnalyticsDateRange,
  projectId: string | undefined,
  metrics: AnalyticsMetrics,
  planning: PlannedActualSummary,
  now: Date
): ProjectDeepDive | undefined {
  if (!projectId) return undefined
  const project = source.projects.find(entry => entry.id === projectId)
  const focus = metrics.projects.focus.find(entry => entry.projectId === projectId)
  const taskMetrics = metrics.projects.tasks.find(entry => entry.projectId === projectId)
  const planned = planning.projects.find(entry => entry.projectId === projectId)
  const projectSnapshot = source.sessions.find(session => session.projectId === projectId)?.projectSnapshot
  const tasksById = new Map(source.tasks.map(task => [task.id, task]))
  const blocksById = new Map(source.scheduledWorkBlocks.map(block => [block.id, block]))
  const timeline: ProjectTimelineItem[] = []
  const seenSessionIds = new Set<string>()
  const countedSessionIds = getAnalyticsCountedSessionIds(source.sessions, range, now)
  const completedSessionCount = source.sessions.filter(session => (
    session.projectId === projectId && session.status === 'completed' && countedSessionIds.has(session.id)
  )).length

  for (const session of source.sessions) {
    if (session.projectId !== projectId || seenSessionIds.has(session.id) || !countedSessionIds.has(session.id)) continue
    const at = inRange(session.startedAt, range)
    const duration = computeElapsedMs(session, now.getTime())
    if (!at || !Number.isFinite(duration) || duration < 0) continue
    seenSessionIds.add(session.id)
    timeline.push({
      id: `session:${session.id}`,
      kind: 'session',
      at,
      label: session.title,
      durationMs: duration,
      scheduledBlockId: session.scheduledBlockId,
      linkedBlockTitle: session.scheduledBlockId ? blocksById.get(session.scheduledBlockId)?.title : undefined,
    })
  }

  for (const activity of source.activities) {
    const at = inRange(activity.createdAt, range)
    if (!at || activity.type === 'session_started' || activity.type === 'session_completed') continue
    const activityProjectId = activity.projectId ?? (activity.taskId ? tasksById.get(activity.taskId)?.projectId : undefined)
    if (activityProjectId === projectId) {
      const kind = activity.type.startsWith('task_') ? 'task' : 'project'
      timeline.push({ id: `${kind}:${activity.id}`, kind, at, label: activity.type })
    }
  }

  for (const block of source.scheduledWorkBlocks) {
    const at = inRange(block.scheduledStart, range)
    if (block.projectId === projectId && at && block.status !== 'cancelled') {
      timeline.push({ id: `calendar:${block.id}`, kind: 'calendar', at, label: block.title })
    }
  }

  timeline.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id))
  const recentTimeline = timeline.slice(-12).reverse()
  const latestAt = recentTimeline.find(entry => entry.kind !== 'calendar')?.at
  return {
    projectId,
    name: project?.name ?? focus?.name ?? projectSnapshot?.name ?? '',
    isHistorical: !project,
    focusMs: focus?.focusMs ?? 0,
    completedSessions: completedSessionCount,
    openTasks: taskMetrics?.open ?? 0,
    completedTasks: taskMetrics?.completed ?? 0,
    overdueTasks: taskMetrics?.overdue ?? 0,
    completedInRange: metrics.tasks.completedInRange,
    plannedMs: planned?.plannedMs ?? 0,
    actualMs: focus?.focusMs ?? 0,
    uncompletedBlockCount: planned?.uncompletedBlockCount ?? 0,
    lastRecordedActivityAt: latestAt,
    timeline: recentTimeline,
  }
}

export function deriveDeterministicInsights(
  current: AnalyticsMetrics,
  previous: AnalyticsMetrics | undefined,
  planning: PlannedActualSummary
): DeterministicInsight[] {
  const insights: DeterministicInsight[] = []
  const focusDelta = current.focus.totalMs - (previous?.focus.totalMs ?? 0)
  if (previous && Math.abs(focusDelta) >= 30 * 60_000) {
    insights.push({ id: 'focus_change', value: current.focus.totalMs, secondaryValue: previous.focus.totalMs })
  }

  if (previous) {
    const previousByProject = new Map(previous.projects.activity.map(entry => [entry.projectId, entry]))
    for (const project of current.projects.activity) {
      const before = previousByProject.get(project.projectId)
      if (before?.lastActivityAt && !project.lastActivityAt && project.status !== 'archived') {
        insights.push({ id: 'project_inactivity', projectId: project.projectId, value: before.lastActivityAt.getTime() })
      }
    }
  }
  if (current.tasks.overdue > 0) insights.push({ id: 'overdue_tasks', value: current.tasks.overdue })

  const plannedMs = planning.plannedMs
  const actualMs = planning.actualMs
  if (plannedMs - actualMs >= 60 * 60_000 && plannedMs >= actualMs * 1.5) {
    insights.push({ id: 'planning_gap', value: plannedMs, secondaryValue: actualMs })
  }

  const eligibleActual = current.projects.focus.reduce((sum, project) => saturatingAdd(sum, project.focusMs), 0)
  const topProject = current.projects.focus[0]
  if (topProject && current.projects.activity.length >= 2 && eligibleActual >= 2 * 60 * 60_000 && topProject.focusMs / eligibleActual >= 0.6) {
    insights.push({ id: 'project_concentration', projectId: topProject.projectId, value: topProject.focusMs, secondaryValue: eligibleActual })
  }

  return [...new Map(insights.map(insight => [`${insight.id}:${insight.projectId ?? 'all'}`, insight])).values()]
}
