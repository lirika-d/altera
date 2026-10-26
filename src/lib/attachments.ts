import * as React from 'react'
import type { Attachment } from '@/types'
import { MAX_FILE_SIZE } from './attachmentPolicy'
export { MAX_FILE_SIZE } from './attachmentPolicy'

/** Supported categorization types for attachments */
export type AttachmentCategory =
  | 'image'
  | 'pdf'
  | 'text'
  | 'archive'
  | 'code'
  | 'generic'

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export interface StorageEstimateResult {
  usage: number
  quota: number
  percentUsed: number
  formattedUsage: string
  formattedQuota: string
}

/**
 * Formats a byte number into a human-readable size string (e.g., '1.2 MB', '450 KB', '0 B').
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, i)
  if (i === 0) return `${Math.round(size)} B`
  const formatted = parseFloat(size.toFixed(size < 10 ? 1 : 0))
  return `${formatted} ${units[i]}`
}

/**
 * Validates file size in bytes against the specified maximum (defaults to 10 MB).
 */
export function validateFileSize(
  sizeInBytes: number,
  maxSize: number = MAX_FILE_SIZE
): FileValidationResult {
  if (sizeInBytes <= 0) {
    return {
      valid: false,
      error: 'File is empty (0 bytes).',
    }
  }
  if (sizeInBytes > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(sizeInBytes)}) exceeds the allowed ${formatFileSize(maxSize)} limit.`,
    }
  }
  return { valid: true }
}

/**
 * Validates a File or Blob object against the maximum file size.
 */
export function validateAttachmentFile(
  file: File | Blob,
  maxSize: number = MAX_FILE_SIZE
): FileValidationResult {
  return validateFileSize(file.size, maxSize)
}

/**
 * Resolves a MIME type and/or filename to an AttachmentCategory.
 * Handles fallbacks when browser MIME is generic or empty.
 */
export function getAttachmentCategory(
  mimeType: string = '',
  filename: string = ''
): AttachmentCategory {
  const normalizedMime = mimeType.toLowerCase().trim()
  const ext = filename.includes('.')
    ? (filename.split('.').pop()?.toLowerCase() || '')
    : ''

  // 1. Image
  if (
    normalizedMime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff'].includes(ext)
  ) {
    return 'image'
  }

  // 2. PDF
  if (normalizedMime === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }

  // 3. Code
  const codeMimes = [
    'application/json',
    'application/ld+json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/typescript',
    'text/typescript',
    'text/html',
    'text/css',
    'text/x-python',
    'application/x-sh',
    'application/sql',
    'text/x-sql',
    'application/graphql',
  ]
  const codeExtensions = [
    'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx',
    'json', 'html', 'htm', 'css', 'scss', 'sass', 'less',
    'py', 'pyw', 'rs', 'go', 'java', 'c', 'h', 'cpp', 'hpp',
    'cs', 'php', 'rb', 'sh', 'bash', 'zsh', 'yaml', 'yml',
    'toml', 'sql', 'graphql', 'gql', 'vue', 'svelte',
    'dockerfile', 'diff', 'patch', 'env', 'xml', 'wasm',
  ]
  if (codeMimes.includes(normalizedMime) || codeExtensions.includes(ext)) {
    return 'code'
  }

  // 4. Text
  const textExtensions = ['txt', 'md', 'markdown', 'csv', 'tsv', 'rtf', 'log', 'ini', 'conf']
  if (normalizedMime.startsWith('text/') || textExtensions.includes(ext)) {
    return 'text'
  }

  // 5. Archive
  const archiveMimes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-gzip',
    'application/x-7z-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-bzip',
    'application/x-bzip2',
  ]
  const archiveExtensions = ['zip', 'tar', 'gz', 'gzip', 'tgz', '7z', 'rar', 'bz2', 'xz']
  if (archiveMimes.includes(normalizedMime) || archiveExtensions.includes(ext)) {
    return 'archive'
  }

  return 'generic'
}

/**
 * Returns true if the attachment can be rendered directly in a preview dialog.
 */
export function isPreviewable(
  mimeType: string = '',
  filename: string = ''
): boolean {
  const category = getAttachmentCategory(mimeType, filename)
  return category === 'image' || category === 'text' || category === 'code'
}

/**
 * Sanitizes a filename to prevent path traversal or unsafe characters during download.
 */
export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return sanitized.length > 0 ? sanitized : 'attachment'
}

/**
 * Safe download helper: creates Blob URL, triggers browser download,
 * and schedules revocation of the temporary URL to avoid memory leaks.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return

  const safeName = sanitizeFilename(filename)
  const url = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = safeName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    // Revoke object URL after delay so browser has ample time to stream/save
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // Ignore revocation error if already revoked
      }
    }, 1500)
  }
}

/**
 * Convenience wrapper to download an attachment object.
 */
export function downloadAttachment(
  attachment: Pick<Attachment, 'blob' | 'filename'>
): void {
  downloadBlob(attachment.blob, attachment.filename)
}

/**
 * Helper to manage individual Object URL lifecycles with an explicit revoke callback.
 */
export function createSafeObjectURL(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob)
  let isRevoked = false

  return {
    url,
    revoke: () => {
      if (!isRevoked) {
        isRevoked = true
        try {
          URL.revokeObjectURL(url)
        } catch {
          // Ignore
        }
      }
    },
  }
}

/**
 * React hook that creates an object URL for a given Blob and automatically
 * revokes it whenever the blob changes or the component unmounts.
 */
export function useObjectURL(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }

    const safeObj = createSafeObjectURL(blob)
    setUrl(safeObj.url)

    return () => {
      safeObj.revoke()
    }
  }, [blob])

  return url
}

/**
 * Checks if an error is an IndexedDB / browser storage quota exhaustion error.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object') {
    const err = error as { name?: string; code?: number; message?: string }
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return true
    }
    if (err.code === 22) {
      return true // DOMException.QUOTA_EXCEEDED_ERR
    }
    if (typeof err.message === 'string') {
      const lower = err.message.toLowerCase()
      if (lower.includes('quota') || (lower.includes('storage') && lower.includes('exceeded'))) {
        return true
      }
    }
  }
  return false
}

/**
 * Formats errors into user-friendly messages for UI feedback.
 */
export function getAttachmentErrorMessage(error: unknown): string {
  if (isQuotaExceededError(error)) {
    return 'Storage quota exceeded. Please free up space by deleting unused notes, resources, or attachments.'
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unexpected error occurred while processing the attachment.'
}

/**
 * Safely reads a Blob as text with character truncation to prevent UI freezing.
 */
export async function readBlobText(
  blob: Blob,
  maxChars: number = 200_000
): Promise<{ text: string; truncated: boolean }> {
  try {
    const text = await blob.text()
    if (text.length > maxChars) {
      return {
        text: text.slice(0, maxChars),
        truncated: true,
      }
    }
    return {
      text,
      truncated: false,
    }
  } catch (err) {
    return {
      text: `[Error reading text content: ${err instanceof Error ? err.message : 'Unknown error'}]`,
      truncated: false,
    }
  }
}

/**
 * Queries the browser StorageManager estimate if supported.
 */
export async function getStorageEstimate(): Promise<StorageEstimateResult | null> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.estimate === 'function'
  ) {
    try {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage ?? 0
      const quota = estimate.quota ?? 0
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0
      return {
        usage,
        quota,
        percentUsed,
        formattedUsage: formatFileSize(usage),
        formattedQuota: formatFileSize(quota),
      }
    } catch {
      return null
    }
  }
  return null
}
