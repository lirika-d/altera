/**
 * useKnowledge.ts — Reactive hooks for the ALTERA Knowledge Hub.
 *
 * Uses `useLiveQuery` from dexie-react-hooks to reactively query Notes,
 * Resources, Attachments, Tags, EntityLinks, and aggregate counts.
 */

import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  createNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  deleteNotePermanently,
  getNoteById,
  getActiveNotes,
  getTrashNotes,
  toggleNoteFavorite,
  createResource,
  updateResource,
  softDeleteResource,
  restoreResource,
  deleteResourcePermanently,
  getResourceById,
  getActiveResources,
  getTrashResources,
  toggleResourceFavorite,
  saveAttachment,
  getAttachment,
  deleteAttachment,
  createTag,
  getOrCreateTag,
  getTags,
  deleteTag,
  assignTag,
  removeTagAssignment,
  getTagsForEntity,
  setEntityTags,
  createEntityLink,
  deleteEntityLink,
  getEntityLinks,
  getKnowledgeCounts,
} from '@/db/knowledge'
import type {
  Note,
  Resource,
  Attachment,
  Tag,
  TagAssignment,
  EntityLink,
  KnowledgeEntityType,
  NoteFilterOptions,
  ResourceFilterOptions,
  KnowledgeCounts,
  EntityLinksResult,
  CreateNoteInput,
  UpdateNoteInput,
  CreateResourceInput,
  UpdateResourceInput,
  CreateTagInput,
} from '@/types'

const EMPTY_NOTES: Note[] = []
const EMPTY_RESOURCES: Resource[] = []
const EMPTY_TAGS: Tag[] = []
const EMPTY_ENTITY_LINKS: EntityLinksResult = { outgoing: [], incoming: [], all: [] }
const EMPTY_KNOWLEDGE_COUNTS: KnowledgeCounts = {
  notes: 0,
  resources: 0,
  trash: 0,
  favorites: 0,
}

// ─── Reactive Queries ─────────────────────────────────────────────────────────

/**
 * Reactively queries active notes (or trash notes if showTrash is true),
 * filtered by project, tag, favorite, or search text.
 */
export function useNotesQuery(options?: NoteFilterOptions): Note[] | undefined {
  return useLiveQuery(
    () => getActiveNotes(options),
    [
      options?.projectId,
      options?.tagId,
      options?.isFavorite,
      options?.showTrash,
      options?.search,
    ]
  )
}

export function useNotes(options?: NoteFilterOptions): Note[] {
  return useNotesQuery(options) ?? EMPTY_NOTES
}

/**
 * Reactively queries a single note by id.
 */
export function useNote(id?: string): Note | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined
      return getNoteById(id)
    },
    [id]
  )
}

/**
 * Reactively queries notes in the trash.
 */
export function useTrashNotes(): Note[] {
  return useLiveQuery(() => getTrashNotes(), []) ?? EMPTY_NOTES
}

/**
 * Reactively queries active resources (or trash resources if showTrash is true),
 * filtered by project, resource type, tag, favorite, or search text.
 */
export function useResources(options?: ResourceFilterOptions): Resource[] {
  return (
    useLiveQuery(
      () => getActiveResources(options),
      [
        options?.projectId,
        options?.type,
        options?.tagId,
        options?.isFavorite,
        options?.showTrash,
        options?.search,
      ]
    ) ?? EMPTY_RESOURCES
  )
}

/**
 * Reactively queries a single resource by id.
 */
export function useResource(id?: string): Resource | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined
      return getResourceById(id)
    },
    [id]
  )
}

/**
 * Reactively queries resources in the trash.
 */
export function useTrashResources(): Resource[] {
  return useLiveQuery(() => getTrashResources(), []) ?? EMPTY_RESOURCES
}

/**
 * Reactively queries a single attachment by id.
 */
export function useAttachment(id?: string): Attachment | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined
      return getAttachment(id)
    },
    [id]
  )
}

/**
 * Reactively queries all available tags ordered alphabetically by name.
 */
export function useTags(): Tag[] {
  return useLiveQuery(() => getTags(), []) ?? EMPTY_TAGS
}

/**
 * Reactively queries all tags assigned to a specific entity.
 */
export function useEntityTags(entityType: string, entityId?: string): Tag[] {
  return (
    useLiveQuery(
      async () => {
        if (!entityId) return EMPTY_TAGS
        return getTagsForEntity(entityType as KnowledgeEntityType, entityId)
      },
      [entityType, entityId]
    ) ?? EMPTY_TAGS
  )
}

/**
 * Reactively queries entity links (incoming, outgoing, and all) for an entity.
 */
export function useEntityLinks(
  entityType: string,
  entityId?: string
): EntityLinksResult {
  return (
    useLiveQuery(
      async () => {
        if (!entityId) return EMPTY_ENTITY_LINKS
        return getEntityLinks(entityType as KnowledgeEntityType, entityId)
      },
      [entityType, entityId]
    ) ?? EMPTY_ENTITY_LINKS
  )
}

/**
 * Reactively computes quick knowledge counts (notes, resources, trash, favorites),
 * optionally scoped to a project.
 */
export function useKnowledgeCounts(projectId?: string): KnowledgeCounts {
  return (
    useLiveQuery(
      () => getKnowledgeCounts(projectId),
      [projectId]
    ) ?? EMPTY_KNOWLEDGE_COUNTS
  )
}

// ─── Actions Hook ─────────────────────────────────────────────────────────────

export interface KnowledgeActions {
  // Note actions
  createNote: (input: CreateNoteInput) => Promise<Note>
  updateNote: (id: string, updates: UpdateNoteInput) => Promise<Note>
  softDeleteNote: (id: string) => Promise<Note>
  restoreNote: (id: string) => Promise<Note>
  deleteNotePermanently: (id: string) => Promise<void>
  toggleNoteFavorite: (id: string) => Promise<Note>

  // Resource actions
  createResource: (input: CreateResourceInput) => Promise<Resource>
  updateResource: (id: string, updates: UpdateResourceInput) => Promise<Resource>
  softDeleteResource: (id: string) => Promise<Resource>
  restoreResource: (id: string) => Promise<Resource>
  deleteResourcePermanently: (id: string) => Promise<void>
  toggleResourceFavorite: (id: string) => Promise<Resource>

  // Attachment actions
  saveAttachment: (
    file: File | { filename: string; mimeType: string; blob: Blob; size?: number }
  ) => Promise<Attachment>
  deleteAttachment: (id: string) => Promise<void>

  // Tag actions
  createTag: (input: CreateTagInput) => Promise<Tag>
  getOrCreateTag: (name: string, color?: string) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  assignTag: (
    tagId: string,
    entityType: KnowledgeEntityType,
    entityId: string
  ) => Promise<TagAssignment>
  removeTagAssignment: (
    tagId: string,
    entityType: KnowledgeEntityType,
    entityId: string
  ) => Promise<void>
  setEntityTags: (
    entityType: KnowledgeEntityType,
    entityId: string,
    tagIds: string[]
  ) => Promise<void>

  // Link actions
  createEntityLink: (
    sourceType: KnowledgeEntityType,
    sourceId: string,
    targetType: KnowledgeEntityType,
    targetId: string
  ) => Promise<EntityLink>
  deleteEntityLink: (id: string) => Promise<void>

  // State
  isLoading: boolean
  error: string | null
  clearError: () => void
}

/**
 * Returns bound knowledge action functions with shared loading/error state.
 */
export function useKnowledgeActions(): KnowledgeActions {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const wrap = React.useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setIsLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const clearError = React.useCallback(() => setError(null), [])

  return {
    // Note actions
    createNote: React.useCallback((input: CreateNoteInput) => wrap(() => createNote(input)), [wrap]),
    updateNote: React.useCallback((id: string, updates: UpdateNoteInput) => wrap(() => updateNote(id, updates)), [wrap]),
    softDeleteNote: React.useCallback((id: string) => wrap(() => softDeleteNote(id)), [wrap]),
    restoreNote: React.useCallback((id: string) => wrap(() => restoreNote(id)), [wrap]),
    deleteNotePermanently: React.useCallback((id: string) => wrap(() => deleteNotePermanently(id)), [wrap]),
    toggleNoteFavorite: React.useCallback((id: string) => wrap(() => toggleNoteFavorite(id)), [wrap]),

    // Resource actions
    createResource: React.useCallback((input: CreateResourceInput) => wrap(() => createResource(input)), [wrap]),
    updateResource: React.useCallback((id: string, updates: UpdateResourceInput) => wrap(() => updateResource(id, updates)), [wrap]),
    softDeleteResource: React.useCallback((id: string) => wrap(() => softDeleteResource(id)), [wrap]),
    restoreResource: React.useCallback((id: string) => wrap(() => restoreResource(id)), [wrap]),
    deleteResourcePermanently: React.useCallback((id: string) => wrap(() => deleteResourcePermanently(id)), [wrap]),
    toggleResourceFavorite: React.useCallback((id: string) => wrap(() => toggleResourceFavorite(id)), [wrap]),

    // Attachment actions
    saveAttachment: React.useCallback((file) => wrap(() => saveAttachment(file)), [wrap]),
    deleteAttachment: React.useCallback((id: string) => wrap(() => deleteAttachment(id)), [wrap]),

    // Tag actions
    createTag: React.useCallback((input: CreateTagInput) => wrap(() => createTag(input)), [wrap]),
    getOrCreateTag: React.useCallback((name: string, color?: string) => wrap(() => getOrCreateTag(name, color)), [wrap]),
    deleteTag: React.useCallback((id: string) => wrap(() => deleteTag(id)), [wrap]),
    assignTag: React.useCallback((tagId: string, entityType: KnowledgeEntityType, entityId: string) => wrap(() => assignTag(tagId, entityType, entityId)), [wrap]),
    removeTagAssignment: React.useCallback((tagId: string, entityType: KnowledgeEntityType, entityId: string) => wrap(() => removeTagAssignment(tagId, entityType, entityId)), [wrap]),
    setEntityTags: React.useCallback((entityType: KnowledgeEntityType, entityId: string, tagIds: string[]) => wrap(() => setEntityTags(entityType, entityId, tagIds)), [wrap]),

    // Link actions
    createEntityLink: React.useCallback((sourceType: KnowledgeEntityType, sourceId: string, targetType: KnowledgeEntityType, targetId: string) => wrap(() => createEntityLink(sourceType, sourceId, targetType, targetId)), [wrap]),
    deleteEntityLink: React.useCallback((id: string) => wrap(() => deleteEntityLink(id)), [wrap]),

    isLoading,
    error,
    clearError,
  }
}
