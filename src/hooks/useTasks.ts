import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Task, Project } from '@/types'

export interface TaskWithProject extends Task {
  project?: Project
}

export function useProjectTasks(projectId: string | undefined) {
  return useLiveQuery(async () => {
    if (!projectId) return []
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    return tasks.sort((a, b) => a.order - b.order)
  }, [projectId])
}

export function useAllTasks() {
  return useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([
      db.tasks.toArray(),
      db.projects.toArray(),
    ])
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    return tasks.map((task) => ({
      ...task,
      project: projectMap.get(task.projectId),
    }))
  }, [])
}

/** Tasks scoped to active projects only (used by My Tasks page). */
export function useActiveProjectTasks() {
  return useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([
      db.tasks.toArray(),
      db.projects.toArray(),
    ])
    const activeProjectIds = new Set(
      projects.filter((p) => p.status === 'active').map((p) => p.id)
    )
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    return tasks
      .filter((t) => activeProjectIds.has(t.projectId))
      .map((task) => ({ ...task, project: projectMap.get(task.projectId) }))
  }, [])
}

export function useMyTasks(limit = 8) {
  return useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([
      db.tasks.toArray(),
      db.projects.toArray(),
    ])
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    const priorityWeights: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
      none: 0,
    }

    const openTasks = tasks
      .filter((t) => t.status === 'todo' || t.status === 'in_progress')
      .map((task) => ({
        ...task,
        project: projectMap.get(task.projectId),
      }))
      .sort((a, b) => {
        const pDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0)
        if (pDiff !== 0) return pDiff
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

    return openTasks.slice(0, limit)
  }, [limit])
}

export function useTask(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    return await db.tasks.get(id)
  }, [id])
}

export function useProjectTaskStats(projectId: string | undefined) {
  return useLiveQuery(async () => {
    if (!projectId) return { total: 0, done: 0, inProgress: 0, todo: 0, progress: 0 }
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length
    const todo = tasks.filter((t) => t.status === 'todo').length
    const progress = total === 0 ? 0 : Math.round((done / total) * 100)

    return { total, done, inProgress, todo, progress }
  }, [projectId])
}
