/**
 * urlSecurity.ts — Strict URL validation, sanitization, and helper utilities
 * for ALTERA Resources Library.
 *
 * Security Requirements:
 * - Allow ONLY `http:` and `https:` protocols.
 * - Strictly reject `javascript:`, `data:`, `vbscript:`, `blob:`, `file:`, etc.
 * - Safe opening in new tabs with `rel="noopener noreferrer"`.
 */

export { ALLOWED_PROTOCOLS, isValidResourceUrl, sanitizeResourceUrl } from '@/lib/resourceUrl'

/**
 * Extracts a clean domain/host name from a URL (e.g. "github.com" from "https://github.com/facebook/react").
 * Returns an empty string if URL is invalid.
 */
export function getDomainFromUrl(input?: string | null): string {
  if (!input) return ''
  try {
    const parsed = new URL(input.trim())
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Formats a file size in bytes into human-readable string (e.g. "1.4 MB", "320 KB").
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
    return '0 B'
  }
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, sizes.length - 1)
  const val = bytes / Math.pow(k, idx)

  return `${val.toFixed(idx === 0 ? 0 : 1)} ${sizes[idx]}`
}

/**
 * Common programming languages supported for code snippets.
 */
export interface LanguageOption {
  value: string
  label: string
}

export const COMMON_LANGUAGES: LanguageOption[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'other', label: 'Other' },
]

/**
 * Copies text safely to clipboard and handles fallback if needed.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for environments where navigator.clipboard might be restricted
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-999999px'
    textarea.style.top = '-999999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)
    return successful
  } catch {
    return false
  }
}
