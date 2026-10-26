/** Resource links may only navigate to absolute HTTP(S) URLs. */
export const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export function isValidResourceUrl(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false
  const trimmed = input.trim()
  if (!trimmed) return false

  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:')
  ) return false

  try {
    return ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

export function sanitizeResourceUrl(input?: string | null): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  return isValidResourceUrl(trimmed) ? trimmed : undefined
}
