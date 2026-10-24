/**
 * useSessions.ts — Reactive hooks for the Sessions engine.
 *
 * Timer design:
 *  - Duration is NEVER stored as a live counter.
 *  - The DB only stores `accumulatedDurationMs` + `lastResumedAt`.
 *  - useLiveTimer() derives elapsed time from those two fields every second
 *    using a local setInterval — the DB is never written to on each tick.
 *  - On page refresh or navigation the timer picks up correctly because the
 *    formula uses wall-clock timestamps.
 */

import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import {
  computeElapsedMs,
  formatDuration,
  formatDurationShort,
  formatTimer,
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
  type CompleteSummary,
} from '@/db/sessions'
import type { Session, SessionStatistics, StartSessionOptions } from '@/types'

export { formatTimer, formatDuration, formatDurationShort }

// ─── Basic reactive queries ───────────────────────────────────────────────────

/** Reactively returns all sessions across all projects, newest first. */
export function useAllSessions(): Session[] {
  return useLiveQuery(() => getAllSessions(), []) ?? []
}

/** Reactively returns the current running or paused session (or undefined). */
export function useActiveSession(): Session | undefined {
  return useLiveQuery(() => getActiveSession(), [])
}

/** Reactively returns all sessions for a given project, newest first. */
export function useProjectSessions(projectId: string | undefined): Session[] {
  return (
    useLiveQuery(
      async () => {
        if (!projectId) return []
        return getSessionsByProject(projectId)
      },
      [projectId]
    ) ?? []
  )
}

/** Reactively returns the most recent completed session for a project. */
export function useLatestProjectSession(projectId: string | undefined): Session | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return undefined
    const sessions = await db.sessions
      .where('projectId')
      .equals(projectId)
      .toArray()
    const completed = sessions
      .filter((s) => s.status === 'completed')
      .sort(
        (a, b) =>
          new Date(b.endedAt || b.updatedAt).getTime() -
          new Date(a.endedAt || a.updatedAt).getTime()
      )
    return completed[0]
  }, [projectId])
}

/** Reactively calculates total focus duration (ms) for a specific project. */
export function useProjectTotalDuration(projectId: string | undefined): number {
  return (
    useLiveQuery(async () => {
      if (!projectId) return 0
      const sessions = await db.sessions
        .where('projectId')
        .equals(projectId)
        .toArray()
      return sessions
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + s.accumulatedDurationMs, 0)
    }, [projectId]) ?? 0
  )
}

/** Reactively returns the N most recent sessions across all projects. */
export function useRecentSessions(limit = 10): Session[] {
  return (
    useLiveQuery(() => getRecentSessions(limit), [limit]) ?? []
  )
}

/** Reactively computes aggregate session statistics. */
export function useSessionStatistics(): SessionStatistics | undefined {
  return useLiveQuery(() => getSessionStatistics(), [])
}

// ─── Live timer ───────────────────────────────────────────────────────────────

/**
 * Returns the live elapsed milliseconds for any session.
 *
 * For a running session this increments every second via a local interval.
 * For a paused or completed session this is stable (no interval needed).
 *
 * The interval is intentionally NOT written back to the DB — only the
 * display value is updated in component state.
 */
export function useLiveElapsedMs(session: Session | undefined): number {
  const [, forceTick] = React.useReducer((tick: number) => tick + 1, 0)

  React.useEffect(() => {
    if (!session || session.status !== 'running') {
      // Stable — no polling needed
      return
    }

    // Tick once per second for visual display only
    const interval = window.setInterval(() => {
      forceTick()
    }, 1000)

    return () => window.clearInterval(interval)
  }, [
    session,
    // Re-subscribe when key fields that affect computation change
    session?.status,
    session?.lastResumedAt,
    session?.accumulatedDurationMs,
  ])

  return session ? computeElapsedMs(session) : 0
}

/**
 * Convenience wrapper: returns a formatted duration string for the active session.
 * Returns "0s" when there is no active session.
 */
export function useActiveDurationString(): string {
  const active = useActiveSession()
  const ms = useLiveElapsedMs(active)
  return formatDuration(ms)
}

// ─── Session actions hook ─────────────────────────────────────────────────────

interface SessionActions {
  start: (projectId: string, options?: StartSessionOptions) => Promise<Session>
  pause: (sessionId: string) => Promise<Session>
  resume: (sessionId: string) => Promise<Session>
  complete: (sessionId: string, summary?: CompleteSummary) => Promise<Session>
  updateMeta: (
    sessionId: string,
    updates: Parameters<typeof updateSessionMeta>[1]
  ) => Promise<void>
  updateCompleted: (
    sessionId: string,
    updates: Parameters<typeof updateCompletedSession>[1]
  ) => Promise<Session>
  deleteSession: (sessionId: string) => Promise<void>
  isLoading: boolean
  error: string | null
  clearError: () => void
}

/**
 * Returns bound session action functions with shared loading/error state.
 * Suitable for use in any component that drives session controls.
 */
export function useSessionActions(): SessionActions {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const wrap = React.useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setIsLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const start = React.useCallback(
    (projectId: string, options?: StartSessionOptions) =>
      wrap(() => startSession(projectId, options)),
    [wrap]
  )

  const pause = React.useCallback(
    (sessionId: string) => wrap(() => pauseSession(sessionId)),
    [wrap]
  )

  const resume = React.useCallback(
    (sessionId: string) => wrap(() => resumeSession(sessionId)),
    [wrap]
  )

  const complete = React.useCallback(
    (sessionId: string, summary?: CompleteSummary) =>
      wrap(() => completeSession(sessionId, summary)),
    [wrap]
  )

  const updateMeta = React.useCallback(
    (sessionId: string, updates: Parameters<typeof updateSessionMeta>[1]) =>
      wrap(() => updateSessionMeta(sessionId, updates)),
    [wrap]
  )

  const updateCompleted = React.useCallback(
    (sessionId: string, updates: Parameters<typeof updateCompletedSession>[1]) =>
      wrap(() => updateCompletedSession(sessionId, updates)),
    [wrap]
  )

  const deleteSessionAction = React.useCallback(
    (sessionId: string) => wrap(() => deleteSession(sessionId)),
    [wrap]
  )

  const clearError = React.useCallback(() => setError(null), [])

  return {
    start,
    pause,
    resume,
    complete,
    updateMeta,
    updateCompleted,
    deleteSession: deleteSessionAction,
    isLoading,
    error,
    clearError,
  }
}
