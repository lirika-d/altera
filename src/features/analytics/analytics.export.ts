import type { AnalyticsComparison, PlannedActualSummary } from './analytics.advanced'
import type { AnalyticsMetrics } from './analytics.types'

export interface AnalyticsReport {
  reportType: 'altera-insights'
  version: 1
  generatedAt: string
  filters: {
    period: { key: string; start?: string; endExclusive: string }
    projectId?: string
  }
  definitions: Record<string, string>
  summary: {
    actualFocusMs: number
    completedSessions: number
    completedTasksInPeriod: number
    plannedMs: number
    uncompletedElapsedBlocks: number
    overdueTasksCurrent: number
    comparison?: AnalyticsComparison
  }
  dailyOrPeriodBreakdown: Array<{ periodStart: string; plannedMs: number; actualMs: number }>
  projectBreakdown: Array<{
    projectId: string
    projectName: string
    plannedMs: number
    actualMs: number
    scheduledBlocks: number
    uncompletedElapsedBlocks: number
  }>
  taskState: {
    currentByStatus: AnalyticsMetrics['tasks']['byStatus']
    currentByPriority: AnalyticsMetrics['tasks']['byPriority']
  }
}

export function buildAnalyticsReport(
  metrics: AnalyticsMetrics,
  planning: PlannedActualSummary,
  comparison: AnalyticsComparison | undefined,
  projectId: string | undefined,
  generatedAt: Date
): AnalyticsReport {
  return {
    reportType: 'altera-insights',
    version: 1,
    generatedAt: generatedAt.toISOString(),
    filters: {
      period: {
        key: metrics.range.key,
        start: metrics.range.start?.toISOString(),
        endExclusive: metrics.range.end.toISOString(),
      },
      projectId,
    },
    definitions: {
      actualFocusMs: 'Sum of valid recorded work-session durations assigned to the session local start date; overlapping sessions are excluded.',
      plannedMs: 'Sum of non-cancelled scheduled work-block time intersecting the selected local date range; clipped at range boundaries.',
      completedTasksInPeriod: 'Persisted task_completed events in range, plus completedAt fallback for records without a matching event.',
      overdueTasksCurrent: 'Current open tasks with a due date before the local current day.',
      uncompletedElapsedBlocks: 'Past scheduled blocks that remain marked planned; this does not prove that no work occurred.',
      projectBreakdown: 'Actual time comes from work sessions; planned time comes from calendar blocks. No time-overlap matching is inferred.',
    },
    summary: {
      actualFocusMs: metrics.focus.totalMs,
      completedSessions: metrics.focus.completedSessions,
      completedTasksInPeriod: metrics.tasks.completedInRange,
      plannedMs: planning.plannedMs,
      uncompletedElapsedBlocks: planning.uncompletedBlockCount,
      overdueTasksCurrent: metrics.tasks.overdue,
      comparison,
    },
    dailyOrPeriodBreakdown: planning.buckets.map(bucket => ({
      periodStart: bucket.start.toISOString(),
      plannedMs: bucket.plannedMs,
      actualMs: bucket.actualMs,
    })),
    projectBreakdown: planning.projects.map(project => ({
      projectId: project.projectId,
      projectName: project.name || (project.projectId === '__unassigned__' ? '' : `…${project.projectId.slice(-6)}`),
      plannedMs: project.plannedMs,
      actualMs: project.actualMs,
      scheduledBlocks: project.blockCount,
      uncompletedElapsedBlocks: project.uncompletedBlockCount,
    })),
    taskState: {
      currentByStatus: metrics.tasks.byStatus,
      currentByPriority: metrics.tasks.byPriority,
    },
  }
}

function neutralizeSpreadsheetFormula(value: unknown): string {
  const text = String(value ?? '')
  let firstMeaningful = 0
  while (firstMeaningful < text.length && text.charCodeAt(firstMeaningful) <= 0x20) firstMeaningful++
  return ['=', '+', '-', '@'].includes(text[firstMeaningful] ?? '') ? `'${text}` : text
}

function escapeCsvCell(value: unknown): string {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : neutralizeSpreadsheetFormula(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function serializeAnalyticsCsv(report: AnalyticsReport): string {
  const rows: unknown[][] = [
    ['section', 'metric', 'value', 'unit', 'project_id', 'project_name', 'period_start', 'period_end_exclusive'],
    ['report', 'generated_at', report.generatedAt, 'ISO-8601', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['report', 'period_key', report.filters.period.key, '', report.filters.projectId ?? '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'actual_focus', report.summary.actualFocusMs, 'milliseconds', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'planned_time', report.summary.plannedMs, 'milliseconds', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'completed_sessions', report.summary.completedSessions, 'sessions', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'completed_tasks_in_period', report.summary.completedTasksInPeriod, 'tasks', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'overdue_tasks_current', report.summary.overdueTasksCurrent, 'tasks', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
    ['summary', 'uncompleted_elapsed_blocks', report.summary.uncompletedElapsedBlocks, 'blocks', '', report.filters.period.start ?? '', report.filters.period.endExclusive],
  ]

  if (report.summary.comparison) {
    for (const [key, value] of Object.entries(report.summary.comparison)) {
      rows.push(['comparison', `${key}_current`, value.current, '', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
      rows.push(['comparison', `${key}_previous`, value.previous, '', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
      rows.push(['comparison', `${key}_difference`, value.difference, '', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
      if (value.percentage !== null) rows.push(['comparison', `${key}_percentage`, value.percentage, 'percent', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
    }
  }
  for (const bucket of report.dailyOrPeriodBreakdown) {
    rows.push(['period', 'planned_time', bucket.plannedMs, 'milliseconds', '', bucket.periodStart, report.filters.period.endExclusive])
    rows.push(['period', 'actual_focus', bucket.actualMs, 'milliseconds', '', bucket.periodStart, report.filters.period.endExclusive])
  }
  for (const project of report.projectBreakdown) {
    rows.push(['project', 'planned_time', project.plannedMs, 'milliseconds', project.projectId, project.projectName, report.filters.period.start ?? '', report.filters.period.endExclusive])
    rows.push(['project', 'actual_focus', project.actualMs, 'milliseconds', project.projectId, project.projectName, report.filters.period.start ?? '', report.filters.period.endExclusive])
    rows.push(['project', 'scheduled_blocks', project.scheduledBlocks, 'blocks', project.projectId, project.projectName, report.filters.period.start ?? '', report.filters.period.endExclusive])
    rows.push(['project', 'uncompleted_elapsed_blocks', project.uncompletedElapsedBlocks, 'blocks', project.projectId, project.projectName, report.filters.period.start ?? '', report.filters.period.endExclusive])
  }
  for (const [status, value] of Object.entries(report.taskState.currentByStatus)) {
    rows.push(['task_state', `status_${status}`, value, 'tasks', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
  }
  for (const [priority, value] of Object.entries(report.taskState.currentByPriority)) {
    rows.push(['task_state', `priority_${priority}`, value, 'tasks', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
  }
  for (const [key, definition] of Object.entries(report.definitions)) {
    rows.push(['definition', key, definition, '', '', report.filters.period.start ?? '', report.filters.period.endExclusive])
  }

  const csv = rows.map(row => {
    while (row.length < 8) row.push('')
    return row.map(escapeCsvCell).join(',')
  }).join('\r\n')
  return `\uFEFF${csv}\r\n`
}

export function serializeAnalyticsJson(report: AnalyticsReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
