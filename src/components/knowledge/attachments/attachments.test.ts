import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MAX_FILE_SIZE,
  formatFileSize,
  validateFileSize,
  validateAttachmentFile,
  getAttachmentCategory,
  isPreviewable,
  sanitizeFilename,
  createSafeObjectURL,
  isQuotaExceededError,
  getAttachmentErrorMessage,
  readBlobText,
  downloadBlob,
  downloadAttachment,
} from '@/lib/attachments'
import {
  saveAttachment,
  getAttachment,
  deleteAttachment,
} from '@/db/knowledge'
import { db } from '@/db/db'

describe('Attachment Utilities (src/lib/attachments.ts)', () => {
  describe('formatFileSize', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(-10)).toBe('0 B')
    })

    it('formats bytes under 1 KB', () => {
      expect(formatFileSize(512)).toBe('512 B')
      expect(formatFileSize(1023)).toBe('1023 B')
    })

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(450 * 1024)).toBe('450 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1.2 * 1024 * 1024)).toBe('1.2 MB')
      expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB')
    })

    it('formats gigabytes correctly', () => {
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2 GB')
    })
  })

  describe('validateFileSize & validateAttachmentFile', () => {
    it('validates files within the 10 MB limit', () => {
      const result = validateFileSize(5 * 1024 * 1024)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('rejects files larger than MAX_FILE_SIZE', () => {
      const result = validateFileSize(10 * 1024 * 1024 + 1)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds the allowed 10 MB limit')
    })

    it('rejects empty files', () => {
      const result = validateFileSize(0)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('File is empty')
    })

    it('validates File / Blob objects directly', () => {
      const blob = new Blob(['sample content'])
      const result = validateAttachmentFile(blob)
      expect(result.valid).toBe(true)

      const largeBlob = new Blob([new Uint8Array(MAX_FILE_SIZE + 100)])
      const largeResult = validateAttachmentFile(largeBlob)
      expect(largeResult.valid).toBe(false)
    })
  })

  describe('getAttachmentCategory', () => {
    it('identifies image mime types and extensions', () => {
      expect(getAttachmentCategory('image/png', 'photo.png')).toBe('image')
      expect(getAttachmentCategory('image/jpeg', 'photo.jpeg')).toBe('image')
      expect(getAttachmentCategory('application/octet-stream', 'screenshot.webp')).toBe('image')
      expect(getAttachmentCategory('', 'vector.svg')).toBe('image')
    })

    it('identifies PDF documents', () => {
      expect(getAttachmentCategory('application/pdf', 'doc.pdf')).toBe('pdf')
      expect(getAttachmentCategory('', 'manual.pdf')).toBe('pdf')
    })

    it('identifies code files by MIME and extensions', () => {
      expect(getAttachmentCategory('application/json', 'package.json')).toBe('code')
      expect(getAttachmentCategory('text/typescript', 'App.tsx')).toBe('code')
      expect(getAttachmentCategory('', 'script.py')).toBe('code')
      expect(getAttachmentCategory('', 'query.sql')).toBe('code')
      expect(getAttachmentCategory('', 'main.rs')).toBe('code')
    })

    it('identifies text files', () => {
      expect(getAttachmentCategory('text/plain', 'notes.txt')).toBe('text')
      expect(getAttachmentCategory('text/markdown', 'README.md')).toBe('text')
      expect(getAttachmentCategory('text/csv', 'data.csv')).toBe('text')
    })

    it('identifies archive files', () => {
      expect(getAttachmentCategory('application/zip', 'archive.zip')).toBe('archive')
      expect(getAttachmentCategory('application/gzip', 'bundle.tar.gz')).toBe('archive')
      expect(getAttachmentCategory('', 'backup.7z')).toBe('archive')
    })

    it('falls back to generic for unknown binary formats', () => {
      expect(getAttachmentCategory('application/octet-stream', 'firmware.bin')).toBe('generic')
      expect(getAttachmentCategory('', 'unknown')).toBe('generic')
    })
  })

  describe('isPreviewable', () => {
    it('returns true for images, text, and code', () => {
      expect(isPreviewable('image/png', 'img.png')).toBe(true)
      expect(isPreviewable('text/plain', 'note.txt')).toBe(true)
      expect(isPreviewable('application/json', 'data.json')).toBe(true)
    })

    it('returns false for archives, pdfs, and generic binaries', () => {
      expect(isPreviewable('application/zip', 'files.zip')).toBe(false)
      expect(isPreviewable('application/pdf', 'doc.pdf')).toBe(false)
      expect(isPreviewable('application/octet-stream', 'binary.dat')).toBe(false)
    })
  })

  describe('sanitizeFilename', () => {
    it('removes invalid path and filesystem characters', () => {
      expect(sanitizeFilename('../../../secret/file.txt')).toBe('.._.._.._secret_file.txt')
      expect(sanitizeFilename('test:file*name?.png')).toBe('test_file_name_.png')
      expect(sanitizeFilename('   ')).toBe('attachment')
      expect(sanitizeFilename('clean_name.jpg')).toBe('clean_name.jpg')
    })
  })

  describe('createSafeObjectURL lifecycle helper', () => {
    it('creates and revokes Object URLs safely', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test-uuid')
      const revokeObjectURLMock = vi.fn()
      globalThis.URL.createObjectURL = createObjectURLMock
      globalThis.URL.revokeObjectURL = revokeObjectURLMock

      const blob = new Blob(['hello'])
      const safe = createSafeObjectURL(blob)

      expect(safe.url).toBe('blob:http://localhost/test-uuid')
      expect(createObjectURLMock).toHaveBeenCalledWith(blob)

      safe.revoke()
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test-uuid')

      // Second revocation is a safe no-op
      safe.revoke()
      expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('readBlobText', () => {
    it('reads text content from Blob', async () => {
      const blob = new Blob(['Hello ALTERA Knowledge Hub!'], { type: 'text/plain' })
      const result = await readBlobText(blob)
      expect(result.text).toBe('Hello ALTERA Knowledge Hub!')
      expect(result.truncated).toBe(false)
    })

    it('truncates text content if it exceeds character threshold', async () => {
      const longText = 'A'.repeat(500)
      const blob = new Blob([longText], { type: 'text/plain' })
      const result = await readBlobText(blob, 100)
      expect(result.text.length).toBe(100)
      expect(result.truncated).toBe(true)
    })
  })

  describe('Storage quota error handling', () => {
    it('identifies QuotaExceededError by name, code, or message', () => {
      expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true)
      expect(isQuotaExceededError({ code: 22 })).toBe(true)
      expect(isQuotaExceededError({ message: 'The quota has been exceeded' })).toBe(true)
      expect(isQuotaExceededError({ message: 'storage is full and exceeded limit' })).toBe(true)
      expect(isQuotaExceededError(new Error('Generic failure'))).toBe(false)
      expect(isQuotaExceededError(null)).toBe(false)
    })

    it('translates quota errors into friendly feedback message', () => {
      const quotaErr = { name: 'QuotaExceededError' }
      const msg = getAttachmentErrorMessage(quotaErr)
      expect(msg).toContain('Storage quota exceeded')
    })
  })

  describe('Safe download helpers', () => {
    it('triggers download with sanitized filename and schedules revocation', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock')
      const revokeObjectURLMock = vi.fn()
      globalThis.URL.createObjectURL = createObjectURLMock
      globalThis.URL.revokeObjectURL = revokeObjectURLMock

      const clickMock = vi.fn()
      const appendChildMock = vi.fn()
      const removeChildMock = vi.fn()

      const fakeElement = {
        href: '',
        download: '',
        style: { display: '' },
        click: clickMock,
      } as unknown as HTMLAnchorElement

      const fakeDocument = {
        createElement: vi.fn().mockReturnValue(fakeElement),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
      }

      // @ts-expect-error test mock
      globalThis.window = {}
      // @ts-expect-error test mock
      globalThis.document = fakeDocument

      const blob = new Blob(['test-data'])
      downloadBlob(blob, 'unsafe/file.txt')

      expect(createObjectURLMock).toHaveBeenCalledWith(blob)
      expect(fakeDocument.createElement).toHaveBeenCalledWith('a')
      expect(appendChildMock).toHaveBeenCalledWith(fakeElement)
      expect(clickMock).toHaveBeenCalled()
      expect(removeChildMock).toHaveBeenCalledWith(fakeElement)
      expect(fakeElement.download).toBe('unsafe_file.txt')

      const attachment = {
        id: 'test-1',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        size: blob.size,
        blob,
        createdAt: new Date(),
      }
      downloadAttachment(attachment)
      expect(createObjectURLMock).toHaveBeenCalledTimes(2)

      // @ts-expect-error clean up test mock
      delete globalThis.window
      // @ts-expect-error clean up test mock
      delete globalThis.document
    })
  })
})

describe('Attachment IndexedDB Integration', () => {
  beforeEach(async () => {
    await db.attachments.clear()
  })

  it('persists and retrieves Blobs without data corruption', async () => {
    const rawData = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64])
    const blob = new Blob([rawData], { type: 'application/octet-stream' })

    const saved = await saveAttachment({
      filename: 'binary.dat',
      mimeType: 'application/octet-stream',
      blob,
      size: rawData.length,
    })

    expect(saved.id).toBeDefined()
    expect(saved.filename).toBe('binary.dat')
    expect(saved.size).toBe(8)

    const fetched = await getAttachment(saved.id)
    expect(fetched).toBeDefined()
    expect(fetched?.id).toBe(saved.id)

    const arrayBuffer = await fetched!.blob.arrayBuffer()
    const fetchedData = new Uint8Array(arrayBuffer)
    expect(fetchedData).toEqual(rawData)

    await deleteAttachment(saved.id)
    const afterDelete = await getAttachment(saved.id)
    expect(afterDelete).toBeUndefined()
  })
})
