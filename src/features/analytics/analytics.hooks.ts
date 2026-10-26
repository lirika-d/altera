import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import type { Project } from '@/types'
import type { AnalyticsDateRange, AnalyticsMetrics, AnalyticsRangeKey } from './analytics.types'
import {
  buildProjectDeepDive,
  calculateAnalyticsComparison,
  calculatePlannedActual,
  deriveDeterministicInsights,
  sourceAsOfRangeEnd,
} from './analytics.advanced'
import { calculateAnalyticsMetrics } from './analytics.metrics'
import { getAnalyticsSourceData } from './analytics.repository'
import { getAnalyticsDateRange, getLocalDateKey, getPreviousAnalyticsDateRange, parseLocalDateKey } from './analytics.utils'
import type { AnalyticsComparison, DeterministicInsight, PlannedActualSummary, ProjectDeepDive } from './analytics.advanced'

export interface AnalyticsHookResult {
  now: Date
  metrics: AnalyticsMetrics | undefined
  previousMetrics: AnalyticsMetrics | undefined
  planning: PlannedActualSummary | undefined
  previousPlanning: PlannedActualSummary | undefined
  comparison: AnalyticsComparison | undefined
  insights: DeterministicInsight[] | undefined
  projectDeepDive: ProjectDeepDive | undefined
  projects: Project[] | undefined
  isLoading: boolean
}

/** Reactive source snapshot plus pure derived metrics; no aggregate data is persisted. */
export function useAnalyticsMetrics(
  rangeKey: AnalyticsRangeKey,
  selectedProjectId?: string,
  customRange?: AnalyticsDateRange
): AnalyticsHookResult {
  const now = useMinuteNow()
  const todayKey = getLocalDateKey(now)
  const rangeAnchor = React.useMemo(
    () => parseLocalDateKey(todayKey) ?? new Date(0),
    [todayKey]
  )
  const range = React.useMemo(
    () => rangeKey === 'custom' && customRange
      ? customRange
      : getAnalyticsDateRange(rangeKey === 'custom' ? '30d' : rangeKey, rangeAnchor),
    [rangeKey, rangeAnchor, customRange]
  )
  const previousRange = React.useMemo(() => getPreviousAnalyticsDateRange(range), [range])
  const source = useLiveQuery(() => getAnalyticsSourceData(range, undefined, previousRange), [range, previousRange])
  const nowMs = now.getTime()
  const metrics = React.useMemo(
    () => source
      ? calculateAnalyticsMetrics(source, range, selectedProjectId, new Date(nowMs))
      : undefined,
    [source, range, selectedProjectId, nowMs]
  )
  const previousSource = React.useMemo(
    () => source && previousRange ? sourceAsOfRangeEnd(source, previousRange) : undefined,
    [source, previousRange]
  )
  const previousMetrics = React.useMemo(
    () => previousSource && previousRange
      ? calculateAnalyticsMetrics(
        previousSource,
        previousRange,
        selectedProjectId,
        new Date(Math.min(nowMs, previousRange.end.getTime() - 1))
      )
      : undefined,
    [previousSource, previousRange, selectedProjectId, nowMs]
  )
  const planning = React.useMemo(
    () => source && metrics
      ? calculatePlannedActual(source, range, selectedProjectId, metrics, new Date(nowMs))
      : undefined,
    [source, range, selectedProjectId, metrics, nowMs]
  )
  const previousPlanning = React.useMemo(
    () => source && previousRange && previousMetrics
      ? calculatePlannedActual(source, previousRange, selectedProjectId, previousMetrics, new Date(nowMs))
      : undefined,
    [source, previousRange, selectedProjectId, previousMetrics, nowMs]
  )
  const comparison = React.useMemo(
    () => metrics && previousMetrics && planning && previousPlanning
      ? calculateAnalyticsComparison(metrics, previousMetrics, planning.plannedMs, previousPlanning.plannedMs)
      : undefined,
    [metrics, previousMetrics, planning, previousPlanning]
  )
  const insights = React.useMemo(
    () => metrics && planning
      ? deriveDeterministicInsights(metrics, previousMetrics, planning)
      : undefined,
    [metrics, previousMetrics, planning]
  )
  const projectDeepDive = React.useMemo(
    () => source && metrics && planning
      ? buildProjectDeepDive(source, range, selectedProjectId, metrics, planning, new Date(nowMs))
      : undefined,
    [source, metrics, planning, range, selectedProjectId, nowMs]
  )

  return {
    now,
    metrics,
    previousMetrics,
    planning,
    previousPlanning,
    comparison,
    insights,
    projectDeepDive,
    projects: source?.projects,
    isLoading: source === undefined,
  }
}
