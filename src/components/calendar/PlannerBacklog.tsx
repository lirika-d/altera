import * as React from 'react'
import { CalendarClock, GripVertical } from 'lucide-react'
import { PriorityIcon } from '@/components/shared/PriorityIcon'
import { Button } from '@/components/ui/button'
import { CALENDAR_DRAG_MIME, type PlannerTask, type PlannerTaskGroups } from '@/lib/planner'
import type { Project } from '@/types'
import type { TranslationKey } from '@/i18n'

type GroupKey = keyof PlannerTaskGroups
const TASKS_PER_GROUP_BATCH = 50

export function PlannerBacklog({
  groups,
  projects,
  projectFilter,
  onProjectFilter,
  onSchedule,
  onOpenTask,
  t,
  language,
}: {
  groups: PlannerTaskGroups
  projects: Project[]
  projectFilter: string
  onProjectFilter: (id: string) => void
  onSchedule: (task: PlannerTask) => void
  onOpenTask: (task: PlannerTask) => void
  t: (key: TranslationKey) => string
  language: string
}) {
  const [visibleState, setVisibleState] = React.useState<{
    projectFilter: string
    counts: Partial<Record<GroupKey, number>>
  }>({ projectFilter, counts: {} })
  const visibleCounts: Partial<Record<GroupKey, number>> = visibleState.projectFilter === projectFilter ? visibleState.counts : {}
  const sections: { key: GroupKey; tasks: PlannerTask[]; tone: string }[] = [
    { key: 'overdue', tasks: groups.overdue, tone: 'text-[#c27b66]' },
    { key: 'today', tasks: groups.today, tone: 'text-accent-olive' },
    { key: 'unscheduled', tasks: groups.unscheduled, tone: 'text-text-secondary' },
  ]
  const count = sections.reduce((sum, section) => sum + section.tasks.length, 0)
  const locale = language === 'en' ? 'en-US' : 'ru-RU'

  return (
    <aside aria-label={t('calendar.planner.title')} className="min-w-0 rounded-lg border border-border-subtle bg-[#10110f] lg:sticky lg:top-3 lg:self-start">
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg text-text-primary">{t('calendar.planner.title')}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{t('calendar.planner.instructions')}</p>
          </div>
          <span className="rounded-sm border border-border-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{count}</span>
        </div>
        <label className="mt-3 block space-y-1 text-[10px] text-text-muted">
          <span>{t('calendar.planner.filterProject')}</span>
          <select value={projectFilter} onChange={event => onProjectFilter(event.target.value)} className="calendar-input h-8 text-xs">
            <option value="all">{t('calendar.planner.allProjects')}</option>
            {projects.filter(project => project.status !== 'archived' && project.status !== 'completed').map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
      </div>

      <div className="max-h-[min(72vh,720px)] space-y-4 overflow-y-auto p-3">
        {sections.map(section => (
          <section key={section.key} aria-labelledby={`planner-${section.key}`}>
            <h3 id={`planner-${section.key}`} className={`mb-2 px-1 text-[10px] font-semibold tracking-wide ${section.tone}`}>
              {t(`calendar.planner.groups.${section.key}`)} <span className="font-mono opacity-70">{section.tasks.length}</span>
            </h3>
            {section.tasks.length ? (
              <ul className="space-y-1.5">
                {section.tasks.slice(0, visibleCounts[section.key] ?? TASKS_PER_GROUP_BATCH).map(task => (
                  <li key={task.id}>
                    <div
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData(CALENDAR_DRAG_MIME, JSON.stringify({ kind: 'task', taskId: task.id }))
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="group rounded-md border border-transparent bg-[#151613] px-2.5 py-2 hover:border-border-subtle focus-within:border-accent-olive/40"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-text-muted opacity-60" />
                        <button type="button" onClick={() => onOpenTask(task)} className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive">
                          <span className="flex items-center gap-1.5">
                            <PriorityIcon priority={task.priority} />
                            <span className="truncate text-xs font-medium text-text-primary">{task.title}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
                            {task.project && <span className="truncate">{task.project.name}</span>}
                            {task.dueDate && <span>{t('calendar.planner.due')} {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(task.dueDate)}</span>}
                          </span>
                        </button>
                        <Button type="button" variant="ghost" size="xs" className="h-7 shrink-0 px-1.5 text-[10px]" onClick={() => onSchedule(task)} aria-label={`${t('calendar.planner.schedule')} ${task.title}`}>
                          <CalendarClock aria-hidden="true" className="h-3 w-3" />
                          <span className="sr-only sm:not-sr-only">{t('calendar.planner.schedule')}</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-1 text-[11px] text-text-muted">{t('calendar.planner.emptyGroup')}</p>
            )}
            {section.tasks.length > (visibleCounts[section.key] ?? TASKS_PER_GROUP_BATCH) && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="mt-2 w-full text-[10px]"
                onClick={() => setVisibleState(previous => {
                  const counts: Partial<Record<GroupKey, number>> = previous.projectFilter === projectFilter ? previous.counts : {}
                  return {
                    projectFilter,
                    counts: { ...counts, [section.key]: (counts[section.key] ?? TASKS_PER_GROUP_BATCH) + TASKS_PER_GROUP_BATCH },
                  }
                })}
              >
                {t('common.loadMore')} ({section.tasks.length - (visibleCounts[section.key] ?? TASKS_PER_GROUP_BATCH)})
              </Button>
            )}
          </section>
        ))}
        {!count && <p className="py-6 text-center text-xs text-text-muted">{t('calendar.planner.empty')}</p>}
      </div>
    </aside>
  )
}
