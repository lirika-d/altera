export interface NoteDraftRecovery {
  noteId: string
  title: string
  contentJSON: string
  plainText: string
  baseRevision: number
  savedAt: string
}

export interface NoteDraftSnapshot {
  title: string
  contentJSON: string
  plainText: string
}

export interface NoteDraftWriteResult {
  draft: NoteDraftRecovery
  storage: 'local' | 'session'
}

const DRAFT_KEY_PREFIX = 'altera:note-editor-draft:'

function storageKey(noteId: string): string {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(noteId)}`
}

function isDraftRecovery(value: unknown, noteId: string): value is NoteDraftRecovery {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<NoteDraftRecovery>
  return draft.noteId === noteId &&
    typeof draft.title === 'string' &&
    typeof draft.contentJSON === 'string' &&
    typeof draft.plainText === 'string' &&
    typeof draft.baseRevision === 'number' &&
    typeof draft.savedAt === 'string'
}

export function readNoteDraft(noteId: string, storage?: Storage): NoteDraftRecovery | null {
  const candidates = storage ? [{ storage, mode: 'local' as const }] : getStorageCandidates()
  const drafts = candidates.flatMap(({ storage: candidate }) => {
    try {
      const raw = candidate.getItem(storageKey(noteId))
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return isDraftRecovery(parsed, noteId) ? [parsed] : []
    } catch {
      return []
    }
  })

  // If sessionStorage was used after a localStorage quota/security failure,
  // prefer the newest copy over an older localStorage record.
  return drafts.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] ?? null
}

export function writeNoteDraft(
  noteId: string,
  snapshot: NoteDraftSnapshot,
  baseRevision: number,
  storage?: Storage
): NoteDraftWriteResult | null {
  const draft: NoteDraftRecovery = {
    noteId,
    ...snapshot,
    baseRevision,
    savedAt: new Date().toISOString(),
  }
  const serialized = JSON.stringify(draft)
  const candidates = storage
    ? [{ storage, mode: 'local' as const }]
    : getStorageCandidates()

  for (const candidate of candidates) {
    try {
      candidate.storage.setItem(storageKey(noteId), serialized)
      return { draft, storage: candidate.mode }
    } catch {
      // Try the session-scoped fallback if persistent local storage is blocked/full.
    }
  }

  return null
}

export function removeNoteDraft(noteId: string, storage?: Storage): void {
  const candidates = storage ? [{ storage }] : getStorageCandidates()
  for (const candidate of candidates) {
    try {
      candidate.storage.removeItem(storageKey(noteId))
    } catch {
      // Local recovery is best-effort when browser storage is unavailable.
    }
  }
}

/** Clear editor recovery snapshots after a confirmed workspace reset or wipe. */
export function clearNoteDrafts(storage?: Storage): void {
  const candidates = storage ? [{ storage }] : getStorageCandidates()
  for (const candidate of candidates) {
    try {
      const keys: string[] = []
      for (let index = 0; index < candidate.storage.length; index += 1) {
        const key = candidate.storage.key(index)
        if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key)
      }
      for (const key of keys) candidate.storage.removeItem(key)
    } catch {
      // Clearing recovery snapshots is best-effort when browser storage is blocked.
    }
  }
}

function getStorageCandidates(): Array<{ storage: Storage; mode: 'local' | 'session' }> {
  const candidates: Array<{ storage: Storage; mode: 'local' | 'session' }> = []
  try {
    if (typeof localStorage !== 'undefined') candidates.push({ storage: localStorage, mode: 'local' })
  } catch {
    // Accessing the storage getter can itself fail in restricted browser contexts.
  }
  try {
    if (typeof sessionStorage !== 'undefined') candidates.push({ storage: sessionStorage, mode: 'session' })
  } catch {
    // Keep the fallback best-effort; callers surface a warning if neither store works.
  }
  return candidates
}
