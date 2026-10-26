import { describe, expect, it } from 'vitest'
import type { Activity, Project, Session, Task } from '@/types'
import { calculateAnalyticsMetrics } from './analytics.metrics'
import { getAnalyticsDateRange, getAnalyticsPeriodKey, isWithinAnalyticsRange } from './analytics.utils'
import type { AnalyticsSourceData } from './analytics.types'

const minute = 60_000

function makeProject(id: string, status: Project['status'] = 'active'): Project {
  const now = new Date(2024, 0, 1, 9)
  return {
    id,
    identifier: `ALT-${id}`,
    name: `Project ${id}`,
    description: '',
    status,
    priority: 'medium',
    color: '#8a9e6b',
    icon: '',
    progress: 0,
    nextAction: '',
    createdAt: now,
    updatedAt: now,
  }
}

function makeSession(
  id: string,
  projectId: string,
  startedAt: Date,
  endedAt: Date | undefined,
  durationMs: number,
  status: Session['status'] = 'completed',
  extra: Partial<Session> = {}
): Session {
  return {
    id,
    projectId,
    title: id,
    objective: '',
    status,
    startedAt,
    endedAt,
    lastResumedAt: startedAt,
    accumulatedDurationMs: durationMs,
    accomplishments: '',
    blockers: '',
    nextStep: '',
    outcome: '',
    createdAt: startedAt,
    updatedAt: endedAt ?? startedAt,
    ...extra,
  }
}

function makeTask(
  id: string,
  projectId: string,
  status: Task['status'],
  dueDate?: Date,
  completedAt?: Date,
  priority: Task['priority'] = 'medium'
): Task {
  const now = new Date(2024, 0, 2, 12)
  return { id, projectId, title: id, status, priority, dueDate, completedAt, createdAt: now, updatedAt: now, order: 0 }
}

function emptySource(overrides: Partial<AnalyticsSourceData> = {}): AnalyticsSourceData {
  return { projects: [], tasks: [], sessions: [], activities: [], scheduledWorkBlocks: [], ...overrides }
}

describe('analytics date ranges', () => {
  it('uses local inclusive start and exclusive next-midnight boundaries', () => {
    const now = new Date(2024, 2, 10, 12, 30)
    const range = getAnalyticsDateRange('7d', now)
    expect(range.start?.getFullYear()).toBe(2024)
    expect(range.start?.getMonth()).toBe(2)
    expect(range.start?.getDate()).toBe(4)
    expect(range.end.getDate()).toBe(11)
    expect(range.end.getHours()).toBe(0)
    expect(isWithinAnalyticsRange(range.start!.getTime(), range)).toBe(true)
    expect(isWithinAnalyticsRange(range.end.getTime(), range)).toBe(false)
  })

  it('does local calendar-day arithmetic without assuming a 24-hour DST day', () => {
    const anchor = new Date(2024, 2, 10, 12)
    const range = getAnalyticsDateRange('today', anchor)
    const nextDay = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate())
    expect(getAnalyticsPeriodKey(nextDay, 'day')).not.toBe(getAnalyticsPeriodKey(range.start!, 'day'))
    expect(range.end.getHours()).toBe(0)
  })
})

describe('calculateAnalyticsMetrics', () => {
  it('counts only recorded running time and separates completed from unfinished sessions', () => {
    const now = new Date(2024, 0, 2, 12, 20)
    const start = new Date(2024, 0, 2, 9)
    const range = getAnalyticsDateRange('today', now)
    const sessions = [
      makeSession('complete', 'p1', start, new Date(2024, 0, 2, 10), 45 * minute),
      makeSession('paused', 'p1', new Date(2024, 0, 2, 10, 30), undefined, 10 * minute, 'paused'),
    ]

    const metrics = calculateAnalyticsMetrics(emptySource({ projects: [makeProject('p1')], sessions }), range, undefined, now)
    expect(metrics.focus.totalMs).toBe(55 * minute)
    expect(metrics.focus.completedMs).toBe(45 * minute)
    expect(metrics.focus.unfinishedMs).toBe(10 * minute)
    expect(metrics.focus.completedSessions).toBe(1)
    expect(metrics.focus.unfinishedSessions).toBe(1)
    expect(metrics.focus.averageCompletedMs).toBe(45 * minute)
  })

  it('derives the live part of a single running session using the session-engine clock rule', () => {
    const now = new Date(2024, 0, 2, 12, 20)
    const startedAt = new Date(2024, 0, 2, 12)
    const running = makeSession('running', 'p1', startedAt, undefined, 0, 'running', { lastResumedAt: startedAt })
    const metrics = calculateAnalyticsMetrics(emptySource({ sessions: [running] }), getAnalyticsDateRange('today', now), undefined, now)
    expect(metrics.focus.totalMs).toBe(20 * minute)
    expect(metrics.focus.unfinishedMs).toBe(20 * minute)
    expect(metrics.focus.unfinishedSessions).toBe(1)
  })

  it('assigns a session spanning midnight to its local start date, without inventing a split', () => {
    const now = new Date(2024, 0, 3, 8)
    const startedAt = new Date(2024, 0, 1, 23, 30)
    const endedAt = new Date(2024, 0, 2, 0, 30)
    const range = getAnalyticsDateRange('7d', now)
    const metrics = calculateAnalyticsMetrics(
      emptySource({ sessions: [makeSession('cross-midnight', 'deleted', startedAt, endedAt, 30 * minute, 'completed', {
        projectSnapshot: { id: 'deleted', name: 'Removed project', identifier: 'ALT-OLD' },
      })] }),
      range,
      undefined,
      now
    )

    const startBucket = metrics.focusSeries.find(bucket => bucket.key === getAnalyticsPeriodKey(startedAt, 'day'))
    const endBucket = metrics.focusSeries.find(bucket => bucket.key === getAnalyticsPeriodKey(endedAt, 'day'))
    expect(startBucket?.focusMs).toBe(30 * minute)
    expect(endBucket?.focusMs).toBe(0)
    expect(metrics.projects.focus[0]).toMatchObject({ projectId: 'deleted', name: 'Removed project', isHistorical: true })
  })

  it('excludes overlapping persisted session intervals instead of double-counting them', () => {
    const now = new Date(2024, 0, 2, 13)
    const range = getAnalyticsDateRange('today', now)
    const sessions = [
      makeSession('overlap-a', 'p1', new Date(2024, 0, 2, 9), new Date(2024, 0, 2, 10), 30 * minute),
      makeSession('overlap-b', 'p2', new Date(2024, 0, 2, 9, 30), new Date(2024, 0, 2, 10, 30), 30 * minute),
      makeSession('clean', 'p1', new Date(2024, 0, 2, 11), new Date(2024, 0, 2, 12), 20 * minute),
    ]
    const metrics = calculateAnalyticsMetrics(emptySource({ projects: [makeProject('p1'), makeProject('p2')], sessions }), range, undefined, now)
    expect(metrics.focus.overlapConflictCount).toBe(2)
    expect(metrics.focus.excludedSessionCount).toBe(2)
    expect(metrics.focus.totalMs).toBe(20 * minute)
    expect(metrics.focus.completedSessions).toBe(1)
  })

  it('computes task states, overdue counts, completion dates, and project status counts from records', () => {
    const now = new Date(2024, 0, 2, 12)
    const yesterday = new Date(2024, 0, 1, 12)
    const today = new Date(2024, 0, 2, 12)
    const tasks = [
      makeTask('open-overdue', 'active', 'todo', yesterday),
      makeTask('in-progress-today', 'active', 'in_progress', today),
      makeTask('completed-period', 'completed', 'done', undefined, today),
      makeTask('completed-no-date', 'archived', 'done'),
      makeTask('cancelled', 'active', 'cancelled', yesterday),
    ]
    const projects = [makeProject('active'), makeProject('completed', 'completed'), makeProject('archived', 'archived')]
    const metrics = calculateAnalyticsMetrics(emptySource({ projects, tasks }), getAnalyticsDateRange('today', now), undefined, now)

    expect(metrics.tasks).toMatchObject({
      total: 5,
      completed: 2,
      completedInRange: 1,
      completedWithoutTimestamp: 1,
      open: 2,
      overdue: 1,
      completionPercent: 40,
    })
    expect(metrics.tasks.byStatus).toEqual({ todo: 1, in_progress: 1, done: 2, cancelled: 1 })
    expect(metrics.projects).toMatchObject({ active: 1, completed: 1, archived: 1 })
    expect(metrics.projects.tasks.find(item => item.projectId === 'active')).toMatchObject({ total: 3, open: 2, overdue: 1 })
  })

  it('keeps deleted-project sessions separate and filters session/task metrics by project', () => {
    const now = new Date(2024, 0, 2, 12)
    const range = getAnalyticsDateRange('7d', now)
    const projects = [makeProject('kept')]
    const tasks = [makeTask('kept-task', 'kept', 'done', undefined, now), makeTask('other-task', 'other', 'todo')]
    const sessions = [
      makeSession('kept-session', 'kept', new Date(2024, 0, 2, 9), new Date(2024, 0, 2, 10), minute),
      makeSession('removed-session', 'removed', new Date(2024, 0, 2, 10), new Date(2024, 0, 2, 11), minute, 'completed', {
        projectSnapshot: { id: 'removed', name: 'Removed', identifier: 'ALT-OLD' },
      }),
      makeSession('unknown-session', 'unknown', new Date(2024, 0, 2, 11), new Date(2024, 0, 2, 12), minute),
    ]
    const metrics = calculateAnalyticsMetrics(emptySource({ projects, tasks, sessions }), range, 'kept', now)
    expect(metrics.focus.totalMs).toBe(minute)
    expect(metrics.tasks.total).toBe(1)
    expect(metrics.projects.focus).toHaveLength(1)
    expect(metrics.projects.focus[0].projectId).toBe('kept')
  })

  it('uses a completed session end time as the latest project activity', () => {
    const now = new Date(2024, 0, 2, 12)
    const startedAt = new Date(2024, 0, 2, 9)
    const endedAt = new Date(2024, 0, 2, 10)
    const project = makeProject('p1')
    const metrics = calculateAnalyticsMetrics(
      emptySource({ projects: [project], sessions: [makeSession('session', 'p1', startedAt, endedAt, 30 * minute)] }),
      getAnalyticsDateRange('today', now),
      undefined,
      now
    )

    expect(metrics.projects.activity[0].lastActivityAt).toEqual(endedAt)
  })

  it('filters focus totals by session start date at the selected range boundaries', () => {
    const now = new Date(2024, 0, 8, 12)
    const range = getAnalyticsDateRange('7d', now)
    const sessions = [
      makeSession('before-range', 'p1', new Date(2024, 0, 1, 23), new Date(2024, 0, 2), 10 * minute),
      makeSession('at-range-start', 'p1', range.start!, new Date(range.start!.getTime() + 20 * minute), 20 * minute),
    ]
    const metrics = calculateAnalyticsMetrics(emptySource({ sessions }), range, undefined, now)

    expect(metrics.focus.totalMs).toBe(20 * minute)
    expect(metrics.focusSeries[0].sessionCount).toBe(1)
  })

  it('does not fabricate percentages or focus data for empty collections', () => {
    const now = new Date(2024, 0, 2, 12)
    const metrics = calculateAnalyticsMetrics(emptySource(), getAnalyticsDateRange('7d', now), undefined, now)
    expect(metrics.focus.totalMs).toBe(0)
    expect(metrics.focusSeries).toHaveLength(7)
    expect(metrics.focusSeries.every(bucket => bucket.focusMs === 0)).toBe(true)
    expect(metrics.tasks.completionPercent).toBeNull()
    expect(metrics.projects.withoutActivity).toEqual([])
  })

  it('counts only persisted non-session activity events once in the activity timeline', () => {
    const now = new Date(2024, 0, 2, 12)
    const eventDate = new Date(2024, 0, 2, 9)
    const activities: Activity[] = [
      { id: 'task-event', type: 'task_completed', projectId: 'p1', taskId: 'task', description: '', createdAt: eventDate },
      { id: 'session-event', type: 'session_completed', projectId: 'p1', description: '', createdAt: eventDate },
    ]
    const sessions = [makeSession('session', 'p1', eventDate, new Date(2024, 0, 2, 9, 30), 20 * minute)]
    const metrics = calculateAnalyticsMetrics(emptySource({ projects: [makeProject('p1')], sessions, activities }), getAnalyticsDateRange('today', now), undefined, now)
    expect(metrics.activitySeries[0]).toMatchObject({ activityCount: 2, taskActivityCount: 1, sessionCount: 1 })
  })

  it('counts task completion history from saved events and falls back to completedAt without double-counting', () => {
    const now = new Date(2024, 0, 8, 12)
    const completionDate = new Date(2024, 0, 7, 10)
    const tasks = [
      makeTask('event-and-timestamp', 'p1', 'done', undefined, completionDate),
      makeTask('reopened', 'p1', 'todo'),
      makeTask('legacy-timestamp', 'p1', 'done', undefined, completionDate),
    ]
    const activities: Activity[] = [
      { id: 'event-1', type: 'task_completed', taskId: 'event-and-timestamp', projectId: 'p1', description: '', createdAt: completionDate },
      { id: 'event-2', type: 'task_completed', taskId: 'reopened', projectId: 'p1', description: '', createdAt: completionDate },
    ]
    const metrics = calculateAnalyticsMetrics(emptySource({ tasks, activities }), getAnalyticsDateRange('7d', now), undefined, now)
    expect(metrics.tasks.completedInRange).toBe(3)
    expect(metrics.activitySeries.reduce((sum, bucket) => sum + bucket.taskCompletionCount, 0)).toBe(3)
  })
})
