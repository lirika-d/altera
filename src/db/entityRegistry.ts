import type { AlteraDB } from './db'
import type { KnowledgeEntityType } from '@/types'

export const ENTITY_TABLES = { note: 'notes', resource: 'resources', project: 'projects', task: 'tasks', session: 'sessions' } as const

export async function assertEntityExists(database: AlteraDB, type: KnowledgeEntityType, id: string): Promise<void> {
  if (!Object.hasOwn(ENTITY_TABLES, type) || !await database.table(ENTITY_TABLES[type]).get(id)) {
    throw new Error(`Missing ${type} entity`)
  }
}

export async function assertTagsExist(database: AlteraDB, ids: string[]): Promise<void> {
  const tags = await database.tags.bulkGet([...new Set(ids)])
  if (tags.some(tag => !tag)) throw new Error('Missing tag')
}
