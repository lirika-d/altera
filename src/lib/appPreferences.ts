import type { AppPreferences, DashboardSectionId } from '@/types/preferences'
import { DASHBOARD_SECTION_IDS, DEFAULT_APP_PREFERENCES } from '@/types/preferences'

export const APP_PREFERENCES_KEY = 'altera:preferences:v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type Listener = () => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validSection(value: unknown): value is DashboardSectionId {
  return typeof value === 'string' && DASHBOARD_SECTION_IDS.includes(value as DashboardSectionId)
}

function uniqueSections(values: unknown): DashboardSectionId[] {
  if (!Array.isArray(values)) return []
  return values.filter((value, index): value is DashboardSectionId =>
    validSection(value) && values.indexOf(value) === index
  )
}

export function normalizeAppPreferences(value: unknown): AppPreferences {
  if (!isRecord(value) || value.schemaVersion !== 1) return structuredClone(DEFAULT_APP_PREFERENCES)

  const dashboard = isRecord(value.dashboard) ? value.dashboard : {}
  const savedOrder = uniqueSections(dashboard.order)
  const order = [...savedOrder, ...DASHBOARD_SECTION_IDS.filter(section => !savedOrder.includes(section))]
  const visible = Array.isArray(dashboard.visible)
    ? uniqueSections(dashboard.visible)
    : [...DEFAULT_APP_PREFERENCES.dashboard.visible]

  const validDefaultRoutes = ['workspace', 'projects', 'my-tasks', 'sessions', 'calendar', 'insights', 'knowledge']
  const defaultRoute = validDefaultRoutes.includes(value.defaultRoute as string)
    ? value.defaultRoute as AppPreferences['defaultRoute']
    : DEFAULT_APP_PREFERENCES.defaultRoute
  const validCalendarViews = ['day', 'week', 'month']
  const calendarView = validCalendarViews.includes(value.calendarView as string)
    ? value.calendarView as AppPreferences['calendarView']
    : DEFAULT_APP_PREFERENCES.calendarView

  return { schemaVersion: 1, defaultRoute, calendarView, dashboard: { order, visible } }
}

function readStorage(storage: StorageLike | null): AppPreferences {
  if (!storage) return structuredClone(DEFAULT_APP_PREFERENCES)
  try {
    const raw = storage.getItem(APP_PREFERENCES_KEY)
    return raw ? normalizeAppPreferences(JSON.parse(raw)) : structuredClone(DEFAULT_APP_PREFERENCES)
  } catch {
    return structuredClone(DEFAULT_APP_PREFERENCES)
  }
}

export function createAppPreferencesStore(storage: StorageLike | null) {
  let snapshot = readStorage(storage)
  const listeners = new Set<Listener>()

  const publish = () => listeners.forEach(listener => listener())

  const update = (
    change: Partial<AppPreferences> | ((current: AppPreferences) => AppPreferences)
  ): boolean => {
    const candidate = typeof change === 'function' ? change(snapshot) : { ...snapshot, ...change }
    const next = normalizeAppPreferences(candidate)
    let persisted = false
    try {
      if (storage) {
        storage.setItem(APP_PREFERENCES_KEY, JSON.stringify(next))
        persisted = true
      }
    } catch {
      // Keep the current-tab preference usable, but let the UI report that it
      // could not be persisted for the next visit.
    }
    snapshot = next
    publish()
    return persisted
  }

  const reset = (): boolean => update(structuredClone(DEFAULT_APP_PREFERENCES))

  const syncFromStorage = (raw: string | null) => {
    let next = structuredClone(DEFAULT_APP_PREFERENCES)
    try {
      if (raw) next = normalizeAppPreferences(JSON.parse(raw))
    } catch {
      // A malformed cross-tab update falls back to defaults without throwing.
    }
    snapshot = next
    publish()
  }

  const subscribe = (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { getSnapshot: () => snapshot, subscribe, update, reset, syncFromStorage }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const appPreferencesStore = createAppPreferencesStore(getBrowserStorage())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === APP_PREFERENCES_KEY || event.key === null) {
      appPreferencesStore.syncFromStorage(event.key === null ? null : event.newValue)
    }
  })
}

export function moveDashboardSection(
  order: readonly DashboardSectionId[],
  visible: readonly DashboardSectionId[],
  section: DashboardSectionId,
  direction: -1 | 1
): DashboardSectionId[] {
  const visibleOrder = order.filter(item => visible.includes(item))
  const index = visibleOrder.indexOf(section)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= visibleOrder.length) return [...order]
  ;[visibleOrder[index], visibleOrder[nextIndex]] = [visibleOrder[nextIndex], visibleOrder[index]]
  const hiddenOrder = order.filter(item => !visible.includes(item))
  return [...visibleOrder, ...hiddenOrder]
}

