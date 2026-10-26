import type { UpdateNoteInput } from '@/types'

interface PendingUpdate {
  sequence: number
  updates: UpdateNoteInput
}

interface Waiter {
  sequence: number
  resolve: (revision: number) => void
  reject: (error: unknown) => void
}

/** Serializes all writes issued by one NoteDetail instance and rebases its own metadata updates. */
export class NoteUpdateCoordinator {
  private revisionValue: number
  private pending: PendingUpdate | null = null
  private activeWrite: Promise<void> | null = null
  private sequence = 0
  private readonly waiters: Waiter[] = []
  private revisionLocked = false
  private cleanWhenIdle = false
  private readonly persist: (updates: UpdateNoteInput, expectedRevision: number) => Promise<number>

  constructor(
    initialRevision: number,
    persist: (updates: UpdateNoteInput, expectedRevision: number) => Promise<number>
  ) {
    this.revisionValue = initialRevision
    this.persist = persist
  }

  get revision(): number {
    return this.revisionValue
  }

  get isRevisionLocked(): boolean {
    return this.revisionLocked || this.pending !== null || this.activeWrite !== null
  }

  markDirty(): void {
    this.revisionLocked = true
    this.cleanWhenIdle = false
  }

  markClean(): void {
    if (this.activeWrite || this.pending) {
      this.cleanWhenIdle = true
      return
    }
    this.revisionLocked = false
    this.cleanWhenIdle = false
  }

  /** Adopt a live-query revision only before this instance has authored a draft or write. */
  adoptRevision(revision: number): number {
    if (!this.revisionLocked && !this.pending && !this.activeWrite && revision >= this.revisionValue) {
      this.revisionValue = revision
    }
    return this.revisionValue
  }

  update(updates: UpdateNoteInput): Promise<number> {
    this.sequence += 1
    const sequence = this.sequence
    this.pending = {
      sequence,
      updates: { ...(this.pending?.updates ?? {}), ...updates },
    }

    const result = new Promise<number>((resolve, reject) => {
      this.waiters.push({ sequence, resolve, reject })
    })
    if (!this.activeWrite) void this.drain().catch(() => undefined)
    return result
  }

  flush(): Promise<void> {
    if (this.activeWrite) return this.activeWrite
    if (!this.pending) return Promise.resolve()
    return this.drain()
  }

  private async drain(): Promise<void> {
    const writePromise = this.runWrites()
    this.activeWrite = writePromise
    try {
      await writePromise
    } finally {
      this.activeWrite = null
      if (this.cleanWhenIdle && !this.pending) {
        this.revisionLocked = false
        this.cleanWhenIdle = false
      }
    }
  }

  private async runWrites(): Promise<void> {
    while (this.pending) {
      const current = this.pending
      this.pending = null
      try {
        this.revisionValue = await this.persist(current.updates, this.revisionValue)
        this.resolveWaiters(current.sequence, this.revisionValue)
      } catch (error) {
        const newerPending = this.pending as PendingUpdate | null
        if (newerPending) {
          this.pending = {
            sequence: newerPending.sequence,
            updates: { ...current.updates, ...newerPending.updates },
          }
        } else {
          this.pending = current
        }
        this.rejectWaiters(Number.POSITIVE_INFINITY, error)
        throw error
      }
    }
  }

  private resolveWaiters(throughSequence: number, revision: number): void {
    for (let index = this.waiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.waiters[index]
      if (waiter.sequence <= throughSequence) {
        this.waiters.splice(index, 1)
        waiter.resolve(revision)
      }
    }
  }

  private rejectWaiters(throughSequence: number, error: unknown): void {
    for (let index = this.waiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.waiters[index]
      if (waiter.sequence <= throughSequence) {
        this.waiters.splice(index, 1)
        waiter.reject(error)
      }
    }
  }
}
