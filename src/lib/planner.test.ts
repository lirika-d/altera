import { describe, expect, it } from 'vitest'
import type { PlannerTask } from './planner'
import { calendarDropEffect, calendarDropStart, formatCompactDuration, groupPlannerTasks, snapCalendarOffsetToMinutes, sumActualDuration, sumPlannedDuration } from './planner'
import type { ScheduledWorkBlock } from '@/types/calendar'
import type { Session } from '@/types'

const now = new Date(2026, 9, 26, 10)
const task = (id: string, dueDate?: Date, priority: PlannerTask['priority'] = 'medium'): PlannerTask => ({
  id, projectId: 'project', title: id, status: 'todo', priority,
  order: 0, createdAt: now, updatedAt: now, dueDate,
})
const block = (id: string, status: ScheduledWorkBlock['status'], start: number, end: number): ScheduledWorkBlock => ({
  id, title: id, status, scheduledStart: new Date(start), scheduledEnd: new Date(end), createdAt: now, updatedAt: now,
})

describe('daily planner calculations', () => {
  it('keeps browser drag effects compatible for task copies and block moves', () => {
    expect(calendarDropEffect('copy')).toBe('copy')
    expect(calendarDropEffect('move')).toBe('move')
  })

  it('groups overdue, today, and unscheduled tasks without duplicates', () => {
    const yesterday = new Date(2026, 9, 25, 12)
    const today = new Date(2026, 9, 26, 12)
    const groups = groupPlannerTasks([
      task('overdue', yesterday), task('today', today), task('scheduled-today'), task('unscheduled'),
      { ...task('done'), status: 'done' },
    ], new Set(['scheduled-today']), new Set(['scheduled-today']), now)

    expect(groups.overdue.map(item => item.id)).toEqual(['overdue'])
    expect(groups.today.map(item => item.id)).toEqual(['today', 'scheduled-today'])
    expect(groups.unscheduled.map(item => item.id)).toEqual(['unscheduled'])
  })

  it('counts only planned work as planned time and includes real linked running sessions as actual', () => {
    const blocks = [block('planned', 'planned', 0, 3_600_000), block('completed', 'completed', 0, 9_000_000)]
    expect(sumPlannedDuration(blocks)).toBe(3_600_000)

    const session: Session = {
      id: 'session', projectId: 'project', scheduledBlockId: 'planned', title: 'Focus', objective: '',
      status: 'running', startedAt: new Date(0), lastResumedAt: new Date(1_000), accumulatedDurationMs: 5_000,
      accomplishments: '', blockers: '', nextStep: '', outcome: '', createdAt: new Date(0), updatedAt: new Date(0),
    }
    expect(sumActualDuration([session], 11_000)).toBe(15_000)
    expect(formatCompactDuration(90 * 60_000, 'ru')).toBe('1ч 30м')
    expect(formatCompactDuration(30 * 60_000, 'en')).toBe('30m')
  })

  it('snaps pointer positions to quarter-hours and parses them in local time', () => {
    expect(snapCalendarOffsetToMinutes(32, 1536)).toBe(30)
    expect(snapCalendarOffsetToMinutes(1536, 1536)).toBe(1425)
    const start = calendarDropStart(new Date(2026, 9, 26), 9 * 60 + 7)
    expect(start.getHours()).toBe(9)
    expect(start.getMinutes()).toBe(0)
  })
})
