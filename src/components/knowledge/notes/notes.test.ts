/**
 * notes.test.ts — Unit and Integration tests for ALTERA Notes Product.
 *
 * Verifies:
 * - Utility functions (formatTimeAgo, slugify, generateNoteMarkdown, exportNoteAsMarkdown)
 * - Note CRUD workflows (create, update with optimistic revision control, soft-delete, restore, permanent delete)
 * - Favorite toggling and duplicate note workflows
 * - Note filtering by status (All, Favorites, Recently Edited, Trash), project scope, tag, and search query
 */

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/db/db'
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
  createTag,
  setEntityTags,
  getTagsForEntity,
} from '@/db/knowledge'
import {
  formatTimeAgo,
  slugify,
  generateNoteMarkdown,
  exportNoteAsMarkdown,
} from './noteUtils'
import { createEmptyDoc } from '@/components/knowledge/editor'
import type { DocRoot } from '@/components/knowledge/editor'

describe('ALTERA Notes Product Suite', () => {
  beforeEach(async () => {
    // Reset database tables before each test
    await db.notes.clear()
    await db.tags.clear()
    await db.tagAssignments.clear()
    await db.entityLinks.clear()
    await db.projects.clear()
  })

  // ─── 1. Utility Tests ───────────────────────────────────────────────────────

  describe('noteUtils', () => {
    describe('formatTimeAgo', () => {
      it('returns empty string for null, undefined, or invalid dates', () => {
        expect(formatTimeAgo(null)).toBe('')
        expect(formatTimeAgo(undefined)).toBe('')
        expect(formatTimeAgo('invalid-date')).toBe('')
      })

      it('formats recent timestamps as Just now', () => {
        const now = new Date()
        expect(formatTimeAgo(now)).toBe('Just now')
        const thirtySecsAgo = new Date(Date.now() - 30 * 1000)
        expect(formatTimeAgo(thirtySecsAgo)).toBe('Just now')
      })

      it('formats minutes ago correctly', () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        expect(formatTimeAgo(fiveMinutesAgo)).toBe('5m ago')
        const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000)
        expect(formatTimeAgo(fortyFiveMinsAgo)).toBe('45m ago')
      })

      it('formats hours ago correctly', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago')
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000)
        expect(formatTimeAgo(twentyHoursAgo)).toBe('20h ago')
      })

      it('formats days ago correctly', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago')
      })

      it('formats months and years ago correctly', () => {
        const sixtyDaysAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000)
        expect(formatTimeAgo(sixtyDaysAgo)).toBe('2mo ago')
        const fourHundredDaysAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
        expect(formatTimeAgo(fourHundredDaysAgo)).toBe('1y ago')
      })
    })

    describe('slugify', () => {
      it('transforms standard titles into kebab-case slugs', () => {
        expect(slugify('Architecture RFC')).toBe('architecture-rfc')
        expect(slugify('Sprint 42 Planning')).toBe('sprint-42-planning')
      })

      it('strips special characters and punctuation safely', () => {
        expect(slugify('Feature: User Auth (v2.0!) & Permissions?')).toBe(
          'feature-user-auth-v20-permissions'
        )
      })

      it('handles empty and whitespace-only strings gracefully', () => {
        expect(slugify('')).toBe('untitled-note')
        expect(slugify('   ')).toBe('untitled-note')
        expect(slugify('---')).toBe('untitled-note')
      })
    })

    describe('generateNoteMarkdown', () => {
      it('generates markdown with document title and plain text fallback', () => {
        const markdown = generateNoteMarkdown({
          title: 'System Requirements',
          plainText: 'These are the system requirements for ALTERA.',
        })

        expect(markdown).toContain('# System Requirements')
        expect(markdown).toContain('These are the system requirements for ALTERA.')
      })

      it('generates markdown from structured doc JSON', () => {
        const doc: DocRoot = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Section Overview' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Detailed description of the architecture.' }],
            },
          ],
        }

        const markdown = generateNoteMarkdown({
          title: 'Architecture Spec',
          contentJSON: JSON.stringify(doc),
        })

        expect(markdown).toContain('# Architecture Spec')
        expect(markdown).toContain('## Section Overview')
        expect(markdown).toContain('Detailed description of the architecture.')
      })

      it('exports malformed stored note documents without throwing', () => {
        const malformed = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: {} }] })
        const markdown = generateNoteMarkdown({ title: 'Recovered', contentJSON: malformed })
        expect(markdown).toContain(malformed)
      })

      it('avoids duplicating the H1 title if already present in body', () => {
        const markdown = generateNoteMarkdown({
          title: 'Quick Notes',
          plainText: '# Quick Notes\n\nSome bullet points here',
        })

        // Should not have double "# Quick Notes\n\n# Quick Notes"
        const count = (markdown.match(/# Quick Notes/g) || []).length
        expect(count).toBe(1)
      })
    })

    describe('exportNoteAsMarkdown', () => {
      it('returns valid markdown and runs without error in node environment', async () => {
        const note = await createNote({
          title: 'Release Notes v1.0',
          plainText: 'Everything is ready for deployment.',
        })

        const markdown = exportNoteAsMarkdown(note)
        expect(typeof markdown).toBe('string')
        expect(markdown).toContain('# Release Notes v1.0')
        expect(markdown).toContain('Everything is ready for deployment.')
      })
    })
  })

  // ─── 2. Note Creation, Revisions, and Duplication ───────────────────────────

  describe('Note Workflows', () => {
    it('creates a note with initial revision 1 and default values', async () => {
      const initialDoc = createEmptyDoc()
      const note = await createNote({
        title: 'Backend API Specifications',
        contentJSON: JSON.stringify(initialDoc),
        plainText: 'API documentation details',
        isFavorite: true,
      })

      expect(note.id).toBeDefined()
      expect(note.title).toBe('Backend API Specifications')
      expect(note.revision).toBe(1)
      expect(note.isFavorite).toBe(true)
      expect(note.deletedAt).toBeUndefined()
      expect(note.createdAt).toBeInstanceOf(Date)
      expect(note.updatedAt).toBeInstanceOf(Date)

      const stored = await getNoteById(note.id)
      expect(stored).toBeDefined()
      expect(stored?.title).toBe('Backend API Specifications')
    })

    it('enforces optimistic revision control on update', async () => {
      const note = await createNote({
        title: 'Concurrent Document',
        plainText: 'Original text',
      })
      expect(note.revision).toBe(1)

      // Successful update with matching revision
      const updated = await updateNote(note.id, {
        plainText: 'Updated text',
        expectedRevision: 1,
      })
      expect(updated.revision).toBe(2)
      expect(updated.plainText).toBe('Updated text')

      // Mismatched revision throws error
      await expect(
        updateNote(note.id, {
          plainText: 'Stale edit',
          expectedRevision: 1, // Stale! Current is 2
        })
      ).rejects.toThrow(/revision/i)
    })

    it('toggles favorite state accurately', async () => {
      const note = await createNote({
        title: 'Favorite Candidate',
        isFavorite: false,
      })
      expect(note.isFavorite).toBe(false)

      const favorited = await toggleNoteFavorite(note.id)
      expect(favorited.isFavorite).toBe(true)

      const unfavorited = await toggleNoteFavorite(note.id)
      expect(unfavorited.isFavorite).toBe(false)
    })

    it('duplicates a note preserving contents with a (Copy) title', async () => {
      const original = await createNote({
        title: 'Original Template',
        contentJSON: JSON.stringify({ type: 'doc', content: [] }),
        plainText: 'Template content here',
        projectId: 'project-xyz',
        isFavorite: true,
      })

      // Simulate Duplicate action in NoteCard / NoteDetail
      const duplicate = await createNote({
        title: `${original.title} (Copy)`,
        contentJSON: original.contentJSON,
        plainText: original.plainText,
        projectId: original.projectId,
        isFavorite: false,
      })

      expect(duplicate.id).not.toBe(original.id)
      expect(duplicate.title).toBe('Original Template (Copy)')
      expect(duplicate.plainText).toBe('Template content here')
      expect(duplicate.projectId).toBe('project-xyz')
      expect(duplicate.isFavorite).toBe(false)
      expect(duplicate.revision).toBe(1)
    })
  })

  // ─── 3. Soft Delete, Trash, and Permanent Deletion ─────────────────────────

  describe('Trash and Deletion Workflows', () => {
    it('soft deletes a note and moves it to trash', async () => {
      const note = await createNote({
        title: 'Note to be trashed',
        plainText: 'Trash me',
      })

      const softDeleted = await softDeleteNote(note.id)
      expect(softDeleted.deletedAt).toBeInstanceOf(Date)

      // Active notes query should exclude this note
      const active = await getActiveNotes()
      expect(active.some((n) => n.id === note.id)).toBe(false)

      // Trash notes query should include this note
      const trash = await getTrashNotes()
      expect(trash.some((n) => n.id === note.id)).toBe(true)
    })

    it('restores a soft-deleted note from trash', async () => {
      const note = await createNote({
        title: 'Recoverable Note',
      })
      await softDeleteNote(note.id)

      const restored = await restoreNote(note.id)
      expect(restored.deletedAt).toBeUndefined()

      const active = await getActiveNotes()
      expect(active.some((n) => n.id === note.id)).toBe(true)

      const trash = await getTrashNotes()
      expect(trash.some((n) => n.id === note.id)).toBe(false)
    })

    it('permanently deletes a note and cleans up its data', async () => {
      const note = await createNote({
        title: 'Fatal Note',
      })

      await deleteNotePermanently(note.id)

      const fetched = await getNoteById(note.id)
      expect(fetched).toBeUndefined()

      const active = await getActiveNotes()
      expect(active.some((n) => n.id === note.id)).toBe(false)

      const trash = await getTrashNotes()
      expect(trash.some((n) => n.id === note.id)).toBe(false)
    })
  })

  // ─── 4. Filtering and Sorting ──────────────────────────────────────────────

  describe('Filtering Operations', () => {
    beforeEach(async () => {
      // Seed notes for filtering
      await createNote({
        title: 'Alpha Note',
        plainText: 'Contains react and typescript',
        projectId: 'proj-1',
        isFavorite: true,
      })

      await createNote({
        title: 'Beta Note',
        plainText: 'Contains python backend',
        projectId: 'proj-2',
        isFavorite: false,
      })

      await createNote({
        title: 'Gamma Note',
        plainText: 'Contains react frontend',
        projectId: 'proj-1',
        isFavorite: false,
      })

      const trashed = await createNote({
        title: 'Deleted Note',
        plainText: 'Old trash',
      })
      await softDeleteNote(trashed.id)
    })

    it('filters notes by search query in title and plainText', async () => {
      const searchReact = await getActiveNotes({ search: 'react' })
      expect(searchReact.length).toBe(2)
      expect(searchReact.map((n) => n.title)).toEqual(
        expect.arrayContaining(['Alpha Note', 'Gamma Note'])
      )

      const searchBeta = await getActiveNotes({ search: 'Beta' })
      expect(searchBeta.length).toBe(1)
      expect(searchBeta[0].title).toBe('Beta Note')
    })

    it('filters notes by favorites tab', async () => {
      const favorites = await getActiveNotes({ isFavorite: true })
      expect(favorites.length).toBe(1)
      expect(favorites[0].title).toBe('Alpha Note')
    })

    it('filters notes by project scope', async () => {
      const proj1Notes = await getActiveNotes({ projectId: 'proj-1' })
      expect(proj1Notes.length).toBe(2)
      expect(proj1Notes.every((n) => n.projectId === 'proj-1')).toBe(true)

      const proj2Notes = await getActiveNotes({ projectId: 'proj-2' })
      expect(proj2Notes.length).toBe(1)
      expect(proj2Notes[0].title).toBe('Beta Note')
    })

    it('filters notes by trash tab', async () => {
      const trash = await getTrashNotes()
      expect(trash.length).toBe(1)
      expect(trash[0].title).toBe('Deleted Note')
    })

    it('assigns and filters notes by tags', async () => {
      const tag = await createTag({ name: 'Architecture', color: '#6366f1' })
      const note = await createNote({
        title: 'Tagged Note',
        plainText: 'Tagged content',
      })

      await setEntityTags('note', note.id, [tag.id])

      const assigned = await getTagsForEntity('note', note.id)
      expect(assigned.length).toBe(1)
      expect(assigned[0].name).toBe('Architecture')

      const filteredByTag = await getActiveNotes({ tagId: tag.id })
      expect(filteredByTag.length).toBe(1)
      expect(filteredByTag[0].id).toBe(note.id)
    })
  })
})
