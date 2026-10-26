import { describe, expect, it } from 'vitest'
import { selectPlannerReminder } from './usePlannerReminders'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Task } from '@/types'

const now = new Date(2026, 9, 26, 9)
const block: ScheduledWorkBlock = {
  id: 'block', title: 'Planning', status: 'planned', scheduledStart: new Date(2026, 9, 26, 9, 5),
  scheduledEnd: new Date(2026, 9, 26, 10), createdAt: now, updatedAt: now,
}
const task: Task = {
  id: 'task', projectId: 'project', title: 'Overdue item', status: 'todo', priority: 'high',
  dueDate: new Date(2026, 9, 25), order: 0, createdAt: now, updatedAt: now,
}

describe('planner reminders', () => {
  it('avoids duplicate reminders after dismissal and shows the next item', () => {
    const taskKey = 'overdue:task:2026-10-26'
    expect(selectPlannerReminder([block], [task], new Set([taskKey]), now)).toMatchObject({ kind: 'block', block })
    expect(selectPlannerReminder([block], [task], new Set([taskKey, `block:${block.id}:${block.scheduledStart.getTime()}`]), now)).toBeNull()
  })

  it('prioritizes overdue tasks and lets them reappear on the next local day', () => {
    expect(selectPlannerReminder([block], [task], new Set(), now)).toMatchObject({ kind: 'task', task })
    const nextDay = new Date(2026, 9, 27, 9)
    expect(selectPlannerReminder([], [task], new Set(['overdue:task:2026-10-26']), nextDay)).toMatchObject({ kind: 'task' })
  })
})
