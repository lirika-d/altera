import { describe, expect, it } from 'vitest'
import { resolveGlobalShortcut, resolveGoSequence } from './keyboardShortcuts'

const event = (values: Partial<KeyboardEvent> = {}) => ({
  key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, isComposing: false, keyCode: 0,
  ...values,
}) as KeyboardEvent

describe('global keyboard shortcuts', () => {
  it('keeps Command Palette available and creates a task with the chosen cross-platform shortcut', () => {
    expect(resolveGlobalShortcut(event({ key: 'k', ctrlKey: true }), { isTyping: true, isDialogOpen: true })).toBe('command-palette')
    expect(resolveGlobalShortcut(event({ key: 'Enter', metaKey: true, shiftKey: true }), { isTyping: false, isDialogOpen: false })).toBe('create-task')
  })

  it('ignores shortcuts while typing or inside a dialog', () => {
    const shortcut = event({ key: 'Enter', ctrlKey: true, shiftKey: true })
    expect(resolveGlobalShortcut(shortcut, { isTyping: true, isDialogOpen: false })).toBeNull()
    expect(resolveGlobalShortcut(shortcut, { isTyping: false, isDialogOpen: true })).toBeNull()
  })

  it('ignores IME composition and opens help on question mark', () => {
    expect(resolveGlobalShortcut(event({ key: 'g', isComposing: true }), { isTyping: false, isDialogOpen: false })).toBeNull()
    expect(resolveGlobalShortcut(event({ key: '?', shiftKey: true }), { isTyping: false, isDialogOpen: false })).toBe('shortcuts-help')
    expect(resolveGlobalShortcut(event({ key: '/', shiftKey: true }), { isTyping: false, isDialogOpen: false })).toBe('shortcuts-help')
  })

  it('resolves only the supported G navigation destinations', () => {
    expect(resolveGlobalShortcut(event({ key: 'g' }), { isTyping: false, isDialogOpen: false })).toBe('sequence-g')
    expect(resolveGoSequence('w')).toBe('workspace')
    expect(resolveGoSequence('p')).toBe('projects')
    expect(resolveGoSequence('c')).toBe('calendar')
    expect(resolveGoSequence('i')).toBe('insights')
    expect(resolveGoSequence('x')).toBeNull()
  })
})
