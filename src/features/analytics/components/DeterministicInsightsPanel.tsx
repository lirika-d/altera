import { Link } from 'react-router-dom'
import type { AnalyticsMetrics } from '../analytics.types'
import type { DeterministicInsight } from '../analytics.advanced'
import { formatAnalyticsDuration } from '../analytics.utils'
import { useTranslation } from '@/i18n'
import { AnalyticsPanel } from './AnalyticsPanel'

export function DeterministicInsightsPanel({
  insights,
  metrics,
  locale,
  onSelectProject,
}: {
  insights: DeterministicInsight[]
  metrics: AnalyticsMetrics
  locale: string
  onSelectProject: (projectId: string) => void
}) {
  const { t } = useTranslation('insights')
  const projectName = (id: string | undefined) => metrics.projects.activity.find(project => project.projectId === id)?.name
    || metrics.projects.focus.find(project => project.projectId === id)?.name
    || t('insights.projects.unknown')

  return (
    <AnalyticsPanel title={t('insights.automatic.title')} description={t('insights.automatic.description')}>
      {insights.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-subtle px-4 py-5 text-sm leading-relaxed text-text-secondary">{t('insights.automatic.empty')}</p>
      ) : (
        <ul className="m-0 divide-y divide-border-subtle p-0">
          {insights.map(insight => {
            let message = ''
            if (insight.id === 'focus_change') {
              message = t('insights.automatic.messages.focus_change', {
                current: formatAnalyticsDuration(insight.value, locale),
                previous: formatAnalyticsDuration(insight.secondaryValue ?? 0, locale),
              })
            } else if (insight.id === 'project_inactivity') {
              message = t('insights.automatic.messages.project_inactivity', { project: projectName(insight.projectId) })
            } else if (insight.id === 'overdue_tasks') {
              message = t('insights.automatic.messages.overdue_tasks', { count: new Intl.NumberFormat(locale).format(insight.value) })
            } else if (insight.id === 'planning_gap') {
              message = t('insights.automatic.messages.planning_gap', {
                planned: formatAnalyticsDuration(insight.value, locale),
                actual: formatAnalyticsDuration(insight.secondaryValue ?? 0, locale),
              })
            } else {
              const share = insight.secondaryValue ? Math.round(insight.value / insight.secondaryValue * 100) : 0
              message = t('insights.automatic.messages.project_concentration', {
                project: projectName(insight.projectId),
                share: new Intl.NumberFormat(locale).format(share),
              })
            }
            return (
              <li key={`${insight.id}:${insight.projectId ?? 'all'}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <p className="m-0 max-w-3xl text-sm leading-relaxed text-text-secondary">{message}</p>
                {insight.id === 'overdue_tasks' ? (
                  <Link to="/my-tasks" className="inline-flex min-h-11 shrink-0 items-center rounded text-xs text-accent-olive underline underline-offset-4 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">{t('insights.automatic.openTasks')}</Link>
                ) : insight.projectId && (insight.id === 'project_inactivity' || insight.id === 'project_concentration') ? (
                  <button type="button" onClick={() => onSelectProject(insight.projectId!)} className="min-h-11 shrink-0 rounded px-2 text-left text-xs text-accent-olive underline underline-offset-4 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">{t('insights.automatic.viewProject')}</button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </AnalyticsPanel>
  )
}
