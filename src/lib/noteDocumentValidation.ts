const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList',
  'listItem', 'taskList', 'taskItem', 'table', 'tableRow', 'tableHeader',
  'tableCell', 'horizontalRule', 'text',
])
const MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'link'])
const MAX_DEPTH = 64
const MAX_NODES = 50_000
const MAX_MARKS_PER_NODE = 8
const MAX_TEXT_CHARS = 5_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Bounded runtime validation for imported and persisted editor documents. */
export function isValidNoteDocument(value: unknown): boolean {
  if (!isRecord(value) || value.type !== 'doc' || !Array.isArray(value.content)) return false

  if (value.content.length > MAX_NODES) return false
  const stack = value.content.map((node) => ({ node, depth: 1 }))
  let scheduledNodeCount = stack.length
  let nodeCount = 0
  let textLength = 0

  while (stack.length) {
    const { node, depth } = stack.pop()!
    if (!isRecord(node) || typeof node.type !== 'string' || !BLOCK_TYPES.has(node.type)) return false
    if (depth > MAX_DEPTH || ++nodeCount > MAX_NODES) return false
    if (node.attrs !== undefined && !isRecord(node.attrs)) return false
    if (node.text !== undefined) {
      if (typeof node.text !== 'string') return false
      textLength += node.text.length
      if (textLength > MAX_TEXT_CHARS) return false
    }
    if (node.type === 'text' && typeof node.text !== 'string') return false
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return false
      scheduledNodeCount += node.content.length
      if (scheduledNodeCount > MAX_NODES) return false
      for (const child of node.content) stack.push({ node: child, depth: depth + 1 })
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > MAX_MARKS_PER_NODE) return false
      for (const mark of node.marks) {
        if (!isRecord(mark) || typeof mark.type !== 'string' || !MARK_TYPES.has(mark.type)) return false
        if (mark.attrs !== undefined && !isRecord(mark.attrs)) return false
        if (mark.type === 'link' && (!isRecord(mark.attrs) || typeof mark.attrs.href !== 'string')) return false
      }
    }
  }

  return true
}
