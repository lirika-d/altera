import type { PlannedActualSummary } from '../analytics.advanced'
import { formatAnalyticsDuration } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'
import { useTranslation } from '@/i18n'

function bucketLabel(date: Date, locale: string, monthly: boolean): string {
  return new Intl.DateTimeFormat(locale, monthly
    ? { month: 'short', year: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(date)
}

export function PlanActualPanel({
  planning,
  locale,
  monthly,
  onSelectProject,
}: {
  planning: PlannedActualSummary
  locale: string
  monthly: boolean
  onSelectProject: (projectId: string) => void
}) {
  const { t } = useTranslation('insights')
  const max = Math.max(1, ...planning.buckets.flatMap(bucket => [bucket.plannedMs, bucket.actualMs]))
  const plotHeight = 118
  const plotWidth = 700
  const groupWidth = planning.buckets.length ? plotWidth / planning.buckets.length : plotWidth
  const barWidth = Math.max(2, Math.min(16, groupWidth * 0.28))
  const tickStride = Math.max(1, Math.ceil(planning.buckets.length / 7))
  const currency = (ms: number) => formatAnalyticsDuration(ms, locale)
  const unassignedLabel = t('insights.planning.unassigned')

  return (
    <AnalyticsPanel
      title={t('insights.planning.title')}
      description={t('insights.planning.description')}
      className="min-w-0"
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border-subtle bg-[#10110f] px-3 py-2.5">
          <p className="text-[11px] text-text-muted">{t('insights.planning.planned')}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">{currency(planning.plannedMs)}</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-[#10110f] px-3 py-2.5">
          <p className="text-[11px] text-text-muted">{t('insights.planning.actual')}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">{currency(planning.actualMs)}</p>
        </div>
        <div className="col-span-2 rounded-md border border-border-subtle bg-[#10110f] px-3 py-2.5 sm:col-span-1">
          <p className="text-[11px] text-text-muted">{t('insights.planning.uncompleted')}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">{new Intl.NumberFormat(locale).format(planning.uncompletedBlockCount)}</p>
        </div>
      </div>

      {planning.buckets.some(bucket => bucket.plannedMs > 0 || bucket.actualMs > 0) ? (
        <figure className="m-0 min-w-0" aria-label={t('insights.planning.chartLabel')}>
          <div className="overflow-x-auto">
            <svg
              role="img"
              aria-label={t('insights.planning.chartLabel')}
              viewBox={`0 0 ${plotWidth} 160`}
              className="h-[180px] min-w-[560px] w-full"
              preserveAspectRatio="none"
            >
              {[0, 0.5, 1].map(fraction => {
                const y = 8 + plotHeight * (1 - fraction)
                return <line key={fraction} x1="0" x2={plotWidth} y1={y} y2={y} stroke="#30312b" strokeDasharray="2 4" />
              })}
              {planning.buckets.map((bucket, index) => {
                const center = groupWidth * index + groupWidth / 2
                const plannedHeight = bucket.plannedMs / max * plotHeight
                const actualHeight = bucket.actualMs / max * plotHeight
                const xPlanned = center - barWidth - 1
                const xActual = center + 1
                const tick = index % tickStride === 0 || index === planning.buckets.length - 1
                const date = bucketLabel(bucket.start, locale, monthly)
                return (
                  <g key={bucket.key}>
                    <g aria-label={`${date}: ${t('insights.planning.planned')} ${currency(bucket.plannedMs)}`}>
                      <title>{`${date}: ${t('insights.planning.planned')} ${currency(bucket.plannedMs)}`}</title>
                      <rect x={xPlanned} y={8 + plotHeight - plannedHeight} width={barWidth} height={Math.max(0, plannedHeight)} rx="2" fill="#8a9e6b" fillOpacity={bucket.plannedMs ? 0.9 : 0.12} />
                    </g>
                    <g aria-label={`${date}: ${t('insights.planning.actual')} ${currency(bucket.actualMs)}`}>
                      <title>{`${date}: ${t('insights.planning.actual')} ${currency(bucket.actualMs)}`}</title>
                      <rect x={xActual} y={8 + plotHeight - actualHeight} width={barWidth} height={Math.max(0, actualHeight)} rx="2" fill="#c5bda8" fillOpacity={bucket.actualMs ? 0.88 : 0.12} />
                    </g>
                    {tick && <text x={center} y="151" textAnchor="middle" fill="#9c9a8e" fontSize="10" aria-hidden="true">{date}</text>}
                  </g>
                )
              })}
            </svg>
          </div>
          <figcaption className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-text-secondary">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#8a9e6b]" aria-hidden="true" />{t('insights.planning.planned')}</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#c5bda8]" aria-hidden="true" />{t('insights.planning.actual')}</span>
            <span className="text-text-muted">{t('insights.planning.sessionStartNote')}</span>
          </figcaption>
        </figure>
      ) : (
        <p className="rounded-md border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-secondary">{t('insights.planning.empty')}</p>
      )}

      <details className="group mt-3 border-t border-border-subtle pt-2 text-xs text-text-secondary">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-sm py-1 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-olive">{t('insights.planning.tableSummary')}</summary>
        <div className="mt-2 max-h-52 overflow-auto">
          <table className="w-full min-w-[360px] text-left text-xs">
            <thead className="sticky top-0 bg-[#141412] text-text-muted"><tr>
              <th scope="col" className="py-1 pr-3 font-medium">{t('insights.focus.date')}</th>
              <th scope="col" className="py-1 pr-3 font-medium">{t('insights.planning.planned')}</th>
              <th scope="col" className="py-1 text-right font-medium">{t('insights.planning.actual')}</th>
            </tr></thead>
            <tbody>{planning.buckets.map(bucket => <tr key={bucket.key} className="border-t border-border-subtle">
              <th scope="row" className="py-1.5 pr-3 font-normal text-text-secondary">{bucketLabel(bucket.start, locale, monthly)}</th>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-text-primary">{currency(bucket.plannedMs)}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-text-primary">{currency(bucket.actualMs)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <h3 className="mb-2 text-xs font-medium text-text-secondary">{t('insights.planning.byProject')}</h3>
        {planning.projects.length === 0 ? <p className="text-xs text-text-muted">{t('insights.planning.noProjects')}</p> : (
          <ul className="m-0 space-y-1.5 p-0">
            {planning.projects.map(project => <li key={project.projectId}>
              {project.projectId === '__unassigned__' ? (
                <div className="flex min-h-10 items-center justify-between gap-3 text-xs">
                  <span className="truncate text-text-secondary">{unassignedLabel}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-muted">{currency(project.plannedMs)} / {currency(project.actualMs)}</span>
                </div>
              ) : (
                <button type="button" onClick={() => onSelectProject(project.projectId)} className="flex min-h-10 w-full items-center justify-between gap-3 rounded px-2 text-left text-xs transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">
                  <span className="min-w-0 truncate text-text-secondary">{project.name || t('insights.projects.unknown')}{project.isHistorical ? ` · ${t('insights.projects.historical')}` : ''}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-muted">{currency(project.plannedMs)} / {currency(project.actualMs)}</span>
                </button>
              )}
            </li>)}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">{t('insights.planning.uncompletedNote')}</p>
    </AnalyticsPanel>
  )
}
