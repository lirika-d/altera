/**
 * sessions.test.ts — Unit tests for the ALTERA Session Service
 *
 * Uses fake-indexeddb (injected via setup.ts) so there is no real browser.
 * Each test gets a fresh AlteraDB instance to avoid cross-test pollution.
 */

// Ensure fake-indexeddb globals are installed first, even if setup.ts ordering
// is non-deterministic in this worker. This import is idempotent.
import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlteraDB, generateId } from '@/db/db'
import {
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  updateSessionMeta,
  updateCompletedSession,
  deleteSession,
  getAllSessions,
  getActiveSession,
  getSessionsByProject,
  getRecentSessions,
  getSessionStatistics,
  computeElapsedMs,
  MAX_SESSION_DURATION_MS,
  formatDuration,
  formatDurationShort,
  formatTimer,
} from '@/db/sessions'
import type { Project, Session, Task } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seed a minimal project so foreign-key checks pass. */
async function seedProject(dbInstance: AlteraDB, id = 'proj-test'): Promise<Project> {
  const project: Project = {
    id,
    identifier: 'ALT-TEST',
    name: 'Test Project',
    description: 'Used in tests',
    status: 'active',
    priority: 'medium',
    color: '#3b82f6',
    icon: '🧪',
    progress: 0,
    nextAction: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await dbInstance.projects.add(project)
  return project
}

async function seedTask(
  dbInstance: AlteraDB,
  projectId = 'proj-test',
  id = 'task-test'
): Promise<Task> {
  const task: Task = {
    id,
    projectId,
    title: 'Test task',
    status: 'todo',
    priority: 'medium',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await dbInstance.tasks.add(task)
  return task
}

// ─── Module-level db singleton replacement ────────────────────────────────────
// The service functions import `db` from '@/db/db'. We use vi.mock to
// intercept that import and swap in our fresh instance.

let testDb: AlteraDB

vi.mock('@/db/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/db')>()
  return {
    ...original,
    // db getter — always returns the current testDb
    get db() {
      return testDb
    },
  }
})

beforeEach(async () => {
  // Close any existing DB to avoid version conflicts
  if (testDb) {
    testDb.close()
  }
  testDb = new AlteraDB()
  // Use a unique name per test via IDBFactory created by fake-indexeddb
  await testDb.open()
  await testDb.projects.clear()
  await testDb.tasks.clear()
  await testDb.activities.clear()
  await testDb.sessions.clear()
})

// ─── computeElapsedMs ─────────────────────────────────────────────────────────

describe('computeElapsedMs', () => {
  it('returns accumulatedDurationMs when paused', () => {
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'paused', startedAt: new Date(), endedAt: undefined,
      lastResumedAt: new Date(Date.now() - 5000),
      accumulatedDurationMs: 60_000,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    expect(computeElapsedMs(session)).toBe(60_000)
  })

  it('returns accumulatedDurationMs when completed', () => {
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'completed', startedAt: new Date(), endedAt: new Date(),
      lastResumedAt: new Date(Date.now() - 5000),
      accumulatedDurationMs: 120_000,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    expect(computeElapsedMs(session)).toBe(120_000)
  })

  it('adds running interval when status is running', () => {
    const fiveSecondsAgo = new Date(Date.now() - 5000)
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'running', startedAt: fiveSecondsAgo, endedAt: undefined,
      lastResumedAt: fiveSecondsAgo,
      accumulatedDurationMs: 10_000,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    const elapsed = computeElapsedMs(session)
    // Should be ~15 000ms (10 000 accumulated + ~5 000 running)
    expect(elapsed).toBeGreaterThanOrEqual(14_900)
    expect(elapsed).toBeLessThan(16_000)
  })

  it('never returns a negative value for clock skew', () => {
    const futureResume = new Date(Date.now() + 10_000) // clock skew
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'running', startedAt: new Date(), endedAt: undefined,
      lastResumedAt: futureResume,
      accumulatedDurationMs: 0,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    expect(computeElapsedMs(session)).toBeGreaterThanOrEqual(0)
  })

  it('recovers safely from invalid timestamps and durations', () => {
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'running', startedAt: new Date('invalid'), endedAt: undefined,
      lastResumedAt: new Date('invalid'),
      accumulatedDurationMs: Number.NaN,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    expect(computeElapsedMs(session)).toBe(0)
  })

  it('caps corrupted or excessively large duration values', () => {
    const session: Session = {
      id: '1', projectId: 'p', title: 'T', objective: '',
      status: 'paused', startedAt: new Date(), endedAt: undefined,
      lastResumedAt: new Date(),
      accumulatedDurationMs: Number.MAX_VALUE,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date(), updatedAt: new Date(),
    }
    expect(computeElapsedMs(session)).toBe(MAX_SESSION_DURATION_MS)
  })
})

// ─── startSession ─────────────────────────────────────────────────────────────

describe('startSession', () => {
  it('creates a running session for a valid project', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    expect(session.status).toBe('running')
    expect(session.projectId).toBe('proj-test')
    expect(session.accumulatedDurationMs).toBe(0)

    const stored = await testDb.sessions.get(session.id)
    expect(stored).toBeDefined()
    expect(stored!.status).toBe('running')
  })

  it('uses provided title and objective', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test', {
      title: 'Custom Title',
      objective: 'Write tests',
    })
    expect(session.title).toBe('Custom Title')
    expect(session.objective).toBe('Write tests')
  })

  it('defaults title to "Session — <project name>"', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    expect(session.title).toBe('Session — Test Project')
  })

  it('throws SESSION_ALREADY_ACTIVE when a running session exists', async () => {
    await seedProject(testDb)
    await startSession('proj-test')
    await expect(startSession('proj-test')).rejects.toMatchObject({
      code: 'SESSION_ALREADY_ACTIVE',
    })
  })

  it('throws SESSION_ALREADY_ACTIVE when a paused session exists', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await pauseSession(s.id)
    await expect(startSession('proj-test')).rejects.toMatchObject({
      code: 'SESSION_ALREADY_ACTIVE',
    })
  })

  it('throws PROJECT_NOT_FOUND for a missing project', async () => {
    await expect(startSession('does-not-exist')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    })
  })

  it('logs a session_started activity', async () => {
    await seedProject(testDb)
    await startSession('proj-test')
    const activities = await testDb.activities.toArray()
    expect(activities.some((a) => a.type === 'session_started')).toBe(true)
  })

  it('accepts a task that belongs to the selected project', async () => {
    await seedProject(testDb)
    await seedTask(testDb)
    const session = await startSession('proj-test', { taskId: 'task-test' })
    expect(session.taskId).toBe('task-test')
  })

  it('rejects a missing task reference', async () => {
    await seedProject(testDb)
    await expect(startSession('proj-test', { taskId: 'missing' })).rejects.toMatchObject({
      code: 'TASK_NOT_FOUND',
    })
    expect(await testDb.sessions.count()).toBe(0)
  })

  it('rejects a task that belongs to another project', async () => {
    await seedProject(testDb)
    await seedProject(testDb, 'other-project')
    await seedTask(testDb, 'other-project')
    await expect(startSession('proj-test', { taskId: 'task-test' })).rejects.toMatchObject({
      code: 'TASK_PROJECT_MISMATCH',
    })
  })

  it('atomically permits only one of two simultaneous starts', async () => {
    await seedProject(testDb)
    const results = await Promise.allSettled([
      startSession('proj-test', { title: 'Tab A' }),
      startSession('proj-test', { title: 'Tab B' }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await testDb.sessions.where('status').anyOf('running', 'paused').count()).toBe(1)
    expect(await testDb.activities.where('type').equals('session_started').count()).toBe(1)
  })
})

// ─── pauseSession ─────────────────────────────────────────────────────────────

describe('pauseSession', () => {
  it('transitions running → paused and banks elapsed time', async () => {
    await seedProject(testDb)
    // Manually set lastResumedAt 10 seconds ago to simulate running time
    const session = await startSession('proj-test')
    await testDb.sessions.update(session.id, {
      lastResumedAt: new Date(Date.now() - 10_000),
    })

    const paused = await pauseSession(session.id)
    expect(paused.status).toBe('paused')
    expect(paused.accumulatedDurationMs).toBeGreaterThanOrEqual(9_900)
  })

  it('throws INVALID_TRANSITION when already paused', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await pauseSession(s.id)
    await expect(pauseSession(s.id)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
  })

  it('throws ALREADY_COMPLETED for a completed session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    await expect(pauseSession(s.id)).rejects.toMatchObject({
      code: 'ALREADY_COMPLETED',
    })
  })

  it('throws SESSION_NOT_FOUND for unknown id', async () => {
    await expect(pauseSession('ghost-id')).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    })
  })
})

// ─── resumeSession ────────────────────────────────────────────────────────────

describe('resumeSession', () => {
  it('transitions paused → running and sets lastResumedAt', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await pauseSession(s.id)
    const before = Date.now()
    const resumed = await resumeSession(s.id)
    const after = Date.now()

    expect(resumed.status).toBe('running')
    const resumedAt = new Date(resumed.lastResumedAt).getTime()
    expect(resumedAt).toBeGreaterThanOrEqual(before)
    expect(resumedAt).toBeLessThanOrEqual(after)
  })

  it('preserves previously accumulated duration on resume', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    // Simulate 30 seconds of running time
    await testDb.sessions.update(s.id, {
      lastResumedAt: new Date(Date.now() - 30_000),
    })
    const paused = await pauseSession(s.id)
    const accumulated = paused.accumulatedDurationMs

    const resumed = await resumeSession(s.id)
    expect(resumed.accumulatedDurationMs).toBe(accumulated)
    // Elapsed should still be at least the accumulated amount
    expect(computeElapsedMs(resumed)).toBeGreaterThanOrEqual(accumulated)
  })

  it('throws INVALID_TRANSITION when already running', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await expect(resumeSession(s.id)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
  })

  it('throws ALREADY_COMPLETED for a completed session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    await expect(resumeSession(s.id)).rejects.toMatchObject({
      code: 'ALREADY_COMPLETED',
    })
  })
})

// ─── completeSession ──────────────────────────────────────────────────────────

describe('completeSession', () => {
  it('finalises a running session and sets endedAt', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await testDb.sessions.update(s.id, {
      lastResumedAt: new Date(Date.now() - 20_000),
    })
    const completed = await completeSession(s.id, { outcome: 'All good' })

    expect(completed.status).toBe('completed')
    expect(completed.endedAt).toBeDefined()
    expect(completed.outcome).toBe('All good')
    expect(completed.accumulatedDurationMs).toBeGreaterThanOrEqual(19_900)
  })

  it('finalises a paused session without adding extra time', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await testDb.sessions.update(s.id, {
      lastResumedAt: new Date(Date.now() - 15_000),
    })
    const paused = await pauseSession(s.id)
    const bankedMs = paused.accumulatedDurationMs

    const completed = await completeSession(s.id)
    // Paused session should not accumulate additional time during complete()
    expect(completed.accumulatedDurationMs).toBe(bankedMs)
  })

  it('saves summary fields', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    const completed = await completeSession(s.id, {
      accomplishments: 'Fixed bug',
      blockers: 'None',
      nextStep: 'Write docs',
      outcome: 'Success',
    })
    expect(completed.accomplishments).toBe('Fixed bug')
    expect(completed.blockers).toBe('None')
    expect(completed.nextStep).toBe('Write docs')
    expect(completed.outcome).toBe('Success')
  })

  it('throws ALREADY_COMPLETED on double-complete', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    await expect(completeSession(s.id)).rejects.toMatchObject({
      code: 'ALREADY_COMPLETED',
    })
  })

  it('logs a session_completed activity', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    const activities = await testDb.activities.toArray()
    expect(activities.some((a) => a.type === 'session_completed')).toBe(true)
  })

  it('creates only one completion event under simultaneous completion', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    const results = await Promise.allSettled([
      completeSession(session.id),
      completeSession(session.id),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await testDb.activities.where('type').equals('session_completed').count()).toBe(1)
  })

  it('atomically synchronizes the next step to the project', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    await completeSession(session.id, {
      nextStep: 'Ship the fix',
      syncNextStepToProject: true,
    })

    expect((await testDb.projects.get('proj-test'))?.nextAction).toBe('Ship the fix')
    expect(await testDb.activities.where('type').equals('next_action_set').count()).toBe(1)
  })

  it('rolls back completion if its related activity write fails', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    vi.spyOn(testDb.activities, 'add').mockRejectedValueOnce(new Error('write failed'))

    await expect(completeSession(session.id)).rejects.toThrow('write failed')
    expect((await testDb.sessions.get(session.id))?.status).toBe('running')
    expect(await testDb.activities.where('type').equals('session_completed').count()).toBe(0)
  })
})

// ─── getActiveSession ─────────────────────────────────────────────────────────

describe('getActiveSession', () => {
  it('returns the running session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    const active = await getActiveSession()
    expect(active?.id).toBe(s.id)
  })

  it('returns the paused session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await pauseSession(s.id)
    const active = await getActiveSession()
    expect(active?.id).toBe(s.id)
    expect(active?.status).toBe('paused')
  })

  it('returns undefined when no session is active', async () => {
    const active = await getActiveSession()
    expect(active).toBeUndefined()
  })

  it('returns undefined after completing a session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    expect(await getActiveSession()).toBeUndefined()
  })
})

// ─── getSessionsByProject ──────────────────────────────────────────────────────

describe('getSessionsByProject', () => {
  it('returns sessions for the correct project only', async () => {
    await seedProject(testDb, 'p1')
    await seedProject(testDb, 'p2')

    const s1 = await startSession('p1')
    await completeSession(s1.id)
    const s2 = await startSession('p2')
    await completeSession(s2.id)

    const p1Sessions = await getSessionsByProject('p1')
    expect(p1Sessions.every((s) => s.projectId === 'p1')).toBe(true)
    expect(p1Sessions.length).toBe(1)
  })

  it('returns sessions newest first', async () => {
    await seedProject(testDb)
    const s1 = await startSession('proj-test')
    await completeSession(s1.id)
    const s2 = await startSession('proj-test')
    await completeSession(s2.id)

    const sessions = await getSessionsByProject('proj-test')
    expect(new Date(sessions[0].startedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(sessions[1].startedAt).getTime()
    )
  })

  it('returns empty array for unknown project', async () => {
    const sessions = await getSessionsByProject('nonexistent')
    expect(sessions).toEqual([])
  })
})

// ─── getRecentSessions ────────────────────────────────────────────────────────

describe('getRecentSessions', () => {
  it('respects the limit parameter', async () => {
    await seedProject(testDb)
    const s1 = await startSession('proj-test', { title: 'S1' })
    await completeSession(s1.id)
    const s2 = await startSession('proj-test', { title: 'S2' })
    await completeSession(s2.id)
    const s3 = await startSession('proj-test', { title: 'S3' })
    await completeSession(s3.id)

    const recent = await getRecentSessions(2)
    expect(recent.length).toBe(2)
  })
})

// ─── getSessionStatistics ─────────────────────────────────────────────────────

describe('getSessionStatistics', () => {
  it('counts total and completed sessions', async () => {
    await seedProject(testDb)
    const s1 = await startSession('proj-test')
    await completeSession(s1.id)
    const s2 = await startSession('proj-test')
    await pauseSession(s2.id) // not completed

    const stats = await getSessionStatistics()
    expect(stats.totalSessions).toBe(2)
    expect(stats.completedSessions).toBe(1)
  })

  it('sums duration for completed sessions only', async () => {
    await seedProject(testDb)
    // Manually insert a completed session with known duration
    const knownMs = 3_600_000 // 1 hour
    await testDb.sessions.add({
      id: generateId(),
      projectId: 'proj-test',
      title: 'Historic',
      objective: '',
      status: 'completed',
      startedAt: new Date(Date.now() - 7200_000),
      endedAt: new Date(),
      lastResumedAt: new Date(Date.now() - 7200_000),
      accumulatedDurationMs: knownMs,
      accomplishments: '',
      blockers: '',
      nextStep: '',
      outcome: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Start but don't complete — should not affect totalDurationMs
    const s2 = await startSession('proj-test')
    await testDb.sessions.update(s2.id, {
      lastResumedAt: new Date(Date.now() - 1800_000),
    })

    const stats = await getSessionStatistics()
    expect(stats.totalDurationMs).toBe(knownMs)
    expect(stats.averageDurationMs).toBe(knownMs)
  })

  it('groups duration by day', async () => {
    await seedProject(testDb)
    const today = new Date().toISOString().slice(0, 10)
    await testDb.sessions.add({
      id: generateId(),
      projectId: 'proj-test',
      title: 'Today session',
      objective: '',
      status: 'completed',
      startedAt: new Date(),
      endedAt: new Date(),
      lastResumedAt: new Date(),
      accumulatedDurationMs: 1_800_000, // 30 min
      accomplishments: '',
      blockers: '',
      nextStep: '',
      outcome: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const stats = await getSessionStatistics()
    expect(stats.byDay[today]).toBe(1_800_000)
  })

  it('returns zero stats when no sessions exist', async () => {
    const stats = await getSessionStatistics()
    expect(stats.totalSessions).toBe(0)
    expect(stats.totalDurationMs).toBe(0)
    expect(stats.averageDurationMs).toBe(0)
    expect(stats.byDay).toEqual({})
    expect(stats.byProject).toEqual({})
  })
})

// ─── updateSessionMeta ────────────────────────────────────────────────────────

describe('updateSessionMeta', () => {
  it('updates mutable fields on a running session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await updateSessionMeta(s.id, { title: 'New title', objective: 'New objective' })
    const updated = await testDb.sessions.get(s.id)
    expect(updated?.title).toBe('New title')
    expect(updated?.objective).toBe('New objective')
  })

  it('throws ALREADY_COMPLETED for a completed session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)
    await expect(updateSessionMeta(s.id, { title: 'X' })).rejects.toMatchObject({
      code: 'ALREADY_COMPLETED',
    })
  })
})

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(45_000)).toBe('45s')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s')
  })
  it('formats hours and minutes', () => {
    expect(formatDuration(3_660_000)).toBe('1h 01m')
  })
  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s')
  })
  it('clamps negative to zero', () => {
    expect(formatDuration(-5000)).toBe('0s')
  })
})

describe('formatDurationShort', () => {
  it('formats minutes only', () => {
    expect(formatDurationShort(600_000)).toBe('10m')
  })
  it('formats hours and minutes', () => {
    expect(formatDurationShort(5_400_000)).toBe('1h 30m')
  })
  it('returns 0m for zero', () => {
    expect(formatDurationShort(0)).toBe('0m')
  })
})

// ─── formatTimer ───────────────────────────────────────────────────────────────

describe('formatTimer', () => {
  it('formats MM:SS under an hour', () => {
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(5000)).toBe('00:05')
    expect(formatTimer(65_000)).toBe('01:05')
    expect(formatTimer(599_000)).toBe('09:59')
  })
  it('formats HH:MM:SS at or over an hour', () => {
    expect(formatTimer(3_600_000)).toBe('01:00:00')
    expect(formatTimer(3_665_000)).toBe('01:01:05')
  })
  it('clamps negative values to 00:00', () => {
    expect(formatTimer(-1000)).toBe('00:00')
  })
})

// ─── getAllSessions & updateCompletedSession & deleteSession ───────────────────

describe('getAllSessions', () => {
  it('returns all sessions newest first', async () => {
    await seedProject(testDb)
    const s1 = await startSession('proj-test', { title: 'First' })
    await completeSession(s1.id)
    const s2 = await startSession('proj-test', { title: 'Second' })
    await completeSession(s2.id)

    const all = await getAllSessions()
    expect(all.length).toBe(2)
    expect(all[0].title).toBe('Second')
    expect(all[1].title).toBe('First')
  })
})

describe('updateCompletedSession', () => {
  it('allows updating accomplishments, blockers, and outcome of completed session', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    const completed = await completeSession(s.id, { outcome: 'progress' })

    const updated = await updateCompletedSession(completed.id, {
      accomplishments: 'Updated accomplishments',
      blockers: 'New blocker note',
      outcome: 'completed',
    })

    expect(updated.accomplishments).toBe('Updated accomplishments')
    expect(updated.blockers).toBe('New blocker note')
    expect(updated.outcome).toBe('completed')

    const inDb = await testDb.sessions.get(completed.id)
    expect(inDb?.accomplishments).toBe('Updated accomplishments')
  })

  it('throws SESSION_NOT_FOUND for non-existent session', async () => {
    await expect(updateCompletedSession('missing', { title: 'Test' })).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    })
  })

  it('rejects summary edits for an unfinished session', async () => {
    await seedProject(testDb)
    const session = await startSession('proj-test')
    await expect(updateCompletedSession(session.id, { title: 'Nope' })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
  })
})

describe('corrupt persisted records', () => {
  it('does not let invalid dates or durations break statistics', async () => {
    await testDb.sessions.add({
      id: 'corrupt',
      projectId: 'missing-project',
      title: 'Corrupt legacy record',
      objective: '',
      status: 'completed',
      startedAt: new Date('invalid'),
      endedAt: new Date('invalid'),
      lastResumedAt: new Date('invalid'),
      accumulatedDurationMs: Number.POSITIVE_INFINITY,
      accomplishments: '', blockers: '', nextStep: '', outcome: '',
      createdAt: new Date('invalid'), updatedAt: new Date('invalid'),
    })

    const stats = await getSessionStatistics()
    expect(stats.totalSessions).toBe(1)
    expect(stats.totalDurationMs).toBe(0)
    expect(stats.byDay).toEqual({})
    expect(stats.byProject['missing-project']).toBe(0)
  })

  it('formats non-finite values without exposing NaN or Infinity', () => {
    expect(formatDuration(Number.NaN)).toBe('0s')
    expect(formatDurationShort(Number.POSITIVE_INFINITY)).toBe('0m')
    expect(formatTimer(Number.NaN)).toBe('00:00')
  })
})

describe('deleteSession', () => {
  it('removes a session from IndexedDB', async () => {
    await seedProject(testDb)
    const s = await startSession('proj-test')
    await completeSession(s.id)

    await deleteSession(s.id)
    const inDb = await testDb.sessions.get(s.id)
    expect(inDb).toBeUndefined()
  })
})

// ─── Database migration (v1 → v2) ────────────────────────────────────────────

describe('Database migration v1 → v2', () => {
  it('preserves representative v1 records while adding the sessions table', async () => {
    testDb.close()
    await Dexie.delete('AlteraDB')

    const legacyDb = new Dexie('AlteraDB')
    legacyDb.version(1).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
    })
    await legacyDb.open()
    await legacyDb.table('projects').add({
      id: 'legacy-project',
      identifier: 'ALT-001',
      name: 'Legacy project',
      description: 'Created before sessions existed',
      status: 'active',
      priority: 'medium',
      color: '#3b82f6',
      icon: '📦',
      progress: 0,
      nextAction: 'Keep this record',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    })
    legacyDb.close()

    testDb = new AlteraDB()
    await testDb.open()
    expect((await testDb.projects.get('legacy-project'))?.nextAction).toBe('Keep this record')
    expect(testDb.sessions).toBeDefined()
    expect(await testDb.sessions.count()).toBe(0)
  })
})
