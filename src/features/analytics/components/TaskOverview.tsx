import { useTranslation } from '@/i18n'
import type { AnalyticsMetrics, AnalyticsPeriodBucket } from '../analytics.types'
import { getAnalyticsPeriodKey, parseAnalyticsPeriodKey } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'

const STATUS_COLORS: Record<string, string> = {
  done: '#8a9e6b',
  in_progress: '#cda558',
  todo: '#827f75',
  cancelled: '#55554d',
}

export function TaskOverview({ metrics, locale }: { metrics: AnalyticsMetrics; locale: string }) {
  const { t } = useTranslation()
  const { tasks } = metrics
  const statuses = (['done', 'in_progress', 'todo', 'cancelled'] as const).map(status => ({
    key: status,
    label: t(`insights.tasks.status.${status}`),
    count: tasks.byStatus[status],
    color: STATUS_COLORS[status],
  }))
  const priorities = (['urgent', 'high', 'medium', 'low', 'none'] as const).map(priority => ({
    key: priority,
    label: t(`insights.tasks.priority.${priority}`),
    count: tasks.byPriority[priority],
  }))
  return (
    <AnalyticsPanel title={t('insights.tasks.title')} description={t('insights.tasks.currentNote')} className="h-full">
      {tasks.total === 0 ? (
        <>
          <p className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-border-subtle px-4 text-center text-sm text-text-secondary">{t('insights.tasks.noTasks')}</p>
          <TaskCompletionTrend metrics={metrics} locale={locale} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TaskStat label={t('insights.tasks.total')} value={tasks.total} />
            <TaskStat label={t('insights.tasks.completed')} value={tasks.completed} />
            <TaskStat label={t('insights.tasks.open')} value={tasks.open} />
            <TaskStat label={t('insights.tasks.overdue')} value={tasks.overdue} warning={tasks.overdue > 0} />
          </div>
          <TaskCompletionTrend metrics={metrics} locale={locale} />
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-text-secondary">{t('insights.tasks.completion')}</span>
              <span className="font-mono tabular-nums text-text-primary">
                {tasks.completionPercent === null ? '—' : `${tasks.completionPercent}%`}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[#282823]"
              role="img"
              aria-label={`${t('insights.tasks.completion')}: ${tasks.completionPercent ?? 0}%`}
            >
              <div className="h-full rounded-full bg-accent-olive transition-[width] duration-200" style={{ width: `${tasks.completionPercent ?? 0}%` }} />
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-text-secondary">{t('insights.tasks.statusTitle')}</h3>
              <div className="flex h-2 overflow-hidden rounded-full bg-[#282823]" role="img" aria-label={t('insights.tasks.statusTitle')}>
                {statuses.map(status => (
                  <span
                    key={status.key}
                    className="h-full"
                    style={{ width: `${status.count / tasks.total * 100}%`, backgroundColor: status.color }}
                    title={`${status.label}: ${status.count}`}
                  />
                ))}
              </div>
              <ul className="mt-2 space-y-1.5">
                {statuses.map(status => (
                  <li key={status.key} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                      <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: status.color }} aria-hidden="true" />
                      <span className="truncate">{status.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-text-primary">{status.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium text-text-secondary">{t('insights.tasks.priorityTitle')}</h3>
              <ul className="space-y-2.5">
                {priorities.map(priority => (
                  <li key={priority.key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-text-secondary">{priority.label}</span>
                      <span className="font-mono tabular-nums text-text-primary">{priority.count}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[#282823]" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent-olive/80" style={{ width: `${priority.count / tasks.total * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {tasks.completedWithoutTimestamp > 0 && (
            <p className="mt-4 rounded-md border border-accent-amber/20 bg-accent-amber/5 px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
              {t('insights.tasks.missingTimestamp', { count: tasks.completedWithoutTimestamp })}
            </p>
          )}
        </>
      )}
    </AnalyticsPanel>
  )
}

function TaskStat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="rounded-md border border-border-subtle bg-[#10110f] px-2.5 py-2">
      <div className="truncate text-[10px] text-text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-sm tabular-nums ${warning ? 'text-accent-amber' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function getCompletionTrend(metrics: AnalyticsMetrics): { buckets: AnalyticsPeriodBucket[]; mode: 'day' | 'week' | 'month' } {
  const { range, activitySeries } = metrics
  const localOrdinal = (date: Date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  const dayCount = range.start ? localOrdinal(range.end) - localOrdinal(range.start) : Number.POSITIVE_INFINITY
  const mode: 'day' | 'week' | 'month' = range.granularity === 'month' ? 'month' : dayCount <= 14 ? 'day' : 'week'
  const grouped = new Map<string, AnalyticsPeriodBucket>()

  for (const bucket of activitySeries) {
    if (bucket.taskCompletionCount === 0) continue
    const start = new Date(bucket.start)
    if (mode === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const key = getAnalyticsPeriodKey(start, mode === 'month' ? 'month' : 'day')
    const target = grouped.get(key)
    if (target) target.taskCompletionCount += bucket.taskCompletionCount
    else grouped.set(key, { ...bucket, key, start, focusMs: 0, sessionCount: 0, activityCount: 0, taskActivityCount: 0 })
  }

  return { buckets: [...grouped.values()].sort((a, b) => a.start.getTime() - b.start.getTime()).slice(-8).reverse(), mode }
}

function TaskCompletionTrend({ metrics, locale }: { metrics: AnalyticsMetrics; locale: string }) {
  const { t } = useTranslation('insights')
  const { buckets, mode } = getCompletionTrend(metrics)
  const maxCount = Math.max(1, ...buckets.map(bucket => bucket.taskCompletionCount))

  return (
    <div className="mt-4 border-t border-border-subtle pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium text-text-secondary">{t('insights.tasks.completionTrend')}</h3>
        <span className="text-[10px] text-text-muted">{t(`insights.tasks.trendMode.${mode}`)}</span>
      </div>
      <p className="mb-2 mt-1 text-[10px] leading-relaxed text-text-muted">{t('insights.tasks.completionTrendNote')}</p>
      {buckets.length === 0 ? (
        <p className="text-xs text-text-muted">{t('insights.tasks.completionTrendEmpty')}</p>
      ) : (
        <ul className="m-0 grid grid-cols-1 gap-x-4 gap-y-1.5 p-0 sm:grid-cols-2">
          {buckets.map(bucket => {
            const date = parseAnalyticsPeriodKey(bucket.key, mode === 'month' ? 'month' : 'day') ?? bucket.start
            const formatted = new Intl.DateTimeFormat(locale, mode === 'month'
              ? { month: 'short', year: '2-digit' }
              : { day: 'numeric', month: 'short' }).format(date)
            const label = mode === 'week' ? t('insights.tasks.weekOf', { date: formatted }) : formatted
            return (
              <li key={bucket.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="truncate text-text-secondary">{label}</span>
                <span className="font-mono tabular-nums text-text-primary">{bucket.taskCompletionCount}</span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-[#282823]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-accent-olive" style={{ width: `${bucket.taskCompletionCount / maxCount * 100}%` }} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
