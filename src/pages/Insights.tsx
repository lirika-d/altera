import * as React from 'react'
import { Activity, CheckCircle2, Clock3, FolderKanban } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { AnalyticsRangeKey } from '@/features/analytics/analytics.types'
import { useAnalyticsMetrics } from '@/features/analytics/analytics.hooks'
import { formatAnalyticsDuration } from '@/features/analytics/analytics.utils'
import { ActivityHistory } from '@/features/analytics/components/ActivityHistory'
import { AnalyticsMetricCard } from '@/features/analytics/components/AnalyticsMetricCard'
import { FocusTimeChart } from '@/features/analytics/components/FocusTimeChart'
import { ProjectActivityList } from '@/features/analytics/components/ProjectActivityList'
import { ProjectFocusList } from '@/features/analytics/components/ProjectFocusList'
import { ProjectTaskTable } from '@/features/analytics/components/ProjectTaskTable'
import { TaskOverview } from '@/features/analytics/components/TaskOverview'
import { ComparisonPanel } from '@/features/analytics/components/ComparisonPanel'
import { PlanActualPanel } from '@/features/analytics/components/PlanActualPanel'
import { DeterministicInsightsPanel } from '@/features/analytics/components/DeterministicInsightsPanel'
import { ProjectDeepDivePanel } from '@/features/analytics/components/ProjectDeepDivePanel'
import { AnalyticsExportActions } from '@/features/analytics/components/AnalyticsExportActions'
import { getAnalyticsDateRange, getCustomAnalyticsDateRange, getLocalDateKey } from '@/features/analytics/analytics.utils'

const RANGE_OPTIONS: Exclude<AnalyticsRangeKey, 'custom'>[] = ['today', '7d', '30d', '90d', 'all']

function formatPeriodBounds(metrics: NonNullable<ReturnType<typeof useAnalyticsMetrics>['metrics']>, locale: string): { start: string; end: string } | undefined {
  if (metrics.range.key === 'all' || !metrics.range.start) return undefined
  const lastDay = new Date(metrics.range.end.getTime() - 1)
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  return { start: format.format(metrics.range.start), end: format.format(lastDay) }
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-[110px] animate-pulse rounded-xl border border-border-subtle bg-[#141412]" />
      ))}
      <div className="h-[330px] animate-pulse rounded-xl border border-border-subtle bg-[#141412] sm:col-span-2 xl:col-span-3" />
      <div className="h-[330px] animate-pulse rounded-xl border border-border-subtle bg-[#141412]" />
    </div>
  )
}

export function Insights() {
  const { t, i18n, translationReady } = useTranslation('insights')
  const [rangeKey, setRangeKey] = React.useState<AnalyticsRangeKey>('30d')
  const [projectId, setProjectId] = React.useState('')
  const [customMode, setCustomMode] = React.useState(false)
  const [compareEnabled, setCompareEnabled] = React.useState(true)
  const [customStart, setCustomStart] = React.useState(() => {
    const range = getAnalyticsDateRange('30d', new Date())
    return getLocalDateKey(range.start!)
  })
  const [customEnd, setCustomEnd] = React.useState(() => getLocalDateKey(new Date()))
  const customRange = React.useMemo(
    () => customMode ? getCustomAnalyticsDateRange(customStart, customEnd) : undefined,
    [customMode, customStart, customEnd]
  )
  const customRangeInvalid = customMode && customRange === undefined
  const { now, metrics, planning, comparison, insights, projectDeepDive, projects, isLoading } = useAnalyticsMetrics(
    customMode ? 'custom' : rangeKey,
    projectId || undefined,
    customRange
  )
  const todayKey = getLocalDateKey(now)
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US'
  const canCompare = Boolean(metrics?.range.start) && metrics?.range.key !== 'all'
  const activeComparison = compareEnabled && canCompare ? comparison : undefined
  const periodBounds = metrics ? formatPeriodBounds(metrics, locale) : undefined
  const periodLabel = periodBounds
    ? `${periodBounds.start} — ${periodBounds.end}`
    : metrics
      ? t('insights.filters.allContext')
      : t('common.loading')
  const periodContext = periodBounds
    ? t('insights.filters.rangeContext', periodBounds)
    : periodLabel

  const resetFilters = () => {
    setRangeKey('30d')
    setProjectId('')
    setCustomMode(false)
    setCompareEnabled(true)
    const range = getAnalyticsDateRange('30d', new Date())
    setCustomStart(getLocalDateKey(range.start!))
    setCustomEnd(getLocalDateKey(new Date()))
  }

  return (
    <div className="min-h-full overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-9 lg:py-8">
      <div className="mx-auto max-w-[1480px] space-y-5 sm:space-y-6">
        <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{t('insights.eyebrow')}</p>
            <h1 className="mt-1 font-serif text-[1.7rem] leading-tight tracking-tight text-text-primary sm:text-3xl">{t('insights.title')}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">{t('insights.subtitle')}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:items-end">
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-1.5 text-[11px] text-text-muted">{t('insights.filters.period')}</legend>
              <div className="flex max-w-full flex-wrap gap-1 rounded-lg border border-border-subtle bg-[#10110f] p-1" role="group" aria-label={t('insights.filters.period')}>
                {RANGE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setCustomMode(false); setRangeKey(option) }}
                    aria-pressed={!customMode && rangeKey === option}
                    className={`min-h-11 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive sm:px-3 ${!customMode && rangeKey === option ? 'bg-[#273220] text-[#d7dfcb]' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
                  >
                    {t(`insights.filters.${option}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  aria-pressed={customMode}
                  className={`min-h-11 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive sm:px-3 ${customMode ? 'bg-[#273220] text-[#d7dfcb]' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
                >{t('insights.filters.custom')}</button>
              </div>
            </fieldset>

            {customMode && (
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-text-muted">
                  {t('insights.filters.startDate')}
                  <input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className="min-h-11 min-w-0 rounded-md border border-border bg-[#10110f] px-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-olive" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-text-muted">
                  {t('insights.filters.endDate')}
                  <input type="date" value={customEnd} min={customStart} max={todayKey} onChange={event => setCustomEnd(event.target.value)} className="min-h-11 min-w-0 rounded-md border border-border bg-[#10110f] px-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-olive" />
                </label>
              </div>
            )}

            <label className="flex min-w-0 items-center gap-2 text-xs text-text-secondary">
              <span className="shrink-0">{t('insights.filters.project')}</span>
              <select
                value={projectId}
                onChange={event => setProjectId(event.target.value)}
                className="min-h-11 min-w-0 max-w-[250px] rounded-md border border-border bg-[#10110f] px-3 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-olive"
              >
                <option value="">{t('insights.filters.allProjects')}</option>
                {projects?.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
                {projectId && !projects?.some(project => project.id === projectId) && (
                  <option value={projectId}>{planning?.projects.find(project => project.projectId === projectId)?.name || t('insights.projects.historical')}</option>
                )}
              </select>
            </label>
          </div>
        </header>

        <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
          <label className={`inline-flex min-h-11 items-center gap-2 text-xs ${canCompare ? 'text-text-secondary' : 'text-text-muted'}`}>
            <input type="checkbox" checked={compareEnabled} disabled={!canCompare} onChange={event => setCompareEnabled(event.target.checked)} className="h-4 w-4 accent-[#8a9e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive" />
            <span>{t('insights.filters.compare')}</span>
          </label>
          <div className="flex flex-col gap-2 sm:items-end">
            {!customRangeInvalid && metrics && planning && <AnalyticsExportActions metrics={metrics} planning={planning} comparison={activeComparison} projectId={projectId || undefined} />}
            <button type="button" onClick={resetFilters} className="min-h-11 rounded px-2 text-left text-xs text-text-muted underline underline-offset-4 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive sm:text-right">{t('insights.filters.reset')}</button>
          </div>
        </div>

        <p className="-mt-2 text-[11px] text-text-muted" aria-live="polite">
          {periodContext}
        </p>

        {customRangeInvalid ? (
          <p role="alert" className="rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-4 py-3 text-sm text-text-secondary">{t('insights.filters.invalidCustomRange')}</p>
        ) : isLoading || !translationReady || !metrics || !planning || !insights ? (
          <LoadingPanel label={t('common.loading')} />
        ) : (
          <>
            {(metrics.focus.excludedSessionCount > 0) && (
              <div role="status" className="space-y-1 rounded-lg border border-accent-amber/25 bg-accent-amber/5 px-4 py-3 text-xs leading-relaxed text-text-secondary">
                {metrics.focus.overlapConflictCount > 0 && (
                  <p>{t('insights.warnings.overlap', { count: metrics.focus.overlapConflictCount })}</p>
                )}
                {metrics.focus.excludedSessionCount > metrics.focus.overlapConflictCount && (
                  <p>{t('insights.warnings.invalidSessions', { count: metrics.focus.excludedSessionCount - metrics.focus.overlapConflictCount })}</p>
                )}
              </div>
            )}

            <section aria-labelledby="insights-overview-heading">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="insights-overview-heading" className="font-serif text-lg text-text-primary">{t('insights.overview.title')}</h2>
                <span className="text-[10px] text-text-muted">{periodLabel}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsMetricCard
                  label={t('insights.overview.focusTime')}
                  value={formatAnalyticsDuration(metrics.focus.totalMs, locale)}
                  detail={metrics.focus.unfinishedMs > 0
                    ? t('insights.overview.includesUnfinished', { duration: formatAnalyticsDuration(metrics.focus.unfinishedMs, locale) })
                    : t('insights.overview.focusTimeHint')}
                  icon={Clock3}
                />
                <AnalyticsMetricCard
                  label={t('insights.overview.completedSessions')}
                  value={new Intl.NumberFormat(locale).format(metrics.focus.completedSessions)}
                  detail={t('insights.focus.sessionStartNote')}
                  icon={Activity}
                />
                <AnalyticsMetricCard
                  label={t('insights.overview.completedTasks')}
                  value={new Intl.NumberFormat(locale).format(metrics.tasks.completedInRange)}
                  detail={metrics.tasks.completedWithoutTimestamp > 0
                    ? t('insights.tasks.missingTimestamp', { count: metrics.tasks.completedWithoutTimestamp })
                    : t('insights.tasks.currentNote')}
                  icon={CheckCircle2}
                />
                <AnalyticsMetricCard
                  label={t('insights.overview.activeProjects')}
                  value={new Intl.NumberFormat(locale).format(metrics.projects.active)}
                  detail={t('insights.overview.currentProjectStatuses')}
                  icon={FolderKanban}
                />
              </div>
            </section>

            {activeComparison && <ComparisonPanel comparison={activeComparison} locale={locale} />}

            <section className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.9fr)]" aria-label={t('insights.focus.title')}>
              <FocusTimeChart
                buckets={metrics.focusSeries}
                range={metrics.range}
                locale={locale}
                averageDuration={formatAnalyticsDuration(metrics.focus.averageCompletedMs, locale)}
                unfinishedDuration={formatAnalyticsDuration(metrics.focus.unfinishedMs, locale)}
                onSelectPeriod={(start, endInclusive) => {
                  setCustomStart(getLocalDateKey(start))
                  setCustomEnd(getLocalDateKey(endInclusive) > todayKey ? todayKey : getLocalDateKey(endInclusive))
                  setCustomMode(true)
                }}
              />
              <ProjectFocusList projects={metrics.projects.focus} locale={locale} onSelectProject={setProjectId} selectedProjectId={projectId} />
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.8fr)]" aria-label={t('insights.planning.title')}>
              <PlanActualPanel planning={planning} locale={locale} monthly={metrics.range.granularity === 'month'} onSelectProject={setProjectId} />
              <DeterministicInsightsPanel insights={insights} metrics={metrics} locale={locale} onSelectProject={setProjectId} />
            </section>

            {projectDeepDive && <ProjectDeepDivePanel detail={projectDeepDive} locale={locale} />}

            <section className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.9fr)_minmax(270px,0.9fr)]" aria-label={t('insights.tasks.title')}>
              <TaskOverview metrics={metrics} locale={locale} />
              <ActivityHistory buckets={metrics.activitySeries} range={metrics.range} locale={locale} />
              <ProjectActivityList projects={metrics.projects.activity} withoutActivity={metrics.projects.withoutActivity} locale={locale} />
            </section>

            <ProjectTaskTable projects={metrics.projects.tasks} />

            {metrics.tasks.completedWithoutTimestamp > 0 && (
              <p className="sr-only" role="note">{t('insights.tasks.missingTimestamp', { count: metrics.tasks.completedWithoutTimestamp })}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
