import { db } from './db'
import { validateBackup } from './backupValidation'
import { restoreBackupPreferences } from './backupPreferences'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface BackupImportResult {
  /** null means the backup predates settings export and left local preferences alone. */
  preferencesRestored: boolean | null
}

const dateFields = new Set(['createdAt', 'updatedAt', 'startedAt', 'endedAt', 'lastResumedAt', 'lastVisitedAt', 'completedAt', 'dueDate', 'deletedAt', 'scheduledStart', 'scheduledEnd'])

/** No mutation occurs until every row and relationship has passed validation. */
export async function importBackup(
  input: unknown,
  options: { settingsStorage?: StorageLike | null } = {},
): Promise<BackupImportResult> {
  const backup = validateBackup(input)
  const tables = {
    ...backup.tables,
    scheduledWorkBlocks: backup.tables.scheduledWorkBlocks ?? [],
    workflowTemplates: backup.tables.workflowTemplates ?? [],
  }
  const prepared = Object.entries(tables).map(([name, rows]) => ({
    name,
    rows: rows.map(row => {
      const copy: Record<string, unknown> = { ...row }
      for (const key of dateFields) {
        if (typeof copy[key] === 'string') copy[key] = new Date(copy[key])
      }
      if (name === 'attachments') {
        const data = atob((copy.blobDataUrl as string).split(',')[1])
        copy.blob = new Blob([Uint8Array.from(data, c => c.charCodeAt(0))], { type: copy.mimeType as string })
        delete copy.blobDataUrl
      }
      return copy
    }),
  }))
  await db.transaction('rw', db.tables, async () => {
    for (const { name, rows } of prepared) {
      await db.table(name).clear()
      await db.table(name).bulkAdd(rows)
    }
    await db.metadata.put({ key: 'initialized', value: true })
  })

  const preferencesRestored = backup.preferences
    ? restoreBackupPreferences(backup.preferences, options.settingsStorage)
    : null
  return { preferencesRestored }
}
