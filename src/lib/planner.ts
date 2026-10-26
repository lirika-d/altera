import type { Task, Project, Session } from '@/types'
import type { ScheduledWorkBlock } from '@/types/calendar'
import { computeElapsedMs } from '@/db/sessions'
import { localDateKey, parseLocalDateTime } from '@/lib/calendarDates'

export interface PlannerTask extends Task {
  project?: Project
}

export interface PlannerTaskGroups {
  overdue: PlannerTask[]
  today: PlannerTask[]
  unscheduled: PlannerTask[]
}

export const CALENDAR_DRAG_MIME = 'application/x-altera-planner-item'
export type CalendarDragPayload = { kind: 'task'; taskId: string } | { kind: 'block'; blockId: string }

export function readCalendarDragPayload(raw: string): CalendarDragPayload | null {
  try {
    const value = JSON.parse(raw) as Partial<CalendarDragPayload>
    if (value.kind === 'task' && typeof value.taskId === 'string' && value.taskId) return { kind: 'task', taskId: value.taskId }
    if (value.kind === 'block' && typeof value.blockId === 'string' && value.blockId) return { kind: 'block', blockId: value.blockId }
  } catch {
    return null
  }
  return null
}

/** Keep the target's requested operation compatible with each drag source. */
export function calendarDropEffect(effectAllowed: string): 'copy' | 'move' {
  return effectAllowed === 'copy' ? 'copy' : 'move'
}

const isOpenTask = (task: Task) => task.status === 'todo' || task.status === 'in_progress'

/** Keeps backlog sections mutually exclusive while prioritizing overdue work. */
export function groupPlannerTasks(
  tasks: PlannerTask[],
  scheduledTaskIds: ReadonlySet<string>,
  todayTaskIds: ReadonlySet<string>,
  today: Date
): PlannerTaskGroups {
  const todayKey = localDateKey(today)
  const groups: PlannerTaskGroups = { overdue: [], today: [], unscheduled: [] }
  for (const task of tasks) {
    if (!isOpenTask(task)) continue
    const dueKey = task.dueDate ? localDateKey(task.dueDate) : undefined
    if (dueKey && dueKey < todayKey) groups.overdue.push(task)
    else if (dueKey === todayKey || todayTaskIds.has(task.id)) groups.today.push(task)
    else if (!scheduledTaskIds.has(task.id)) groups.unscheduled.push(task)
  }
  const sortTasks = (a: PlannerTask, b: PlannerTask) => {
    const priority = { urgent: 5, high: 4, medium: 3, low: 2, none: 1 }
    const priorityDiff = priority[b.priority] - priority[a.priority]
    if (priorityDiff) return priorityDiff
    const dueDiff = (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
    return dueDiff || a.order - b.order
  }
  groups.overdue.sort(sortTasks)
  groups.today.sort(sortTasks)
  groups.unscheduled.sort(sortTasks)
  return groups
}

export function sumPlannedDuration(blocks: ScheduledWorkBlock[]): number {
  return blocks.reduce((sum, block) => block.status === 'planned'
    ? sum + Math.max(0, block.scheduledEnd.getTime() - block.scheduledStart.getTime())
    : sum, 0)
}

export function sumActualDuration(sessions: Session[], nowMs = Date.now()): number {
  return sessions.reduce((sum, session) => sum + computeElapsedMs(session, nowMs), 0)
}

export function formatCompactDuration(milliseconds: number, language: string): string {
  const totalMinutes = Math.floor(Math.max(0, milliseconds) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hourLabel = language === 'ru' ? 'ч' : 'h'
  const minuteLabel = language === 'ru' ? 'м' : 'm'
  if (hours && minutes) return `${hours}${hourLabel} ${minutes}${minuteLabel}`
  if (hours) return `${hours}${hourLabel}`
  return `${minutes}${minuteLabel}`
}

/** Convert the timeline's pixel offset into a local 15-minute slot. */
export function snapCalendarOffsetToMinutes(offsetY: number, height: number, snapMinutes = 15): number {
  if (!Number.isFinite(offsetY) || !Number.isFinite(height) || height <= 0 || snapMinutes <= 0) return 0
  const rawMinutes = Math.max(0, Math.min(24 * 60, offsetY / height * 24 * 60))
  return Math.max(0, Math.min(24 * 60 - snapMinutes, Math.round(rawMinutes / snapMinutes) * snapMinutes))
}

/** Parse a pointer-selected local time and reject a nonexistent DST wall time. */
export function calendarDropStart(day: Date, minuteOfDay: number): Date {
  const snapped = Math.max(0, Math.min(24 * 60 - 15, Math.round(minuteOfDay / 15) * 15))
  const hh = String(Math.floor(snapped / 60)).padStart(2, '0')
  const mm = String(snapped % 60).padStart(2, '0')
  return parseLocalDateTime(localDateKey(day), `${hh}:${mm}`)
}

