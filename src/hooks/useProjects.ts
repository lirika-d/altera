import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { ProjectFilter } from '@/types'

export function useProjects(filter?: ProjectFilter, search?: string) {
  return useLiveQuery(async () => {
    let projects = await db.projects.toArray()

    if (filter && filter !== 'all') {
      projects = projects.filter((p) => p.status === filter)
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.identifier.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.nextAction.toLowerCase().includes(q)
      )
    }

    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [filter, search])
}

export function useProject(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    return await db.projects.get(id)
  }, [id])
}

export function useRecentlyVisitedProjects(limit = 3) {
  return useLiveQuery(async () => {
    const projects = await db.projects.toArray()
    return projects
      .filter((p) => p.lastVisitedAt)
      .sort((a, b) => new Date(b.lastVisitedAt!).getTime() - new Date(a.lastVisitedAt!).getTime())
      .slice(0, limit)
  }, [limit])
}

export function useActiveProjects() {
  return useLiveQuery(async () => {
    const projects = await db.projects.where('status').equals('active').toArray()
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [])
}
