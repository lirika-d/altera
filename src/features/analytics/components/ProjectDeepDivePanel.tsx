import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ProjectDeepDive } from '../analytics.advanced'
import { formatAnalyticsDuration } from '../analytics.utils'
import { useTranslation } from '@/i18n'
import { AnalyticsPanel } from './AnalyticsPanel'

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getTimelineKindLabel(kind: ProjectDeepDive['timeline'][number]['kind'], t: ReturnType<typeof useTranslation>['t']): string {
  if (kind === 'session') return t('insights.deepDive.kind.session')
  if (kind === 'task') return t('insights.deepDive.kind.task')
  if (kind === 'project') return t('insights.deepDive.kind.project')
  return t('insights.deepDive.kind.calendar')
}

function getEventLabel(label: string, t: ReturnType<typeof useTranslation>['t']): string {
  switch (label) {
    case 'task_created': return t('insights.deepDive.events.taskCreated')
    case 'task_completed': return t('insights.deepDive.events.taskCompleted')
    case 'task_deleted': return t('insights.deepDive.events.taskDeleted')
    case 'project_created': return t('insights.deepDive.events.projectCreated')
    case 'project_updated': return t('insights.deepDive.events.projectUpdated')
    case 'next_action_set': return t('insights.deepDive.events.nextActionSet')
    default: return t('insights.deepDive.events.unknown')
  }
}

export function ProjectDeepDivePanel({ detail, locale }: { detail: ProjectDeepDive; locale: string }) {
  const { t } = useTranslation('insights')
  const stats = [
    [t('insights.deepDive.actual'), formatAnalyticsDuration(detail.actualMs, locale)],
    [t('insights.deepDive.completedSessions'), new Intl.NumberFormat(locale).format(detail.completedSessions)],
    [t('insights.deepDive.openTasks'), new Intl.NumberFormat(locale).format(detail.openTasks)],
    [t('insights.deepDive.completedTasks'), new Intl.NumberFormat(locale).format(detail.completedTasks)],
    [t('insights.deepDive.completedInPeriod'), new Intl.NumberFormat(locale).format(detail.completedInRange)],
    [t('insights.deepDive.overdueTasks'), new Intl.NumberFormat(locale).format(detail.overdueTasks)],
    [t('insights.deepDive.planned'), formatAnalyticsDuration(detail.plannedMs, locale)],
    [t('insights.deepDive.uncompletedBlocks'), new Intl.NumberFormat(locale).format(detail.uncompletedBlockCount)],
  ]

  return (
    <AnalyticsPanel
      title={t('insights.deepDive.title', { project: detail.name || t('insights.projects.unknown') })}
      description={t('insights.deepDive.description')}
      action={!detail.isHistorical ? (
        <Link to={`/projects/${encodeURIComponent(detail.projectId)}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded px-2 text-xs text-accent-olive hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">
          {t('insights.deepDive.openWorkspace')}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    >
      {detail.isHistorical && <p className="mb-3 rounded border border-border-subtle px-3 py-2 text-xs text-text-muted">{t('insights.projects.historical')}</p>}
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {stats.map(([label, value]) => (
          <div key={label} className="min-w-0 border-l border-border-subtle pl-2.5">
            <dt className="text-[10px] leading-relaxed text-text-muted">{label}</dt>
            <dd className="m-0 mt-1 truncate font-mono text-xs tabular-nums text-text-primary" title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-4 border-t border-border-subtle pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="font-serif text-base text-text-primary">{t('insights.deepDive.activityTitle')}</h3>
            {detail.lastRecordedActivityAt && <time className="text-[10px] text-text-muted" dateTime={detail.lastRecordedActivityAt.toISOString()}>{t('insights.deepDive.lastActivity')}: {formatDate(detail.lastRecordedActivityAt, locale)}</time>}
          </div>
          {detail.timeline.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-subtle px-3 py-5 text-sm text-text-secondary">{t('insights.deepDive.noActivity')}</p>
          ) : (
            <ol className="m-0 max-h-64 list-none space-y-0 overflow-auto p-0">
              {detail.timeline.map(item => {
                const kindLabel = getTimelineKindLabel(item.kind, t)
                return (
                  <li key={item.id} className="grid grid-cols-[minmax(95px,auto)_minmax(0,1fr)] gap-3 border-l border-border-subtle py-2 pl-3 first:pt-1 last:pb-1">
                    <time className="text-[10px] leading-relaxed text-text-muted" dateTime={item.at.toISOString()}>{formatDate(item.at, locale)}</time>
                    <div className="min-w-0">
                      <div className="text-[10px] text-accent-olive">{kindLabel}</div>
                      <p className="m-0 truncate text-xs text-text-primary" title={item.label}>{item.kind === 'task' || item.kind === 'project' ? getEventLabel(item.label, t) : item.label}</p>
                      {item.kind === 'session' && item.durationMs !== undefined && <p className="mt-0.5 text-[10px] text-text-muted">{formatAnalyticsDuration(item.durationMs, locale)}{item.scheduledBlockId ? ` · ${t('insights.deepDive.linkedBlock', { title: item.linkedBlockTitle || item.scheduledBlockId.slice(-6) })}` : ''}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <aside className="rounded-md border border-border-subtle bg-[#10110f] p-3">
          <h3 className="font-serif text-base text-text-primary">{t('insights.deepDive.timeSplit')}</h3>
          <dl className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs"><dt className="text-text-secondary">{t('insights.planning.planned')}</dt><dd className="m-0 font-mono tabular-nums text-text-primary">{formatAnalyticsDuration(detail.plannedMs, locale)}</dd></div>
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2 text-xs"><dt className="text-text-secondary">{t('insights.planning.actual')}</dt><dd className="m-0 font-mono tabular-nums text-text-primary">{formatAnalyticsDuration(detail.actualMs, locale)}</dd></div>
          </dl>
          <p className="mb-0 mt-3 text-[10px] leading-relaxed text-text-muted">{t('insights.planning.relationshipNote')}</p>
        </aside>
      </div>
    </AnalyticsPanel>
  )
}
