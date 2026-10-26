import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { seedDatabase } from '@/db/seed'
import { isBackupSizeAllowed, MAX_BACKUP_BYTES, validateBackup } from '@/db/backupValidation'
import { importBackup } from '@/db/backupImport'
import { createScheduledWorkBlock } from '@/db/calendar'
import { createWorkflowTemplate } from '@/db/templates'
import { restoreBackupPreferences } from '@/db/backupPreferences'
import { DEFAULT_APP_PREFERENCES } from '@/types/preferences'
import { APP_PREFERENCES_KEY } from '@/lib/appPreferences'
import { PLANNER_REMINDER_LEAD_KEY } from '@/lib/plannerReminderSettings'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

async function fixture() {
  await seedDatabase()
  const task = await db.tasks.toCollection().first()
  await createScheduledWorkBlock({
    title: 'Backup calendar block',
    scheduledStart: new Date(2026, 9, 30, 9),
    scheduledEnd: new Date(2026, 9, 30, 10),
    projectId: task?.projectId,
    taskId: task?.id,
  })
  const tables = Object.fromEntries(await Promise.all(db.tables.filter(t => t.name !== 'metadata').map(async t => [t.name, await t.toArray()])))
  return JSON.parse(JSON.stringify({ app: 'ALTERA', schemaVersion: 3, exportedAt: new Date().toISOString(), tables }))
}
beforeEach(async () => { await db.delete(); await db.open() })

describe('backup validation and import', () => {
  it('keeps exported backup sizes within the import limit', () => {
    expect(isBackupSizeAllowed(MAX_BACKUP_BYTES)).toBe(true)
    expect(isBackupSizeAllowed(MAX_BACKUP_BYTES + 1)).toBe(false)
    expect(isBackupSizeAllowed(-1)).toBe(false)
    expect(isBackupSizeAllowed(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('rejects activity records with missing or mismatched entity references', async () => {
    const missingTaskBackup = await fixture()
    const activity = missingTaskBackup.tables.activities.find((row: { taskId?: string }) => row.taskId)
    expect(activity).toBeDefined()
    activity.taskId = 'missing-task'
    expect(() => validateBackup(missingTaskBackup)).toThrow('activities: missing task')

    const mismatchBackup = await fixture()
    const task = mismatchBackup.tables.tasks[0]
    const otherProject = mismatchBackup.tables.projects.find((project: { id: string }) => project.id !== task.projectId)
    expect(otherProject).toBeDefined()
    const taskActivity = {
      id: 'activity-with-mismatched-project',
      taskId: task.id,
      projectId: otherProject.id,
      type: 'task_completed',
      description: 'test',
      createdAt: new Date().toISOString(),
    }
    mismatchBackup.tables.activities.push(taskActivity)
    expect(() => validateBackup(mismatchBackup)).toThrow('activities: task does not belong to project')
  })

  it('round-trips the real demo data and revives task dueDate', async () => {
    const backup = await fixture()
    backup.tables.tasks[0].dueDate = '2026-10-30T00:00:00.000Z'
    expect(validateBackup(backup)).toBe(backup)
    await importBackup(backup)
    expect((await db.tasks.get(backup.tables.tasks[0].id))?.dueDate).toBeInstanceOf(Date)
    expect((await db.metadata.get('initialized'))?.value).toBe(true)
    const block = await db.scheduledWorkBlocks.get(backup.tables.scheduledWorkBlocks![0].id)
    expect(block?.scheduledStart).toBeInstanceOf(Date)
    expect(block?.scheduledEnd).toBeInstanceOf(Date)
  })
  it('restores portable preferences while leaving language, reminder dismissals, and recovery drafts untouched', async () => {
    const backup = await fixture()
    backup.preferences = {
      appPreferences: {
        ...DEFAULT_APP_PREFERENCES,
        defaultRoute: 'calendar',
        calendarView: 'month',
        dashboard: { order: ['sessions', 'planning', 'insights'], visible: ['sessions', 'planning'] },
      },
      plannerReminderLeadMinutes: 15,
    }
    const storage = memoryStorage({
      [APP_PREFERENCES_KEY]: JSON.stringify(DEFAULT_APP_PREFERENCES),
      [PLANNER_REMINDER_LEAD_KEY]: '5',
      altera_language: 'en',
      'altera:planner-dismissed-reminders': '["block:old"]',
      'altera:note-editor-draft:note-1': '{"content":"keep me"}',
    })

    expect(validateBackup(backup)).toBe(backup)
    const result = await importBackup(backup, { settingsStorage: storage })

    expect(result.preferencesRestored).toBe(true)
    expect(JSON.parse(storage.getItem(APP_PREFERENCES_KEY)!).defaultRoute).toBe('calendar')
    expect(storage.getItem(PLANNER_REMINDER_LEAD_KEY)).toBe('15')
    expect(storage.getItem('altera_language')).toBe('en')
    expect(storage.getItem('altera:planner-dismissed-reminders')).toBe('["block:old"]')
    expect(storage.getItem('altera:note-editor-draft:note-1')).toBe('{"content":"keep me"}')
  })
  it('completes an isolated clear-and-restore round trip across every backed-up table and portable setting', async () => {
    const backup = await fixture()
    backup.tables.attachments.push({
      id: 'roundtrip-attachment',
      filename: 'roundtrip.txt',
      mimeType: 'text/plain',
      size: 4,
      createdAt: new Date().toISOString(),
      blobDataUrl: 'data:text/plain;base64,dGVzdA==',
    })
    backup.preferences = {
      appPreferences: {
        ...DEFAULT_APP_PREFERENCES,
        defaultRoute: 'calendar',
        calendarView: 'month',
      },
      plannerReminderLeadMinutes: 15,
    }
    const storage = memoryStorage({
      [APP_PREFERENCES_KEY]: JSON.stringify(DEFAULT_APP_PREFERENCES),
      [PLANNER_REMINDER_LEAD_KEY]: '5',
      altera_language: 'en',
      'altera:planner-dismissed-reminders': '["old-reminder"]',
      'altera:note-editor-draft:note-1': '{"content":"keep this draft"}',
    })
    const expectedTables = backup.tables as Record<string, Array<Record<string, unknown>>>

    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    for (const table of db.tables.filter(table => table.name !== 'metadata')) {
      expect(await table.count(), `${table.name} is empty before restore`).toBe(0)
    }

    const result = await importBackup(backup, { settingsStorage: storage })

    expect(result.preferencesRestored).toBe(true)
    for (const [tableName, expectedRows] of Object.entries(expectedTables)) {
      const actualRows = await db.table(tableName).toArray() as Array<Record<string, unknown>>
      if (tableName === 'attachments') {
        expect(actualRows).toHaveLength(expectedRows.length)
        const attachment = actualRows.find(row => row.id === 'roundtrip-attachment')
        expect(attachment).toBeDefined()
        if (!attachment) throw new Error('Expected the round-trip attachment to be restored')
        expect(attachment.blob).toBeInstanceOf(Blob)
        expect(await (attachment.blob as Blob).text()).toBe('test')
        expect(attachment).toMatchObject({ filename: 'roundtrip.txt', mimeType: 'text/plain', size: 4 })
        continue
      }
      const normalizeRows = (rows: Array<Record<string, unknown>>) => JSON.parse(JSON.stringify(rows))
        .sort((left: { id: string }, right: { id: string }) => left.id.localeCompare(right.id))
      expect(normalizeRows(actualRows), `${tableName} matches its export`).toEqual(
        normalizeRows(expectedRows as Array<Record<string, unknown>>)
      )
    }
    expect((await db.metadata.get('initialized'))?.value).toBe(true)
    expect(JSON.parse(storage.getItem(APP_PREFERENCES_KEY)!).defaultRoute).toBe('calendar')
    expect(storage.getItem(PLANNER_REMINDER_LEAD_KEY)).toBe('15')
    expect(storage.getItem('altera_language')).toBe('en')
    expect(storage.getItem('altera:planner-dismissed-reminders')).toBe('["old-reminder"]')
    expect(storage.getItem('altera:note-editor-draft:note-1')).toBe('{"content":"keep this draft"}')
  })
  it('rejects invalid portable settings and keeps legacy v3 backups valid', async () => {
    const backup = await fixture()
    expect(() => validateBackup(backup)).not.toThrow()
    backup.preferences = {
      appPreferences: { ...DEFAULT_APP_PREFERENCES, defaultRoute: 'unknown' },
      plannerReminderLeadMinutes: 15,
    }
    expect(() => validateBackup(backup)).toThrow('Invalid backup preferences')
  })
  it('rolls back only the portable settings keys if a browser write fails', () => {
    const storage = memoryStorage({
      [APP_PREFERENCES_KEY]: JSON.stringify(DEFAULT_APP_PREFERENCES),
      [PLANNER_REMINDER_LEAD_KEY]: '5',
      'altera:note-editor-draft:note-1': 'draft',
    })
    const failingStorage = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === PLANNER_REMINDER_LEAD_KEY && value === '15') throw new Error('quota')
        storage.setItem(key, value)
      },
    }
    const settings = {
      appPreferences: { ...DEFAULT_APP_PREFERENCES, defaultRoute: 'calendar' as const },
      plannerReminderLeadMinutes: 15 as const,
    }

    expect(restoreBackupPreferences(settings, failingStorage)).toBe(false)
    expect(storage.getItem(APP_PREFERENCES_KEY)).toBe(JSON.stringify(DEFAULT_APP_PREFERENCES))
    expect(storage.getItem(PLANNER_REMINDER_LEAD_KEY)).toBe('5')
    expect(storage.getItem('altera:note-editor-draft:note-1')).toBe('draft')
  })
  it('does not mutate any storage key when the existing portable settings cannot be read', () => {
    const storage = memoryStorage({
      [APP_PREFERENCES_KEY]: JSON.stringify(DEFAULT_APP_PREFERENCES),
      [PLANNER_REMINDER_LEAD_KEY]: '5',
      'altera:note-editor-draft:note-1': 'draft',
    })
    const failingStorage = {
      ...storage,
      getItem: () => { throw new Error('storage unavailable') },
      removeItem: (key: string) => storage.removeItem(key),
      setItem: (key: string, value: string) => storage.setItem(key, value),
    }

    expect(restoreBackupPreferences({
      appPreferences: { ...DEFAULT_APP_PREFERENCES, defaultRoute: 'calendar' },
      plannerReminderLeadMinutes: 15,
    }, failingStorage)).toBe(false)
    expect(storage.getItem(APP_PREFERENCES_KEY)).toBe(JSON.stringify(DEFAULT_APP_PREFERENCES))
    expect(storage.getItem(PLANNER_REMINDER_LEAD_KEY)).toBe('5')
    expect(storage.getItem('altera:note-editor-draft:note-1')).toBe('draft')
  })
  it('preserves a session-to-block association and rejects dangling links before import', async () => {
    const backup = await fixture()
    const session = backup.tables.sessions[0]
    const blockId = backup.tables.scheduledWorkBlocks![0].id
    session.scheduledBlockId = blockId
    expect(validateBackup(backup)).toBe(backup)
    await importBackup(backup)
    expect((await db.sessions.get(session.id))?.scheduledBlockId).toBe(blockId)

    session.scheduledBlockId = 'missing-block'
    await expect(importBackup(backup)).rejects.toThrow('Session references a missing work block')
  })
  it('imports legacy v3 backups without a calendar table and clears the current calendar', async () => {
    const backup = await fixture()
    const existingId = backup.tables.scheduledWorkBlocks![0].id
    delete backup.tables.scheduledWorkBlocks
    await importBackup(backup)
    expect(await db.scheduledWorkBlocks.get(existingId)).toBeUndefined()
    expect(await db.scheduledWorkBlocks.count()).toBe(0)
  })
  it('round-trips workflow templates and accepts older v3 backups without the optional table', async () => {
    const backup = await fixture()
    const template = await createWorkflowTemplate({
      kind: 'task', name: 'Review template', title: 'Review draft', priority: 'high',
    })
    backup.tables.workflowTemplates = JSON.parse(JSON.stringify(await db.workflowTemplates.toArray()))
    expect(validateBackup(backup)).toBe(backup)
    await importBackup(backup)
    const imported = await db.workflowTemplates.get(template.id)
    expect(imported?.kind).toBe('task')
    expect(imported?.createdAt).toBeInstanceOf(Date)
    expect(imported?.updatedAt).toBeInstanceOf(Date)

    delete backup.tables.workflowTemplates
    await importBackup(backup)
    expect(await db.workflowTemplates.count()).toBe(0)
  })
  it('rejects invalid workflow template data before replacing records', async () => {
    const backup = await fixture()
    backup.tables.workflowTemplates = [{
      id: 'bad-template', kind: 'project', name: 'bad', projectName: '', description: '', priority: 'medium',
      color: '#8a9e6b', icon: '📁', nextAction: '', tasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }]
    const count = await db.projects.count()
    await expect(importBackup(backup)).rejects.toThrow('Invalid project template name')
    expect(await db.projects.count()).toBe(count)
  })
  it.each(['duration', 'missing-project'])('rejects invalid calendar blocks (%s) before replacing user data', async kind => {
    const backup = await fixture()
    const existingProjectCount = await db.projects.count()
    const block = backup.tables.scheduledWorkBlocks![0]
    if (kind === 'duration') block.scheduledEnd = block.scheduledStart
    else block.projectId = 'missing-project'
    await expect(importBackup(backup)).rejects.toThrow()
    expect(await db.projects.count()).toBe(existingProjectCount)
  })
  it('rejects calendar timestamps with impossible calendar dates before replacing data', async () => {
    const backup = await fixture()
    const existingProjectCount = await db.projects.count()
    const block = backup.tables.scheduledWorkBlocks![0]
    block.scheduledStart = '2026-02-30T09:00:00.000Z'
    block.scheduledEnd = '2026-02-30T10:00:00.000Z'

    await expect(importBackup(backup)).rejects.toThrow('scheduledWorkBlocks: invalid scheduledStart')
    expect(await db.projects.count()).toBe(existingProjectCount)
  })
  it.each(['enum', 'duplicate', 'date', 'revision', 'reference', 'session', 'tag'])('rejects malformed %s before clearing existing data', async kind => {
    const backup = await fixture()
    const count = await db.projects.count()
    if (kind === 'enum') backup.tables.tasks[0].status = 'invalid'
    if (kind === 'duplicate') backup.tables.projects.push(backup.tables.projects[0])
    if (kind === 'date') backup.tables.notes[0].updatedAt = 'not-a-date'
    if (kind === 'revision') backup.tables.notes[0].revision = -1
    if (kind === 'reference') backup.tables.tasks[0].projectId = 'missing'
    if (kind === 'session') backup.tables.sessions[0].accumulatedDurationMs = -1
    if (kind === 'tag') backup.tables.tagAssignments[0].entityId = 'missing'
    await expect(importBackup(backup)).rejects.toThrow()
    expect(await db.projects.count()).toBe(count)
  })
  it('checks attachment MIME and actual decoded length', async () => {
    const backup = await fixture()
    backup.tables.attachments = [{ id: 'file', filename: 'a.txt', mimeType: 'text/plain', size: 3, createdAt: new Date().toISOString(), blobDataUrl: 'data:text/plain;base64,YWJj' }]
    await importBackup(backup)
    expect((await db.attachments.get('file'))?.blob.size).toBe(3)
    backup.tables.attachments[0].size = 4
    expect(() => validateBackup(backup)).toThrow('length')
    backup.tables.attachments[0].size = 3
    backup.tables.attachments[0].mimeType = 'image/png'
    expect(() => validateBackup(backup)).toThrow('MIME')
  })

  it('rejects unsafe resource URLs and malformed note documents before import', async () => {
    const backup = await fixture()
    const link = backup.tables.resources.find((resource: { type: string; url?: string }) => resource.type === 'link')!
    link.url = 'javascript:window.__alteraAudit = true'
    expect(() => validateBackup(backup)).toThrow('HTTP or HTTPS')

    link.url = 'https://example.com'
    backup.tables.notes[0].contentJSON = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: {} }] })
    expect(() => validateBackup(backup)).toThrow('note document structure')
  })

  it('validates thousands of task references using the prebuilt task index', async () => {
    const backup = await fixture()
    const baseTask = backup.tables.tasks[0]
    const baseBlock = backup.tables.scheduledWorkBlocks![0]
    const now = new Date().toISOString()
    const projectId = baseTask.projectId
    const taskCount = 5_000
    const blockCount = 2_000

    backup.tables.tasks.push(...Array.from({ length: taskCount }, (_, index) => ({
      ...baseTask,
      id: `large-task-${index}`,
      projectId,
      createdAt: now,
      updatedAt: now,
    })))
    backup.tables.scheduledWorkBlocks!.push(...Array.from({ length: blockCount }, (_, index) => ({
      ...baseBlock,
      id: `large-block-${index}`,
      taskId: `large-task-${index}`,
      projectId,
      createdAt: now,
      updatedAt: now,
    })))

    expect(() => validateBackup(backup)).not.toThrow()
  })

  it('accepts special entity identifiers without treating them as object properties', async () => {
    const backup = await fixture()
    const tag = backup.tables.tags[0]
    const oldTagId = tag.id
    tag.id = '__proto__'
    for (const assignment of backup.tables.tagAssignments) {
      if (assignment.tagId === oldTagId) assignment.tagId = '__proto__'
    }
    expect(() => validateBackup(backup)).not.toThrow()
  })

  it('rejects entity links with missing endpoints', async () => {
    const backup = await fixture()
    backup.tables.entityLinks[0].targetId = 'missing-entity'

    expect(() => validateBackup(backup)).toThrow('Dangling entity link')
  })

  it('rejects duplicate directed entity links', async () => {
    const backup = await fixture()
    backup.tables.entityLinks.push({
      ...backup.tables.entityLinks[0],
      id: 'duplicate-directed-link',
    })

    expect(() => validateBackup(backup)).toThrow('entityLinks: duplicate value')
  })

  it('treats link identity as type-aware when IDs overlap across tables', async () => {
    const backup = await fixture()
    const sourceNote = backup.tables.notes[0]
    const now = new Date().toISOString()
    const sourceId = 'typed-link-shared-source'
    const targetId = 'typed-link-shared-target'

    backup.tables.notes.push({ ...sourceNote, id: sourceId, createdAt: now, updatedAt: now })
    backup.tables.resources.push({
      ...backup.tables.resources[0],
      id: sourceId,
      createdAt: now,
      updatedAt: now,
    })
    backup.tables.projects.push({ ...backup.tables.projects[0], id: targetId, identifier: 'ALT-TYPED-LINK', createdAt: now, updatedAt: now })
    backup.tables.notes.push({
      ...sourceNote,
      id: targetId,
      createdAt: now,
      updatedAt: now,
    })
    backup.tables.entityLinks.push(
      {
        id: 'typed-link-note-project',
        sourceType: 'note',
        sourceId,
        targetType: 'project',
        targetId,
        createdAt: now,
      },
      {
        id: 'typed-link-resource-note',
        sourceType: 'resource',
        sourceId,
        targetType: 'note',
        targetId,
        createdAt: now,
      }
    )

    expect(() => validateBackup(backup)).not.toThrow()
  })
})
