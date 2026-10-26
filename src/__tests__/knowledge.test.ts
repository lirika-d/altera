/**
 * knowledge.test.ts — Unit tests for ALTERA Knowledge Hub Persistence Layer
 *
 * Tests:
 *  - v6 schema initialization and migration compatibility with v1-v4 records
 *  - Note CRUD, soft-delete, restore, permanent delete
 *  - Optimistic revision checking (preventing stale write)
 *  - Resource CRUD and filtering (type, project, favorite, tag, search)
 *  - Attachment save and retrieve (Blob handling)
 *  - Tag creation, normalization, unique name enforcement, entity assignment
 *  - EntityLink creation, duplicate prevention, bidirectional link querying
 *  - Atomic transactions and cascading cleanup
 */

import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlteraDB, clearAllData, createProject, createTask, db } from '@/db/db'
import {
  assignTag,
  cleanupEntityConnections,
  createEntityLink,
  createNote,
  createResource,
  createTag,
  deleteAttachment,
  deleteEntityLink,
  deleteNotePermanently,
  deleteResourcePermanently,
  deleteTag,
  DuplicateEntityLinkError,
  DuplicateTagError,
  getActiveNotes,
  getActiveResources,
  getAttachment,
  getEntitiesForTag,
  getEntityLinks,
  getKnowledgeCounts,
  getNoteById,
  getOrCreateTag,
  getResourceById,
  getTags,
  getTagsForEntity,
  getTrashNotes,
  getTrashResources,
  KnowledgeNotFoundError,
  removeTagAssignment,
  restoreNote,
  restoreResource,
  saveAttachment,
  searchNotes,
  searchResources,
  setEntityTags,
  softDeleteNote,
  softDeleteResource,
  StaleWriteError,
  toggleNoteFavorite,
  toggleResourceFavorite,
  updateNote,
  updateResource,
} from '@/db/knowledge'
import type { Project, Session, Task } from '@/types'

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.open()
  await clearAllData()
})

// ─── 1. Schema Initialization & Migration Compatibility ───────────────────────

describe('Schema Initialization and Migration Compatibility', () => {
  it('preserves v4 links while installing the current typed-link and project indexes', async () => {
    const migrationDbName = `altera-link-index-migration-${Date.now()}`
    const legacyDb = new Dexie(migrationDbName)
    legacyDb.version(4).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
      notes: 'id, isFavorite, deletedAt, updatedAt, createdAt, revision',
      resources: 'id, type, isFavorite, deletedAt, updatedAt, createdAt',
      attachments: 'id, filename, mimeType, createdAt',
      tags: 'id, &name, normalizedName, createdAt',
      tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId]',
      metadata: 'key',
    })
    await legacyDb.open()
    const link = {
      id: 'legacy-v4-link',
      sourceType: 'note',
      sourceId: 'legacy-note',
      targetType: 'project',
      targetId: 'legacy-project',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    await legacyDb.table('entityLinks').add(link)
    await legacyDb.table('entityLinks').add({ ...link, id: 'legacy-v4-link-duplicate', createdAt: new Date('2026-01-02T00:00:00.000Z') })
    legacyDb.close()

    const upgradedDb = new AlteraDB(migrationDbName)
    await upgradedDb.open()
    expect(await upgradedDb.entityLinks.get(link.id)).toEqual(link)
    expect(await upgradedDb.entityLinks.count()).toBe(1)
    expect(upgradedDb.entityLinks.schema.indexes).toContainEqual(expect.objectContaining({
      name: '[sourceType+sourceId+targetType+targetId]',
      unique: true,
    }))
    expect(upgradedDb.notes.schema.indexes).toContainEqual(expect.objectContaining({ name: 'projectId' }))
    expect(upgradedDb.resources.schema.indexes).toContainEqual(expect.objectContaining({ name: 'projectId' }))
    upgradedDb.close()
    await upgradedDb.delete()
  })

  it('preserves existing v1 and v2 records when upgrading to the current schema', async () => {
    const migrationDbName = `altera-migration-test-${Date.now()}`

    // 1. Initialize a DB using v2 schema only
    const v2Db = new Dexie(migrationDbName)
    v2Db.version(1).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
    })
    v2Db.version(2).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
    })

    await v2Db.open()

    const project: Project = {
      id: 'proj-mig-1',
      identifier: 'ALT-100',
      name: 'Migration Legacy Project',
      description: 'Created under v2 schema',
      status: 'active',
      priority: 'high',
      color: '#3b82f6',
      icon: '🚀',
      progress: 50,
      nextAction: 'Test v3 upgrade',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }
    await v2Db.table('projects').add(project)

    const task: Task = {
      id: 'task-mig-1',
      projectId: 'proj-mig-1',
      title: 'Legacy task',
      status: 'in_progress',
      priority: 'high',
      order: 0,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }
    await v2Db.table('tasks').add(task)

    const session: Session = {
      id: 'session-mig-1',
      projectId: 'proj-mig-1',
      taskId: 'task-mig-1',
      title: 'Legacy session',
      objective: 'Verify upgrade',
      status: 'completed',
      startedAt: new Date('2026-01-01T10:00:00'),
      endedAt: new Date('2026-01-01T11:00:00'),
      lastResumedAt: new Date('2026-01-01T10:00:00'),
      accumulatedDurationMs: 3600000,
      accomplishments: 'Built foundation',
      blockers: '',
      nextStep: '',
      outcome: 'Success',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }
    await v2Db.table('sessions').add(session)

    v2Db.close()

    // 2. Open using the current AlteraDB schema.
    const currentDb = new AlteraDB(migrationDbName)
    await currentDb.open()

    // Verify v1 & v2 records are intact
    const loadedProject = await currentDb.projects.get('proj-mig-1')
    expect(loadedProject).toBeDefined()
    expect(loadedProject?.name).toBe('Migration Legacy Project')
    expect(loadedProject?.identifier).toBe('ALT-100')

    const loadedTask = await currentDb.tasks.get('task-mig-1')
    expect(loadedTask).toBeDefined()
    expect(loadedTask?.title).toBe('Legacy task')

    const loadedSession = await currentDb.sessions.get('session-mig-1')
    expect(loadedSession).toBeDefined()
    expect(loadedSession?.title).toBe('Legacy session')

    // Verify current stores and the type-aware unique relationship index.
    expect(currentDb.notes).toBeDefined()
    expect(currentDb.resources).toBeDefined()
    expect(currentDb.attachments).toBeDefined()
    expect(currentDb.tags).toBeDefined()
    expect(currentDb.tagAssignments).toBeDefined()
    expect(currentDb.entityLinks).toBeDefined()
    expect(currentDb.entityLinks.schema.indexes).toContainEqual(expect.objectContaining({
      name: '[sourceType+sourceId+targetType+targetId]',
      unique: true,
    }))

    const note = await createNote(
      {
        title: 'V3 Note after migration',
        plainText: 'Migration succeeded',
        projectId: 'proj-mig-1',
      },
      currentDb
    )
    expect(note.id).toBeDefined()

    const retrievedNote = await currentDb.notes.get(note.id)
    expect(retrievedNote?.title).toBe('V3 Note after migration')

    currentDb.close()
  })
})

// ─── 2. Note CRUD, Soft-Delete, Restore, Permanent Delete ──────────────────────

describe('Note Operations', () => {
  it('creates a note with default values, revision 1, and assigns tags', async () => {
    const tag = await createTag({ name: 'Architecture', color: '#10b981' })

    const note = await createNote({
      title: 'System Design Overview',
      contentJSON: '{"type":"doc","content":[{"type":"paragraph","text":"Hello"}]}',
      plainText: 'Hello',
      isFavorite: true,
      projectId: 'proj-alpha',
      tagIds: [tag.id],
    })

    expect(note.id).toBeDefined()
    expect(note.title).toBe('System Design Overview')
    expect(note.plainText).toBe('Hello')
    expect(note.isFavorite).toBe(true)
    expect(note.revision).toBe(1)
    expect(note.projectId).toBe('proj-alpha')
    expect(note.deletedAt).toBeUndefined()
    expect(note.createdAt).toBeInstanceOf(Date)
    expect(note.updatedAt).toBeInstanceOf(Date)

    // Tag should be assigned
    const tags = await getTagsForEntity('note', note.id)
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Architecture')
  })

  it('updates note content and increments revision number', async () => {
    const note = await createNote({
      title: 'Draft Spec',
      plainText: 'Initial spec',
    })

    const updated = await updateNote(note.id, {
      title: 'Final Spec',
      plainText: 'Completed spec text',
      isFavorite: true,
    })

    expect(updated.title).toBe('Final Spec')
    expect(updated.plainText).toBe('Completed spec text')
    expect(updated.isFavorite).toBe(true)
    expect(updated.revision).toBe(2)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(note.updatedAt).getTime()
    )

    const stored = await getNoteById(note.id)
    expect(stored?.title).toBe('Final Spec')
    expect(stored?.revision).toBe(2)
  })

  it('throws KnowledgeNotFoundError when updating non-existent note', async () => {
    await expect(
      updateNote('missing-note-id', { title: 'Updated' })
    ).rejects.toThrow(KnowledgeNotFoundError)
  })

  it('soft deletes a note and excludes it from getActiveNotes', async () => {
    const note = await createNote({ title: 'Temporary Note' })

    const deleted = await softDeleteNote(note.id)
    expect(deleted.deletedAt).toBeInstanceOf(Date)
    expect(deleted.revision).toBe(2)

    const activeNotes = await getActiveNotes()
    expect(activeNotes.some((n) => n.id === note.id)).toBe(false)

    const trashNotes = await getTrashNotes()
    expect(trashNotes.some((n) => n.id === note.id)).toBe(true)
  })

  it('restores a soft-deleted note and returns it to active notes', async () => {
    const note = await createNote({ title: 'Resurrected Note' })
    await softDeleteNote(note.id)

    const restored = await restoreNote(note.id)
    expect(restored.deletedAt).toBeUndefined()
    expect(restored.revision).toBe(3)

    const activeNotes = await getActiveNotes()
    expect(activeNotes.some((n) => n.id === note.id)).toBe(true)

    const trashNotes = await getTrashNotes()
    expect(trashNotes.some((n) => n.id === note.id)).toBe(false)
  })

  it('permanently deletes a note and cleans up associated tags and links', async () => {
    const tag = await createTag({ name: 'Cleanup Tag' })
    const note = await createNote({
      title: 'Doomed Note',
      tagIds: [tag.id],
    })
    const project = await createProject({
      name: 'Linked project',
      description: '',
      status: 'active',
      priority: 'medium',
      color: '#3b82f6',
      icon: '📁',
      nextAction: '',
    })
    await createEntityLink('note', note.id, 'project', project.id)

    // Confirm relations exist before deletion
    expect(await getTagsForEntity('note', note.id)).toHaveLength(1)
    const linksBefore = await getEntityLinks('note', note.id)
    expect(linksBefore.outgoing).toHaveLength(1)

    // Permanently delete
    await deleteNotePermanently(note.id)

    expect(await getNoteById(note.id)).toBeUndefined()
    expect(await getTagsForEntity('note', note.id)).toHaveLength(0)
    const linksAfter = await getEntityLinks('note', note.id)
    expect(linksAfter.all).toHaveLength(0)
  })

  it('toggles note favorite status', async () => {
    const note = await createNote({ title: 'Favorite Test', isFavorite: false })

    const fav = await toggleNoteFavorite(note.id)
    expect(fav.isFavorite).toBe(true)
    expect(fav.revision).toBe(2)

    const unFav = await toggleNoteFavorite(note.id)
    expect(unFav.isFavorite).toBe(false)
    expect(unFav.revision).toBe(3)
  })

  it('searches active notes by title and plainText content', async () => {
    await createNote({
      title: 'Frontend Architecture Guide',
      plainText: 'Explaining React and Tailwind setup.',
      projectId: 'proj-p3',
    })
    await createNote({
      title: 'Backend Persistence',
      plainText: 'Explaining Dexie and IndexedDB transactions.',
      projectId: 'proj-p3',
    })
    await createNote({
      title: 'Trash Architecture Guide',
      plainText: 'Old guide.',
      projectId: 'proj-p3',
    })
    const trashNote = await createNote({
      title: 'Deleted Architecture Guide',
      plainText: 'Should not appear in search.',
    })
    await softDeleteNote(trashNote.id)

    const searchReact = await searchNotes('react')
    expect(searchReact).toHaveLength(1)
    expect(searchReact[0].title).toBe('Frontend Architecture Guide')

    const searchArch = await searchNotes('architecture')
    expect(searchArch).toHaveLength(2)

    const searchProjectScoped = await searchNotes('dexie', { projectId: 'proj-p3' })
    expect(searchProjectScoped).toHaveLength(1)
    expect(searchProjectScoped[0].title).toBe('Backend Persistence')
  })
})

// ─── 3. Optimistic Revision Checking ──────────────────────────────────────────

describe('Optimistic Revision Checking (Stale Write Prevention)', () => {
  it('prevents stale writes when expectedRevision does not match current revision', async () => {
    const note = await createNote({
      title: 'Concurrent Document',
      plainText: 'Version 1',
    })
    expect(note.revision).toBe(1)

    // Tab A updates the note successfully with expectedRevision = 1
    const tabAUpdate = await updateNote(note.id, {
      title: 'Concurrent Document (Tab A)',
      expectedRevision: 1,
    })
    expect(tabAUpdate.revision).toBe(2)

    // Tab B had read version 1 and tries to update with expectedRevision = 1
    await expect(
      updateNote(note.id, {
        title: 'Concurrent Document (Tab B Stale)',
        expectedRevision: 1,
      })
    ).rejects.toThrow(StaleWriteError)

    // Verify error properties
    try {
      await updateNote(note.id, {
        title: 'Concurrent Document (Tab B Stale)',
        expectedRevision: 1,
      })
      expect.fail('Should have thrown StaleWriteError')
    } catch (err) {
      expect(err).toBeInstanceOf(StaleWriteError)
      const staleErr = err as StaleWriteError
      expect(staleErr.code).toBe('STALE_WRITE')
      expect(staleErr.currentRevision).toBe(2)
      expect(staleErr.expectedRevision).toBe(1)
    }

    // Verify the document was not overwritten by Tab B
    const latest = await getNoteById(note.id)
    expect(latest?.title).toBe('Concurrent Document (Tab A)')
    expect(latest?.revision).toBe(2)

    // Tab B re-reads (current revision = 2) and updates with expectedRevision = 2
    const tabBResolved = await updateNote(note.id, {
      title: 'Concurrent Document (Tab B Rebased)',
      expectedRevision: 2,
    })
    expect(tabBResolved.title).toBe('Concurrent Document (Tab B Rebased)')
    expect(tabBResolved.revision).toBe(3)
  })
})

// ─── 4. Resource CRUD and Filtering ───────────────────────────────────────────

describe('Resource Operations and Filtering', () => {
  it('creates link, snippet, and file resources and retrieves them', async () => {
    const link = await createResource({
      type: 'link',
      title: 'Dexie Documentation',
      url: 'https://dexie.org',
      description: 'Official Dexie docs',
      projectId: 'proj-1',
    })
    expect(link.id).toBeDefined()
    expect(link.type).toBe('link')
    expect(link.url).toBe('https://dexie.org')

    const snippet = await createResource({
      type: 'snippet',
      title: 'UUID Generator',
      snippetContent: 'crypto.randomUUID()',
      language: 'typescript',
      projectId: 'proj-1',
    })
    expect(snippet.type).toBe('snippet')
    expect(snippet.language).toBe('typescript')

    const fileResource = await createResource({
      type: 'file',
      title: 'Database Architecture Diagram',
      attachmentId: 'att-123',
      projectId: 'proj-2',
      isFavorite: true,
    })
    expect(fileResource.type).toBe('file')
    expect(fileResource.isFavorite).toBe(true)

    // Filter by type
    const linksOnly = await getActiveResources({ type: 'link' })
    expect(linksOnly).toHaveLength(1)
    expect(linksOnly[0].id).toBe(link.id)

    const snippetsOnly = await getActiveResources({ type: 'snippet' })
    expect(snippetsOnly).toHaveLength(1)
    expect(snippetsOnly[0].id).toBe(snippet.id)

    // Filter by project
    const proj1Resources = await getActiveResources({ projectId: 'proj-1' })
    expect(proj1Resources).toHaveLength(2)

    // Filter by favorite
    const favResources = await getActiveResources({ isFavorite: true })
    expect(favResources).toHaveLength(1)
    expect(favResources[0].id).toBe(fileResource.id)
  })

  it('updates, soft-deletes, restores, and permanently deletes resources', async () => {
    const res = await createResource({
      type: 'link',
      title: 'Initial Title',
      url: 'https://example.com',
    })

    const updated = await updateResource(res.id, {
      title: 'Updated Title',
      description: 'New Description',
    })
    expect(updated.title).toBe('Updated Title')
    expect(updated.description).toBe('New Description')

    // Soft delete
    await softDeleteResource(res.id)
    expect((await getActiveResources()).some((r) => r.id === res.id)).toBe(false)
    expect((await getTrashResources()).some((r) => r.id === res.id)).toBe(true)

    // Restore
    await restoreResource(res.id)
    expect((await getActiveResources()).some((r) => r.id === res.id)).toBe(true)
    expect((await getTrashResources()).some((r) => r.id === res.id)).toBe(false)

    // Toggle favorite
    const fav = await toggleResourceFavorite(res.id)
    expect(fav.isFavorite).toBe(true)

    // Permanent delete
    await deleteResourcePermanently(res.id)
    expect(await getResourceById(res.id)).toBeUndefined()
  })

  it('searches resources across title, description, url, and snippet content', async () => {
    await createResource({
      type: 'link',
      title: 'Vite Build Tool',
      url: 'https://vite.dev',
      description: 'Next Generation Frontend Tooling',
    })
    await createResource({
      type: 'snippet',
      title: 'React Query Hook',
      snippetContent: 'const { data } = useQuery(...)',
      language: 'typescript',
    })

    const searchVite = await searchResources('vite')
    expect(searchVite).toHaveLength(1)
    expect(searchVite[0].title).toBe('Vite Build Tool')

    const searchSnippet = await searchResources('useQuery')
    expect(searchSnippet).toHaveLength(1)
    expect(searchSnippet[0].title).toBe('React Query Hook')
  })
})

// ─── 5. Attachment Save and Retrieve (Blob) ───────────────────────────────────

describe('Attachment Persistence', () => {
  it('saves, retrieves, and deletes binary Blob attachments', async () => {
    const content = 'ALTERA Knowledge Hub Spec 2026'
    const blob = new Blob([content], { type: 'text/markdown' })

    const attachment = await saveAttachment({
      filename: 'spec.md',
      mimeType: 'text/markdown',
      blob,
      size: blob.size,
    })

    expect(attachment.id).toBeDefined()
    expect(attachment.filename).toBe('spec.md')
    expect(attachment.mimeType).toBe('text/markdown')
    expect(attachment.size).toBe(blob.size)
    expect(attachment.createdAt).toBeInstanceOf(Date)

    const retrieved = await getAttachment(attachment.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.filename).toBe('spec.md')

    const readText = await retrieved!.blob.text()
    expect(readText).toBe(content)

    await deleteAttachment(attachment.id)
    expect(await getAttachment(attachment.id)).toBeUndefined()
  })
})

// ─── 6. Tag Operations & Normalization ────────────────────────────────────────

describe('Tag Operations', () => {
  it('creates and normalizes tags, rejecting duplicate names', async () => {
    const tag1 = await createTag({ name: '  TypeScript  ', color: '#3178c6' })
    expect(tag1.name).toBe('TypeScript')
    expect(tag1.normalizedName).toBe('typescript')
    expect(tag1.color).toBe('#3178c6')

    // Reject exact duplicate
    await expect(createTag({ name: 'TypeScript' })).rejects.toThrow(DuplicateTagError)

    // Reject case-insensitive duplicate
    await expect(createTag({ name: 'typescript' })).rejects.toThrow(DuplicateTagError)
    await expect(createTag({ name: '  TYPESCRIPT  ' })).rejects.toThrow(DuplicateTagError)

    // Reject empty tag name
    await expect(createTag({ name: '   ' })).rejects.toThrow('Tag name cannot be empty')
  })

  it('getOrCreateTag returns existing tag or creates new tag', async () => {
    const created = await getOrCreateTag('React', '#61dafb')
    expect(created.name).toBe('React')

    const retrieved = await getOrCreateTag('react')
    expect(retrieved.id).toBe(created.id)

    const allTags = await getTags()
    expect(allTags).toHaveLength(1)
  })

  it('assigns tags to entities and allows querying tags and entities', async () => {
    const tagArch = await createTag({ name: 'Architecture' })
    const tagDb = await createTag({ name: 'Database' })

    const note = await createNote({ title: 'Schema Spec' })

    await assignTag(tagArch.id, 'note', note.id)
    await assignTag(tagDb.id, 'note', note.id)

    // Duplicate assignment should be idempotent and not throw
    const duplicate = await assignTag(tagArch.id, 'note', note.id)
    expect(duplicate.tagId).toBe(tagArch.id)

    const tags = await getTagsForEntity('note', note.id)
    expect(tags).toHaveLength(2)
    expect(tags.map((t) => t.name)).toContain('Architecture')
    expect(tags.map((t) => t.name)).toContain('Database')

    const entities = await getEntitiesForTag(tagArch.id)
    expect(entities).toHaveLength(1)
    expect(entities[0].entityId).toBe(note.id)

    // Remove one tag
    await removeTagAssignment(tagArch.id, 'note', note.id)
    const remainingTags = await getTagsForEntity('note', note.id)
    expect(remainingTags).toHaveLength(1)
    expect(remainingTags[0].name).toBe('Database')
  })

  it('setEntityTags synchronizes tags atomically', async () => {
    const t1 = await createTag({ name: 'Tag 1' })
    const t2 = await createTag({ name: 'Tag 2' })
    const t3 = await createTag({ name: 'Tag 3' })

    const note = await createNote({ title: 'Sync Tags Test' })

    // Set initial tags [t1, t2]
    await setEntityTags('note', note.id, [t1.id, t2.id])
    let tags = await getTagsForEntity('note', note.id)
    expect(tags.map((t) => t.name).sort()).toEqual(['Tag 1', 'Tag 2'])

    // Update tags to [t2, t3] (t1 removed, t3 added)
    await setEntityTags('note', note.id, [t2.id, t3.id])
    tags = await getTagsForEntity('note', note.id)
    expect(tags.map((t) => t.name).sort()).toEqual(['Tag 2', 'Tag 3'])
  })

  it('deleting a tag cascades and cleans up tag assignments', async () => {
    const tag = await createTag({ name: 'Deprecated Tag' })
    const note = await createNote({ title: 'Tagged note', tagIds: [tag.id] })

    expect(await getTagsForEntity('note', note.id)).toHaveLength(1)

    await deleteTag(tag.id)

    expect(await getTagsForEntity('note', note.id)).toHaveLength(0)
    expect(await getEntitiesForTag(tag.id)).toHaveLength(0)
  })
})

// ─── 7. EntityLink Operations ─────────────────────────────────────────────────

describe('EntityLink Operations', () => {
  it('creates links between entities, prevents self-links and duplicates', async () => {
    const note = await createNote({ title: 'Sprint Retrospective' })
    const project = await createProject({
      name: 'Link target project',
      description: '',
      status: 'active',
      priority: 'medium',
      color: '#3b82f6',
      icon: '📁',
      nextAction: '',
    })
    const task = await createTask({
      projectId: project.id,
      title: 'Link target task',
      status: 'todo',
      priority: 'medium',
    })

    // Prevent self-linking
    await expect(
      createEntityLink('note', note.id, 'note', note.id)
    ).rejects.toThrow('Cannot link an entity to itself')

    // Create valid link: note -> task
    const link = await createEntityLink('note', note.id, 'task', task.id)
    expect(link.id).toBeDefined()
    expect(link.sourceType).toBe('note')
    expect(link.sourceId).toBe(note.id)
    expect(link.targetType).toBe('task')
    expect(link.targetId).toBe(task.id)

    // Duplicate link prevention
    await expect(
      createEntityLink('note', note.id, 'task', task.id)
    ).rejects.toThrow(DuplicateEntityLinkError)
  })

  it('supports bidirectional link querying (outgoing and incoming backlinks)', async () => {
    const note = await createNote({ title: 'Feature Specification' })
    const resource = await createResource({
      type: 'link',
      title: 'API Reference',
      url: 'https://api.example.com',
    })

    // Link note (source) -> resource (target)
    await createEntityLink('note', note.id, 'resource', resource.id)

    // Note perspective: outgoing link to resource
    const noteLinks = await getEntityLinks('note', note.id)
    expect(noteLinks.outgoing).toHaveLength(1)
    expect(noteLinks.outgoing[0].targetId).toBe(resource.id)
    expect(noteLinks.incoming).toHaveLength(0)
    expect(noteLinks.all).toHaveLength(1)

    // Resource perspective: incoming backlink from note
    const resourceLinks = await getEntityLinks('resource', resource.id)
    expect(resourceLinks.incoming).toHaveLength(1)
    expect(resourceLinks.incoming[0].sourceId).toBe(note.id)
    expect(resourceLinks.outgoing).toHaveLength(0)
    expect(resourceLinks.all).toHaveLength(1)

    // Deleting link clears both perspectives
    await deleteEntityLink(noteLinks.outgoing[0].id)

    expect((await getEntityLinks('note', note.id)).all).toHaveLength(0)
    expect((await getEntityLinks('resource', resource.id)).all).toHaveLength(0)
  })
})

// ─── 8. Atomic Transactions & Cascading Cleanup ───────────────────────────────

describe('Atomic Transactions and Cleanup', () => {
  it('cleans up connections for an entity via cleanupEntityConnections', async () => {
    const tag = await createTag({ name: 'Sprint 1' })
    const note1 = await createNote({ title: 'Note 1' })
    const note2 = await createNote({ title: 'Note 2' })

    await assignTag(tag.id, 'note', note1.id)
    await createEntityLink('note', note1.id, 'note', note2.id) // outgoing
    await createEntityLink('note', note2.id, 'note', note1.id) // incoming

    expect(await getTagsForEntity('note', note1.id)).toHaveLength(1)
    const linksBefore = await getEntityLinks('note', note1.id)
    expect(linksBefore.outgoing).toHaveLength(1)
    expect(linksBefore.incoming).toHaveLength(1)

    await cleanupEntityConnections('note', note1.id)

    expect(await getTagsForEntity('note', note1.id)).toHaveLength(0)
    const linksAfter = await getEntityLinks('note', note1.id)
    expect(linksAfter.all).toHaveLength(0)
  })

  it('cascades attachment deletion when resource is permanently deleted', async () => {
    const blob = new Blob(['attachment data'], { type: 'text/plain' })
    const attachment = await saveAttachment({
      filename: 'file.txt',
      mimeType: 'text/plain',
      blob,
    })

    const resource = await createResource({
      type: 'file',
      title: 'Resource with file',
      attachmentId: attachment.id,
    })

    expect(await getAttachment(attachment.id)).toBeDefined()

    await deleteResourcePermanently(resource.id)

    expect(await getResourceById(resource.id)).toBeUndefined()
    expect(await getAttachment(attachment.id)).toBeUndefined()
  })

  it('rolls back note creation and tag assignment if transaction fails', async () => {
    const initialNotesCount = await db.notes.count()
    const initialAssignmentsCount = await db.tagAssignments.count()

    vi.spyOn(db.notes, 'add').mockRejectedValueOnce(new Error('Simulated disk full'))

    await expect(
      createNote({
        title: 'Failing Note',
        tagIds: ['tag-fake'],
      })
    ).rejects.toThrow('Simulated disk full')

    expect(await db.notes.count()).toBe(initialNotesCount)
    expect(await db.tagAssignments.count()).toBe(initialAssignmentsCount)
  })

  it('clearAllData wipes all tables including v3 knowledge hub tables', async () => {
    await createNote({ title: 'Wipe Note' })
    await createResource({ type: 'link', title: 'Wipe Resource' })
    await createTag({ name: 'Wipe Tag' })

    expect(await db.notes.count()).toBeGreaterThan(0)
    expect(await db.resources.count()).toBeGreaterThan(0)
    expect(await db.tags.count()).toBeGreaterThan(0)

    await clearAllData()

    expect(await Promise.all([
      db.projects.count(),
      db.tasks.count(),
      db.activities.count(),
      db.sessions.count(),
      db.notes.count(),
      db.resources.count(),
      db.attachments.count(),
      db.tags.count(),
      db.tagAssignments.count(),
      db.entityLinks.count(),
    ])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

// ─── 9. Aggregate Knowledge Counts ───────────────────────────────────────────

describe('Aggregate Knowledge Counts', () => {
  it('correctly counts active notes, resources, favorites, and trash scoped by project', async () => {
    // Project A
    await createNote({ title: 'A1', projectId: 'pA', isFavorite: true })
    await createNote({ title: 'A2', projectId: 'pA', isFavorite: false })
    const n3 = await createNote({ title: 'A3', projectId: 'pA' })
    await softDeleteNote(n3.id)

    await createResource({ type: 'link', title: 'R1', projectId: 'pA', isFavorite: true })
    const r2 = await createResource({ type: 'snippet', title: 'R2', projectId: 'pA' })
    await softDeleteResource(r2.id)

    // Project B
    await createNote({ title: 'B1', projectId: 'pB', isFavorite: false })

    // Project A counts
    const pACounts = await getKnowledgeCounts('pA')
    expect(pACounts.notes).toBe(2) // n1, n2
    expect(pACounts.resources).toBe(1) // r1
    expect(pACounts.favorites).toBe(2) // n1, r1
    expect(pACounts.trash).toBe(2) // n3, r2

    // Global counts (no projectId)
    const globalCounts = await getKnowledgeCounts()
    expect(globalCounts.notes).toBe(3) // n1, n2, b1
    expect(globalCounts.resources).toBe(1) // r1
    expect(globalCounts.favorites).toBe(2) // n1, r1
    expect(globalCounts.trash).toBe(2) // n3, r2
  })
})
