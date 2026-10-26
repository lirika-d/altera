import { describe, expect, it } from 'vitest'
import {
  APP_PREFERENCES_KEY,
  createAppPreferencesStore,
  moveDashboardSection,
  normalizeAppPreferences,
} from './appPreferences'
import { DEFAULT_APP_PREFERENCES } from '@/types/preferences'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    values,
  }
}

describe('local application preferences', () => {
  it('persists supported preferences and restores them from versioned local storage', () => {
    const storage = memoryStorage()
    const first = createAppPreferencesStore(storage)
    expect(first.update({ defaultRoute: 'calendar', calendarView: 'month' })).toBe(true)
    const second = createAppPreferencesStore(storage)
    expect(second.getSnapshot().defaultRoute).toBe('calendar')
    expect(second.getSnapshot().calendarView).toBe('month')
    expect(storage.values.has(APP_PREFERENCES_KEY)).toBe(true)
  })

  it('normalizes duplicate and unknown dashboard section identifiers', () => {
    const result = normalizeAppPreferences({
      schemaVersion: 1,
      dashboard: { order: ['sessions', 'sessions', 'unknown'], visible: ['planning', 'unknown'] },
    })
    expect(result.dashboard.order).toEqual(['sessions', 'planning', 'insights'])
    expect(result.dashboard.visible).toEqual(['planning'])
    expect(result.calendarView).toBe('week')
  })

  it('resets workspace and calendar preferences without storing extra data', () => {
    const storage = memoryStorage()
    const store = createAppPreferencesStore(storage)
    store.update({ defaultRoute: 'insights', calendarView: 'day' })
    expect(store.reset()).toBe(true)
    expect(store.getSnapshot()).toEqual(DEFAULT_APP_PREFERENCES)
  })

  it('keeps a session-only update when storage is unavailable and reports non-persistence', () => {
    const store = createAppPreferencesStore(null)
    expect(store.update({ defaultRoute: 'projects' })).toBe(false)
    expect(store.getSnapshot().defaultRoute).toBe('projects')
  })

  it('moves visible sections while preserving hidden section order', () => {
    expect(moveDashboardSection(
      ['planning', 'insights', 'sessions'],
      ['planning', 'sessions'],
      'sessions',
      -1
    )).toEqual(['sessions', 'planning', 'insights'])
  })
})

