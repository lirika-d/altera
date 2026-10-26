/**
 * relationships.test.ts — Unit & Integration tests for Tags & Entity Relationships.
 *
 * Verifies:
 * 1. Tag assignment, removal, cascading cleanup, and color palette.
 * 2. Duplicate link prevention & self-link prevention.
 * 3. Bidirectional links and backlink querying.
 * 4. Graceful handling of missing and soft-deleted entities.
 * 5. Cyclic relationship handling without infinite loops.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, generateId } from '@/db/db'
import {
  createTag,
  assignTag,
  removeTagAssignment,
  getTagsForEntity,
  setEntityTags,
  deleteTag,
  createEntityLink,
  deleteEntityLink,
  getEntityLinks,
  DuplicateEntityLinkError,
} from '@/db/knowledge'
import {
  resolveEntity,
  getEntityTypeConfig,
} from './entityResolver'
import {
  getTagColorOption,
  TAG_COLOR_PALETTE,
} from '../tags/tagColors'
import type {
  Project,
  Task,
  Note,
  Resource,
  Session,
} from '@/types'

async function addTestEntity(type: 'project' | 'task' | 'session' | 'note' | 'resource', id: string): Promise<void> {
  const now = new Date()
  if (type === 'project') {
    const project: Project = {
      id,
      identifier: `ALT-${id.slice(0, 8)}`,
      name: 'Relationship test project',
      description: '',
      status: 'active',
      priority: 'medium',
      color: '#3b82f6',
      icon: '📁',
      progress: 0,
      nextAction: '',
      createdAt: now,
      updatedAt: now,
    }
    await db.projects.put(project)
    return
  }
  if (type === 'task') {
    const projectId = generateId()
    await addTestEntity('project', projectId)
    const task: Task = {
      id,
      projectId,
      title: 'Relationship test task',
      status: 'todo',
      priority: 'medium',
      order: 0,
      createdAt: now,
      updatedAt: now,
    }
    await db.tasks.put(task)
    return
  }
  if (type === 'session') {
    const projectId = generateId()
    await addTestEntity('project', projectId)
    const session: Session = {
      id,
      projectId,
      title: 'Relationship test session',
      objective: '',
      status: 'completed',
      startedAt: now,
      endedAt: now,
      lastResumedAt: now,
      accumulatedDurationMs: 0,
      accomplishments: '',
      blockers: '',
      nextStep: '',
      outcome: '',
      createdAt: now,
      updatedAt: now,
    }
    await db.sessions.put(session)
    return
  }
  if (type === 'note') {
    const note: Note = {
      id,
      title: 'Relationship test note',
      contentJSON: '{}',
      plainText: '',
      isFavorite: false,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }
    await db.notes.put(note)
    return
  }
  const resource: Resource = {
    id,
    type: 'link',
    title: 'Relationship test resource',
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.resources.put(resource)
}

describe('Tags & Entity Relationships Engine', () => {
  beforeEach(async () => {
    // Reset test database tables
    await db.tags.clear()
    await db.tagAssignments.clear()
    await db.entityLinks.clear()
    await db.projects.clear()
    await db.tasks.clear()
    await db.sessions.clear()
    await db.notes.clear()
    await db.resources.clear()
  })

  // ─── 1. TAG PALETTE & ASSIGNMENT TESTS ─────────────────────────────────────
  describe('Tag Palette & Formatting', () => {
    it('defines the 8 standard colors (blue, green, purple, amber, red, cyan, pink, gray)', () => {
      const paletteIds = TAG_COLOR_PALETTE.map((c) => c.id)
      expect(paletteIds).toEqual([
        'blue',
        'green',
        'purple',
        'amber',
        'red',
        'cyan',
        'pink',
        'gray',
      ])
    })

    it('resolves color options by id, hex, or name case-insensitively', () => {
      expect(getTagColorOption('blue').color).toBe('#3b82f6')
      expect(getTagColorOption('#10b981').id).toBe('green')
      expect(getTagColorOption('PURPLE').id).toBe('purple')
      expect(getTagColorOption(undefined).id).toBe('blue')
    })

    it('returns custom color object for arbitrary hex color', () => {
      const custom = getTagColorOption('#123456')
      expect(custom.id).toBe('custom')
      expect(custom.color).toBe('#123456')
    })
  })

  describe('Tag Assignment & Persistence', () => {
    it('creates tags and assigns them to an entity', async () => {
      const tag1 = await createTag({ name: 'Architecture', color: '#8b5cf6' })
      const tag2 = await createTag({ name: 'Frontend', color: '#3b82f6' })

      const noteId = generateId()
      await addTestEntity('note', noteId)

      const a1 = await assignTag(tag1.id, 'note', noteId)
      expect(a1.tagId).toBe(tag1.id)
      expect(a1.entityId).toBe(noteId)

      await assignTag(tag2.id, 'note', noteId)

      const tags = await getTagsForEntity('note', noteId)
      expect(tags).toHaveLength(2)
      expect(tags.map((t) => t.name)).toEqual(['Architecture', 'Frontend'])
    })

    it('prevents duplicate tag assignments for the same entity idempotently', async () => {
      const tag = await createTag({ name: 'Database' })
      const taskId = generateId()
      await addTestEntity('task', taskId)

      const first = await assignTag(tag.id, 'task', taskId)
      const second = await assignTag(tag.id, 'task', taskId)

      expect(first.id).toBe(second.id)

      const assigned = await getTagsForEntity('task', taskId)
      expect(assigned).toHaveLength(1)
    })

    it('removes tag assignments cleanly', async () => {
      const tag = await createTag({ name: 'UI' })
      const projectId = generateId()
      await addTestEntity('project', projectId)

      await assignTag(tag.id, 'project', projectId)
      let tags = await getTagsForEntity('project', projectId)
      expect(tags).toHaveLength(1)

      await removeTagAssignment(tag.id, 'project', projectId)
      tags = await getTagsForEntity('project', projectId)
      expect(tags).toHaveLength(0)
    })

    it('replaces all entity tags atomically via setEntityTags', async () => {
      const tagA = await createTag({ name: 'Alpha' })
      const tagB = await createTag({ name: 'Beta' })
      const tagC = await createTag({ name: 'Gamma' })

      const resourceId = generateId()
      await addTestEntity('resource', resourceId)

      await setEntityTags('resource', resourceId, [tagA.id, tagB.id])
      let tags = await getTagsForEntity('resource', resourceId)
      expect(tags.map((t) => t.name)).toEqual(['Alpha', 'Beta'])

      // Update to tagB and tagC (removing tagA)
      await setEntityTags('resource', resourceId, [tagB.id, tagC.id])
      tags = await getTagsForEntity('resource', resourceId)
      expect(tags.map((t) => t.name)).toEqual(['Beta', 'Gamma'])
    })

    it('deleting a tag cascades and removes all entity assignments', async () => {
      const tag = await createTag({ name: 'Temporary' })
      const noteId = generateId()
      const taskId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('task', taskId)

      await assignTag(tag.id, 'note', noteId)
      await assignTag(tag.id, 'task', taskId)

      expect(await getTagsForEntity('note', noteId)).toHaveLength(1)
      expect(await getTagsForEntity('task', taskId)).toHaveLength(1)

      await deleteTag(tag.id)

      expect(await getTagsForEntity('note', noteId)).toHaveLength(0)
      expect(await getTagsForEntity('task', taskId)).toHaveLength(0)

      const remainingAssignments = await db.tagAssignments.where('tagId').equals(tag.id).toArray()
      expect(remainingAssignments).toHaveLength(0)
    })
  })

  // ─── 2. ENTITY LINKS & DUPLICATE PREVENTION TESTS ──────────────────────────
  describe('Entity Link Creation & Duplicate Prevention', () => {
    it('creates outgoing entity link between Note and Project', async () => {
      const noteId = generateId()
      const projectId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('project', projectId)

      const link = await createEntityLink('note', noteId, 'project', projectId)
      expect(link.id).toBeDefined()
      expect(link.sourceType).toBe('note')
      expect(link.sourceId).toBe(noteId)
      expect(link.targetType).toBe('project')
      expect(link.targetId).toBe(projectId)

      const links = await getEntityLinks('note', noteId)
      expect(links.outgoing).toHaveLength(1)
      expect(links.outgoing[0].targetId).toBe(projectId)
    })

    it('prevents self-links and throws descriptive error', async () => {
      const noteId = generateId()
      await expect(
        createEntityLink('note', noteId, 'note', noteId)
      ).rejects.toThrow('Cannot link an entity to itself')
    })

    it('rejects a link when either endpoint is missing', async () => {
      const noteId = generateId()
      const projectId = generateId()
      const missingProjectId = generateId()
      const missingNoteId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('project', projectId)

      await expect(createEntityLink('note', noteId, 'project', missingProjectId)).rejects.toThrow('Missing project entity')
      await expect(createEntityLink('note', missingNoteId, 'project', projectId)).rejects.toThrow('Missing note entity')
      expect(await db.entityLinks.count()).toBe(0)
    })

    it('prevents duplicate links and throws DuplicateEntityLinkError', async () => {
      const noteId = generateId()
      const taskId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('task', taskId)

      await createEntityLink('note', noteId, 'task', taskId)

      await expect(
        createEntityLink('note', noteId, 'task', taskId)
      ).rejects.toThrow(DuplicateEntityLinkError)
    })

    it('serializes concurrent duplicate link attempts', async () => {
      const noteId = generateId()
      const projectId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('project', projectId)

      const results = await Promise.allSettled([
        createEntityLink('note', noteId, 'project', projectId),
        createEntityLink('note', noteId, 'project', projectId),
      ])

      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      const rejection = results.find(result => result.status === 'rejected')
      expect(rejection?.status === 'rejected' && rejection.reason).toBeInstanceOf(DuplicateEntityLinkError)
      expect(await db.entityLinks.count()).toBe(1)
    })

    it('allows reciprocal bidirectional links (A -> B and B -> A)', async () => {
      const noteA = generateId()
      const noteB = generateId()
      await addTestEntity('note', noteA)
      await addTestEntity('note', noteB)

      const link1 = await createEntityLink('note', noteA, 'note', noteB)
      const link2 = await createEntityLink('note', noteB, 'note', noteA)

      expect(link1.id).toBeDefined()
      expect(link2.id).toBeDefined()
      expect(link1.id).not.toBe(link2.id)
    })

    it('deletes an entity link cleanly', async () => {
      const noteId = generateId()
      const sessionId = generateId()
      await addTestEntity('note', noteId)
      await addTestEntity('session', sessionId)

      const link = await createEntityLink('note', noteId, 'session', sessionId)
      expect((await getEntityLinks('note', noteId)).outgoing).toHaveLength(1)

      await deleteEntityLink(link.id)
      expect((await getEntityLinks('note', noteId)).outgoing).toHaveLength(0)
    })
  })

  // ─── 3. BIDIRECTIONAL LINKS & BACKLINKS QUERYING ──────────────────────────
  describe('Bidirectional Links & Backlink Querying', () => {
    it('correctly maps outgoing and incoming links for both endpoints', async () => {
      const projectId = generateId()
      const noteId = generateId()
      await addTestEntity('project', projectId)
      await addTestEntity('note', noteId)

      // Project links to Note
      await createEntityLink('project', projectId, 'note', noteId)

      // Project perspective:
      const projectLinks = await getEntityLinks('project', projectId)
      expect(projectLinks.outgoing).toHaveLength(1)
      expect(projectLinks.incoming).toHaveLength(0)
      expect(projectLinks.outgoing[0].targetId).toBe(noteId)

      // Note perspective (backlink):
      const noteLinks = await getEntityLinks('note', noteId)
      expect(noteLinks.outgoing).toHaveLength(0)
      expect(noteLinks.incoming).toHaveLength(1)
      expect(noteLinks.incoming[0].sourceType).toBe('project')
      expect(noteLinks.incoming[0].sourceId).toBe(projectId)
    })

    it('aggregates multiple incoming backlinks across different entity types', async () => {
      const targetNoteId = generateId()

      const pId = generateId()
      const tId = generateId()
      const sId = generateId()
      const otherNoteId = generateId()
      await addTestEntity('note', targetNoteId)
      await addTestEntity('project', pId)
      await addTestEntity('task', tId)
      await addTestEntity('session', sId)
      await addTestEntity('note', otherNoteId)

      // 4 different entities link to targetNote
      await createEntityLink('project', pId, 'note', targetNoteId)
      await createEntityLink('task', tId, 'note', targetNoteId)
      await createEntityLink('session', sId, 'note', targetNoteId)
      await createEntityLink('note', otherNoteId, 'note', targetNoteId)

      const { incoming, outgoing, all } = await getEntityLinks('note', targetNoteId)

      expect(incoming).toHaveLength(4)
      expect(outgoing).toHaveLength(0)
      expect(all).toHaveLength(4)

      const sourceTypes = incoming.map((l) => l.sourceType).sort()
      expect(sourceTypes).toEqual(['note', 'project', 'session', 'task'])
    })

    it('allows different typed relationships when endpoint IDs coincide', async () => {
      const sharedSourceId = generateId()
      const sharedTargetId = generateId()
      await addTestEntity('note', sharedSourceId)
      await addTestEntity('resource', sharedSourceId)
      await addTestEntity('project', sharedTargetId)
      await addTestEntity('note', sharedTargetId)

      await createEntityLink('note', sharedSourceId, 'project', sharedTargetId)
      await expect(createEntityLink('resource', sharedSourceId, 'note', sharedTargetId)).resolves.toMatchObject({
        sourceType: 'resource',
        sourceId: sharedSourceId,
        targetType: 'note',
        targetId: sharedTargetId,
      })
      expect(await db.entityLinks.count()).toBe(2)
    })
  })

  // ─── 4. ENTITY RESOLUTION & DELETED ENTITY HANDLING ───────────────────────
  describe('Entity Resolution & Graceful Missing Handling', () => {
    it('resolves real Project metadata with icon and identifier', async () => {
      const project: Project = {
        id: generateId(),
        identifier: 'ALT-101',
        name: 'Phase 3 Hub',
        description: 'Knowledge management overhaul',
        status: 'active',
        priority: 'high',
        color: '#3b82f6',
        icon: '🚀',
        progress: 75,
        nextAction: 'Build UI',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.projects.add(project)

      const resolved = await resolveEntity('project', project.id)
      expect(resolved.isDeleted).toBe(false)
      expect(resolved.title).toBe('Phase 3 Hub')
      expect(resolved.identifier).toBe('ALT-101')
      expect(resolved.icon).toBe('🚀')
      expect(resolved.routeUrl).toBe(`/projects/${project.id}`)
    })

    it('resolves real Task with parent Project identifier', async () => {
      const project: Project = {
        id: generateId(),
        identifier: 'ALT-202',
        name: 'Parent Project',
        description: '',
        status: 'active',
        priority: 'medium',
        color: '#10b981',
        icon: '📁',
        progress: 50,
        nextAction: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.projects.add(project)

      const task: Task = {
        id: generateId(),
        projectId: project.id,
        title: 'Implement entity linker',
        status: 'in_progress',
        priority: 'high',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.tasks.add(task)

      const resolved = await resolveEntity('task', task.id)
      expect(resolved.isDeleted).toBe(false)
      expect(resolved.title).toBe('Implement entity linker')
      expect(resolved.identifier).toBe('ALT-202')
      expect(resolved.status).toBe('in_progress')
    })

    it('gracefully resolves deleted or non-existent entity without throwing', async () => {
      const nonExistentId = 'missing-id-999'

      const resolvedProj = await resolveEntity('project', nonExistentId)
      expect(resolvedProj.isDeleted).toBe(true)
      expect(resolvedProj.title).toBe('Entity no longer exists')

      const resolvedTask = await resolveEntity('task', nonExistentId)
      expect(resolvedTask.isDeleted).toBe(true)
      expect(resolvedTask.title).toBe('Entity no longer exists')

      const resolvedSession = await resolveEntity('session', nonExistentId)
      expect(resolvedSession.isDeleted).toBe(true)
      expect(resolvedSession.title).toBe('Entity no longer exists')
    })

    it('treats soft-deleted notes and resources as deleted', async () => {
      const note: Note = {
        id: generateId(),
        title: 'Trashed Note',
        contentJSON: '{}',
        plainText: 'hello',
        isFavorite: false,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(), // soft deleted
      }
      await db.notes.add(note)

      const resolvedNote = await resolveEntity('note', note.id)
      expect(resolvedNote.isDeleted).toBe(true)
      expect(resolvedNote.title).toBe('Entity no longer exists')

      const resource: Resource = {
        id: generateId(),
        type: 'link',
        title: 'Trashed Resource',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(), // soft deleted
      }
      await db.resources.add(resource)

      const resolvedResource = await resolveEntity('resource', resource.id)
      expect(resolvedResource.isDeleted).toBe(true)
      expect(resolvedResource.title).toBe('Entity no longer exists')
    })
  })

  // ─── 5. RECURSION & CYCLIC LINK SAFETY ─────────────────────────────────────
  describe('Recursion and Cycle Safety', () => {
    it('supports circular note relationships without infinite loops', async () => {
      const note1: Note = {
        id: generateId(),
        title: 'Note 1',
        contentJSON: '{}',
        plainText: 'Points to Note 2',
        isFavorite: false,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const note2: Note = {
        id: generateId(),
        title: 'Note 2',
        contentJSON: '{}',
        plainText: 'Points back to Note 1',
        isFavorite: false,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.notes.bulkAdd([note1, note2])

      // Mutual links Note 1 <-> Note 2
      await createEntityLink('note', note1.id, 'note', note2.id)
      await createEntityLink('note', note2.id, 'note', note1.id)

      const links1 = await getEntityLinks('note', note1.id)
      const links2 = await getEntityLinks('note', note2.id)

      expect(links1.outgoing[0].targetId).toBe(note2.id)
      expect(links1.incoming[0].sourceId).toBe(note2.id)

      expect(links2.outgoing[0].targetId).toBe(note1.id)
      expect(links2.incoming[0].sourceId).toBe(note1.id)

      // Resolution terminates immediately in O(1) without nested queries
      const res1 = await resolveEntity('note', note1.id)
      const res2 = await resolveEntity('note', note2.id)
      expect(res1.title).toBe('Note 1')
      expect(res2.title).toBe('Note 2')
    })
  })

  // ─── 6. UI TYPE CONFIGURATION ──────────────────────────────────────────────
  describe('Entity Type Configurations', () => {
    it('returns valid UI metadata for all 5 entity types', () => {
      const types = ['project', 'task', 'session', 'note', 'resource'] as const
      for (const t of types) {
        const config = getEntityTypeConfig(t)
        expect(config.label).toBeDefined()
        expect(config.icon).toBeDefined()
        expect(config.badgeColor).toContain('bg-')
      }
    })
  })
})
