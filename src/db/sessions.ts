/**
 * sessions.ts — ALTERA Session Service
 *
 * All session operations go through this module. It enforces:
 *  - Valid state transitions (running → paused → running → completed)
 *  - Single-active-session constraint (only one running/paused session at a time)
 *  - Timestamp-based duration (never a live incrementing counter in the DB)
 *  - Atomic transactions for multi-step writes
 *
 * Duration formula:
 *   When running: elapsed = accumulatedDurationMs + (now - lastResumedAt)
 *   When paused/completed: elapsed = accumulatedDurationMs
 */

import { db, generateId } from './db'
import type {
  Session,
  SessionStatistics,
  StartSessionOptions,
} from '@/types'

/** A single focus session lasting longer than a year is treated as corrupt data. */
export const MAX_SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000

type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'SESSION_ALREADY_ACTIVE'
  | 'PROJECT_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'TASK_PROJECT_MISMATCH'
  | 'WORK_BLOCK_NOT_FOUND'
  | 'WORK_BLOCK_NOT_PLANNED'
  | 'WORK_BLOCK_PROJECT_MISMATCH'
  | 'WORK_BLOCK_TASK_MISMATCH'
  | 'ALREADY_COMPLETED'

// ─── Errors ──────────────────────────────────────────────────────────────────

export class SessionError extends Error {
  code: SessionErrorCode

  constructor(message: string, code: SessionErrorCode) {
    super(message)
    this.name = 'SessionError'
    this.code = code
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sanitizeDurationMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.floor(value), MAX_SESSION_DURATION_MS)
}

function timestampOf(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

/** Compute live elapsed ms for any session without modifying it. */
export function computeElapsedMs(session: Session, nowMs = Date.now()): number {
  const accumulated = sanitizeDurationMs(session.accumulatedDurationMs)
  if (session.status === 'running') {
    const resumedAtMs = timestampOf(session.lastResumedAt)
    if (resumedAtMs === undefined || !Number.isFinite(nowMs)) return accumulated
    const runningIntervalMs = Math.max(0, nowMs - resumedAtMs)
    return sanitizeDurationMs(accumulated + runningIntervalMs)
  }
  return accumulated
}

/** Return the single in-flight session (running or paused), if any. */
async function findActiveSession(): Promise<Session | undefined> {
  const running = await db.sessions.where('status').equals('running').first()
  if (running) return running
  return db.sessions.where('status').equals('paused').first()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new work session for a project.
 *
 * Throws if:
 *  - The project does not exist.
 *  - There is already a running or paused session (call pauseSession or
 *    completeSession first).
 */
export async function startSession(
  projectId: string,
  options: StartSessionOptions = {}
): Promise<Session> {
  // IndexedDB serializes overlapping read/write transactions for the same
  // object stores, so the invariant check and insert must live together.
  return db.transaction('rw', db.projects, db.tasks, db.sessions, db.activities, db.scheduledWorkBlocks, async () => {
    const project = await db.projects.get(projectId)
    if (!project) {
      throw new SessionError(`Project "${projectId}" not found`, 'PROJECT_NOT_FOUND')
    }

    if (options.taskId) {
      const task = await db.tasks.get(options.taskId)
      if (!task) {
        throw new SessionError(`Task "${options.taskId}" not found`, 'TASK_NOT_FOUND')
      }
      if (task.projectId !== projectId) {
        throw new SessionError(
          `Task "${options.taskId}" does not belong to project "${projectId}"`,
          'TASK_PROJECT_MISMATCH'
        )
      }
    }

    if (options.scheduledBlockId) {
      const block = await db.scheduledWorkBlocks.get(options.scheduledBlockId)
      if (!block) {
        throw new SessionError(`Work block "${options.scheduledBlockId}" not found`, 'WORK_BLOCK_NOT_FOUND')
      }
      if (block.status !== 'planned') {
        throw new SessionError('A session can only be started from a planned work block', 'WORK_BLOCK_NOT_PLANNED')
      }
      if (block.projectId !== projectId) {
        throw new SessionError('Work block belongs to a different project', 'WORK_BLOCK_PROJECT_MISMATCH')
      }
      if (block.taskId !== options.taskId) {
        throw new SessionError('Work block task does not match the selected task', 'WORK_BLOCK_TASK_MISMATCH')
      }
    }

    const existingActive = await findActiveSession()
    if (existingActive) {
      throw new SessionError(
        `A session is already ${existingActive.status}. Complete it before starting a new one.`,
        'SESSION_ALREADY_ACTIVE'
      )
    }

    const now = new Date()
    const session: Session = {
      id: generateId(),
      projectId,
      taskId: options.taskId,
      scheduledBlockId: options.scheduledBlockId,
      title: options.title ?? `Session — ${project.name}`,
      objective: options.objective ?? '',
      status: 'running',
      startedAt: now,
      endedAt: undefined,
      lastResumedAt: now,
      accumulatedDurationMs: 0,
      accomplishments: '',
      blockers: '',
      nextStep: '',
      outcome: '',
      createdAt: now,
      updatedAt: now,
    }

    await db.sessions.add(session)
    await db.activities.add({
      id: generateId(),
      projectId,
      type: 'session_started',
      description: `Started session "${session.title}"`,
      createdAt: now,
    })
    return session
  })
}

/**
 * Pause a running session.
 * Banks the elapsed time into accumulatedDurationMs.
 */
export async function pauseSession(sessionId: string): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) {
      throw new SessionError(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND')
    }
    if (session.status === 'completed') {
      throw new SessionError('Cannot pause a completed session', 'ALREADY_COMPLETED')
    }
    if (session.status === 'paused') {
      throw new SessionError('Session is already paused', 'INVALID_TRANSITION')
    }

    const now = new Date()
    const updates: Partial<Session> = {
      status: 'paused',
      accumulatedDurationMs: computeElapsedMs(session, now.getTime()),
      updatedAt: now,
    }

    await db.sessions.update(sessionId, updates)
    return { ...session, ...updates }
  })
}

/**
 * Resume a paused session.
 * Records the resume timestamp so duration can be calculated going forward.
 */
export async function resumeSession(sessionId: string): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) {
      throw new SessionError(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND')
    }
    if (session.status === 'completed') {
      throw new SessionError('Cannot resume a completed session', 'ALREADY_COMPLETED')
    }
    if (session.status === 'running') {
      throw new SessionError('Session is already running', 'INVALID_TRANSITION')
    }

    const otherActive = await findActiveSession()
    if (otherActive && otherActive.id !== sessionId) {
      throw new SessionError(
        `Another session is already ${otherActive.status}. Complete it first.`,
        'SESSION_ALREADY_ACTIVE'
      )
    }

    const now = new Date()
    const updates: Partial<Session> = {
      status: 'running',
      accumulatedDurationMs: sanitizeDurationMs(session.accumulatedDurationMs),
      lastResumedAt: now,
      updatedAt: now,
    }

    await db.sessions.update(sessionId, updates)
    return { ...session, ...updates }
  })
}

/** Options accepted by completeSession(). All fields are optional. */
export interface CompleteSummary {
  accomplishments?: string
  blockers?: string
  nextStep?: string
  outcome?: string
  syncNextStepToProject?: boolean
}

/**
 * Mark a session as completed.
 * Finalises the accumulated duration so it is forever readable without timestamps.
 */
export async function completeSession(
  sessionId: string,
  summary: CompleteSummary = {}
): Promise<Session> {
  return db.transaction('rw', db.projects, db.sessions, db.activities, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) {
      throw new SessionError(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND')
    }
    if (session.status === 'completed') {
      throw new SessionError('Session is already completed', 'ALREADY_COMPLETED')
    }

    const now = new Date()
    const accumulatedDurationMs = computeElapsedMs(session, now.getTime())
    const nextStep = summary.nextStep ?? session.nextStep
    const updates: Partial<Session> = {
      status: 'completed',
      endedAt: now,
      accumulatedDurationMs,
      accomplishments: summary.accomplishments ?? session.accomplishments,
      blockers: summary.blockers ?? session.blockers,
      nextStep,
      outcome: summary.outcome ?? session.outcome,
      updatedAt: now,
    }

    await db.sessions.update(sessionId, updates)
    await db.activities.add({
      id: generateId(),
      projectId: session.projectId,
      type: 'session_completed',
      description: `Completed session "${session.title}" (${formatDurationShort(accumulatedDurationMs)})`,
      createdAt: now,
    })

    const trimmedNextStep = nextStep.trim()
    if (summary.syncNextStepToProject && trimmedNextStep) {
      const project = await db.projects.get(session.projectId)
      if (project && project.nextAction !== trimmedNextStep) {
        await db.projects.update(project.id, {
          nextAction: trimmedNextStep,
          updatedAt: now,
        })
        await db.activities.add({
          id: generateId(),
          projectId: project.id,
          type: 'next_action_set',
          description: `Updated next action: "${trimmedNextStep}"`,
          createdAt: now,
        })
      }
    }

    return { ...session, ...updates }
  })
}

/**
 * Update mutable fields on a session (title, objective, notes, nextStep, blockers).
 * Status transitions must use the dedicated functions above.
 */
export async function updateSessionMeta(
  sessionId: string,
  updates: Partial<Pick<Session, 'title' | 'objective' | 'accomplishments' | 'blockers' | 'nextStep' | 'taskId'>>
): Promise<void> {
  await db.transaction('rw', db.tasks, db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) {
      throw new SessionError(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND')
    }
    if (session.status === 'completed') {
      throw new SessionError('Cannot edit a completed session', 'ALREADY_COMPLETED')
    }
    if (updates.taskId) {
      const task = await db.tasks.get(updates.taskId)
      if (!task) {
        throw new SessionError(`Task "${updates.taskId}" not found`, 'TASK_NOT_FOUND')
      }
      if (task.projectId !== session.projectId) {
        throw new SessionError(
          `Task "${updates.taskId}" does not belong to the session project`,
          'TASK_PROJECT_MISMATCH'
        )
      }
    }
    await db.sessions.update(sessionId, { ...updates, updatedAt: new Date() })
  })
}

/**
 * Update summary fields of an existing completed session.
 * Does not alter duration or lifecycle status.
 */
export async function updateCompletedSession(
  sessionId: string,
  updates: Partial<Pick<Session, 'title' | 'objective' | 'accomplishments' | 'blockers' | 'nextStep' | 'outcome'>>
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) {
      throw new SessionError(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND')
    }
    if (session.status !== 'completed') {
      throw new SessionError('Only completed sessions can have their summary edited', 'INVALID_TRANSITION')
    }
    const updatedData: Partial<Session> = {
      ...updates,
      updatedAt: new Date(),
    }
    await db.sessions.update(sessionId, updatedData)
    return { ...session, ...updatedData }
  })
}

/**
 * Delete a session from IndexedDB.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.tagAssignments, db.entityLinks, async () => {
    await db.tagAssignments.filter(a => a.entityType === 'session' && a.entityId === sessionId).delete()
    await db.entityLinks.filter(link => (link.sourceType === 'session' && link.sourceId === sessionId) || (link.targetType === 'session' && link.targetId === sessionId)).delete()
    await db.sessions.delete(sessionId)
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Return all sessions across all projects, newest first. */
export async function getAllSessions(): Promise<Session[]> {
  const all = await db.sessions.toArray()
  return all.sort(
    (a, b) => (timestampOf(b.startedAt) ?? 0) - (timestampOf(a.startedAt) ?? 0)
  )
}

/** Return the current running or paused session, or undefined. */
export async function getActiveSession(): Promise<Session | undefined> {
  return findActiveSession()
}

/** Return all sessions for a project, newest first. */
export async function getSessionsByProject(projectId: string): Promise<Session[]> {
  const sessions = await db.sessions
    .where('projectId')
    .equals(projectId)
    .toArray()
  return sessions.sort(
    (a, b) => (timestampOf(b.startedAt) ?? 0) - (timestampOf(a.startedAt) ?? 0)
  )
}

/** Returns actual sessions associated with one planned work block, newest first. */
export async function getSessionsByScheduledBlock(blockId: string): Promise<Session[]> {
  const sessions = await db.sessions.where('scheduledBlockId').equals(blockId).toArray()
  return sessions.sort(
    (a, b) => (timestampOf(b.startedAt) ?? 0) - (timestampOf(a.startedAt) ?? 0)
  )
}

/** Return the N most recently updated sessions across all projects. */
export async function getRecentSessions(limit = 10): Promise<Session[]> {
  const all = await db.sessions.toArray()
  return all
    .sort((a, b) => (timestampOf(b.updatedAt) ?? 0) - (timestampOf(a.updatedAt) ?? 0))
    .slice(0, Math.max(0, Math.floor(limit)))
}

/**
 * Compute aggregate statistics across all sessions.
 * Only completed sessions contribute to duration averages.
 */
export async function getSessionStatistics(): Promise<SessionStatistics> {
  const [totalSessions, completed] = await Promise.all([
    db.sessions.count(),
    db.sessions.where('status').equals('completed').toArray(),
  ])

  const totalDurationMs = completed.reduce(
    (sum, s) => Math.min(Number.MAX_SAFE_INTEGER, sum + sanitizeDurationMs(s.accumulatedDurationMs)),
    0
  )

  const byDay: Record<string, number> = {}
  const byProject: Record<string, number> = {}

  for (const s of completed) {
    const duration = sanitizeDurationMs(s.accumulatedDurationMs)
    const startedAtMs = timestampOf(s.startedAt)
    if (startedAtMs !== undefined) {
      const day = new Date(startedAtMs).toISOString().slice(0, 10)
      byDay[day] = Math.min(Number.MAX_SAFE_INTEGER, (byDay[day] ?? 0) + duration)
    }
    byProject[s.projectId] =
      Math.min(Number.MAX_SAFE_INTEGER, (byProject[s.projectId] ?? 0) + duration)
  }

  return {
    totalSessions,
    completedSessions: completed.length,
    totalDurationMs,
    averageDurationMs:
      completed.length === 0 ? 0 : Math.round(totalDurationMs / completed.length),
    byDay,
    byProject,
  }
}

// ─── Formatting helpers (pure, exported for use in hooks/UI) ─────────────────

/** Format ms as "1h 23m" */
export function formatDuration(ms: number): string {
  ms = sanitizeDurationMs(ms)
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }
  return `${seconds}s`
}

/** Compact format for activity log: "1h 23m" or "45m" */
export function formatDurationShort(ms: number): string {
  ms = sanitizeDurationMs(ms)
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Formats ms into standard stopwatch timer: "MM:SS" or "HH:MM:SS" */
export function formatTimer(ms: number): string {
  ms = sanitizeDurationMs(ms)
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}
