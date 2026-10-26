import { describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { AlteraDB } from '@/db/db'
import { createNote, getNoteById, updateNote } from '@/db/knowledge'
import { NoteUpdateCoordinator } from './noteUpdateCoordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('NoteUpdateCoordinator', () => {
  it('serializes content and metadata writes with returned revisions', async () => {
    const first = deferred<number>()
    const writes: Array<{ updates: object; revision: number }> = []
    const persist = vi.fn((updates: object, revision: number) => {
      writes.push({ updates, revision })
      return writes.length === 1 ? first.promise : Promise.resolve(revision + 1)
    })
    const writer = new NoteUpdateCoordinator(4, persist)

    const titleWrite = writer.update({ title: 'Renamed' })
    const contentWrite = writer.update({ contentJSON: '{"text":"latest"}', plainText: 'latest' })
    expect(writes).toEqual([{ updates: { title: 'Renamed' }, revision: 4 }])

    first.resolve(5)
    await expect(titleWrite).resolves.toBe(5)
    await expect(contentWrite).resolves.toBe(6)
    expect(writes).toEqual([
      { updates: { title: 'Renamed' }, revision: 4 },
      { updates: { contentJSON: '{"text":"latest"}', plainText: 'latest' }, revision: 5 },
    ])
    expect(writer.revision).toBe(6)
  })

  it('coalesces updates staged during a slow write without losing changed fields', async () => {
    const first = deferred<number>()
    const writes: object[] = []
    const persist = vi.fn((updates: object, revision: number) => {
      writes.push(updates)
      return writes.length === 1 ? first.promise : Promise.resolve(revision + 1)
    })
    const writer = new NoteUpdateCoordinator(1, persist)

    const firstUpdate = writer.update({ projectId: 'project-a' })
    const titleUpdate = writer.update({ title: 'Latest title' })
    const favoriteUpdate = writer.update({ isFavorite: true })
    first.resolve(2)

    await expect(firstUpdate).resolves.toBe(2)
    await expect(titleUpdate).resolves.toBe(3)
    await expect(favoriteUpdate).resolves.toBe(3)
    expect(writes).toEqual([
      { projectId: 'project-a' },
      { title: 'Latest title', isFavorite: true },
    ])
  })

  it('retains failed updates, leaves the revision unchanged, and requires an explicit retry', async () => {
    const conflict = Object.assign(new Error('Stale write'), { code: 'STALE_WRITE' })
    const persist = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(12)
    const writer = new NoteUpdateCoordinator(11, persist)

    await expect(writer.update({ contentJSON: 'local', plainText: 'local' })).rejects.toBe(conflict)
    expect(writer.revision).toBe(11)
    await writer.flush()
    expect(persist).toHaveBeenNthCalledWith(1, { contentJSON: 'local', plainText: 'local' }, 11)
    expect(persist).toHaveBeenNthCalledWith(2, { contentJSON: 'local', plainText: 'local' }, 11)
    expect(writer.revision).toBe(12)
  })

  it('rejects every waiter when a write fails and retains coalesced newer fields for retry', async () => {
    const first = deferred<number>()
    const persist = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(7)
    const writer = new NoteUpdateCoordinator(5, persist)
    const failedWrite = writer.update({ title: 'Title' })
    const queuedWrite = writer.update({ plainText: 'Latest body' })
    const error = new Error('write failed')
    first.reject(error)

    await expect(failedWrite).rejects.toBe(error)
    await expect(queuedWrite).rejects.toBe(error)
    await writer.flush()
    expect(persist).toHaveBeenLastCalledWith({ title: 'Title', plainText: 'Latest body' }, 5)
    expect(writer.revision).toBe(7)
  })

  it('does not adopt a live-query revision after this instance has a local draft', () => {
    const writer = new NoteUpdateCoordinator(2, async (_updates, revision) => revision + 1)
    expect(writer.adoptRevision(4)).toBe(4)
    writer.markDirty()
    expect(writer.adoptRevision(5)).toBe(4)
  })

  it('serializes real Dexie title and content writes without a false revision conflict', async () => {
    const testDb = new AlteraDB(`NoteWriter-${crypto.randomUUID()}`)
    try {
      const note = await createNote({ title: 'Initial title', plainText: 'Initial content' }, testDb)
      const writer = new NoteUpdateCoordinator(note.revision, async (updates, expectedRevision) => {
        const updated = await updateNote(note.id, { ...updates, expectedRevision }, testDb)
        return updated.revision
      })

      const titleWrite = writer.update({ title: 'Updated title' })
      const contentWrite = writer.update({ contentJSON: '{"text":"latest"}', plainText: 'latest' })
      await Promise.all([titleWrite, contentWrite])

      const saved = await getNoteById(note.id, testDb)
      expect(saved).toMatchObject({
        title: 'Updated title',
        plainText: 'latest',
        revision: 3,
      })
    } finally {
      await testDb.delete()
    }
  })

  it('keeps a concurrent external edit and reports a real stale revision', async () => {
    const testDb = new AlteraDB(`NoteConflict-${crypto.randomUUID()}`)
    try {
      const note = await createNote({ title: 'Before external edit', plainText: 'server copy' }, testDb)
      const writer = new NoteUpdateCoordinator(note.revision, async (updates, expectedRevision) => {
        const updated = await updateNote(note.id, { ...updates, expectedRevision }, testDb)
        return updated.revision
      })
      writer.markDirty()
      await updateNote(note.id, { title: 'Changed in another tab', expectedRevision: note.revision }, testDb)

      await expect(writer.update({ plainText: 'local draft', contentJSON: '{"text":"local"}' }))
        .rejects.toMatchObject({ code: 'STALE_WRITE' })
      expect(await getNoteById(note.id, testDb)).toMatchObject({
        title: 'Changed in another tab',
        plainText: 'server copy',
        revision: note.revision + 1,
      })
    } finally {
      await testDb.delete()
    }
  })
})
