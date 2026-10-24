import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

export function useRecentActivity(limit = 10, projectId?: string) {
  return useLiveQuery(async () => {
    let activities = projectId
      ? await db.activities.where('projectId').equals(projectId).toArray()
      : await db.activities.toArray()

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return activities.slice(0, limit)
  }, [limit, projectId])
}
