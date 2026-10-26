/**
 * resources.test.ts — Unit and Integration tests for ALTERA Resources Library.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  isValidResourceUrl,
  sanitizeResourceUrl,
  getDomainFromUrl,
  formatFileSize,
  copyToClipboard,
  COMMON_LANGUAGES,
} from './urlSecurity'
import {
  createResource,
  updateResource,
  softDeleteResource,
  restoreResource,
  getResourceById,
  getActiveResources,
  toggleResourceFavorite,
  saveAttachment,
} from '@/db/knowledge'
import { db } from '@/db/db'

describe('Resources Security & Utilities', () => {
  describe('isValidResourceUrl', () => {
    it('accepts valid https and http URLs', () => {
      expect(isValidResourceUrl('https://react.dev')).toBe(true)
      expect(isValidResourceUrl('http://localhost:3000')).toBe(true)
      expect(isValidResourceUrl('https://github.com/facebook/react?query=1#readme')).toBe(true)
    })

    it('rejects unsafe schemes like javascript:, data:, vbscript:', () => {
      expect(isValidResourceUrl('javascript:alert(1)')).toBe(false)
      expect(isValidResourceUrl('JAVASCRIPT:alert(1)')).toBe(false)
      expect(isValidResourceUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isValidResourceUrl('vbscript:msgbox(1)')).toBe(false)
      expect(isValidResourceUrl('blob:https://evil.com/123')).toBe(false)
      expect(isValidResourceUrl('file:///etc/passwd')).toBe(false)
    })

    it('rejects malformed or empty URLs', () => {
      expect(isValidResourceUrl('')).toBe(false)
      expect(isValidResourceUrl('   ')).toBe(false)
      expect(isValidResourceUrl(null)).toBe(false)
      expect(isValidResourceUrl(undefined)).toBe(false)
      expect(isValidResourceUrl('not-a-url')).toBe(false)
      expect(isValidResourceUrl('//missing-protocol.com')).toBe(false)
    })
  })

  describe('sanitizeResourceUrl', () => {
    it('returns trimmed URL when valid', () => {
      expect(sanitizeResourceUrl('  https://docs.docker.com  ')).toBe('https://docs.docker.com')
    })

    it('returns undefined when invalid or dangerous', () => {
      expect(sanitizeResourceUrl('javascript:evil()')).toBeUndefined()
      expect(sanitizeResourceUrl('random string')).toBeUndefined()
    })
  })

  describe('getDomainFromUrl', () => {
    it('extracts hostname and strips www', () => {
      expect(getDomainFromUrl('https://www.github.com/profile')).toBe('github.com')
      expect(getDomainFromUrl('https://docs.python.org/3/')).toBe('docs.python.org')
      expect(getDomainFromUrl('http://localhost:5173')).toBe('localhost')
    })

    it('handles invalid inputs gracefully', () => {
      expect(getDomainFromUrl('')).toBe('')
      expect(getDomainFromUrl('invalid')).toBe('')
      expect(getDomainFromUrl(null)).toBe('')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes into KB and MB correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(512)).toBe('512 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1048576)).toBe('1.0 MB')
    })
  })

  describe('copyToClipboard', () => {
    it('handles clipboard copy gracefully without throwing in test environment', async () => {
      const res = await copyToClipboard('test snippet')
      expect(typeof res).toBe('boolean')
    })
  })

  describe('COMMON_LANGUAGES', () => {
    it('contains standard development languages', () => {
      const values = COMMON_LANGUAGES.map((l) => l.value)
      expect(values).toContain('typescript')
      expect(values).toContain('javascript')
      expect(values).toContain('python')
      expect(values).toContain('sql')
      expect(values).toContain('rust')
    })
  })
})

describe('Resources Persistence Integration', () => {
  beforeEach(async () => {
    await db.resources.clear()
    await db.attachments.clear()
    await db.tagAssignments.clear()
  })

  it('creates and retrieves a link resource', async () => {
    const res = await createResource({
      type: 'link',
      title: 'Vite Guide',
      url: 'https://vite.dev/guide/',
      description: 'Official guide for Vite build tool',
      isFavorite: true,
    })

    expect(res.id).toBeDefined()
    expect(res.type).toBe('link')
    expect(res.title).toBe('Vite Guide')
    expect(res.url).toBe('https://vite.dev/guide/')
    expect(res.isFavorite).toBe(true)

    const retrieved = await getResourceById(res.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.title).toBe('Vite Guide')
  })

  it('rejects unsafe URLs at the persistence boundary', async () => {
    await expect(createResource({ type: 'link', title: 'Unsafe', url: 'javascript:alert(1)' }))
      .rejects.toThrow('HTTP or HTTPS')

    const resource = await createResource({ type: 'link', title: 'Safe', url: 'https://example.com' })
    await expect(updateResource(resource.id, { url: 'data:text/html,unsafe' }))
      .rejects.toThrow('HTTP or HTTPS')
    expect((await getResourceById(resource.id))?.url).toBe('https://example.com')
  })

  it('enforces the attachment size limit in the database service', async () => {
    const before = await db.attachments.count()
    const oversized = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'application/octet-stream' })
    await expect(saveAttachment({ filename: 'large.bin', mimeType: oversized.type, blob: oversized }))
      .rejects.toThrow('10 MB')
    expect(await db.attachments.count()).toBe(before)
  })

  it('creates and queries code snippet resource with language', async () => {
    const res = await createResource({
      type: 'snippet',
      title: 'React Custom Hook',
      language: 'typescript',
      snippetContent: 'function useCounter() { const [c, setC] = useState(0); return { c }; }',
    })

    expect(res.type).toBe('snippet')
    expect(res.language).toBe('typescript')
    expect(res.snippetContent).toContain('useCounter')

    const activeSnippets = await getActiveResources({ type: 'snippet' })
    expect(activeSnippets).toHaveLength(1)
    expect(activeSnippets[0].id).toBe(res.id)
  })

  it('creates a reference file resource with attachment', async () => {
    const blob = new Blob(['sample data'], { type: 'text/plain' })
    const attachment = await saveAttachment({
      filename: 'sample.txt',
      mimeType: 'text/plain',
      blob,
      size: 11,
    })

    const res = await createResource({
      type: 'file',
      title: 'Sample Doc',
      attachmentId: attachment.id,
    })

    expect(res.type).toBe('file')
    expect(res.attachmentId).toBe(attachment.id)

    const activeFiles = await getActiveResources({ type: 'file' })
    expect(activeFiles).toHaveLength(1)
    expect(activeFiles[0].title).toBe('Sample Doc')
  })

  it('updates a resource metadata and fields', async () => {
    const res = await createResource({
      type: 'link',
      title: 'Old Title',
      url: 'https://old.org',
    })

    const updated = await updateResource(res.id, {
      title: 'Updated Title',
      url: 'https://updated.org',
      description: 'New Description',
    })

    expect(updated.title).toBe('Updated Title')
    expect(updated.url).toBe('https://updated.org')
    expect(updated.description).toBe('New Description')
  })

  it('toggles resource favorite state', async () => {
    const res = await createResource({
      type: 'link',
      title: 'Fav Test',
      isFavorite: false,
    })

    const favorited = await toggleResourceFavorite(res.id)
    expect(favorited.isFavorite).toBe(true)

    const unfavorited = await toggleResourceFavorite(res.id)
    expect(unfavorited.isFavorite).toBe(false)
  })

  it('soft-deletes and restores a resource', async () => {
    const res = await createResource({
      type: 'link',
      title: 'Delete Test',
    })

    const deleted = await softDeleteResource(res.id)
    expect(deleted.deletedAt).toBeDefined()

    const activeList = await getActiveResources()
    expect(activeList.some((r) => r.id === res.id)).toBe(false)

    const trashList = await getActiveResources({ showTrash: true })
    expect(trashList.some((r) => r.id === res.id)).toBe(true)

    const restored = await restoreResource(res.id)
    expect(restored.deletedAt).toBeUndefined()

    const activeListAfter = await getActiveResources()
    expect(activeListAfter.some((r) => r.id === res.id)).toBe(true)
  })

  it('filters active resources by search query', async () => {
    await createResource({
      type: 'link',
      title: 'Kubernetes Docs',
      url: 'https://kubernetes.io',
    })
    await createResource({
      type: 'snippet',
      title: 'Docker Compose',
      snippetContent: 'version: "3.8"\nservices:',
    })

    const searchKube = await getActiveResources({ search: 'kubernetes' })
    expect(searchKube).toHaveLength(1)
    expect(searchKube[0].title).toBe('Kubernetes Docs')

    const searchCompose = await getActiveResources({ search: 'services' })
    expect(searchCompose).toHaveLength(1)
    expect(searchCompose[0].title).toBe('Docker Compose')
  })
})
