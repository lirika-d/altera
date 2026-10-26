import * as React from 'react'
import { useTranslation } from '@/i18n'
import type { AnalyticsDateRange, AnalyticsPeriodBucket } from '../analytics.types'
import { formatAnalyticsDuration, formatCompactDuration, parseAnalyticsPeriodKey } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'

function formatBucketDate(bucket: AnalyticsPeriodBucket, range: AnalyticsDateRange, locale: string, long = false): string {
  const date = parseAnalyticsPeriodKey(bucket.key, range.granularity) ?? bucket.start
  const options: Intl.DateTimeFormatOptions = range.granularity === 'month'
    ? { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' }
    : long
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short' }
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function FocusTimeChart({
  buckets,
  range,
  locale,
  averageDuration,
  unfinishedDuration,
  onSelectPeriod,
}: {
  buckets: AnalyticsPeriodBucket[]
  range: AnalyticsDateRange
  locale: string
  averageDuration: string
  unfinishedDuration: string
  onSelectPeriod?: (start: Date, endInclusive: Date) => void
}) {
  const { t } = useTranslation()
  const titleId = React.useId()
  const descriptionId = React.useId()
  const populated = buckets.some(bucket => bucket.sessionCount > 0)
  const maxMs = Math.max(0, ...buckets.map(bucket => bucket.focusMs))
  const maxScale = maxMs > 0 ? maxMs : 1
  const width = 760
  const height = 230
  const left = 54
  const right = 12
  const top = 14
  const bottom = 32
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const step = buckets.length ? plotWidth / buckets.length : plotWidth
  const barWidth = Math.max(2, step * 0.6)
  const tickIndexes = buckets.length <= 7
    ? buckets.map((_, index) => index)
    : [0, Math.floor((buckets.length - 1) / 3), Math.floor((buckets.length - 1) * 2 / 3), buckets.length - 1]
  const localeLabel = range.granularity === 'day' ? t('insights.filters.granularityDay') : t('insights.filters.granularityMonth')
  const description = populated
    ? t('insights.focus.chartLabel', { granularity: localeLabel })
    : t('insights.focus.noData')

  return (
    <AnalyticsPanel
      title={t('insights.focus.title')}
      description={t('insights.focus.description')}
      className="h-full"
      action={
        <div className="hidden shrink-0 text-right sm:block">
          <div className="text-[10px] text-text-muted">{t('insights.focus.averageCompleted')}</div>
          <div className="mt-0.5 font-mono text-xs text-text-primary">{averageDuration}</div>
        </div>
      }
    >
      {!populated ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle px-5 text-center">
          <p className="max-w-sm text-sm text-text-secondary">{t('insights.focus.noData')}</p>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">{t('insights.focus.sessionStartNote')}</p>
        </div>
      ) : (
        <>
          <figure className="m-0 min-w-0" aria-describedby={descriptionId}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="block h-auto min-h-[190px] w-full overflow-visible"
              role="group"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
            >
              <title id={titleId}>{description}</title>
              <desc id={descriptionId}>{t('insights.focus.sessionStartNote')}</desc>
              {[0, 0.5, 1].map((fraction) => {
                const y = top + plotHeight * (1 - fraction)
                return (
                  <g key={fraction} aria-hidden="true">
                    <line x1={left} x2={width - right} y1={y} y2={y} stroke="#2b2b26" strokeDasharray={fraction === 0 ? undefined : '3 5'} />
                    <text x={left - 8} y={y + 3.5} textAnchor="end" fill="#9c9a8e" fontSize="10">
                      {formatCompactDuration(maxMs * fraction, locale)}
                    </text>
                  </g>
                )
              })}
              {buckets.map((bucket, index) => {
                const barHeight = bucket.focusMs / maxScale * plotHeight
                const x = left + index * step + (step - barWidth) / 2
                const y = top + plotHeight - barHeight
                const pointDate = formatBucketDate(bucket, range, locale, true)
                const duration = formatAnalyticsDuration(bucket.focusMs, locale)
                const label = t('insights.focus.pointLabel', {
                  date: pointDate,
                  duration,
                  count: bucket.sessionCount,
                })
                const endInclusive = range.granularity === 'month'
                  ? new Date(bucket.start.getFullYear(), bucket.start.getMonth() + 1, 0)
                  : bucket.start
                const selectPeriod = () => onSelectPeriod?.(bucket.start, endInclusive)
                return (
                  <g
                    key={bucket.key}
                    tabIndex={onSelectPeriod ? 0 : undefined}
                    role={onSelectPeriod ? 'button' : 'img'}
                    aria-label={label}
                    aria-pressed={onSelectPeriod ? false : undefined}
                    onClick={onSelectPeriod ? selectPeriod : undefined}
                    onKeyDown={onSelectPeriod ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectPeriod()
                      }
                    } : undefined}
                    className={onSelectPeriod ? 'group cursor-pointer outline-none' : undefined}
                  >
                    <title>{label}</title>
                    <rect
                      x={x}
                      y={Math.min(y, top + plotHeight - 1)}
                      width={barWidth}
                      height={Math.max(1, barHeight)}
                      rx={Math.min(3, barWidth / 2)}
                      fill="#8a9e6b"
                      fillOpacity={bucket.focusMs === 0 ? 0.14 : 0.88}
                      className="transition-[fill-opacity] duration-150 hover:fill-opacity-100 focus:fill-opacity-100 group-focus-visible:stroke-[#e8e4d8] group-focus-visible:stroke-2"
                    />
                  </g>
                )
              })}
              {tickIndexes.map(index => {
                const bucket = buckets[index]
                if (!bucket) return null
                const x = left + index * step + step / 2
                return (
                  <text key={bucket.key} x={x} y={height - 8} textAnchor="middle" fill="#9c9a8e" fontSize="10" aria-hidden="true">
                    {formatBucketDate(bucket, range, locale)}
                  </text>
                )
              })}
            </svg>
            <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-text-muted">
              <span>{t('insights.focus.sessionStartNote')}</span>
            {onSelectPeriod && <span>{t('insights.focus.selectToFilter')}</span>}
              <span className="shrink-0">{t('insights.focus.unfinished')}: {unfinishedDuration}</span>
            </figcaption>
          </figure>
          <details className="group mt-3 border-t border-border-subtle pt-2 text-xs text-text-secondary">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-sm py-1 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-olive">
              {t('insights.focus.tableSummary')}
            </summary>
            <div className="mt-2 max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#141412] text-text-muted">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">{t('insights.focus.date')}</th>
                    <th scope="col" className="py-1 pr-3 font-medium">{t('insights.focus.duration')}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t('insights.focus.sessions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map(bucket => (
                    <tr key={bucket.key} className="border-t border-border-subtle">
                      <th scope="row" className="py-1.5 pr-3 font-normal text-text-secondary">{formatBucketDate(bucket, range, locale, true)}</th>
                      <td className="py-1.5 pr-3 font-mono text-text-primary">{formatAnalyticsDuration(bucket.focusMs, locale)}</td>
                      <td className="py-1.5 text-right tabular-nums">{bucket.sessionCount}</td>
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
