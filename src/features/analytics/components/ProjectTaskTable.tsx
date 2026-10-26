import { useTranslation } from '@/i18n'
import type { ProjectTaskSummary } from '../analytics.types'
import { AnalyticsPanel } from './AnalyticsPanel'

export function ProjectTaskTable({ projects }: { projects: ProjectTaskSummary[] }) {
  const { t } = useTranslation()
  return (
    <AnalyticsPanel title={t('insights.projects.tasksTitle')} className="h-full">
      {projects.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('insights.tasks.noTasks')}</p>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded-md border border-border-subtle">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-[1] bg-[#181815] text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">{t('insights.tasks.project')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('insights.tasks.taskCount')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('insights.tasks.completed')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('insights.tasks.open')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('insights.tasks.overdue')}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => {
                const name = project.name || t('insights.projects.unknown')
                return (
                  <tr key={project.projectId} className="border-t border-border-subtle hover:bg-bg-hover/40">
                    <th scope="row" className="max-w-[280px] px-3 py-2.5 font-medium text-text-primary">
                      <span className="block truncate" title={name}>{name}</span>
                      {(project.identifier || project.isHistorical) && (
                        <span className="mt-0.5 block font-mono text-[10px] font-normal text-text-muted">
                          {project.identifier ?? `…${project.projectId.slice(-6)}`}
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary">{project.total}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary">{project.completed}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary">{project.open}</td>
                    <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${project.overdue > 0 ? 'text-accent-amber' : 'text-text-muted'}`}>{project.overdue}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AnalyticsPanel>
  )
}
