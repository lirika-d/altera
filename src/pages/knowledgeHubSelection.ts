import type { Note } from '@/types'

export interface KnowledgeHubNoteSelectionInput {
  notes: readonly Note[] | undefined
  noteId?: string
  projectId?: string
  search?: string
  initialSelectionResolved: boolean
}

export type KnowledgeHubNoteSelectionDecision =
  | { action: 'wait'; initialSelectionResolved: false }
  | { action: 'keep'; initialSelectionResolved: boolean }
  | { action: 'select'; noteId: string | undefined; initialSelectionResolved: true }

export function resolveKnowledgeHubNoteSelection({
  notes,
  noteId,
  projectId,
  search,
  initialSelectionResolved,
}: KnowledgeHubNoteSelectionInput): KnowledgeHubNoteSelectionDecision {
  if (notes === undefined) {
    return { action: 'wait', initialSelectionResolved: false }
  }

  const query = search?.trim().toLowerCase() ?? ''
  const matchingNotes = notes.filter((note) => {
    if (projectId && note.projectId !== projectId) return false
    if (!query) return true

    return note.title.toLowerCase().includes(query) || note.plainText.toLowerCase().includes(query)
  })

  if (noteId) {
    if (notes.some((note) => note.id === noteId)) {
      return { action: 'keep', initialSelectionResolved: true }
    }

    return {
      action: 'select',
      noteId: matchingNotes[0]?.id,
      initialSelectionResolved: true,
    }
  }

  if (initialSelectionResolved || matchingNotes.length === 0) {
    return { action: 'keep', initialSelectionResolved }
  }

  return {
    action: 'select',
    noteId: matchingNotes[0].id,
    initialSelectionResolved: true,
  }
}

export function withKnowledgeHubNote(searchParams: URLSearchParams, noteId?: string): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  if (noteId) {
    next.set('note', noteId)
  } else {
    next.delete('note')
  }
  return next
}
