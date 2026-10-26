import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, CalendarDays, CalendarClock, Clock3, GripVertical, Plus, Timer, Trash2 } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { TranslationKey } from '@/i18n'
import { useCalendarData } from '@/hooks/useCalendarData'
import { usePlannerTasks } from '@/hooks/usePlannerTasks'
import { useProjects } from '@/hooks/useProjects'
import { useActiveSession } from '@/hooks/useSessions'
import { useAllTasks } from '@/hooks/useTasks'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { createScheduledWorkBlock, deleteScheduledWorkBlock, getScheduledWorkBlockById, updateScheduledWorkBlock, WorkBlockError } from '@/db/calendar'
import { db } from '@/db/db'
import { appRoutes } from '@/lib/appRoutes'
import { appPreferencesStore } from '@/lib/appPreferences'
import { useAppPreferences } from '@/hooks/useAppPreferences'
import { addCalendarDays, addCalendarMonths, getCalendarRange, localDateKey, localDateTimeAfterMinutes, localTimeValue, parseLocalDateTime, type CalendarLocale } from '@/lib/calendarDates'
import { layoutOverlappingBlocks } from '@/lib/calendarLayout'
import { CALENDAR_DRAG_MIME, calendarDropEffect, calendarDropStart, formatCompactDuration, groupPlannerTasks, readCalendarDragPayload, snapCalendarOffsetToMinutes, sumActualDuration, sumPlannedDuration, type CalendarDragPayload, type PlannerTask } from '@/lib/planner'
import type { ScheduledWorkBlock, ScheduledWorkBlockInput, WorkBlockStatus } from '@/types/calendar'
import { computeElapsedMs } from '@/db/sessions'
import type { Project, Session, Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PlannerBacklog } from '@/components/calendar/PlannerBacklog'
import { usePlannerReminderLead, setPlannerReminderLead } from '@/hooks/usePlannerReminders'

type CalendarView = 'day' | 'week' | 'month'
const EMPTY_PROJECTS: Project[] = []
const EMPTY_TASKS: Task[] = []
const EMPTY_DATE = new Date(0)
const CALENDAR_ERROR_KEYS: Record<string, TranslationKey> = {
  WORK_BLOCK_NOT_FOUND: 'calendar.errors.WORK_BLOCK_NOT_FOUND',
  WORK_BLOCK_INVALID_INPUT: 'calendar.errors.WORK_BLOCK_INVALID_INPUT',
  WORK_BLOCK_INVALID_DATE: 'calendar.errors.WORK_BLOCK_INVALID_DATE',
  WORK_BLOCK_INVALID_DURATION: 'calendar.errors.WORK_BLOCK_INVALID_DURATION',
  WORK_BLOCK_INVALID_STATUS: 'calendar.errors.WORK_BLOCK_INVALID_STATUS',
  WORK_BLOCK_INVALID_RANGE: 'calendar.errors.WORK_BLOCK_INVALID_RANGE',
  PROJECT_NOT_FOUND: 'calendar.errors.PROJECT_NOT_FOUND',
  TASK_NOT_FOUND: 'calendar.errors.TASK_NOT_FOUND',
  TASK_PROJECT_MISMATCH: 'calendar.errors.TASK_PROJECT_MISMATCH',
  INVALID_LOCAL_TIME: 'calendar.errors.INVALID_LOCAL_TIME',
  SAVE_FAILED: 'calendar.errors.SAVE_FAILED',
}

function calendarErrorKey(code: string): TranslationKey {
  return CALENDAR_ERROR_KEYS[code] ?? 'calendar.errors.SAVE_FAILED'
}

function formatLongDate(date: Date, lang: CalendarLocale): string {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function formatMonth(date: Date, lang: CalendarLocale): string {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' }).format(date)
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function CalendarToolbar({
  date, view, locale, onView, onDate, onCreate, t,
}: {
  date: Date
  view: CalendarView
  locale: CalendarLocale
  onView: (view: CalendarView) => void
  onDate: (date: Date) => void
  onCreate: () => void
  t: (key: TranslationKey) => string
}) {
  const move = (amount: number) => {
    onDate(view === 'day' ? addCalendarDays(date, amount) : view === 'week' ? addCalendarDays(date, amount * 7) : addCalendarMonths(date, amount))
  }
  const dateLabel = view === 'month' ? formatMonth(date, locale) : view === 'day' ? formatLongDate(date, locale) : (() => {
    const { start } = getCalendarRange(date, 'week', locale)
    const end = addCalendarDays(start, 6)
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    return `${new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', options).format(start)} — ${new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { ...options, year: 'numeric' }).format(end)}`
  })()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-olive/25 bg-[#273220]/60 text-accent-olive">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[20px] capitalize leading-tight text-text-primary sm:text-2xl">{dateLabel}</h1>
          <p className="mt-0.5 text-[11px] text-text-muted">{t('calendar.subtitle')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onDate(new Date())}>{t('calendar.today')}</Button>
        <div className="flex items-center rounded-md border border-border-subtle bg-bg-base">
          <button type="button" aria-label={t('calendar.previous')} onClick={() => move(-1)} className="flex h-7 w-7 items-center justify-center text-text-secondary hover:text-text-primary"><ArrowLeft className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label={t('calendar.next')} onClick={() => move(1)} className="flex h-7 w-7 items-center justify-center text-text-secondary hover:text-text-primary"><ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        <div role="tablist" aria-label={t('calendar.views')} className="flex rounded-md border border-border-subtle bg-bg-base p-0.5">
          {(['day', 'week', 'month'] as const).map(item => (
            <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => onView(item)} className={`rounded px-2 py-1 text-[11px] transition-colors ${view === item ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}>
              {t(`calendar.${item}`)}
            </button>
          ))}
        </div>
        <Button variant="olive" size="sm" onClick={onCreate}><Plus className="h-3.5 w-3.5" />{t('calendar.newBlock')}</Button>
      </div>
    </div>
  )
}

function BlockDialog({
  open, block, initialStart, initialTask, projects, tasks, sessions, now, activeSession, onClose, onStartFocus, onOpenSession, onOpenTask, onOpenProject, t,
}: {
  open: boolean
  block: ScheduledWorkBlock | null
  initialStart: Date | null
  initialTask: PlannerTask | null
  projects: Project[]
  tasks: Task[]
  sessions: Session[]
  now: Date
  activeSession?: Session
  onClose: (saved: boolean) => void
  onStartFocus: (block: ScheduledWorkBlock) => void
  onOpenSession: (sessionId: string) => void
  onOpenTask: (taskId: string, projectId?: string) => void
  onOpenProject: (projectId: string) => void
  t: (key: TranslationKey) => string
}) {
  const { i18n } = useTranslation()
  const start = block?.scheduledStart ?? initialStart ?? EMPTY_DATE
  const defaultEnd = localDateTimeAfterMinutes(start, 60)
  const [title, setTitle] = React.useState(() => block?.title ?? initialTask?.title ?? '')
  const [description, setDescription] = React.useState(() => block?.description ?? '')
  const [projectId, setProjectId] = React.useState(() => block?.projectId ?? initialTask?.projectId ?? '')
  const [taskId, setTaskId] = React.useState(() => block?.taskId ?? initialTask?.id ?? '')
  const [startDate, setStartDate] = React.useState(() => localDateKey(start))
  const [startTime, setStartTime] = React.useState(() => localTimeValue(start))
  const [endDate, setEndDate] = React.useState(() => block?.scheduledEnd ? localDateKey(block.scheduledEnd) : defaultEnd.date)
  const [endTime, setEndTime] = React.useState(() => block?.scheduledEnd ? localTimeValue(block.scheduledEnd) : defaultEnd.time)
  const [status, setStatus] = React.useState<WorkBlockStatus>(() => block?.status ?? 'planned')
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const availableTasks = tasks.filter(task => !projectId || task.projectId === projectId)
  const actualDuration = sumActualDuration(sessions, now.getTime())
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const input: ScheduledWorkBlockInput = {
        title, description, projectId: projectId || undefined, taskId: taskId || undefined,
        scheduledStart: block && localDateKey(block.scheduledStart) === startDate && localTimeValue(block.scheduledStart) === startTime
          ? block.scheduledStart : parseLocalDateTime(startDate, startTime),
        scheduledEnd: block && localDateKey(block.scheduledEnd) === endDate && localTimeValue(block.scheduledEnd) === endTime
          ? block.scheduledEnd : parseLocalDateTime(endDate, endTime),
        status,
      }
      if (block) await updateScheduledWorkBlock(block.id, input)
      else await createScheduledWorkBlock(input)
      onClose(true)
    } catch (err) {
      const code = err instanceof WorkBlockError ? err.code : err instanceof RangeError ? 'INVALID_LOCAL_TIME' : 'SAVE_FAILED'
      setError(t(calendarErrorKey(code)))
    } finally {
      setSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!block) return
    setSaving(true)
    setError('')
    try {
      await deleteScheduledWorkBlock(block.id)
      onClose(true)
    } catch {
      setError(t('calendar.errors.SAVE_FAILED'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!value && !saving) onClose(false) }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{block ? t('calendar.editBlock') : t('calendar.newBlock')}</DialogTitle>
          <DialogDescription>{t('calendar.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <Field label={t('calendar.title')}>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required className="calendar-input" />
          </Field>
          <Field label={t('calendar.description')}>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000} className="calendar-input resize-y" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('calendar.startDate')}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="calendar-input" />
            </Field>
            <Field label={t('calendar.startTime')}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="calendar-input" />
            </Field>
            <Field label={t('calendar.endDate')}>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="calendar-input" />
            </Field>
            <Field label={t('calendar.endTime')}>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="calendar-input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('calendar.project')}>
              <select value={projectId} onChange={e => { setProjectId(e.target.value); setTaskId('') }} className="calendar-input">
                <option value="">{t('calendar.noProject')}</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </Field>
            <Field label={t('calendar.task')}>
              <select value={taskId} onChange={e => setTaskId(e.target.value)} className="calendar-input" disabled={!availableTasks.length}>
                <option value="">{t('calendar.noTask')}</option>
                {availableTasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('calendar.status')}>
            <select value={status} onChange={e => setStatus(e.target.value as WorkBlockStatus)} className="calendar-input">
              {(['planned', 'completed', 'cancelled'] as const).map(value => <option key={value} value={value}>{t(`calendar.statuses.${value}`)}</option>)}
            </select>
          </Field>
          {block?.taskId && <Button type="button" variant="link" size="xs" className="h-auto justify-start px-0" onClick={() => onOpenTask(block.taskId!, block.projectId)}>{t('calendar.planner.openTask')}</Button>}
          {block?.projectId && <Button type="button" variant="link" size="xs" className="h-auto justify-start px-0" onClick={() => onOpenProject(block.projectId!)}>{t('calendar.planner.openProject')}</Button>}
          {block && (
            <section className="rounded-md border border-border-subtle bg-[#10110f] p-3" aria-label={t('calendar.planner.actualTime')}>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="block text-[10px] text-text-muted">{t('calendar.planner.plannedTime')}</span><strong className="mt-1 block font-mono text-text-primary">{formatCompactDuration(block.scheduledEnd.getTime() - block.scheduledStart.getTime(), i18n.language)}</strong></div>
                <div><span className="block text-[10px] text-text-muted">{t('calendar.planner.actualTime')}</span><strong className="mt-1 block font-mono text-text-primary">{formatCompactDuration(actualDuration, i18n.language)}</strong></div>
              </div>
              {sessions.length > 0 ? (
                <div className="mt-3 border-t border-border-subtle pt-2">
                  <p className="mb-1 text-[10px] text-text-muted">{t('calendar.planner.sessions')}</p>
                  <div className="space-y-1">
                    {sessions.map(session => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)} className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left text-[11px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive">
                      <span className="truncate">{session.title}</span>
                      <span className="shrink-0 text-[10px] text-text-muted">{t(`calendar.planner.sessionStatuses.${session.status}`)} · {formatCompactDuration(computeElapsedMs(session, now.getTime()), i18n.language)}</span>
                    </button>)}
                  </div>
                </div>
              ) : <p className="mt-2 text-[10px] text-text-muted">{t('calendar.planner.noSessions')}</p>}
            </section>
          )}
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300">{error}</p>}
          <DialogFooter className="flex-wrap justify-between gap-2">
            {block ? <Button variant="danger" type="button" size="sm" onClick={handleDelete} disabled={saving}><Trash2 className="h-3.5 w-3.5" />{t('calendar.delete')}</Button> : <span />}
            <div className="flex gap-2">
              {block?.status === 'planned' && block.projectId && <Button variant="olive" type="button" size="sm" onClick={() => onStartFocus(block)} disabled={saving}><Timer className="h-3.5 w-3.5" />{activeSession ? t('calendar.planner.returnToSession') : t('calendar.planner.startFocus')}</Button>}
              <Button variant="outline" type="button" size="sm" onClick={() => onClose(false)} disabled={saving}>{t('calendar.cancel')}</Button>
              <Button type="submit" size="sm" disabled={saving || !title.trim()}>{saving ? t('calendar.saving') : t('calendar.save')}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-text-secondary"><span>{label}</span>{children}</label>
}

function BlockResizeHandle({ block, day, locale, onResize, t }: {
  block: ScheduledWorkBlock
  day: Date
  locale: CalendarLocale
  onResize: (block: ScheduledWorkBlock, end: Date) => void
  t: (key: TranslationKey) => string
}) {
  const pointerId = React.useRef<number | null>(null)
  const [previewEnd, setPreviewEnd] = React.useState<Date | null>(null)

  const updatePreview = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return
    const column = event.currentTarget.closest<HTMLElement>('[data-calendar-day-column]')
    if (!column) return
    const rect = column.getBoundingClientRect()
    const minute = snapCalendarOffsetToMinutes(event.clientY - rect.top, rect.height)
    try {
      const end = calendarDropStart(day, minute)
      setPreviewEnd(end.getTime() >= block.scheduledStart.getTime() + 15 * 60_000 ? end : null)
    } catch {
      setPreviewEnd(null)
    }
  }

  const finishResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return
    const end = previewEnd
    pointerId.current = null
    setPreviewEnd(null)
    if (end) onResize(block, end)
  }

  return (
    <button
      type="button"
      aria-label={t('calendar.planner.resizeBlock')}
      title={previewEnd ? `${t('calendar.endTime')}: ${previewEnd.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : t('calendar.planner.resizeBlock')}
      onPointerDown={event => {
        event.preventDefault()
        event.stopPropagation()
        pointerId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={updatePreview}
      onPointerUp={finishResize}
      onPointerCancel={event => { pointerId.current = null; setPreviewEnd(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      className={`absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize touch-none rounded-b-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive ${previewEnd ? 'bg-accent-olive/70' : 'bg-transparent hover:bg-accent-olive/35'}`}
    />
  )
}

function TimeGrid({
  days, blocks, deadlines, projectsById, tasksById, now, onEdit, onCreateAt, onDeadline, onDrop, onResize, t,
}: {
  days: Date[]
  blocks: ScheduledWorkBlock[]
  deadlines: Task[]
  projectsById: Map<string, Project>
  tasksById: Map<string, Task>
  now: Date
  onEdit: (block: ScheduledWorkBlock) => void
  onCreateAt: (date: Date) => void
  onDeadline: (task: Task) => void
  onDrop: (day: Date, minute: number, payload: CalendarDragPayload) => void
  onResize: (block: ScheduledWorkBlock, end: Date) => void
  t: (key: TranslationKey) => string
}) {
  const [dropTarget, setDropTarget] = React.useState<{ day: string; minute: number } | null>(null)
  const columns = `56px repeat(${days.length}, minmax(${days.length === 1 ? '300px' : '145px'}, 1fr))`
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'ru-RU'
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div className="calendar-scroll mx-4 mb-4 overflow-x-auto rounded-lg border border-border-subtle sm:mx-6">
      <div className="min-w-[660px]" style={{ display: 'grid', gridTemplateColumns: columns }}>
        <div className="sticky top-0 z-20 border-b border-border-subtle bg-[#11120f]" />
        {days.map(day => {
          const dayDeadlines = deadlines.filter(task => task.dueDate && sameDate(task.dueDate, day))
          return (
            <div key={localDateKey(day)} className={`sticky top-0 z-20 min-h-14 border-b border-l border-border-subtle bg-[#11120f] px-2.5 py-2 ${sameDate(day, now) ? 'text-accent-olive' : 'text-text-secondary'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide">{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}</span>
                <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${sameDate(day, now) ? 'bg-accent-olive text-[#11120f] font-semibold' : 'text-text-primary'}`}>{day.getDate()}</span>
              </div>
              <div className="mt-1 flex min-h-[16px] flex-wrap gap-1">
                {dayDeadlines.slice(0, 2).map(task => <button key={task.id} onClick={() => onDeadline(task)} className="max-w-full truncate rounded-sm bg-amber-500/10 px-1.5 text-[9px] text-amber-200 hover:bg-amber-500/20">{t('calendar.deadline')}: {task.title}</button>)}
                {dayDeadlines.length > 2 && <span className="text-[9px] text-text-muted">+{dayDeadlines.length - 2}</span>}
              </div>
            </div>
          )
        })}
        <div className="relative h-[1536px] bg-[#10110f]">
          {hours.map(hour => <div key={hour} className="absolute right-1 text-[9px] font-mono text-text-muted" style={{ top: hour * 64 + 2 }}>{`${String(hour).padStart(2, '0')}:00`}</div>)}
        </div>
        {days.map(day => {
          const dayBlocks = blocks.filter(block => block.scheduledStart < addCalendarDays(day, 1) && block.scheduledEnd > day)
          const positioned = layoutOverlappingBlocks(dayBlocks, day)
          const isToday = sameDate(day, now)
          const currentTimeTop = (now.getHours() * 60 + now.getMinutes()) * 64 / 60
          return (
            <div
              key={localDateKey(day)}
              data-calendar-day-column
              onDragOver={event => {
                if (!event.dataTransfer.types.includes(CALENDAR_DRAG_MIME)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = calendarDropEffect(event.dataTransfer.effectAllowed)
                const rect = event.currentTarget.getBoundingClientRect()
                const minute = snapCalendarOffsetToMinutes(event.clientY - rect.top, rect.height)
                setDropTarget(current => current?.day === localDateKey(day) && current.minute === minute ? current : { day: localDateKey(day), minute })
              }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
              }}
              onDrop={event => {
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const minute = snapCalendarOffsetToMinutes(event.clientY - rect.top, rect.height)
                const payload = readCalendarDragPayload(event.dataTransfer.getData(CALENDAR_DRAG_MIME))
                setDropTarget(null)
                if (payload) onDrop(day, minute, payload)
              }}
              className="relative h-[1536px] border-l border-border-subtle bg-[#0e0e0d]"
              style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 63px, rgba(255,255,255,.055) 63px, rgba(255,255,255,.055) 64px)' }}
            >
              {hours.map(hour => <div key={hour} className="absolute inset-x-0 h-px bg-white/[0.035]" style={{ top: hour * 64 + 32 }} />)}
              {positioned.map(item => {
                const entityTask = item.block.taskId ? tasksById.get(item.block.taskId) : undefined
                const project = item.block.projectId ? projectsById.get(item.block.projectId) : undefined
                const faded = item.block.status === 'cancelled'
                return (
                  <div key={item.block.id} className={`absolute z-10 overflow-hidden rounded-[4px] border border-accent-olive/25 border-l-2 border-l-accent-olive bg-[#20251c] ${faded ? 'opacity-50' : ''} ${item.block.status === 'completed' ? 'border-l-[#6c7f53]' : ''}`} style={{ top: item.top, height: item.height, left: `calc(${item.left}% + 2px)`, width: `calc(${item.width}% - 4px)` }}>
                    <button
                      type="button"
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData(CALENDAR_DRAG_MIME, JSON.stringify({ kind: 'block', blockId: item.block.id }))
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => onEdit(item.block)}
                      aria-label={`${item.block.title}, ${item.block.scheduledStart.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`}
                      className={`block h-full w-full overflow-hidden px-1.5 py-1 pr-2 text-left text-[10px] leading-tight text-[#e3e6dc] hover:bg-[#293022] focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive ${item.block.status === 'cancelled' ? 'line-through' : ''}`}
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate font-medium"><GripVertical aria-hidden="true" className="h-3 w-3 shrink-0 opacity-45" />{item.block.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-[9px] text-[#a8ad9f]">{item.block.scheduledStart.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}–{item.block.scheduledEnd.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                      {entityTask && <span className="mt-0.5 block truncate text-[9px] text-text-muted">{entityTask.title}</span>}
                      {!entityTask && project && <span className="mt-0.5 block truncate text-[9px] text-text-muted">{project.name}</span>}
                    </button>
                    {sameDate(item.block.scheduledStart, day) && <BlockResizeHandle block={item.block} day={day} locale={locale === 'en-US' ? 'en' : 'ru'} onResize={onResize} t={t} />}
                  </div>
                )
              })}
              {dropTarget?.day === localDateKey(day) && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-30 border-t border-dashed border-accent-olive bg-accent-olive/10" style={{ top: dropTarget.minute * 64 / 60, height: 16 }}><span className="ml-1 rounded bg-[#11120f] px-1 py-0.5 font-mono text-[9px] text-accent-olive">{`${String(Math.floor(dropTarget.minute / 60)).padStart(2, '0')}:${String(dropTarget.minute % 60).padStart(2, '0')}`}</span></div>}
              {isToday && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: currentTimeTop }}><span className="h-1.5 w-1.5 rounded-full bg-[#c27b66]" /><span className="h-px flex-1 bg-[#c27b66]/80" /></div>}
              <div className="absolute inset-x-0 top-0 z-0">
                {hours.map(hour => <button key={hour} type="button" onClick={() => onCreateAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour))} className="block h-16 w-full focus-visible:bg-accent-olive/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive" aria-label={`${t('calendar.newBlock')} ${formatLongDate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour), locale === 'en-US' ? 'en' : 'ru')} ${String(hour).padStart(2, '0')}:00`} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthGrid({
  rangeStart, locale, blocks, deadlines, projectsById, now, onEdit, onDay, onDeadline, onDrop, t,
}: {
  rangeStart: Date
  locale: CalendarLocale
  blocks: ScheduledWorkBlock[]
  deadlines: Task[]
  projectsById: Map<string, Project>
  now: Date
  onEdit: (block: ScheduledWorkBlock) => void
  onDay: (day: Date) => void
  onDeadline: (task: Task) => void
  onDrop: (day: Date, minute: number, payload: CalendarDragPayload) => void
  t: (key: TranslationKey) => string
}) {
  const [dropDay, setDropDay] = React.useState<string | null>(null)
  const weekStart = locale === 'ru' ? 1 : 0
  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
  const reference = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 8)
  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-border-subtle sm:mx-6">
      <div className="grid grid-cols-7 border-b border-border-subtle bg-[#11120f]">
        {weekdays.map(index => <div key={index} className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-text-muted">{new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' }).format(addCalendarDays(reference, index - reference.getDay()))}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, index) => {
          const day = addCalendarDays(rangeStart, index)
          const dayBlocks = blocks.filter(block => block.scheduledStart < addCalendarDays(day, 1) && block.scheduledEnd > day)
          const dayDeadlines = deadlines.filter(task => task.dueDate && sameDate(task.dueDate, day))
          const outsideMonth = day.getMonth() !== reference.getMonth()
          return (
            <div
              key={localDateKey(day)}
              onDragOver={event => {
                if (!event.dataTransfer.types.includes(CALENDAR_DRAG_MIME)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = calendarDropEffect(event.dataTransfer.effectAllowed)
                setDropDay(localDateKey(day))
              }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null) }}
              onDrop={event => {
                event.preventDefault()
                setDropDay(null)
                const payload = readCalendarDragPayload(event.dataTransfer.getData(CALENDAR_DRAG_MIME))
                if (payload) onDrop(day, payload.kind === 'task' ? 9 * 60 : -1, payload)
              }}
              className={`min-h-20 border-b border-r border-border-subtle p-1.5 sm:min-h-28 sm:p-2 ${dropDay === localDateKey(day) ? 'bg-accent-olive/10' : outsideMonth ? 'bg-[#0c0d0b]/70' : 'bg-[#10110f]'}`}
            >
              <button type="button" onClick={() => onDay(day)} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${sameDate(day, now) ? 'bg-accent-olive font-semibold text-[#11120f]' : outsideMonth ? 'text-text-muted' : 'text-text-secondary hover:bg-bg-elevated'}`}>{day.getDate()}</button>
              <div className="space-y-0.5">
                {dayBlocks.slice(0, 2).map(block => {
                  const project = block.projectId ? projectsById.get(block.projectId) : undefined
                  return <button key={block.id} type="button" draggable onDragStart={event => {
                    event.dataTransfer.setData(CALENDAR_DRAG_MIME, JSON.stringify({ kind: 'block', blockId: block.id }))
                    event.dataTransfer.effectAllowed = 'move'
                  }} onClick={() => onEdit(block)} className="block w-full truncate rounded-sm border-l-2 border-l-accent-olive bg-[#20251c] px-1 py-0.5 text-left text-[9px] text-[#dce1d3] hover:bg-[#293022] sm:text-[10px]">{block.title}<span className="hidden sm:inline text-text-muted">{project ? ` · ${project.name}` : ''}</span></button>
                })}
                {dayDeadlines.slice(0, Math.max(0, 2 - Math.min(dayBlocks.length, 2))).map(task => <button key={task.id} type="button" onClick={() => onDeadline(task)} className="block w-full truncate rounded-sm bg-amber-500/10 px-1 py-0.5 text-left text-[9px] text-amber-200">{t('calendar.deadline')}: {task.title}</button>)}
                {dayBlocks.length + dayDeadlines.length > 2 && <span className="block px-1 text-[9px] text-text-muted">+{dayBlocks.length + dayDeadlines.length - 2} {t('calendar.more')}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Calendar() {
  const { t, i18n } = useTranslation()
  const locale: CalendarLocale = i18n.language === 'en' ? 'en' : 'ru'
  const [searchParams, setSearchParams] = useSearchParams()
  const preferences = useAppPreferences()
  const [date, setDate] = React.useState(() => new Date())
  const [dialogBlock, setDialogBlock] = React.useState<ScheduledWorkBlock | null>(null)
  const [initialTask, setInitialTask] = React.useState<PlannerTask | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogKey, setDialogKey] = React.useState(0)
  const [initialStart, setInitialStart] = React.useState<Date | null>(null)
  const [dragError, setDragError] = React.useState('')
  const [projectFilter, setProjectFilter] = React.useState('all')
  const now = useMinuteNow()
  const navigate = useNavigate()
  const activeSession = useActiveSession()
  const reminderLead = usePlannerReminderLead()
  const projects = useProjects() ?? EMPTY_PROJECTS
  const taskQuery = useAllTasks()
  const taskRecords = taskQuery ?? EMPTY_TASKS
  const tasks = taskRecords
  const today = React.useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now])
  const plannerData = usePlannerTasks(today, now)
  const groups = React.useMemo(() => {
    const visibleTasks = projectFilter === 'all' ? plannerData.tasks : plannerData.tasks.filter(task => task.projectId === projectFilter)
    return groupPlannerTasks(visibleTasks, plannerData.scheduledTaskIds, plannerData.todayTaskIds, today)
  }, [plannerData, projectFilter, today])
  const todayPlannedMs = sumPlannedDuration(plannerData.todayBlocks)
  const todayActualMs = sumActualDuration(plannerData.todaySessions, now.getTime())
  const remainingPlannedMs = plannerData.todayBlocks.reduce((sum, block) => block.status === 'planned'
    ? sum + Math.max(0, block.scheduledEnd.getTime() - Math.max(block.scheduledStart.getTime(), now.getTime()))
    : sum, 0)
  const nextFocusBlock = plannerData.todayBlocks.filter(block => block.status === 'planned' && block.scheduledEnd > now)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())[0]
  const taskIntentId = searchParams.get('task')
  const blockIntentId = searchParams.get('block')
  const routeBlock = useLiveQuery(async () => blockIntentId ? (await db.scheduledWorkBlocks.get(blockIntentId)) ?? null : null, [blockIntentId])
  const routeTask = taskIntentId ? taskRecords.find(task => task.id === taskIntentId && (task.status === 'todo' || task.status === 'in_progress')) as PlannerTask | undefined : undefined
  const calendarDate = blockIntentId && routeBlock ? routeBlock.scheduledStart : date
  const calendarView: CalendarView = blockIntentId && routeBlock ? 'day' : preferences.calendarView
  const range = React.useMemo(() => getCalendarRange(calendarDate, calendarView, locale), [calendarDate, calendarView, locale])
  const data = useCalendarData(range.start, range.end)
  const projectsById = React.useMemo(() => new Map(data.projects.map(project => [project.id, project])), [data.projects])
  const routedDialogOpen = Boolean((blockIntentId && routeBlock) || (taskIntentId && taskQuery !== undefined && routeTask))
  const visibleDialogBlock = dialogBlock ?? (blockIntentId && routeBlock ? routeBlock : null)
  const visibleInitialTask = initialTask ?? (taskIntentId ? routeTask ?? null : null)
  const visibleInitialStart = initialStart ?? (taskIntentId && routeTask ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9) : null)

  const openCreate = React.useCallback((start?: Date, task?: PlannerTask) => {
    setDialogKey(key => key + 1)
    setDialogBlock(null)
    setInitialTask(task ?? null)
    setInitialStart(start ?? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9))
    setDialogOpen(true)
  }, [date])
  const openEdit = React.useCallback((block: ScheduledWorkBlock) => {
    if (!block.id) openCreate(block.scheduledStart)
    else {
      setDialogKey(key => key + 1)
      setDialogBlock(block)
      setInitialTask(null)
      setInitialStart(null)
      setDialogOpen(true)
    }
  }, [openCreate])
  const onDeadline = (task: Task) => navigate(appRoutes.task(task.id, task.projectId))
  const days = calendarView === 'day' ? [range.start] : calendarView === 'week' ? Array.from({ length: 7 }, (_, index) => addCalendarDays(range.start, index)) : []

  React.useEffect(() => {
    if (!blockIntentId || routeBlock !== null) return
    const next = new URLSearchParams(searchParams)
    next.delete('block')
    setSearchParams(next, { replace: true })
  }, [blockIntentId, routeBlock, searchParams, setSearchParams])

  React.useEffect(() => {
    if (!taskIntentId || taskQuery === undefined || blockIntentId || routeTask) return
    const next = new URLSearchParams(searchParams)
    next.delete('task')
    setSearchParams(next, { replace: true })
  }, [taskIntentId, taskQuery, blockIntentId, routeTask, searchParams, setSearchParams])

  const handleDrop = async (day: Date, minute: number, payload: CalendarDragPayload) => {
    setDragError('')
    try {
      if (payload.kind === 'task') {
        const task = taskRecords.find(item => item.id === payload.taskId)
        if (!task || (task.status !== 'todo' && task.status !== 'in_progress')) throw new Error('TASK_NOT_FOUND')
        const start = calendarDropStart(day, minute)
        await createScheduledWorkBlock({
          title: task.title,
          projectId: task.projectId,
          taskId: task.id,
          scheduledStart: start,
          scheduledEnd: new Date(start.getTime() + 60 * 60_000),
          status: 'planned',
        })
        return
      }

      const block = await getScheduledWorkBlockById(payload.blockId)
      if (!block) throw new Error('WORK_BLOCK_NOT_FOUND')
      const minuteToUse = minute < 0 ? block.scheduledStart.getHours() * 60 + block.scheduledStart.getMinutes() : minute
      const start = calendarDropStart(day, minuteToUse)
      const duration = block.scheduledEnd.getTime() - block.scheduledStart.getTime()
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('WORK_BLOCK_INVALID_DURATION')
      await updateScheduledWorkBlock(block.id, { scheduledStart: start, scheduledEnd: new Date(start.getTime() + duration) })
    } catch (error) {
      const code = error instanceof WorkBlockError ? error.code : error instanceof RangeError ? 'INVALID_LOCAL_TIME' : error instanceof Error ? error.message : 'SAVE_FAILED'
      setDragError(t(calendarErrorKey(code)))
    }
  }

  const handleResize = async (block: ScheduledWorkBlock, end: Date) => {
    setDragError('')
    try {
      if (end.getTime() - block.scheduledStart.getTime() < 15 * 60_000) throw new Error('WORK_BLOCK_INVALID_DURATION')
      await updateScheduledWorkBlock(block.id, { scheduledEnd: end })
    } catch (error) {
      const code = error instanceof WorkBlockError ? error.code : error instanceof RangeError ? 'INVALID_LOCAL_TIME' : error instanceof Error ? error.message : 'SAVE_FAILED'
      setDragError(t(calendarErrorKey(code)))
    }
  }

  const startFocus = (block: ScheduledWorkBlock) => {
    closeDialog()
    if (activeSession) {
      navigate(appRoutes.session(activeSession.id))
      return
    }
    if (block.projectId) navigate(appRoutes.startSessionFromBlock(block.projectId, block.taskId, block.id))
  }
  const dialogSessions = visibleDialogBlock ? data.sessionsByBlockId.get(visibleDialogBlock.id) ?? [] : []
  const closeDialog = () => {
    setDialogOpen(false)
    setDialogBlock(null)
    setInitialTask(null)
    setInitialStart(null)
    if (blockIntentId && routeBlock) {
      setDate(routeBlock.scheduledStart)
    }
    if (blockIntentId || taskIntentId) {
      const next = new URLSearchParams(searchParams)
      next.delete('block')
      next.delete('task')
      setSearchParams(next, { replace: true })
    }
  }
  const setView = (nextView: CalendarView) => {
    appPreferencesStore.update({ calendarView: nextView })
  }
  const mobileBacklog = <PlannerBacklog groups={groups} projects={projects} projectFilter={projectFilter} onProjectFilter={setProjectFilter} onSchedule={task => openCreate(undefined, task)} onOpenTask={task => navigate(appRoutes.task(task.id, task.projectId))} t={t} language={i18n.language} />

  return (
    <section className="min-h-full min-w-0 bg-[#0e0e0d]">
      <CalendarToolbar date={calendarDate} view={calendarView} locale={locale} onView={setView} onDate={setDate} onCreate={() => openCreate()} t={t} />
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2 sm:mx-6 sm:grid-cols-4">
        <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"><span className="block text-[11px] text-text-muted">{t('calendar.planner.plannedTime')}</span><strong className="mt-0.5 block font-mono text-sm text-text-primary">{formatCompactDuration(todayPlannedMs, i18n.language)}</strong></div>
        <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"><span className="block text-[11px] text-text-muted">{t('calendar.planner.remainingTime')}</span><strong className="mt-0.5 block font-mono text-sm text-text-primary">{formatCompactDuration(remainingPlannedMs, i18n.language)}</strong></div>
        <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"><span className="block text-[11px] text-text-muted">{t('calendar.planner.actualTime')}</span><strong className="mt-0.5 block font-mono text-sm text-text-primary">{formatCompactDuration(todayActualMs, i18n.language)}</strong></div>
        <label className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-[11px] text-text-muted">{t('calendar.planner.reminderLead')}<select aria-label={t('calendar.planner.reminderLead')} value={reminderLead} onChange={event => setPlannerReminderLead(Number(event.target.value))} className="mt-0.5 block w-full bg-transparent text-xs text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive">{[5, 10, 15, 30].map(value => <option key={value} value={value}>{t('calendar.planner.minutes', { count: value })}</option>)}</select></label>
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-text-muted sm:mx-6"><Clock3 className="h-3.5 w-3.5 text-accent-olive" aria-hidden="true" /><span>{t('calendar.timezone')}: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>{nextFocusBlock && <span className="ml-auto truncate text-text-secondary"><CalendarClock className="mr-1 inline h-3 w-3 text-accent-olive" aria-hidden="true" />{t('calendar.planner.nextFocus')}: {nextFocusBlock.scheduledStart.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })} {nextFocusBlock.title}</span>}</div>
      {dragError && <p role="alert" className="mx-4 mt-3 rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300 sm:mx-6">{dragError}</p>}
      <details className="mx-4 mt-3 rounded-md border border-border-subtle bg-[#10110f] lg:hidden">
        <summary className="cursor-pointer px-3 py-2 text-sm font-serif text-text-primary">{t('calendar.planner.title')} <span className="ml-1 font-mono text-[10px] text-text-muted">{groups.overdue.length + groups.today.length + groups.unscheduled.length}</span></summary>
        <div className="border-t border-border-subtle">{mobileBacklog}</div>
      </details>
      <div className="grid min-w-0 grid-cols-1 gap-4 pt-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {calendarView === 'month' ? (
            <MonthGrid rangeStart={range.start} locale={locale} blocks={data.blocks} deadlines={data.deadlines} projectsById={projectsById} now={now} onEdit={openEdit} onDay={day => { setDate(day); setView('day') }} onDeadline={onDeadline} onDrop={handleDrop} t={t} />
          ) : (
            <TimeGrid days={days} blocks={data.blocks} deadlines={data.deadlines} projectsById={projectsById} tasksById={data.tasksById} now={now} onEdit={openEdit} onCreateAt={openCreate} onDeadline={onDeadline} onDrop={handleDrop} onResize={handleResize} t={t} />
          )}
        </div>
        <div className="hidden min-w-0 pr-4 lg:block">{mobileBacklog}</div>
      </div>
      <BlockDialog key={`${dialogKey}:${visibleDialogBlock?.id ?? visibleInitialTask?.id ?? 'new'}`} open={dialogOpen || routedDialogOpen} block={visibleDialogBlock} initialStart={visibleInitialStart} initialTask={visibleInitialTask} projects={projects} tasks={tasks} sessions={dialogSessions} now={now} activeSession={activeSession} onStartFocus={startFocus} onOpenSession={id => { closeDialog(); navigate(appRoutes.session(id)) }} onOpenTask={(taskId, projectId) => { closeDialog(); navigate(appRoutes.task(taskId, projectId)) }} onOpenProject={projectId => { closeDialog(); navigate(appRoutes.project(projectId)) }} onClose={closeDialog} t={t} />
    </section>
  )
}
