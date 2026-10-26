import type { AutosaveStatus } from './editorTypes'

export interface SaveCoordinatorCallbacks<T> {
  save: (snapshot: T, expectedRevision: number) => Promise<number>
  onStatusChange?: (status: AutosaveStatus, error?: unknown) => void
  onSaved?: (snapshot: T, revision: number, pendingSnapshot?: T) => void
}

interface PendingSnapshot<T> {
  sequence: number
  value: T
}

function isRevisionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; name?: string }
  return candidate.code === 'STALE_WRITE' || candidate.name === 'StaleWriteError'
}

/** Serializes persistence and coalesces snapshots staged while a write is active. */
export class SerializedSaveCoordinator<T> {
  private revisionValue: number
  private pending: PendingSnapshot<T> | null = null
  private activeSave: Promise<void> | null = null
  private sequence = 0
  private readonly callbacks: SaveCoordinatorCallbacks<T>

  constructor(initialRevision: number, callbacks: SaveCoordinatorCallbacks<T>) {
    this.revisionValue = initialRevision
    this.callbacks = callbacks
  }

  get revision(): number {
    return this.revisionValue
  }

  get pendingSnapshot(): T | undefined {
    return this.pending?.value
  }

  get isSaving(): boolean {
    return this.activeSave !== null
  }

  adoptRevision(revision: number): void {
    if (revision >= this.revisionValue) this.revisionValue = revision
  }

  stage(snapshot: T): number {
    this.sequence += 1
    this.pending = { sequence: this.sequence, value: snapshot }
    if (!this.activeSave) this.callbacks.onStatusChange?.('unsaved')
    return this.sequence
  }

  flush(): Promise<void> {
    if (this.activeSave) return this.activeSave
    if (!this.pending) return Promise.resolve()

    this.callbacks.onStatusChange?.('saving')
    const savePromise = this.drain()
    this.activeSave = savePromise
    return savePromise
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending) {
        const current = this.pending
        this.pending = null

        try {
          const nextRevision = await this.callbacks.save(current.value, this.revisionValue)
          this.revisionValue = Math.max(this.revisionValue, nextRevision)
          const pending = this.pending as PendingSnapshot<T> | null
          this.callbacks.onSaved?.(current.value, this.revisionValue, pending?.value)
        } catch (error) {
          // Keep the failed snapshot unless a newer edit has already replaced it.
          const newerPending = this.pending as PendingSnapshot<T> | null
          if (!newerPending || newerPending.sequence < current.sequence) {
            this.pending = current
          }
          this.callbacks.onStatusChange?.(isRevisionConflict(error) ? 'conflict' : 'error', error)
          throw error
        }

        this.callbacks.onStatusChange?.(this.pending ? 'saving' : 'saved')
      }
    } finally {
      this.activeSave = null
    }
  }
}
