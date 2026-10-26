import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AlteraDB, clearAllData, db } from '@/db/db'
import { ensureDatabaseSeeded } from '@/db/initialization'
import { seedDatabase } from '@/db/seed'

beforeEach(async () => { await db.delete(); await db.open() })
afterEach(async () => { await db.delete() })

describe('persistent initialization', () => {
  it('seeds once under concurrent initialization', async () => {
    await Promise.all([ensureDatabaseSeeded(), ensureDatabaseSeeded()])
    expect(await db.projects.count()).toBeGreaterThan(0)
    expect((await db.metadata.get('initialized'))?.value).toBe(true)
  })

  it('keeps a wiped workspace empty after reopen', async () => {
    await ensureDatabaseSeeded()
    await clearAllData()
    db.close()
    await db.open()
    await ensureDatabaseSeeded()
    for (const table of db.tables.filter(t => t.name !== 'metadata')) {
      expect(await table.count()).toBe(0)
    }
  })

  it('does not overwrite existing knowledge without projects', async () => {
    await db.tags.add({ id: 'personal', name: 'Personal', normalizedName: 'personal', color: '#fff', createdAt: new Date() })
    await ensureDatabaseSeeded()
    expect(await db.projects.count()).toBe(0)
    expect(await db.tags.count()).toBe(1)
  })

  it('clears calendar blocks and templates when replacing all local records with demo data', async () => {
    await seedDatabase()
    const project = await db.projects.get('proj-1')
    const task = await db.tasks.where('projectId').equals('proj-1').first()
    expect(project).toBeDefined()
    expect(task).toBeDefined()
    const now = new Date()
    await db.scheduledWorkBlocks.add({
      id: 'user-calendar-block',
      title: 'User block',
      projectId: project!.id,
      taskId: task!.id,
      scheduledStart: new Date(now.getTime() + 60_000),
      scheduledEnd: new Date(now.getTime() + 90_000),
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    })
    await db.workflowTemplates.add({
      id: 'user-workflow-template',
      kind: 'task',
      name: 'User template',
      title: 'Reusable task',
      priority: 'medium',
      createdAt: now,
      updatedAt: now,
    })

    await seedDatabase()

    expect(await db.scheduledWorkBlocks.count()).toBe(0)
    expect(await db.workflowTemplates.count()).toBe(0)
    expect(await db.projects.get('proj-1')).toBeDefined()
    expect(await db.tasks.where('projectId').equals('proj-1').count()).toBeGreaterThan(0)
  })

  it('marks an existing empty v3 database initialized on migration', async () => {
    const name = 'initialization-migration-test'
    const legacy = new Dexie(name)
    legacy.version(3).stores({ projects: 'id' })
    await legacy.open()
    legacy.close()
    const upgraded = new AlteraDB(name)
    try {
      await upgraded.open()
      expect((await upgraded.metadata.get('initialized'))?.value).toBe(true)
      expect(await upgraded.projects.count()).toBe(0)
    } finally { await upgraded.delete() }
  })
})
