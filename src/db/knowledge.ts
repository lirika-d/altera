/**
 * knowledge.ts — ALTERA Knowledge Hub Persistence Service
 *
 * Implements CRUD, soft-delete, restore, permanent delete, revision/optimistic
 * stale write checks, transactions, attachments, tags, entity links, and search.
 */

import { db, generateId, type AlteraDB } from './db'
import { assertEntityExists, assertTagsExist } from './entityRegistry'
import { isValidResourceUrl } from '@/lib/resourceUrl'
import { MAX_FILE_SIZE } from '@/lib/attachmentPolicy'
import type {
  Note,
  Resource,
  Attachment,
  Tag,
  TagAssignment,
  EntityLink,
  KnowledgeEntityType,
  ResourceType,
  CreateNoteInput,
  UpdateNoteInput,
  CreateResourceInput,
  UpdateResourceInput,
  CreateTagInput,
  NoteFilterOptions,
  ResourceFilterOptions,
  KnowledgeCounts,
  EntityLinksResult,
} from '@/types'

// ─── Error Classes ────────────────────────────────────────────────────────────

export class StaleWriteError extends Error {
  code: 'STALE_WRITE'
  currentRevision: number
  expectedRevision: number

  constructor(message: string, currentRevision: number, expectedRevision: number) {
    super(message)
    this.name = 'StaleWriteError'
    this.code = 'STALE_WRITE'
    this.currentRevision = currentRevision
    this.expectedRevision = expectedRevision
  }
}

export class KnowledgeNotFoundError extends Error {
  code: 'KNOWLEDGE_NOT_FOUND'
  entityType: string
  id: string

  constructor(entityType: string, id: string) {
    super(`${entityType} with id "${id}" not found`)
    this.name = 'KnowledgeNotFoundError'
    this.code = 'KNOWLEDGE_NOT_FOUND'
    this.entityType = entityType
    this.id = id
  }
}

export class DuplicateEntityLinkError extends Error {
  code: 'DUPLICATE_ENTITY_LINK'

  constructor(message: string = 'Entity link already exists') {
    super(message)
    this.name = 'DuplicateEntityLinkError'
    this.code = 'DUPLICATE_ENTITY_LINK'
  }
}

export class DuplicateTagError extends Error {
  code: 'DUPLICATE_TAG'
  tagName: string

  constructor(tagName: string) {
    super(`Tag "${tagName}" already exists`)
    this.name = 'DuplicateTagError'
    this.code = 'DUPLICATE_TAG'
    this.tagName = tagName
  }
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase()
}

export async function createTag(
  input: CreateTagInput,
  dbInstance: AlteraDB = db
): Promise<Tag> {
  const trimmed = input.name.trim()
  if (!trimmed) {
    throw new Error('Tag name cannot be empty')
  }
  const normalizedName = normalizeTagName(trimmed)

  return dbInstance.transaction('rw', dbInstance.tags, async () => {
    const existing = await dbInstance.tags
      .where('normalizedName')
      .equals(normalizedName)
      .first()

    if (existing) {
      throw new DuplicateTagError(trimmed)
    }

    const tag: Tag = {
      id: generateId(),
      name: trimmed,
      normalizedName,
      color: input.color || '#3b82f6',
      createdAt: new Date(),
    }

    await dbInstance.tags.add(tag)
    return tag
  })
}

export async function getOrCreateTag(
  name: string,
  color?: string,
  dbInstance: AlteraDB = db
): Promise<Tag> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Tag name cannot be empty')
  const normalized = normalizeTagName(trimmed)

  const existing = await dbInstance.tags
    .where('normalizedName')
    .equals(normalized)
    .first()

  if (existing) {
    return existing
  }

  return createTag({ name: trimmed, color }, dbInstance)
}

export async function getTags(dbInstance: AlteraDB = db): Promise<Tag[]> {
  const tags = await dbInstance.tags.toArray()
  return tags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function getTagById(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Tag | undefined> {
  return dbInstance.tags.get(id)
}

export async function deleteTag(
  id: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction('rw', dbInstance.tags, dbInstance.tagAssignments, async () => {
    await dbInstance.tags.delete(id)
    await dbInstance.tagAssignments.where('tagId').equals(id).delete()
  })
}

export async function assignTag(
  tagId: string,
  entityType: KnowledgeEntityType,
  entityId: string,
  dbInstance: AlteraDB = db
): Promise<TagAssignment> {
  return dbInstance.transaction('rw', dbInstance.tables, async () => {
    await assertEntityExists(dbInstance, entityType, entityId)
    const tag = await dbInstance.tags.get(tagId)
    if (!tag) {
      throw new KnowledgeNotFoundError('Tag', tagId)
    }

    const existing = await dbInstance.tagAssignments
      .where('[tagId+entityId]')
      .equals([tagId, entityId])
      .and(assignment => assignment.entityType === entityType)
      .first()

    if (existing) {
      return existing
    }

    const assignment: TagAssignment = {
      id: generateId(),
      tagId,
      entityType,
      entityId,
    }

    await dbInstance.tagAssignments.add(assignment)
    return assignment
  })
}

export async function removeTagAssignment(
  tagId: string,
  entityType: KnowledgeEntityType,
  entityId: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction('rw', dbInstance.tagAssignments, async () => {
    const assignments = await dbInstance.tagAssignments
      .where('[tagId+entityId]')
      .equals([tagId, entityId])
      .toArray()

    for (const a of assignments) {
      if (a.entityType === entityType) {
        await dbInstance.tagAssignments.delete(a.id)
      }
    }
  })
}

export async function getTagsForEntity(
  entityType: KnowledgeEntityType,
  entityId: string,
  dbInstance: AlteraDB = db
): Promise<Tag[]> {
  const assignments = await dbInstance.tagAssignments
    .where('entityId')
    .equals(entityId)
    .and((a) => a.entityType === entityType)
    .toArray()

  if (assignments.length === 0) return []
  const tagIds = assignments.map((a) => a.tagId)
  const tags = await dbInstance.tags.where('id').anyOf(tagIds).toArray()
  return tags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function getEntitiesForTag(
  tagId: string,
  entityType?: KnowledgeEntityType,
  dbInstance: AlteraDB = db
): Promise<TagAssignment[]> {
  const assignments = await dbInstance.tagAssignments
    .where('tagId')
    .equals(tagId)
    .toArray()

  if (entityType) {
    return assignments.filter((a) => a.entityType === entityType)
  }
  return assignments
}

export async function setEntityTags(
  entityType: KnowledgeEntityType,
  entityId: string,
  tagIds: string[],
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction('rw', dbInstance.tables, async () => {
    await assertEntityExists(dbInstance, entityType, entityId)
    await assertTagsExist(dbInstance, tagIds)
    const existing = await dbInstance.tagAssignments
      .where('entityId')
      .equals(entityId)
      .and((a) => a.entityType === entityType)
      .toArray()

    const existingTagIdSet = new Set(existing.map((a) => a.tagId))
    const targetTagIdSet = new Set(tagIds)

    for (const a of existing) {
      if (!targetTagIdSet.has(a.tagId)) {
        await dbInstance.tagAssignments.delete(a.id)
      }
    }

    for (const tagId of targetTagIdSet) {
      if (!existingTagIdSet.has(tagId)) {
        await dbInstance.tagAssignments.add({
          id: generateId(),
          tagId,
          entityType,
          entityId,
        })
      }
    }
  })
}

// ─── Entity Links ─────────────────────────────────────────────────────────────

export async function createEntityLink(
  sourceType: KnowledgeEntityType,
  sourceId: string,
  targetType: KnowledgeEntityType,
  targetId: string,
  dbInstance: AlteraDB = db
): Promise<EntityLink> {
  if (sourceType === targetType && sourceId === targetId) {
    throw new Error('Cannot link an entity to itself')
  }

  try {
    return await dbInstance.transaction('rw', dbInstance.tables, async () => {
      await assertEntityExists(dbInstance, sourceType, sourceId)
      await assertEntityExists(dbInstance, targetType, targetId)

      const existing = await dbInstance.entityLinks
        .where('[sourceType+sourceId+targetType+targetId]')
        .equals([sourceType, sourceId, targetType, targetId])
        .first()

      if (existing) {
        throw new DuplicateEntityLinkError(
          `Entity link from ${sourceType}:${sourceId} to ${targetType}:${targetId} already exists`
        )
      }

      const link: EntityLink = {
        id: generateId(),
        sourceType,
        sourceId,
        targetType,
        targetId,
        createdAt: new Date(),
      }

      await dbInstance.entityLinks.add(link)
      return link
    })
  } catch (error) {
    // The unique index is the final guard if concurrent callers race past the
    // explicit lookup. Keep the service-level error stable for the UI.
    if (error instanceof Error && error.name === 'ConstraintError') {
      throw new DuplicateEntityLinkError(
        `Entity link from ${sourceType}:${sourceId} to ${targetType}:${targetId} already exists`
      )
    }
    throw error
  }
}

export async function deleteEntityLink(
  id: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.entityLinks.delete(id)
}

export async function getEntityLinks(
  entityType: KnowledgeEntityType,
  entityId: string,
  dbInstance: AlteraDB = db
): Promise<EntityLinksResult> {
  const outgoing = await dbInstance.entityLinks
    .where('[sourceType+sourceId]')
    .equals([entityType, entityId])
    .toArray()

  const incoming = await dbInstance.entityLinks
    .where('[targetType+targetId]')
    .equals([entityType, entityId])
    .toArray()

  return {
    outgoing,
    incoming,
    all: [...outgoing, ...incoming],
  }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function saveAttachment(
  file: File | { filename: string; mimeType: string; blob: Blob; size?: number },
  dbInstance: AlteraDB = db
): Promise<Attachment> {
  let filename = 'attachment'
  let mimeType = 'application/octet-stream'
  let blob: Blob
  let size = 0

  if (typeof File !== 'undefined' && file instanceof File) {
    filename = file.name
    mimeType = file.type || 'application/octet-stream'
    size = file.size
    blob = file
  } else {
    const anyFile = file as { filename?: string; name?: string; mimeType?: string; type?: string; blob?: Blob; size?: number }
    filename = anyFile.filename || anyFile.name || 'attachment'
    mimeType = anyFile.mimeType || anyFile.type || 'application/octet-stream'
    blob = anyFile.blob || (file as unknown as Blob)
    size = blob?.size ?? 0
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error('Attachment exceeds the 10 MB limit.')
  }

  const attachment: Attachment = {
    id: generateId(),
    filename,
    mimeType,
    size,
    blob,
    createdAt: new Date(),
  }

  await dbInstance.attachments.add(attachment)
  return attachment
}

export async function getAttachment(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Attachment | undefined> {
  return dbInstance.attachments.get(id)
}

export async function deleteAttachment(
  id: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.attachments.delete(id)
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(
  input: CreateNoteInput,
  dbInstance: AlteraDB = db
): Promise<Note> {
  return dbInstance.transaction('rw', dbInstance.notes, dbInstance.tagAssignments, async () => {
    const now = new Date()
    const note: Note = {
      id: generateId(),
      title: input.title.trim() || 'Untitled Note',
      contentJSON: input.contentJSON ?? '',
      plainText: input.plainText ?? '',
      isFavorite: input.isFavorite ?? false,
      projectId: input.projectId,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }

    await dbInstance.notes.add(note)

    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await dbInstance.tagAssignments.add({
          id: generateId(),
          tagId,
          entityType: 'note',
          entityId: note.id,
        })
      }
    }

    return note
  })
}

export async function updateNote(
  id: string,
  updates: UpdateNoteInput,
  dbInstance: AlteraDB = db
): Promise<Note> {
  return dbInstance.transaction('rw', dbInstance.notes, dbInstance.tagAssignments, async () => {
    const existing = await dbInstance.notes.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Note', id)
    }

    if (
      updates.expectedRevision !== undefined &&
      existing.revision !== updates.expectedRevision
    ) {
      throw new StaleWriteError(
        `Stale write detected for note "${id}". Current revision is ${existing.revision}, expected ${updates.expectedRevision}`,
        existing.revision,
        updates.expectedRevision
      )
    }

    const now = new Date()
    const updated: Note = {
      ...existing,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      contentJSON: updates.contentJSON !== undefined ? updates.contentJSON : existing.contentJSON,
      plainText: updates.plainText !== undefined ? updates.plainText : existing.plainText,
      isFavorite: updates.isFavorite !== undefined ? updates.isFavorite : existing.isFavorite,
      projectId:
        updates.projectId === null
          ? undefined
          : updates.projectId !== undefined
          ? updates.projectId
          : existing.projectId,
      revision: existing.revision + 1,
      updatedAt: now,
    }

    await dbInstance.notes.put(updated)

    if (updates.tagIds !== undefined) {
      const existingAssignments = await dbInstance.tagAssignments
        .where('entityId')
        .equals(id)
        .and((a) => a.entityType === 'note')
        .toArray()

      const existingTagIds = new Set(existingAssignments.map((a) => a.tagId))
      const targetTagIds = new Set(updates.tagIds)

      for (const a of existingAssignments) {
        if (!targetTagIds.has(a.tagId)) {
          await dbInstance.tagAssignments.delete(a.id)
        }
      }

      for (const tagId of targetTagIds) {
        if (!existingTagIds.has(tagId)) {
          await dbInstance.tagAssignments.add({
            id: generateId(),
            tagId,
            entityType: 'note',
            entityId: id,
          })
        }
      }
    }

    return updated
  })
}

export async function softDeleteNote(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Note> {
  return dbInstance.transaction('rw', dbInstance.notes, async () => {
    const existing = await dbInstance.notes.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Note', id)
    }

    const now = new Date()
    const updated: Note = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      revision: existing.revision + 1,
    }

    await dbInstance.notes.put(updated)
    return updated
  })
}

export async function restoreNote(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Note> {
  return dbInstance.transaction('rw', dbInstance.notes, async () => {
    const existing = await dbInstance.notes.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Note', id)
    }

    const now = new Date()
    const updated: Note = {
      ...existing,
      updatedAt: now,
      revision: existing.revision + 1,
    }
    delete updated.deletedAt

    await dbInstance.notes.put(updated)
    return updated
  })
}

export async function deleteNotePermanently(
  id: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction(
    'rw',
    dbInstance.notes,
    dbInstance.tagAssignments,
    dbInstance.entityLinks,
    async () => {
      const existing = await dbInstance.notes.get(id)
      if (!existing) return

      await dbInstance.notes.delete(id)
      await dbInstance.tagAssignments
        .where('entityId')
        .equals(id)
        .and((a) => a.entityType === 'note')
        .delete()

      await dbInstance.entityLinks
        .where('[sourceType+sourceId]')
        .equals(['note', id])
        .delete()

      await dbInstance.entityLinks
        .where('[targetType+targetId]')
        .equals(['note', id])
        .delete()
    }
  )
}

export async function getNoteById(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Note | undefined> {
  return dbInstance.notes.get(id)
}

export async function getActiveNotes(
  options?: NoteFilterOptions,
  dbInstance: AlteraDB = db
): Promise<Note[]> {
  // Use the project index first when scoped; the remaining predicates are
  // intentionally evaluated on the smaller candidate set.
  let notes = options?.projectId
    ? await dbInstance.notes.where('projectId').equals(options.projectId).toArray()
    : await dbInstance.notes.toArray()

  notes = notes.filter((n) => (options?.showTrash ? !!n.deletedAt : !n.deletedAt))

  if (options?.isFavorite !== undefined) {
    notes = notes.filter((n) => n.isFavorite === options.isFavorite)
  }

  if (options?.tagId) {
    const assignments = await dbInstance.tagAssignments
      .where('tagId')
      .equals(options.tagId)
      .and((a) => a.entityType === 'note')
      .toArray()
    const entityIds = new Set(assignments.map((a) => a.entityId))
    notes = notes.filter((n) => entityIds.has(n.id))
  }

  if (options?.search) {
    const q = options.search.trim().toLowerCase()
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.plainText.toLowerCase().includes(q)
    )
  }

  return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getTrashNotes(dbInstance: AlteraDB = db): Promise<Note[]> {
  const notes = await dbInstance.notes
    .filter((n) => !!n.deletedAt)
    .toArray()

  return notes.sort(
    (a, b) =>
      new Date(b.deletedAt || b.updatedAt).getTime() -
      new Date(a.deletedAt || a.updatedAt).getTime()
  )
}

export async function searchNotes(
  query: string,
  options?: { projectId?: string },
  dbInstance: AlteraDB = db
): Promise<Note[]> {
  return getActiveNotes({ search: query, projectId: options?.projectId }, dbInstance)
}

export async function toggleNoteFavorite(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Note> {
  return dbInstance.transaction('rw', dbInstance.notes, async () => {
    const existing = await dbInstance.notes.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Note', id)
    }

    const now = new Date()
    const updated: Note = {
      ...existing,
      isFavorite: !existing.isFavorite,
      updatedAt: now,
      revision: existing.revision + 1,
    }

    await dbInstance.notes.put(updated)
    return updated
  })
}

// ─── Resources ────────────────────────────────────────────────────────────────

export async function createResource(
  input: CreateResourceInput,
  dbInstance: AlteraDB = db
): Promise<Resource> {
  const url = input.url?.trim()
  if (url && !isValidResourceUrl(url)) {
    throw new Error('Resource URLs must use HTTP or HTTPS.')
  }
  return dbInstance.transaction('rw', dbInstance.resources, dbInstance.tagAssignments, async () => {
    const now = new Date()
    const resource: Resource = {
      id: generateId(),
      type: input.type,
      title: input.title.trim() || 'Untitled Resource',
      description: input.description,
      url,
      snippetContent: input.snippetContent,
      language: input.language,
      attachmentId: input.attachmentId,
      isFavorite: input.isFavorite ?? false,
      projectId: input.projectId,
      createdAt: now,
      updatedAt: now,
    }

    await dbInstance.resources.add(resource)

    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await dbInstance.tagAssignments.add({
          id: generateId(),
          tagId,
          entityType: 'resource',
          entityId: resource.id,
        })
      }
    }

    return resource
  })
}

export async function updateResource(
  id: string,
  updates: UpdateResourceInput,
  dbInstance: AlteraDB = db
): Promise<Resource> {
  return dbInstance.transaction('rw', dbInstance.resources, dbInstance.tagAssignments, async () => {
    const existing = await dbInstance.resources.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Resource', id)
    }

    const nextUrl = updates.url !== undefined ? updates.url?.trim() : existing.url
    if (nextUrl && !isValidResourceUrl(nextUrl)) {
      throw new Error('Resource URLs must use HTTP or HTTPS.')
    }

    const now = new Date()
    const updated: Resource = {
      ...existing,
      type: updates.type !== undefined ? updates.type : existing.type,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description : existing.description,
      url: nextUrl,
      snippetContent:
        updates.snippetContent !== undefined ? updates.snippetContent : existing.snippetContent,
      language: updates.language !== undefined ? updates.language : existing.language,
      attachmentId:
        updates.attachmentId !== undefined ? updates.attachmentId : existing.attachmentId,
      isFavorite: updates.isFavorite !== undefined ? updates.isFavorite : existing.isFavorite,
      projectId:
        updates.projectId === null
          ? undefined
          : updates.projectId !== undefined
          ? updates.projectId
          : existing.projectId,
      updatedAt: now,
    }

    await dbInstance.resources.put(updated)

    if (updates.tagIds !== undefined) {
      const existingAssignments = await dbInstance.tagAssignments
        .where('entityId')
        .equals(id)
        .and((a) => a.entityType === 'resource')
        .toArray()

      const existingTagIds = new Set(existingAssignments.map((a) => a.tagId))
      const targetTagIds = new Set(updates.tagIds)

      for (const a of existingAssignments) {
        if (!targetTagIds.has(a.tagId)) {
          await dbInstance.tagAssignments.delete(a.id)
        }
      }

      for (const tagId of targetTagIds) {
        if (!existingTagIds.has(tagId)) {
          await dbInstance.tagAssignments.add({
            id: generateId(),
            tagId,
            entityType: 'resource',
            entityId: id,
          })
        }
      }
    }

    return updated
  })
}

export async function softDeleteResource(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Resource> {
  return dbInstance.transaction('rw', dbInstance.resources, async () => {
    const existing = await dbInstance.resources.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Resource', id)
    }

    const now = new Date()
    const updated: Resource = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    }

    await dbInstance.resources.put(updated)
    return updated
  })
}

export async function restoreResource(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Resource> {
  return dbInstance.transaction('rw', dbInstance.resources, async () => {
    const existing = await dbInstance.resources.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Resource', id)
    }

    const now = new Date()
    const updated: Resource = {
      ...existing,
      updatedAt: now,
    }
    delete updated.deletedAt

    await dbInstance.resources.put(updated)
    return updated
  })
}

export async function deleteResourcePermanently(
  id: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction(
    'rw',
    dbInstance.resources,
    dbInstance.attachments,
    dbInstance.tagAssignments,
    dbInstance.entityLinks,
    async () => {
      const existing = await dbInstance.resources.get(id)
      if (!existing) return

      if (existing.attachmentId) {
        await dbInstance.attachments.delete(existing.attachmentId)
      }

      await dbInstance.resources.delete(id)
      await dbInstance.tagAssignments
        .where('entityId')
        .equals(id)
        .and((a) => a.entityType === 'resource')
        .delete()

      await dbInstance.entityLinks
        .where('[sourceType+sourceId]')
        .equals(['resource', id])
        .delete()

      await dbInstance.entityLinks
        .where('[targetType+targetId]')
        .equals(['resource', id])
        .delete()
    }
  )
}

export async function getResourceById(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Resource | undefined> {
  return dbInstance.resources.get(id)
}

export async function getActiveResources(
  options?: ResourceFilterOptions,
  dbInstance: AlteraDB = db
): Promise<Resource[]> {
  let resources = options?.projectId
    ? await dbInstance.resources.where('projectId').equals(options.projectId).toArray()
    : await dbInstance.resources.toArray()

  resources = resources.filter((r) => (options?.showTrash ? !!r.deletedAt : !r.deletedAt))

  if (options?.type) {
    resources = resources.filter((r) => r.type === options.type)
  }

  if (options?.isFavorite !== undefined) {
    resources = resources.filter((r) => r.isFavorite === options.isFavorite)
  }

  if (options?.tagId) {
    const assignments = await dbInstance.tagAssignments
      .where('tagId')
      .equals(options.tagId)
      .and((a) => a.entityType === 'resource')
      .toArray()
    const entityIds = new Set(assignments.map((a) => a.entityId))
    resources = resources.filter((r) => entityIds.has(r.id))
  }

  if (options?.search) {
    const q = options.search.trim().toLowerCase()
    resources = resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.url && r.url.toLowerCase().includes(q)) ||
        (r.snippetContent && r.snippetContent.toLowerCase().includes(q))
    )
  }

  return resources.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getTrashResources(dbInstance: AlteraDB = db): Promise<Resource[]> {
  const resources = await dbInstance.resources
    .filter((r) => !!r.deletedAt)
    .toArray()

  return resources.sort(
    (a, b) =>
      new Date(b.deletedAt || b.updatedAt).getTime() -
      new Date(a.deletedAt || a.updatedAt).getTime()
  )
}

export async function searchResources(
  query: string,
  options?: { projectId?: string; type?: ResourceType },
  dbInstance: AlteraDB = db
): Promise<Resource[]> {
  return getActiveResources(
    { search: query, projectId: options?.projectId, type: options?.type },
    dbInstance
  )
}

export async function toggleResourceFavorite(
  id: string,
  dbInstance: AlteraDB = db
): Promise<Resource> {
  return dbInstance.transaction('rw', dbInstance.resources, async () => {
    const existing = await dbInstance.resources.get(id)
    if (!existing) {
      throw new KnowledgeNotFoundError('Resource', id)
    }

    const now = new Date()
    const updated: Resource = {
      ...existing,
      isFavorite: !existing.isFavorite,
      updatedAt: now,
    }

    await dbInstance.resources.put(updated)
    return updated
  })
}

// ─── Analytics & Cleanup ──────────────────────────────────────────────────────

export async function getKnowledgeCounts(
  projectId?: string,
  dbInstance: AlteraDB = db
): Promise<KnowledgeCounts> {
  const [filteredNotes, filteredResources] = await Promise.all([
    projectId
      ? dbInstance.notes.where('projectId').equals(projectId).toArray()
      : dbInstance.notes.toArray(),
    projectId
      ? dbInstance.resources.where('projectId').equals(projectId).toArray()
      : dbInstance.resources.toArray(),
  ])

  const activeNotes = filteredNotes.filter((n) => !n.deletedAt)
  const activeResources = filteredResources.filter((r) => !r.deletedAt)

  const trashNotes = filteredNotes.filter((n) => !!n.deletedAt).length
  const trashResources = filteredResources.filter((r) => !!r.deletedAt).length

  const favNotes = activeNotes.filter((n) => n.isFavorite).length
  const favResources = activeResources.filter((r) => r.isFavorite).length

  return {
    notes: activeNotes.length,
    resources: activeResources.length,
    trash: trashNotes + trashResources,
    favorites: favNotes + favResources,
  }
}

export async function cleanupEntityConnections(
  entityType: KnowledgeEntityType,
  entityId: string,
  dbInstance: AlteraDB = db
): Promise<void> {
  await dbInstance.transaction(
    'rw',
    dbInstance.tagAssignments,
    dbInstance.entityLinks,
    async () => {
      await dbInstance.tagAssignments
        .where('entityId')
        .equals(entityId)
        .and((a) => a.entityType === entityType)
        .delete()

      await dbInstance.entityLinks
        .where('[sourceType+sourceId]')
        .equals([entityType, entityId])
        .delete()

      await dbInstance.entityLinks
        .where('[targetType+targetId]')
        .equals([entityType, entityId])
        .delete()
    }
  )
}
