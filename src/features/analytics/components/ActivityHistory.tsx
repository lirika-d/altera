import { useTranslation } from '@/i18n'
import type { AnalyticsDateRange, AnalyticsPeriodBucket } from '../analytics.types'
import { formatAnalyticsDuration, parseAnalyticsPeriodKey } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'

function periodLabel(bucket: AnalyticsPeriodBucket, range: AnalyticsDateRange, locale: string): string {
  const date = parseAnalyticsPeriodKey(bucket.key, range.granularity) ?? bucket.start
  const options: Intl.DateTimeFormatOptions = range.granularity === 'month'
    ? { month: 'long', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function ActivityHistory({
  buckets,
  range,
  locale,
}: {
  buckets: AnalyticsPeriodBucket[]
  range: AnalyticsDateRange
  locale: string
}) {
  const { t } = useTranslation()
  const activePeriods = buckets.filter(bucket => bucket.activityCount > 0).length
  const maxCount = Math.max(0, ...buckets.map(bucket => bucket.activityCount))
  const periodLabelText = range.granularity === 'day'
    ? t('insights.filters.granularityDay')
    : t('insights.filters.granularityMonth')

  return (
    <AnalyticsPanel
      title={t('insights.activity.title')}
      description={t('insights.activity.description')}
      className="h-full"
      action={buckets.length > 0 ? <span className="shrink-0 text-[10px] text-text-muted">{periodLabelText}</span> : undefined}
    >
      {activePeriods === 0 ? (
        <p className="flex min-h-[184px] items-center justify-center rounded-lg border border-dashed border-border-subtle px-4 text-center text-sm text-text-secondary">
          {t('insights.activity.noActivity')}
        </p>
      ) : (
        <>
          <div
            className="grid grid-cols-7 gap-1.5 sm:gap-2"
            role="img"
            aria-label={`${t('insights.activity.title')}. ${t('insights.activity.activePeriods', { count: activePeriods })}`}
          >
            {buckets.map(bucket => {
              const count = bucket.activityCount
              const opacity = count === 0 ? 0.14 : 0.28 + 0.72 * (count / maxCount)
              const backgroundColor = count === 0
                ? '#23231f'
                : `color-mix(in srgb, #8a9e6b ${Math.round(opacity * 100)}%, #23231f)`
              const label = `${periodLabel(bucket, range, locale)}: ${count}`
              return (
                <span
                  key={bucket.key}
                  className="aspect-square min-h-5 rounded-[3px] border border-border-subtle"
                  style={{ backgroundColor }}
                  title={label}
                  aria-hidden="true"
                />
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-text-muted">
            <span>{t('insights.activity.activePeriods', { count: activePeriods })}</span>
            <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
              <span>{t('insights.activity.zero')}</span>
              <span className="h-2.5 w-2.5 rounded-[2px] border border-border-subtle bg-[#23231f]" />
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#8a9e6b]" />
            </span>
          </div>
          <details className="group mt-3 border-t border-border-subtle pt-2 text-xs text-text-secondary">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-sm py-1 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-olive">
              {t('insights.activity.tableSummary')}
            </summary>
            <div className="mt-2 max-h-40 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#141412] text-text-muted">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">{t('insights.focus.date')}</th>
                    <th scope="col" className="py-1 pr-3 font-medium">{t('insights.activity.recordedCount')}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t('insights.focus.duration')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.filter(bucket => bucket.activityCount > 0).map(bucket => (
                    <tr key={bucket.key} className="border-t border-border-subtle">
                      <th scope="row" className="py-1.5 pr-3 font-normal">{periodLabel(bucket, range, locale)}</th>
                      <td className="py-1.5 pr-3 tabular-nums">{bucket.activityCount}</td>
                      <td className="py-1.5 text-right font-mono text-text-primary">{formatAnalyticsDuration(bucket.focusMs, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </AnalyticsPanel>
  )
}
