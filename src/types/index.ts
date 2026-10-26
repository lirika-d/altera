export type ProjectStatus = 'active' | 'backlog' | 'paused' | 'archived' | 'completed'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export interface Project {
  id: string           // uuid
  identifier: string   // 'ALT-001'
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  color: string        // hex
  icon: string         // emoji
  progress: number     // 0-100
  nextAction: string   // the key "next action" field
  createdAt: Date
  updatedAt: Date
  lastVisitedAt?: Date
}

export interface Task {
  id: string
  projectId: string
  title: string
  status: TaskStatus
  priority: Priority
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
  order: number
}

export interface Activity {
  id: string
  projectId?: string
  taskId?: string
  type: 'project_created' | 'project_updated' | 'task_created' | 'task_completed' | 'task_deleted' | 'next_action_set' | 'session_started' | 'session_completed'
  description: string
  createdAt: Date
}

export type ProjectFilter = 'all' | 'active' | 'backlog' | 'archived' | 'paused' | 'completed'

// ─── Sessions ────────────────────────────────────────────────────────────────

/** Lifecycle states for a work session. */
export type SessionStatus = 'running' | 'paused' | 'completed'

/**
 * A timed work session scoped to a project (and optionally a task).
 *
 * Duration is NEVER stored as a realtime counter. Instead:
 *   totalMs = accumulatedDurationMs + (Date.now() - lastResumedAt)   [when running]
 *   totalMs = accumulatedDurationMs                                   [when paused/completed]
 *
 * This means the timer survives page refreshes, navigations and background tabs
 * without any setInterval bookkeeping in the persistence layer.
 */
export interface Session {
  /** Primary key – UUID */
  id: string
  /** FK → projects.id, or historical id when projectSnapshot is present. */
  projectId: string
  /** Preserved when the project is deleted; no live project link remains. */
  projectSnapshot?: { id: string; name: string; identifier: string }
  /** FK → tasks.id (optional focus task) */
  taskId?: string
  /** Optional link to the planned calendar block this real session was started from. */
  scheduledBlockId?: string
  /** Short human label for the session */
  title: string
  /** What the user intends to accomplish this session */
  objective: string
  /** Current lifecycle state */
  status: SessionStatus
  /** Wall-clock time the session was first created/started */
  startedAt: Date
  /** Wall-clock time the session ended (set on complete/abandon) */
  endedAt?: Date
  /**
   * Timestamp of the most recent resume (or startedAt for brand new sessions).
   * Used together with accumulatedDurationMs to compute live elapsed time.
   */
  lastResumedAt: Date
  /**
   * Duration banked from all previous running intervals (milliseconds).
   * Updated on every pause so we can resume from the right place.
   */
  accumulatedDurationMs: number
  /** Free-text notes on what was accomplished during the session */
  accomplishments: string
  /** Things that slowed the user down */
  blockers: string
  /** Proposed next step after this session */
  nextStep: string
  /** Brief outcome summary written when completing the session */
  outcome: string
  createdAt: Date
  updatedAt: Date
}

/** Shape returned by getSessionStatistics / useSessionStatistics */
export interface SessionStatistics {
  totalSessions: number
  completedSessions: number
  totalDurationMs: number
  averageDurationMs: number
  /** ISO date string (YYYY-MM-DD) → total ms worked that day */
  byDay: Record<string, number>
  /** projectId → total ms */
  byProject: Record<string, number>
}

/** Options accepted by startSession() */
export interface StartSessionOptions {
  title?: string
  objective?: string
  taskId?: string
  scheduledBlockId?: string
}

export * from './knowledge'
export * from './templates'
