import Dexie, { type Table } from 'dexie'
import type { Project, Task, Activity, Session } from '@/types'

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class AlteraDB extends Dexie {
  projects!: Table<Project, string>
  tasks!: Table<Task, string>
  activities!: Table<Activity, string>
  sessions!: Table<Session, string>

  constructor() {
    super('AlteraDB')

    // ── v1: original schema (never touch this) ─────────────────────────────
    this.version(1).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
    })

    // ── v2: add sessions table ─────────────────────────────────────────────
    // Dexie merges the schema – existing tables and their data are preserved.
    // Only `sessions` is new; no upgrade() callback needed.
    this.version(2).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      // Indexed on projectId (history per project), status (find active sessions),
      // startedAt (chronological ordering) and updatedAt (recency).
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
    })
  }
}

export const db = new AlteraDB()

export class DataIntegrityError extends Error {
  code: 'PROJECT_NOT_FOUND' | 'PROJECT_HAS_ACTIVE_SESSION'

  constructor(
    message: string,
    code: 'PROJECT_NOT_FOUND' | 'PROJECT_HAS_ACTIVE_SESSION'
  ) {
    super(message)
    this.name = 'DataIntegrityError'
    this.code = code
  }
}

export async function getNextProjectIdentifier(): Promise<string> {
  const projects = await db.projects.toArray()
  let maxNum = 0
  for (const p of projects) {
    const match = p.identifier.match(/ALT-(\d+)/i)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }
  const nextNum = maxNum + 1
  return `ALT-${nextNum.toString().padStart(3, '0')}`
}

export async function logActivity(activity: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  const newActivity: Activity = {
    ...activity,
    id: generateId(),
    createdAt: new Date(),
  }
  await db.activities.add(newActivity)
  return newActivity
}

export async function recalculateProjectProgress(projectId: string): Promise<number> {
  const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray()
  const progress = projectTasks.length === 0
    ? 0
    : Math.round((projectTasks.filter((t) => t.status === 'done').length / projectTasks.length) * 100)

  await db.projects.update(projectId, {
    progress,
    updatedAt: new Date(),
  })
  return progress
}

export async function touchProject(projectId: string): Promise<void> {
  const project = await db.projects.get(projectId)
  if (project) {
    await db.projects.update(projectId, {
      lastVisitedAt: new Date(),
    })
  }
}

/** Explicit destructive operation used only by the confirmed Settings action. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.activities, db.sessions, async () => {
    await db.projects.clear()
    await db.tasks.clear()
    await db.activities.clear()
    await db.sessions.clear()
  })
}

export async function createProject(
  data: Omit<Project, 'id' | 'identifier' | 'progress' | 'createdAt' | 'updatedAt'> & { identifier?: string }
): Promise<Project> {
  return db.transaction('rw', db.projects, db.activities, async () => {
    const now = new Date()
    const identifier = data.identifier || (await getNextProjectIdentifier())
    const project: Project = {
      ...data,
      id: generateId(),
      identifier,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      lastVisitedAt: now,
    }

    await db.projects.add(project)
    await logActivity({
      type: 'project_created',
      projectId: project.id,
      description: `Created project "${project.name}" (${project.identifier})`,
    })

    if (project.nextAction && project.nextAction.trim()) {
      await logActivity({
        type: 'next_action_set',
        projectId: project.id,
        description: `Set initial next action: "${project.nextAction.trim()}"`,
      })
    }

    return project
  })
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  await db.transaction('rw', db.projects, db.activities, async () => {
    const existing = await db.projects.get(projectId)
    if (!existing) return

    const now = new Date()
    await db.projects.update(projectId, {
      ...updates,
      id: existing.id,
      identifier: existing.identifier,
      createdAt: existing.createdAt,
      updatedAt: now,
    })

    if (updates.nextAction !== undefined && updates.nextAction !== existing.nextAction) {
      await logActivity({
        type: 'next_action_set',
        projectId,
        description: updates.nextAction.trim()
          ? `Updated next action: "${updates.nextAction.trim()}"`
          : `Cleared next action`,
      })
    } else if (updates.name || updates.status || updates.priority || updates.description) {
      await logActivity({
        type: 'project_updated',
        projectId,
        description: `Updated project "${updates.name || existing.name}"`,
      })
    }
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.activities, db.sessions, async () => {
    const project = await db.projects.get(projectId)
    if (!project) return
    const activeSession = await db.sessions
      .where('projectId')
      .equals(projectId)
      .filter((session) => session.status !== 'completed')
      .first()
    if (activeSession) {
      throw new DataIntegrityError(
        'Complete or delete the active work session before deleting this project.',
        'PROJECT_HAS_ACTIVE_SESSION'
      )
    }
    await db.tasks.where('projectId').equals(projectId).delete()
    await db.activities.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}

export async function createTask(
  data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'> & { order?: number }
): Promise<Task> {
  return db.transaction('rw', db.projects, db.tasks, db.activities, async () => {
    const project = await db.projects.get(data.projectId)
    if (!project) {
      throw new DataIntegrityError(
        `Project "${data.projectId}" not found`,
        'PROJECT_NOT_FOUND'
      )
    }

    const now = new Date()
    const existingTasks = await db.tasks.where('projectId').equals(data.projectId).toArray()
    const order = data.order !== undefined ? data.order : existingTasks.length
    const task: Task = {
      ...data,
      id: generateId(),
      order,
      completedAt: data.status === 'done' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }

    await db.tasks.add(task)
    await recalculateProjectProgress(data.projectId)
    await logActivity({
      type: 'task_created',
      projectId: data.projectId,
      taskId: task.id,
      description: `Created task "${task.title}"`,
    })
    return task
  })
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.activities, async () => {
    const existing = await db.tasks.get(taskId)
    if (!existing) return

    const now = new Date()
    const updatedData: Partial<Task> = {
      ...updates,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: now,
    }

    if (updates.status !== undefined) {
      if (updates.status === 'done' && existing.status !== 'done') {
        updatedData.completedAt = now
      } else if (updates.status !== 'done') {
        updatedData.completedAt = undefined
      }
    }

    await db.tasks.update(taskId, updatedData)
    await recalculateProjectProgress(existing.projectId)

    if (updates.status === 'done' && existing.status !== 'done') {
      await logActivity({
        type: 'task_completed',
        projectId: existing.projectId,
        taskId,
        description: `Completed task "${existing.title}"`,
      })
    }
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.activities, async () => {
    const existing = await db.tasks.get(taskId)
    if (!existing) return

    await db.tasks.delete(taskId)
    await recalculateProjectProgress(existing.projectId)
    await logActivity({
      type: 'task_deleted',
      projectId: existing.projectId,
      taskId,
      description: `Deleted task "${existing.title}"`,
    })
  })
}
