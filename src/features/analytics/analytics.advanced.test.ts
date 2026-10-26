import { describe, expect, it } from 'vitest'
import type { Activity, Project, Session } from '@/types'
import type { AnalyticsSourceData } from './analytics.types'
import { calculateAnalyticsMetrics } from './analytics.metrics'
import {
  buildProjectDeepDive,
  calculateAnalyticsComparison,
  calculatePlannedActual,
  compareValues,
  deriveDeterministicInsights,
  sourceAsOfRangeEnd,
} from './analytics.advanced'
import { getAnalyticsDateRange, getCustomAnalyticsDateRange, getLocalDateKey, getPreviousAnalyticsDateRange } from './analytics.utils'
import { buildAnalyticsReport, serializeAnalyticsCsv, serializeAnalyticsJson } from './analytics.export'

const hour = 60 * 60_000

function project(id: string, name = `Project ${id}`): Project {
  const date = new Date(2024, 0, 1)
  return {
    id, name, identifier: id.toUpperCase(), description: '', status: 'active', priority: 'medium',
    color: '#8a9e6b', icon: '', progress: 0, nextAction: '', createdAt: date, updatedAt: date,
  }
}

function session(id: string, projectId: string, start: Date, duration: number, scheduledBlockId?: string): Session {
  return {
    id, projectId, title: `Session ${id}`, objective: '', status: 'completed', startedAt: start,
    endedAt: new Date(start.getTime() + duration), lastResumedAt: start, accumulatedDurationMs: duration,
    accomplishments: '', blockers: '', nextStep: '', outcome: '', createdAt: start,
    updatedAt: new Date(start.getTime() + duration), scheduledBlockId,
  }
}

function source(overrides: Partial<AnalyticsSourceData> = {}): AnalyticsSourceData {
  return { projects: [], tasks: [], sessions: [], activities: [], scheduledWorkBlocks: [], ...overrides }
}

function block(id: string, start: Date, duration: number, status: 'planned' | 'completed' | 'cancelled' = 'planned', projectId = 'p1') {
  return {
    id, projectId, title: `Block ${id}`, scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + duration), status,
    createdAt: start, updatedAt: start,
  }
}

describe('advanced analytics periods and comparisons', () => {
  it('compares equal local-calendar windows, including around DST-safe date arithmetic', () => {
    const current = getAnalyticsDateRange('7d', new Date(2024, 2, 10, 12))
    const previous = getPreviousAnalyticsDateRange(current)
    expect(previous).toBeDefined()
    expect(getLocalDateKey(previous!.start!)).toBe('2024-02-26')
    expect(previous!.end.getTime()).toBe(current.start!.getTime())
  })

  it('builds custom inclusive dates as half-open ranges and rejects invalid dates', () => {
    const range = getCustomAnalyticsDateRange('2024-04-03', '2024-04-05')
    expect(getLocalDateKey(range!.start!)).toBe('2024-04-03')
    expect(getLocalDateKey(new Date(range!.end.getTime() - 1))).toBe('2024-04-05')
    expect(getCustomAnalyticsDateRange('2024-04-06', '2024-04-05')).toBeUndefined()
    expect(getPreviousAnalyticsDateRange({ ...range!, key: 'all' })).toBeUndefined()
  })

  it('handles a zero comparison baseline and negative changes without infinite percentages', () => {
    expect(compareValues(30, 0)).toEqual({ current: 30, previous: 0, difference: 30, percentage: null })
    expect(compareValues(0, 0).percentage).toBe(0)
    expect(compareValues(5, 10)).toMatchObject({ difference: -5, percentage: -50 })
  })
})

describe('planned and actual analytics', () => {
  const now = new Date(2024, 0, 8, 12)
  const range = getAnalyticsDateRange('7d', now)
  const first = new Date(2024, 0, 3, 9)

  it('keeps planned blocks, recorded sessions, unworked plans, and unscheduled work distinct', () => {
    const data = source({
      projects: [project('p1')],
      sessions: [
        session('linked-by-time-only', 'p1', first, hour),
        session('explicit-link', 'p1', new Date(2024, 0, 5, 10), hour / 2, 'plan-a'),
      ],
      scheduledWorkBlocks: [
        block('plan-a', first, 2 * hour, 'planned'),
        block('unworked', new Date(2024, 0, 4, 10), hour, 'completed'),
        block('cancelled', new Date(2024, 0, 4, 12), 4 * hour, 'cancelled'),
      ],
    })
    const metrics = calculateAnalyticsMetrics(data, range, undefined, now)
    const planning = calculatePlannedActual(data, range, undefined, metrics, now)

    expect(planning.plannedMs).toBe(3 * hour)
    expect(planning.actualMs).toBe(1.5 * hour)
    expect(planning.uncompletedBlockCount).toBe(1)
    expect(planning.projects[0]).toMatchObject({ projectId: 'p1', plannedMs: 3 * hour, actualMs: 1.5 * hour })
    expect(planning.buckets.reduce((sum, bucket) => sum + bucket.plannedMs, 0)).toBe(planning.plannedMs)
    expect(planning.buckets.reduce((sum, bucket) => sum + bucket.actualMs, 0)).toBe(planning.actualMs)

    const detail = buildProjectDeepDive(data, range, 'p1', metrics, planning, now)
    expect(detail?.actualMs).toBe(1.5 * hour)
    expect(detail?.timeline.filter(item => item.kind === 'calendar')).toHaveLength(2)
    expect(detail?.timeline.filter(item => item.kind === 'session')).toHaveLength(2)
    expect(detail?.timeline.find(item => item.id === 'session:explicit-link')?.linkedBlockTitle).toBe('Block plan-a')
    expect(detail?.timeline.find(item => item.id === 'session:linked-by-time-only')?.scheduledBlockId).toBeUndefined()
    expect(detail?.lastRecordedActivityAt?.getTime()).toBe(new Date(2024, 0, 5, 10).getTime())
  })

  it('clips overlapping blocks to selected range and excludes deleted projects from live lookup', () => {
    const crossing = block('crossing', new Date(2024, 0, 1, 23), 2 * hour, 'planned', 'deleted')
    const data = source({ sessions: [], scheduledWorkBlocks: [crossing] })
    const metrics = calculateAnalyticsMetrics(data, range, undefined, now)
    const planning = calculatePlannedActual(data, range, undefined, metrics, now)
    expect(planning.plannedMs).toBe(hour)
    expect(planning.projects).toHaveLength(1)
    expect(planning.projects[0]?.isHistorical).toBe(true)
    expect(buildProjectDeepDive(data, range, 'deleted', metrics, planning, now)?.isHistorical).toBe(true)
  })

  it('compares filtered project totals using the same time ranges', () => {
    const previousRange = getPreviousAnalyticsDateRange(range)!
    const before = session('before', 'p1', previousRange.start!, hour)
    const current = session('current', 'p1', range.start!, 2 * hour)
    const data = source({ projects: [project('p1')], sessions: [before, current] })
    const currentMetrics = calculateAnalyticsMetrics(data, range, 'p1', now)
    const previousMetrics = calculateAnalyticsMetrics(data, previousRange, 'p1', now)
    const currentPlan = calculatePlannedActual(data, range, 'p1', currentMetrics, now)
    const previousPlan = calculatePlannedActual(data, previousRange, 'p1', previousMetrics, now)
    const comparison = calculateAnalyticsComparison(currentMetrics, previousMetrics, currentPlan.plannedMs, previousPlan.plannedMs)
    expect(comparison.focusMs).toMatchObject({ current: 2 * hour, previous: hour, difference: hour, percentage: 100 })
    expect(comparison.plannedMs).toMatchObject({ current: 0, previous: 0, percentage: 0 })
  })

  it('does not leak a session edited after the prior period into historical comparison', () => {
    const previousRange = getPreviousAnalyticsDateRange(range)!
    const crossing = session('cross-period', 'p1', new Date(previousRange.end.getTime() - 30 * 60_000), hour)
    const data = source({ projects: [project('p1')], sessions: [crossing] })
    const historicalSource = sourceAsOfRangeEnd(data, previousRange)
    const historicalNow = new Date(previousRange.end.getTime() - 1)
    const historicalMetrics = calculateAnalyticsMetrics(historicalSource, previousRange, undefined, historicalNow)
    expect(historicalMetrics.focus.totalMs).toBe(0)
  })
})

describe('task completion events, insights, and report export', () => {
  const now = new Date(2024, 0, 8, 12)
  const range = getAnalyticsDateRange('7d', now)

  it('counts persisted completion events once and uses completedAt only as a fallback', () => {
    const date = new Date(2024, 0, 7, 10)
    const task = {
      id: 't1', projectId: 'p1', title: 'reopened task', status: 'todo' as const, priority: 'low' as const,
      createdAt: date, updatedAt: date, order: 1,
    }
    const completed: Activity = { id: 'e1', type: 'task_completed', taskId: 't1', projectId: 'p1', description: '', createdAt: date }
    const metrics = calculateAnalyticsMetrics(source({ tasks: [task], activities: [completed] }), range, undefined, now)
    expect(metrics.tasks.completedInRange).toBe(1)
  })

  it('emits stable factual insights only when explicit thresholds are met', () => {
    const recent = new Date(2024, 0, 1, 10)
    const data = source({
      projects: [project('p1'), project('p2')],
      sessions: [session('large-session', 'p1', new Date(2024, 0, 3, 10), 2 * hour)],
      activities: [{ id: 'old-event', type: 'project_updated', projectId: 'p2', description: '', createdAt: recent }],
      scheduledWorkBlocks: [block('plan', new Date(2024, 0, 3, 10), 4 * hour)],
      tasks: [{ id: 'late', projectId: 'p1', title: 'late', status: 'todo', priority: 'high', dueDate: new Date(2024, 0, 2), createdAt: recent, updatedAt: recent, order: 1 }],
    })
    const current = calculateAnalyticsMetrics(data, range, undefined, now)
    const previousRange = getPreviousAnalyticsDateRange(range)!
    const previous = calculateAnalyticsMetrics(data, previousRange, undefined, now)
    const planning = calculatePlannedActual(data, range, undefined, current, now)
    const first = deriveDeterministicInsights(current, previous, planning)
    expect(first.map(item => item.id)).toEqual(['focus_change', 'project_inactivity', 'overdue_tasks', 'planning_gap', 'project_concentration'])
    expect(deriveDeterministicInsights(current, previous, planning)).toEqual(first)

    const empty = calculateAnalyticsMetrics(source(), range, undefined, now)
    const emptyPlan = calculatePlannedActual(source(), range, undefined, empty, now)
    expect(deriveDeterministicInsights(empty, undefined, emptyPlan)).toEqual([])
  })

  it('exports displayed totals and preserves Cyrillic while neutralizing spreadsheet formulas', () => {
    const hostileProject = project('p1', '=HYPERLINK("https://invalid","Проект")')
    const data = source({ projects: [hostileProject], sessions: [session('s1', 'p1', new Date(2024, 0, 3, 10), hour)] })
    const metrics = calculateAnalyticsMetrics(data, range, undefined, now)
    const planning = calculatePlannedActual(data, range, undefined, metrics, now)
    const report = buildAnalyticsReport(metrics, planning, undefined, undefined, now)
    expect(report.summary.actualFocusMs).toBe(metrics.focus.totalMs)
    expect(report.summary.plannedMs).toBe(planning.plannedMs)
    const csv = serializeAnalyticsCsv(report)
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain("'=HYPERLINK(")
    expect(csv).toContain('""Проект""')
    expect(csv).toContain('Проект')
    const json = serializeAnalyticsJson(report)
    expect(JSON.parse(json).summary.actualFocusMs).toBe(metrics.focus.totalMs)
    expect(json).not.toContain('private note contents')
  })
})
