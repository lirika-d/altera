import { db } from './db'

let pending: Promise<void> | undefined

/** Serialize StrictMode mounts; the marker lives in the same DB as user data. */
export function ensureDatabaseSeeded(): Promise<void> {
  if (!pending) {
    pending = initialize().finally(() => { pending = undefined })
  }
  return pending
}

async function initialize(): Promise<void> {
  // Keep the check and seed in one transaction across tabs too. Load code first:
  // a dynamic import inside an IDB transaction could let it auto-commit.
  if ((await db.metadata.get('initialized'))?.value) return
  const { seedDatabase } = await import('./seed')
  await db.transaction('rw', db.tables, async () => {
    if ((await db.metadata.get('initialized'))?.value) return
    const counts = await Promise.all(db.tables.filter(t => t.name !== 'metadata').map(t => t.count()))
    if (counts.some(Boolean)) {
      await db.metadata.put({ key: 'initialized', value: true })
    } else {
      await seedDatabase()
    }
  })
}
