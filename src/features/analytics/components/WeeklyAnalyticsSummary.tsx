import { Link } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'
import * as React from 'react'
import type { Project, Session } from '@/types'
import { calculateAnalyticsMetrics } from '../analytics.metrics'
import { formatAnalyticsDuration, getAnalyticsDateRange, getLocalDateKey, parseLocalDateKey } from '../analytics.utils'
import { useTranslation } from '@/i18n'

export function WeeklyAnalyticsSummary({
  projects,
  sessions,
  now,
  isLoading = false,
}: {
  projects: Project[]
  sessions: Session[]
  now: Date
  isLoading?: boolean
}) {
  const { t, i18n, translationReady } = useTranslation('insights')
  const nowKey = getLocalDateKey(now)
  const range = React.useMemo(
    () => getAnalyticsDateRange('7d', parseLocalDateKey(nowKey) ?? new Date(0)),
    [nowKey]
  )
  const sessionsInRange = React.useMemo(() => sessions.filter(session => (
    session.startedAt.getTime() >= range.start!.getTime() && session.startedAt.getTime() < range.end.getTime()
  )), [sessions, range])
  const metrics = React.useMemo(() => calculateAnalyticsMetrics({
    projects,
    tasks: [],
    sessions: sessionsInRange,
    activities: [],
    scheduledWorkBlocks: [],
  }, range, undefined, now), [projects, sessionsInRange, range, now])
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US'

  if (isLoading || !metrics || !translationReady) {
    return <div className="h-[76px] animate-pulse rounded-lg border border-border bg-bg-surface" aria-hidden="true" />
  }

  return (
    <section aria-labelledby="weekly-insights-title" className="flex flex-col gap-3 border-y border-border-subtle px-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-olive" />
        <div className="min-w-0">
          <h2 id="weekly-insights-title" className="font-sans text-sm font-semibold text-text-primary">{t('insights.workspace.title')}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{t('insights.workspace.summary', {
            duration: formatAnalyticsDuration(metrics.focus.totalMs, locale),
            sessions: new Intl.NumberFormat(locale).format(metrics.focus.completedSessions),
            projects: new Intl.NumberFormat(locale).format(metrics.projects.active),
          })}</p>
        </div>
      </div>
      <Link to="/insights" className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded px-2 text-xs font-medium text-accent-olive transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">
        {t('insights.workspace.open')}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}
