import { CalendarClock, CalendarDays, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjectCalendar } from '@/hooks/useProjectCalendar'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { useTranslation } from '@/i18n'
import { appRoutes } from '@/lib/appRoutes'
import { localDateKey } from '@/lib/calendarDates'
import { formatCompactDuration } from '@/lib/planner'

export function ProjectScheduleSection({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation()
  const summary = useProjectCalendar(projectId)
  const todayKey = localDateKey(useMinuteNow())
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US'

  return (
    <section aria-labelledby="project-schedule-title" className="rounded-xl border border-border bg-bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
        <div>
          <h3 id="project-schedule-title" className="font-serif text-base text-text-primary">{t('calendar.projectSchedule.title')}</h3>
          <p className="mt-0.5 text-[10px] text-text-muted">{t('calendar.projectSchedule.plannedTime')}: {formatCompactDuration(summary.plannedDurationMs, i18n.language)}</p>
        </div>
        <Link to={appRoutes.calendar()} className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-2.5 text-[11px] text-text-secondary hover:border-accent-olive/40 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive">
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{t('calendar.projectSchedule.openCalendar')}
        </Link>
      </div>
      <div className="grid divide-y divide-border-subtle md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary"><CalendarClock aria-hidden="true" className="h-3 w-3 text-accent-olive" />{t('calendar.projectSchedule.upcoming')}</h4>
          {summary.blocks.length ? <ul className="space-y-1.5">{summary.blocks.slice(0, 4).map(block => <li key={block.id}><Link to={appRoutes.calendarBlock(block.id)} className="flex items-center justify-between gap-3 rounded px-1.5 py-1 text-xs hover:bg-bg-elevated focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive">
            <span className="min-w-0 truncate text-text-primary">{block.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-text-muted">{new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(block.scheduledStart)} · {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(block.scheduledStart)}</span>
          </Link></li>)}</ul> : <p className="py-2 text-[11px] text-text-muted">{t('calendar.projectSchedule.noUpcoming')}</p>}
        </div>
        <div className="p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary"><Clock3 aria-hidden="true" className="h-3 w-3 text-[#c27b66]" />{t('calendar.projectSchedule.deadlines')}</h4>
          {summary.deadlines.length ? <ul className="space-y-1.5">{summary.deadlines.slice(0, 4).map(task => <li key={task.id}><Link to={appRoutes.task(task.id, task.projectId)} className="flex items-center justify-between gap-3 rounded px-1.5 py-1 text-xs hover:bg-bg-elevated focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive">
            <span className="min-w-0 truncate text-text-primary">{task.title}</span>
            <span className={`shrink-0 font-mono text-[10px] ${localDateKey(task.dueDate!) < todayKey ? 'text-[#c27b66]' : 'text-text-muted'}`}>{new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(task.dueDate!)}</span>
          </Link></li>)}</ul> : <p className="py-2 text-[11px] text-text-muted">{t('calendar.projectSchedule.noDeadlines')}</p>}
        </div>
      </div>
    </section>
  )
}
