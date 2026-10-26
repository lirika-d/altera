import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { clearNoteDrafts, readNoteDraft, removeNoteDraft, writeNoteDraft } from './draftRecovery'

function createStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear() { values.clear() },
    getItem(key: string) { return values.get(key) ?? null },
    key(index: number) { return [...values.keys()][index] ?? null },
    removeItem(key: string) { values.delete(key) },
    setItem(key: string, value: string) { values.set(key, value) },
  }
}

describe('note draft recovery', () => {
  it('stores and recovers a pending title and document at its base revision', () => {
    const storage = createStorage()
    writeNoteDraft('note/1', {
      title: 'Draft title',
      contentJSON: '{"text":"unsaved"}',
      plainText: 'unsaved',
    }, 6, storage)

    expect(readNoteDraft('note/1', storage)).toMatchObject({
      noteId: 'note/1',
      title: 'Draft title',
      plainText: 'unsaved',
      baseRevision: 6,
    })
    expect(readNoteDraft('other-note', storage)).toBeNull()
  })

  it('removes a draft only when explicitly acknowledged by the caller', () => {
    const storage = createStorage()
    writeNoteDraft('note-1', { title: 'Title', contentJSON: '{}', plainText: '' }, 1, storage)
    removeNoteDraft('note-1', storage)
    expect(readNoteDraft('note-1', storage)).toBeNull()
  })

  it('clears only note recovery drafts and leaves unrelated browser preferences intact', () => {
    const storage = createStorage()
    storage.setItem('theme', 'dark')
    storage.setItem('altera:note-editor-draft:one', '{"noteId":"one"}')
    storage.setItem('altera:note-editor-draft:two', '{"noteId":"two"}')

    clearNoteDrafts(storage)

    expect(storage.getItem('theme')).toBe('dark')
    expect(storage.getItem('altera:note-editor-draft:one')).toBeNull()
    expect(storage.getItem('altera:note-editor-draft:two')).toBeNull()
  })

  it('ignores malformed recovery data without throwing', () => {
    const storage = createStorage()
    storage.setItem('altera:note-editor-draft:broken', '{not json')
    expect(readNoteDraft('broken', storage)).toBeNull()
  })

  it('falls back to sessionStorage when localStorage rejects a draft write', () => {
    const blockedLocal = createStorage()
    blockedLocal.setItem = () => { throw new Error('storage quota exceeded') }
    const session = createStorage()
    vi.stubGlobal('localStorage', blockedLocal)
    vi.stubGlobal('sessionStorage', session)

    try {
      const result = writeNoteDraft('note-1', {
        title: 'Temporary draft',
        contentJSON: '{"text":"recover me"}',
        plainText: 'recover me',
      }, 4)

      expect(result?.storage).toBe('session')
      expect(readNoteDraft('note-1')).toMatchObject({
        title: 'Temporary draft',
        baseRevision: 4,
      })
      removeNoteDraft('note-1')
      expect(readNoteDraft('note-1')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports when neither local nor session storage can keep a recovery copy', () => {
    const blockedLocal = createStorage()
    const blockedSession = createStorage()
    blockedLocal.setItem = () => { throw new Error('local storage blocked') }
    blockedSession.setItem = () => { throw new Error('session storage blocked') }
    vi.stubGlobal('localStorage', blockedLocal)
    vi.stubGlobal('sessionStorage', blockedSession)

    try {
      expect(writeNoteDraft('note-1', {
        title: 'Temporary draft',
        contentJSON: '{}',
        plainText: '',
      }, 1)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
