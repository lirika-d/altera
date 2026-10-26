export type GlobalShortcutAction = 'command-palette' | 'create-task' | 'shortcuts-help' | 'sequence-g'

interface ShortcutContext {
  isTyping: boolean
  isDialogOpen: boolean
}

export function resolveGlobalShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'keyCode'>,
  context: ShortcutContext
): GlobalShortcutAction | null {
  if (event.isComposing || event.keyCode === 229) return null
  const hasPrimaryModifier = event.ctrlKey || event.metaKey
  if (hasPrimaryModifier && event.key.toLowerCase() === 'k' && !event.altKey) return 'command-palette'
  if (context.isTyping || context.isDialogOpen) return null
  if (hasPrimaryModifier && event.shiftKey && event.key === 'Enter' && !event.altKey) return 'create-task'
  if (!hasPrimaryModifier && !event.altKey && (event.key === '?' || (event.key === '/' && event.shiftKey))) return 'shortcuts-help'
  if (!hasPrimaryModifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'g') return 'sequence-g'
  return null
}

export function resolveGoSequence(key: string): 'workspace' | 'projects' | 'calendar' | 'insights' | null {
  switch (key.toLowerCase()) {
    case 'w': return 'workspace'
    case 'p': return 'projects'
    case 'c': return 'calendar'
    case 'i': return 'insights'
    default: return null
  }
}

export function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [role="textbox"], [role="combobox"]'))
}
