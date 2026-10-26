import { useTranslation } from '@/i18n'
import type { ProjectFocusSummary } from '../analytics.types'
import { formatAnalyticsDuration, safeProjectColor } from '../analytics.utils'
import { AnalyticsPanel } from './AnalyticsPanel'

export function ProjectFocusList({
  projects,
  locale,
  onSelectProject,
  selectedProjectId,
}: {
  projects: ProjectFocusSummary[]
  locale: string
  onSelectProject?: (projectId: string) => void
  selectedProjectId?: string
}) {
  const { t } = useTranslation()
  const totalMs = projects.reduce((sum, project) => sum + project.focusMs, 0)

  return (
    <AnalyticsPanel title={t('insights.projects.timeTitle')} description={t('insights.projects.timeDescription')} className="h-full">
      {projects.length === 0 ? (
        <p className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border-subtle px-5 text-center text-sm text-text-secondary">
          {t('insights.projects.noTime')}
        </p>
      ) : (
        <ol className="m-0 max-h-[355px] list-none space-y-4 overflow-y-auto p-0 pr-1">
          {projects.map(project => {
            const share = totalMs > 0 ? project.focusMs / totalMs * 100 : 0
            const name = project.name || t('insights.projects.unknown')
            const color = safeProjectColor(project.color)
            return (
              <li key={project.projectId}>
                <button
                  type="button"
                  onClick={() => onSelectProject?.(selectedProjectId === project.projectId ? '' : project.projectId)}
                  aria-pressed={selectedProjectId === project.projectId}
                  aria-label={`${name}, ${formatAnalyticsDuration(project.focusMs, locale)}, ${Math.round(share)}%`}
                  className="w-full rounded-md p-1 text-left transition-colors hover:bg-bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary" title={name}>{name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
                          {project.identifier && <span className="font-mono">{project.identifier}</span>}
                          {project.isHistorical
                            ? <span>{t('insights.projects.historical')}</span>
                            : project.status && <span>{t(`insights.projects.status.${project.status}`)}</span>}
                          {project.isHistorical && !project.identifier && <span className="font-mono">…{project.projectId.slice(-6)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs tabular-nums text-text-primary">{formatAnalyticsDuration(project.focusMs, locale)}</div>
                      <div className="mt-0.5 text-[10px] tabular-nums text-text-muted">{Math.round(share)}% · {project.sessionCount}</div>
                    </div>
                  </div>
                  <div className="ml-[1.125rem] mt-2 h-1.5 overflow-hidden rounded-full bg-[#282823]" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </AnalyticsPanel>
  )
}
