/**
 * projectIntegration.test.ts — Unit & Integration tests for Knowledge Hub Integration
 * with Project Workspace, Work Sessions, Tasks, and Dashboard.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db'
import {
  createNote,
  createResource,
  saveAttachment,
  createEntityLink,
  deleteEntityLink,
  getEntityLinks,
  getActiveNotes,
  getActiveResources,
} from '@/db/knowledge'
import * as ProjectIntegrationExports from './index'

async function addProject(id: string): Promise<void> {
  const now = new Date()
  await db.projects.put({
    id,
    identifier: `IT-${id}`,
    name: id,
    description: '',
    status: 'active',
    priority: 'medium',
    color: '#3b82f6',
    icon: '📁',
    progress: 0,
    nextAction: '',
    createdAt: now,
    updatedAt: now,
  })
}

async function addTask(id: string, projectId: string): Promise<void> {
  const now = new Date()
  await addProject(projectId)
  await db.tasks.put({
    id,
    projectId,
    title: id,
    status: 'todo',
    priority: 'medium',
    order: 0,
    createdAt: now,
    updatedAt: now,
  })
}

async function addSession(id: string, projectId: string): Promise<void> {
  const now = new Date()
  await addProject(projectId)
  await db.sessions.put({
    id,
    projectId,
    title: id,
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
  })
}

describe('Project Integration Components & Workflows', () => {
  beforeEach(async () => {
    await db.projects.clear()
    await db.tasks.clear()
    await db.sessions.clear()
    await db.notes.clear()
    await db.resources.clear()
    await db.attachments.clear()
    await db.entityLinks.clear()
    await db.tagAssignments.clear()
    await db.tags.clear()
  })

  describe('Module Exports', () => {
    it('exports all expected integration components', () => {
      expect(ProjectIntegrationExports.ProjectKnowledgeTab).toBeDefined()
      expect(ProjectIntegrationExports.SessionKnowledgeLinks).toBeDefined()
      expect(ProjectIntegrationExports.DashboardKnowledgeWidget).toBeDefined()
      expect(ProjectIntegrationExports.TaskKnowledgeLinks).toBeDefined()
    })
  })

  describe('Project Knowledge Scoping Logic', () => {
    it('accurately identifies direct project notes and entity-linked notes', async () => {
      const projId = 'proj-alpha'
      await addProject(projId)
      await addProject('proj-beta')

      // Direct project note
      await createNote({
        title: 'Alpha Architecture RFC',
        projectId: projId,
        contentJSON: '{"type":"doc","content":[]}',
        plainText: 'Architecture spec',
      })

      // Global note linked to project via EntityLink
      const globalNote = await createNote({
        title: 'Global Performance Guidelines',
        contentJSON: '{"type":"doc","content":[]}',
        plainText: 'Performance rules',
      })
      await createEntityLink('project', projId, 'note', globalNote.id)

      // Another project's note (should not be included)
      await createNote({
        title: 'Beta Roadmap',
        projectId: 'proj-beta',
      })

      // Query all notes & entity links
      const allNotes = await getActiveNotes()
      const links = await getEntityLinks('project', projId)

      const linkedNoteIds = new Set(
        links.all
          .filter(
            (l) =>
              (l.sourceType === 'note' && l.targetType === 'project' && l.targetId === projId) ||
              (l.targetType === 'note' && l.sourceType === 'project' && l.sourceId === projId)
          )
          .map((l) => (l.sourceType === 'note' ? l.sourceId : l.targetId))
      )

      const projectNotes = allNotes.filter(
        (n) => !n.deletedAt && (n.projectId === projId || linkedNoteIds.has(n.id))
      )

      expect(projectNotes).toHaveLength(2)
      const noteTitles = projectNotes.map((n) => n.title)
      expect(noteTitles).toContain('Alpha Architecture RFC')
      expect(noteTitles).toContain('Global Performance Guidelines')
      expect(noteTitles).not.toContain('Beta Roadmap')
    })

    it('accurately scopes resources and resolves file attachments', async () => {
      const projId = 'proj-gamma'
      await addProject(projId)

      // Save an attachment
      const attachment = await saveAttachment({
        filename: 'architecture.pdf',
        mimeType: 'application/pdf',
        blob: new Blob(['fake-pdf-content'], { type: 'application/pdf' }),
        size: 1024,
      })

      // Create a file resource attached to project
      await createResource({
        type: 'file',
        title: 'Architecture Blueprint',
        projectId: projId,
        attachmentId: attachment.id,
      })

      // Create a web link resource attached to project
      await createResource({
        type: 'link',
        title: 'API Docs',
        url: 'https://api.example.com',
        projectId: projId,
      })

      // Query resources for projId
      const projectResources = await getActiveResources({ projectId: projId })
      expect(projectResources).toHaveLength(2)

      const attachmentIds = projectResources
        .map((r) => r.attachmentId)
        .filter((id): id is string => !!id)

      expect(attachmentIds).toEqual([attachment.id])

      const foundAttachments = await db.attachments.where('id').anyOf(attachmentIds).toArray()
      expect(foundAttachments).toHaveLength(1)
      expect(foundAttachments[0].filename).toBe('architecture.pdf')
    })
  })

  describe('Session Knowledge Links & Auto-Titled Notes', () => {
    it('creates a pre-titled session note linked to both session and project', async () => {
      const projId = 'proj-delta'
      const sessionId = 'session-123'
      const sessionTitle = 'Implement OAuth Flow'
      await addSession(sessionId, projId)

      // Create pre-titled session note
      const noteTitle = `Session Notes — ${sessionTitle}`
      const note = await createNote({
        title: noteTitle,
        projectId: projId,
        contentJSON: '{"type":"doc","content":[]}',
        plainText: '',
      })

      // Create link
      const link = await createEntityLink('session', sessionId, 'note', note.id)

      expect(note.title).toBe('Session Notes — Implement OAuth Flow')
      expect(note.projectId).toBe(projId)
      expect(link.sourceType).toBe('session')
      expect(link.sourceId).toBe(sessionId)
      expect(link.targetType).toBe('note')
      expect(link.targetId).toBe(note.id)

      // Verify query via getEntityLinks
      const links = await getEntityLinks('session', sessionId)
      expect(links.all).toHaveLength(1)
      expect(links.all[0].targetId).toBe(note.id)
    })

    it('allows unlinking a note from a session without deleting the note itself', async () => {
      const sessionId = 'session-456'
      await addSession(sessionId, 'proj-session-456')
      const note = await createNote({
        title: 'Standup memo',
      })

      const link = await createEntityLink('session', sessionId, 'note', note.id)
      let links = await getEntityLinks('session', sessionId)
      expect(links.all).toHaveLength(1)

      // Unlink
      await deleteEntityLink(link.id)

      links = await getEntityLinks('session', sessionId)
      expect(links.all).toHaveLength(0)

      // Note must still exist in DB!
      const fetchedNote = await db.notes.get(note.id)
      expect(fetchedNote).toBeDefined()
      expect(fetchedNote?.id).toBe(note.id)
    })
  })

  describe('Task Knowledge Links', () => {
    it('creates task note pre-titled and bidirectional link', async () => {
      const taskId = 'task-789'
      const taskTitle = 'Refactor DB Indices'
      const projId = 'proj-zeta'
      await addTask(taskId, projId)

      const note = await createNote({
        title: `Task Notes — ${taskTitle}`,
        projectId: projId,
        contentJSON: '',
        plainText: 'Indexing plan',
      })

      await createEntityLink('task', taskId, 'note', note.id)

      const links = await getEntityLinks('task', taskId)
      expect(links.all).toHaveLength(1)
      expect(links.all[0].targetId).toBe(note.id)

      const fetchedNote = await db.notes.get(note.id)
      expect(fetchedNote?.title).toBe('Task Notes — Refactor DB Indices')
    })
  })

  describe('Dashboard Knowledge Widget Ordering & Filtering', () => {
    it('ranks recent notes and resources by updatedAt descending and excludes trash', async () => {
      // Note 1: Older
      const n1 = await createNote({
        title: 'Old Spec',
        contentJSON: '',
        plainText: '',
      })
      await db.notes.update(n1.id, { updatedAt: new Date('2026-01-01T10:00:00Z') })

      // Note 2: Newest
      const n2 = await createNote({
        title: 'Newest RFC',
        contentJSON: '',
        plainText: '',
      })
      await db.notes.update(n2.id, { updatedAt: new Date('2026-01-03T10:00:00Z') })

      // Resource 1: Middle
      const r1 = await createResource({
        type: 'link',
        title: 'Middle Resource',
        url: 'https://example.com',
      })
      await db.resources.update(r1.id, { updatedAt: new Date('2026-01-02T10:00:00Z') })

      // Note 3: Deleted (Trash)
      const n3 = await createNote({
        title: 'Deleted Draft',
        contentJSON: '',
        plainText: '',
      })
      await db.notes.update(n3.id, {
        updatedAt: new Date('2026-01-04T10:00:00Z'),
        deletedAt: new Date('2026-01-04T10:05:00Z'),
      })

      // Query active notes & resources
      const notes = await getActiveNotes()
      const resources = await getActiveResources()

      const list = [
        ...notes.map((n) => ({ kind: 'note', id: n.id, title: n.title, updatedAt: new Date(n.updatedAt) })),
        ...resources.map((r) => ({ kind: 'resource', id: r.id, title: r.title, updatedAt: new Date(r.updatedAt) })),
      ]
      list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      // Deleted draft must be excluded
      expect(list.find((i) => i.title === 'Deleted Draft')).toBeUndefined()

      // Order must be: Newest RFC -> Middle Resource -> Old Spec
      expect(list[0].title).toBe('Newest RFC')
      expect(list[1].title).toBe('Middle Resource')
      expect(list[2].title).toBe('Old Spec')
    })
  })
})
