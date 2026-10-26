import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { localDateKey } from '@/lib/calendarDates'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Task } from '@/types'
import { PLANNER_REMINDER_LEAD_KEY, PLANNER_REMINDER_SETTINGS_EVENT } from '@/lib/plannerReminderSettings'

export { PLANNER_REMINDER_LEAD_KEY, PLANNER_REMINDER_SETTINGS_EVENT } from '@/lib/plannerReminderSettings'
const DISMISSED_KEY = 'altera:planner-dismissed-reminders'
const DEFAULT_LEAD_MINUTES = 10
const inMemoryDismissed = new Set<string>()

function readLeadMinutes(): number {
  try {
    const value = Number(localStorage.getItem(PLANNER_REMINDER_LEAD_KEY))
    return [5, 10, 15, 30].includes(value) ? value : DEFAULT_LEAD_MINUTES
  } catch {
    return DEFAULT_LEAD_MINUTES
  }
}

function readDismissed(): Set<string> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
    return new Set([...inMemoryDismissed, ...(Array.isArray(data) ? data.filter((item): item is string => typeof item === 'string') : [])])
  } catch {
    return new Set(inMemoryDismissed)
  }
}

function dismissKeyForBlock(block: ScheduledWorkBlock): string {
  return `block:${block.id}:${block.scheduledStart.getTime()}`
}

function dismissKeyForTask(task: Task, now: Date): string {
  return `overdue:${task.id}:${localDateKey(now)}`
}

export type PlannerReminder =
  | { kind: 'block'; key: string; block: ScheduledWorkBlock }
  | { kind: 'task'; key: string; task: Task }

/** Selects one actionable reminder, preferring overdue work and skipping dismissed occurrences. */
export function selectPlannerReminder(
  blocks: ScheduledWorkBlock[],
  overdueTasks: Task[],
  dismissed: ReadonlySet<string>,
  now: Date
): PlannerReminder | null {
  const task = [...overdueTasks]
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .find(item => !dismissed.has(dismissKeyForTask(item, now)))
  if (task) return { kind: 'task', key: dismissKeyForTask(task, now), task }
  const block = [...blocks]
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
    .find(item => !dismissed.has(dismissKeyForBlock(item)))
  return block ? { kind: 'block', key: dismissKeyForBlock(block), block } : null
}

export function usePlannerReminderLead(): number {
  const [minutes, setMinutes] = React.useState(readLeadMinutes)
  React.useEffect(() => {
    const refresh = () => setMinutes(readLeadMinutes())
    window.addEventListener(PLANNER_REMINDER_SETTINGS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(PLANNER_REMINDER_SETTINGS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return minutes
}

export function setPlannerReminderLead(minutes: number): void {
  if (![5, 10, 15, 30].includes(minutes)) return
  try {
    localStorage.setItem(PLANNER_REMINDER_LEAD_KEY, String(minutes))
  } catch {
    // Reminders still work with the in-memory default when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(PLANNER_REMINDER_SETTINGS_EVENT))
}

export function dismissPlannerReminder(key: string): void {
  inMemoryDismissed.add(key)
  const dismissed = readDismissed()
  dismissed.add(key)
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed].slice(-200)))
  } catch {
    // A failed dismissal write may show the reminder again after a reload.
  }
  window.dispatchEvent(new Event(PLANNER_REMINDER_SETTINGS_EVENT))
}

/** In-app reminders only; no background worker or browser notification permission is used. */
export function usePlannerReminder(): PlannerReminder | null {
  const leadMinutes = usePlannerReminderLead()
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000)
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener(PLANNER_REMINDER_SETTINGS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(PLANNER_REMINDER_SETTINGS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return useLiveQuery(async () => {
    const now = new Date(nowMs)
    const dismissed = readDismissed()
    const [blocks, overdueTasks] = await Promise.all([
      db.scheduledWorkBlocks.where('scheduledStart')
        .between(now, new Date(nowMs + leadMinutes * 60_000), true, true)
        .filter(block => block.status === 'planned')
        .toArray(),
      db.tasks.where('dueDate').below(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        .filter(task => task.status === 'todo' || task.status === 'in_progress')
        .toArray(),
    ])

    return selectPlannerReminder(blocks, overdueTasks, dismissed, now)
  }, [nowMs, leadMinutes, revision]) ?? null
}
