import { useTranslation } from '@/i18n'
import type { AnalyticsComparison } from '../analytics.advanced'
import { formatAnalyticsDuration } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'

function signedNumber(value: number, locale: string): string {
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(value))
  return value < 0 ? `−${formatted}` : value > 0 ? `+${formatted}` : formatted
}

function signedDuration(value: number, locale: string): string {
  const formatted = formatAnalyticsDuration(Math.abs(value), locale)
  return value < 0 ? `−${formatted}` : value > 0 ? `+${formatted}` : formatted
}

export function ComparisonPanel({ comparison, locale }: { comparison: AnalyticsComparison; locale: string }) {
  const { t } = useTranslation('insights')
  const rows = [
    { key: 'focus', label: t('insights.comparison.focus'), value: comparison.focusMs, duration: true },
    { key: 'planned', label: t('insights.comparison.planned'), value: comparison.plannedMs, duration: true },
    { key: 'sessions', label: t('insights.comparison.sessions'), value: comparison.completedSessions, duration: false },
    { key: 'tasks', label: t('insights.comparison.tasks'), value: comparison.completedTasks, duration: false },
  ] as const

  return (
    <AnalyticsPanel title={t('insights.comparison.title')} description={t('insights.comparison.description')}>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(row => {
          const change = row.value
          const percentage = change.percentage === null
            ? t('insights.comparison.noPercentage')
            : `${change.percentage > 0 ? '+' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(change.percentage)}%`
          return (
            <div key={row.key} className="min-w-0 border-l border-border-subtle pl-3">
              <h3 className="truncate text-xs text-text-secondary">{row.label}</h3>
              <p className="mt-1 text-sm font-medium tabular-nums text-text-primary">
                {row.duration ? formatAnalyticsDuration(change.current, locale) : new Intl.NumberFormat(locale).format(change.current)}
                <span className="mx-1 text-text-muted">←</span>
                <span className="text-xs font-normal text-text-secondary">
                  {row.duration ? formatAnalyticsDuration(change.previous, locale) : new Intl.NumberFormat(locale).format(change.previous)}
                </span>
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-text-muted">
                {t('insights.comparison.change')}: {row.duration ? signedDuration(change.difference, locale) : signedNumber(change.difference, locale)} · {percentage}
              </p>
            </div>
          )
        })}
      </div>
    </AnalyticsPanel>
  )
}
