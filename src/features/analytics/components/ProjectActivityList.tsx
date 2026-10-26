import { useTranslation } from '@/i18n'
import type { ProjectActivitySummary } from '../analytics.types'
import { AnalyticsPanel } from './AnalyticsPanel'

function formatLastActivity(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function ProjectActivityList({
  projects,
  withoutActivity,
  locale,
}: {
  projects: ProjectActivitySummary[]
  withoutActivity: ProjectActivitySummary[]
  locale: string
}) {
  const { t } = useTranslation()
  const recent = projects.filter(project => project.lastActivityAt).slice(0, 4)
  const missing = withoutActivity.slice(0, 4)

  return (
    <AnalyticsPanel title={t('insights.projects.activityTitle')} description={t('insights.projects.activityDescription')} className="h-full">
      {recent.length === 0 && missing.length === 0 ? (
        <p className="flex min-h-[184px] items-center justify-center text-center text-sm text-text-secondary">
          {t('insights.projects.noActivity')}
        </p>
      ) : (
        <div className="space-y-4">
          {recent.length > 0 && (
            <ul className="space-y-2.5">
              {recent.map(project => (
                <li key={project.projectId} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-text-primary" title={project.name}>{project.name}</div>
                    <div className="mt-0.5 text-[10px] text-text-muted">{t(`insights.projects.status.${project.status}`)}</div>
                  </div>
                  {project.lastActivityAt && (
                    <time className="shrink-0 text-right text-[10px] leading-relaxed text-text-secondary" dateTime={project.lastActivityAt.toISOString()}>
                      {formatLastActivity(project.lastActivityAt, locale)}
                    </time>
                  )}
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <div className="border-t border-border-subtle pt-3">
              <h3 className="mb-2 text-[11px] font-medium text-text-muted">{t('insights.projects.withoutActivity')}</h3>
              <ul className="space-y-1.5">
                {missing.map(project => (
                  <li key={project.projectId} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                    <span className="truncate text-text-secondary" title={project.name}>{project.name}</span>
                    <span className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-[9px] text-text-muted">{t('insights.projects.status.active')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AnalyticsPanel>
  )
}
