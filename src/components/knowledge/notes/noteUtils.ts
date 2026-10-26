/**
 * noteUtils.ts — Utility functions for ALTERA Notes.
 *
 * Includes:
 * - formatTimeAgo: Relative human-friendly timestamp formatting
 * - slugify: Safe filename generation
 * - generateNoteMarkdown: Converts a Note entity into Markdown formatted string
 * - exportNoteAsMarkdown: Downloads a note as a .md file
 */

import type { Note } from '@/types'
import { docToMarkdown, normalizeDoc, type DocRoot } from '@/components/knowledge/editor'

/**
 * Format a Date or timestamp into a compact relative time string.
 * Examples: 'Just now', '12m ago', '3h ago', '5d ago'.
 */
export function formatTimeAgo(date?: Date | string | number | null): string {
  if (!date) return ''
  const parsed = new Date(date)
  const time = parsed.getTime()
  if (isNaN(time)) return ''

  const now = Date.now()
  const diff = now - time
  if (diff < 0) return 'Just now'

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}

/**
 * Converts a note title into a safe lowercase kebab-case slug for filenames.
 */
export function slugify(text: string): string {
  if (!text) return 'untitled-note'
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled-note'
}

/**
 * Generates clean Markdown content from a note entity.
 * Uses docToMarkdown from @/components/knowledge/editor, falling back to plainText.
 */
export function generateNoteMarkdown(note: {
  title?: string
  contentJSON?: string | DocRoot
  plainText?: string
}): string {
  const title = (note.title || 'Untitled Note').trim()
  let body = ''

  if (note.contentJSON) {
    try {
      body = docToMarkdown(normalizeDoc(note.contentJSON))
    } catch {
      body = ''
    }
  }

  if (!body.trim() && note.plainText) {
    body = note.plainText.trim()
  }

  // If body already starts with the same header # Title, avoid repeating
  const trimmedBody = body.trim()
  if (trimmedBody.startsWith(`# ${title}`)) {
    return trimmedBody + '\n'
  }

  return `# ${title}\n\n${trimmedBody}`.trim() + '\n'
}

/**
 * Exports a note as a .md file and triggers download in browser environments.
 * Returns the generated Markdown string.
 */
export function exportNoteAsMarkdown(note: Note): string {
  const markdown = generateNoteMarkdown(note)
  const filename = `${slugify(note.title || 'untitled-note')}.md`

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to trigger note download:', err)
    }
  }

  return markdown
}
