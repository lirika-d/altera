/**
 * tagColors.ts — Palette configuration and color utility helpers for Tags.
 */

export interface TagColorOption {
  id: string
  name: string
  color: string // hex code
  bgClass: string
  textClass: string
  borderClass: string
}

/**
 * The 8 standard color palette swatches:
 * blue, green, purple, amber, red, cyan, pink, gray
 */
export const TAG_COLOR_PALETTE: TagColorOption[] = [
  {
    id: 'blue',
    name: 'Blue',
    color: '#3b82f6',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
  },
  {
    id: 'green',
    name: 'Green',
    color: '#10b981',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  },
  {
    id: 'purple',
    name: 'Purple',
    color: '#8b5cf6',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
  },
  {
    id: 'amber',
    name: 'Amber',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  {
    id: 'red',
    name: 'Red',
    color: '#ef4444',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    color: '#06b6d4',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
  },
  {
    id: 'pink',
    name: 'Pink',
    color: '#ec4899',
    bgClass: 'bg-pink-500/15',
    textClass: 'text-pink-400',
    borderClass: 'border-pink-500/30',
  },
  {
    id: 'gray',
    name: 'Gray',
    color: '#6b7280',
    bgClass: 'bg-zinc-500/15',
    textClass: 'text-zinc-400',
    borderClass: 'border-zinc-500/30',
  },
]

export const DEFAULT_TAG_COLOR = '#3b82f6'

/**
 * Resolves a color string (name or hex) to a TagColorOption.
 */
export function getTagColorOption(color?: string): TagColorOption {
  if (!color) return TAG_COLOR_PALETTE[0]

  const clean = color.trim().toLowerCase()
  const matched = TAG_COLOR_PALETTE.find(
    (c) => c.color.toLowerCase() === clean || c.id.toLowerCase() === clean || c.name.toLowerCase() === clean
  )

  if (matched) return matched

  // Fallback for custom hex or arbitrary color
  return {
    id: 'custom',
    name: 'Custom',
    color: color,
    bgClass: 'bg-bg-elevated',
    textClass: 'text-text-primary',
    borderClass: 'border-border',
  }
}
