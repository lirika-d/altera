import 'fake-indexeddb/auto'
import { liveQuery } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Session } from '@/types'
import { AlteraDB } from '@/db/db'
import { getAnalyticsSourceData } from './analytics.repository'
import { getAnalyticsDateRange } from './analytics.utils'

function makeSession(id: string, startedAt: Date, durationMs = 5 * 60_000): Session {
  const endedAt = new Date(startedAt.getTime() + 30 * 60_000)
  return {
    id,
    projectId: 'project-a',
    title: id,
    objective: '',
    status: 'completed',
    startedAt,
    endedAt,
    lastResumedAt: startedAt,
    accumulatedDurationMs: durationMs,
    accomplishments: '',
    blockers: '',
    nextStep: '',
    outcome: '',
    createdAt: startedAt,
    updatedAt: endedAt,
  }
}

describe('analytics repository', () => {
  let database: AlteraDB

  beforeEach(async () => {
    database = new AlteraDB(`AlteraAnalyticsTest-${Date.now()}-${Math.random()}`)
    await database.open()
  })

  afterEach(async () => {
    await database.delete()
  })

  it('uses indexed local [start, end) ranges and includes scheduled blocks as a separate source', async () => {
    const now = new Date(2024, 0, 8, 12)
    const range = getAnalyticsDateRange('7d', now)
    const start = range.start!
    await database.sessions.bulkAdd([
      makeSession('at-start', start),
      makeSession('inside', new Date(2024, 0, 7, 9)),
      makeSession('at-end', range.end),
    ])
    await database.activities.add({
      id: 'activity-in-range',
      type: 'task_completed',
      projectId: 'project-a',
      description: 'completed',
      createdAt: new Date(2024, 0, 7, 9),
    })
    await database.scheduledWorkBlocks.add({
      id: 'planned',
      title: 'Planned work',
      projectId: 'project-a',
      scheduledStart: new Date(2024, 0, 7, 9),
      scheduledEnd: new Date(2024, 0, 7, 10),
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    })

    const data = await getAnalyticsSourceData(range, database)
    expect(data.sessions.map(session => session.id).sort()).toEqual(['at-start', 'inside'])
    expect(data.activities.map(activity => activity.id)).toEqual(['activity-in-range'])
    expect(data.scheduledWorkBlocks.map(block => block.id)).toEqual(['planned'])
  })

  it('loads the union of current and previous ranges for comparisons', async () => {
    const now = new Date(2024, 0, 8, 12)
    const current = getAnalyticsDateRange('7d', now)
    const previousStart = new Date(current.start!)
    previousStart.setDate(previousStart.getDate() - 7)
    const previous = { ...current, start: previousStart, end: new Date(current.start!) }
    await database.sessions.bulkAdd([
      makeSession('previous', new Date(previous.start)),
      makeSession('current', new Date(current.start!)),
      makeSession('outside', new Date(previous.start.getTime() - 1)),
    ])
    const data = await getAnalyticsSourceData(current, database, previous)
    expect(data.sessions.map(session => session.id).sort()).toEqual(['current', 'previous'])
  })

  it('reacts to source-table changes through Dexie live queries', async () => {
    const now = new Date(2024, 0, 8, 12)
    const range = getAnalyticsDateRange('7d', now)
    let initialResolve: ((sessions: Session[]) => void) | undefined
    let updateResolve: ((sessions: Session[]) => void) | undefined
    let updateReject: ((reason?: unknown) => void) | undefined
    const initialValue = new Promise<Session[]>(resolve => { initialResolve = resolve })
    const updatedValue = new Promise<Session[]>((resolve, reject) => {
      updateResolve = resolve
      updateReject = reject
    })
    let emissions = 0
    const subscription = liveQuery(() => getAnalyticsSourceData(range, database)).subscribe({
      next: data => {
        emissions++
        if (emissions === 1) initialResolve?.(data.sessions)
        if (data.sessions.length === 1) updateResolve?.(data.sessions)
      },
      error: error => updateReject?.(error),
    })

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      expect(await initialValue).toEqual([])
      const startedAt = new Date(2024, 0, 7, 10)
      await database.sessions.add(makeSession('new-session', startedAt))
      const result = await Promise.race([
        updatedValue,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Timed out waiting for live query')), 2_000)
        }),
      ])
      expect(result.map(session => session.id)).toEqual(['new-session'])
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  })
})
