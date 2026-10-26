import { describe, expect, it, vi } from 'vitest'
import { SerializedSaveCoordinator } from './saveCoordinator'
import type { NoteDraftSnapshot } from './draftRecovery'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function snapshot(content: string, title = 'Title'): NoteDraftSnapshot {
  return { contentJSON: content, plainText: content, title }
}

describe('SerializedSaveCoordinator', () => {
  it('coalesces rapid consecutive edits before a save starts', async () => {
    const save = vi.fn(async (_value: NoteDraftSnapshot, revision: number) => revision + 1)
    const coordinator = new SerializedSaveCoordinator(4, { save })

    coordinator.stage(snapshot('first'))
    coordinator.stage(snapshot('second'))
    coordinator.stage(snapshot('latest'))
    await coordinator.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(snapshot('latest'), 4)
    expect(coordinator.revision).toBe(5)
  })

  it('serializes writes and preserves only the latest edit made in flight', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    const started: Array<{ value: NoteDraftSnapshot; revision: number }> = []
    const save = vi.fn((value: NoteDraftSnapshot, revision: number) => {
      started.push({ value, revision })
      return started.length === 1 ? first.promise : second.promise
    })
    const coordinator = new SerializedSaveCoordinator(1, { save })

    coordinator.stage(snapshot('first'))
    const firstFlush = coordinator.flush()
    coordinator.stage(snapshot('middle'))
    coordinator.stage(snapshot('latest'))
    const secondFlush = coordinator.flush()

    expect(started).toEqual([{ value: snapshot('first'), revision: 1 }])
    first.resolve(2)
    await vi.waitFor(() => expect(started).toHaveLength(2))
    expect(started[1]).toEqual({ value: snapshot('latest'), revision: 2 })
    second.resolve(3)
    await Promise.all([firstFlush, secondFlush])

    expect(save).toHaveBeenCalledTimes(2)
    expect(coordinator.revision).toBe(3)
  })

  it('does not report a failed write as saved and keeps its snapshot retryable', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(8)
    const statuses: string[] = []
    const coordinator = new SerializedSaveCoordinator(7, {
      save,
      onStatusChange: (status) => statuses.push(status),
    })
    coordinator.stage(snapshot('kept'))

    await expect(coordinator.flush()).rejects.toThrow('disk unavailable')
    expect(coordinator.pendingSnapshot).toEqual(snapshot('kept'))
    expect(statuses.at(-1)).toBe('error')

    await coordinator.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(coordinator.revision).toBe(8)
    expect(statuses.at(-1)).toBe('saved')
  })

  it('keeps stale revisions detectable and does not retry a conflict automatically', async () => {
    const conflict = Object.assign(new Error('stale revision'), { code: 'STALE_WRITE' })
    const save = vi.fn().mockRejectedValue(conflict)
    const statuses: string[] = []
    const coordinator = new SerializedSaveCoordinator(3, {
      save,
      onStatusChange: (status) => statuses.push(status),
    })
    coordinator.stage(snapshot('local'))

    await expect(coordinator.flush()).rejects.toBe(conflict)
    expect(coordinator.revision).toBe(3)
    expect(coordinator.pendingSnapshot).toEqual(snapshot('local'))
    expect(statuses.at(-1)).toBe('conflict')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('returns the acknowledged database revision rather than incrementing a local counter', async () => {
    const save = vi.fn().mockResolvedValue(42)
    const coordinator = new SerializedSaveCoordinator(9, { save })
    coordinator.stage(snapshot('title edit', 'New title'))

    await coordinator.flush()

    expect(coordinator.revision).toBe(42)
    expect(save).toHaveBeenCalledWith(snapshot('title edit', 'New title'), 9)
  })

  it('keeps note switching isolated between editor instances with pending saves', async () => {
    const first = deferred<number>()
    const noteA = new SerializedSaveCoordinator(1, { save: () => first.promise })
    const noteBSave = vi.fn(async (_value: NoteDraftSnapshot, revision: number) => revision + 1)
    const noteB = new SerializedSaveCoordinator(8, { save: noteBSave })

    noteA.stage(snapshot('note A pending'))
    const pendingA = noteA.flush()
    noteB.stage(snapshot('note B'))
    await noteB.flush()

    expect(noteBSave).toHaveBeenCalledWith(snapshot('note B'), 8)
    expect(noteB.revision).toBe(9)
    first.resolve(2)
    await pendingA
    expect(noteA.revision).toBe(2)
  })
})
