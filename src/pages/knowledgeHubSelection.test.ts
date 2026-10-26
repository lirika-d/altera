import { describe, expect, it } from 'vitest'
import type { Note } from '@/types'
import { resolveKnowledgeHubNoteSelection, withKnowledgeHubNote } from './knowledgeHubSelection'

function makeNote(id: string, title: string, projectId?: string): Note {
  const now = new Date('2026-10-25T12:00:00.000Z')
  return {
    id,
    title,
    contentJSON: '',
    plainText: title,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    projectId,
  }
}

const notes = [makeNote('note-1', 'First note', 'project-1'), makeNote('note-2', 'Second note', 'project-2')]

describe('Knowledge Hub note selection policy', () => {
  it('waits for live-query data before auto-selecting', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes: undefined,
        initialSelectionResolved: false,
      })
    ).toEqual({ action: 'wait', initialSelectionResolved: false })
  })

  it('selects the first note on the initial route when no note is in the URL', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes,
        initialSelectionResolved: false,
      })
    ).toEqual({ action: 'select', noteId: 'note-1', initialSelectionResolved: true })
  })

  it('preserves an explicitly selected valid note', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes,
        noteId: 'note-2',
        initialSelectionResolved: false,
      })
    ).toEqual({ action: 'keep', initialSelectionResolved: true })
  })

  it('does not replace a valid URL note because it is outside the current project or search filter', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes,
        noteId: 'note-2',
        projectId: 'project-1',
        search: 'first',
        initialSelectionResolved: true,
      })
    ).toEqual({ action: 'keep', initialSelectionResolved: true })
  })

  it('replaces a missing or deleted note id with the first matching active note', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes,
        noteId: 'deleted-note',
        projectId: 'project-2',
        search: 'second',
        initialSelectionResolved: true,
      })
    ).toEqual({ action: 'select', noteId: 'note-2', initialSelectionResolved: true })
  })

  it('clears a stale note id when no active notes remain', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes: [],
        noteId: 'missing-note',
        initialSelectionResolved: false,
      })
    ).toEqual({ action: 'select', noteId: undefined, initialSelectionResolved: true })
  })

  it('does not navigate for an empty collection or auto-select after an explicit clear', () => {
    expect(
      resolveKnowledgeHubNoteSelection({
        notes: [],
        initialSelectionResolved: false,
      })
    ).toEqual({ action: 'keep', initialSelectionResolved: false })

    expect(
      resolveKnowledgeHubNoteSelection({
        notes,
        initialSelectionResolved: true,
      })
    ).toEqual({ action: 'keep', initialSelectionResolved: true })
  })

  it('updates only the note search parameter and preserves the rest of the URL state', () => {
    const current = new URLSearchParams('tab=notes&project=project-1&filter=all&note=note-1')
    expect(withKnowledgeHubNote(current, 'note-2').toString()).toBe(
      'tab=notes&project=project-1&filter=all&note=note-2'
    )
    expect(withKnowledgeHubNote(current).toString()).toBe('tab=notes&project=project-1&filter=all')
  })
})
