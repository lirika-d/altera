import { appPreferencesStore, APP_PREFERENCES_KEY } from '@/lib/appPreferences'
import { DASHBOARD_SECTION_IDS, type AppPreferences } from '@/types/preferences'
import { PLANNER_REMINDER_LEAD_KEY, PLANNER_REMINDER_SETTINGS_EVENT } from '@/lib/plannerReminderSettings'

export interface BackupPreferences {
  appPreferences: AppPreferences
  plannerReminderLeadMinutes: 5 | 10 | 15 | 30
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const defaultRouteValues = ['workspace', 'projects', 'my-tasks', 'sessions', 'calendar', 'insights', 'knowledge']
const calendarViewValues = ['day', 'week', 'month']
const reminderLeadValues = [5, 10, 15, 30] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isValidBackupPreferences(value: unknown): value is BackupPreferences {
  if (!isRecord(value) || !isRecord(value.appPreferences)) return false
  const preferences = value.appPreferences
  if (preferences.schemaVersion !== 1
    || !defaultRouteValues.includes(preferences.defaultRoute as string)
    || !calendarViewValues.includes(preferences.calendarView as string)
    || !isRecord(preferences.dashboard)) return false

  const { order, visible } = preferences.dashboard
  const sections = DASHBOARD_SECTION_IDS as readonly string[]
  if (!Array.isArray(order) || order.length !== sections.length
    || order.some(item => typeof item !== 'string' || !sections.includes(item))
    || new Set(order).size !== sections.length) return false
  if (!Array.isArray(visible)
    || visible.some(item => typeof item !== 'string' || !sections.includes(item))
    || new Set(visible).size !== visible.length) return false

  return reminderLeadValues.includes(value.plannerReminderLeadMinutes as typeof reminderLeadValues[number])
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function exportBackupPreferences(): BackupPreferences {
  let plannerReminderLeadMinutes: BackupPreferences['plannerReminderLeadMinutes'] = 10
  try {
    const raw = Number(getBrowserStorage()?.getItem(PLANNER_REMINDER_LEAD_KEY))
    if (reminderLeadValues.includes(raw as typeof reminderLeadValues[number])) {
      plannerReminderLeadMinutes = raw as BackupPreferences['plannerReminderLeadMinutes']
    }
  } catch {
    // Use the documented default when browser storage is unavailable.
  }
  return {
    appPreferences: structuredClone(appPreferencesStore.getSnapshot()),
    plannerReminderLeadMinutes,
  }
}

/** Writes only the two explicitly portable preference keys; recovery and dismissal data is untouched. */
export function restoreBackupPreferences(
  value: BackupPreferences,
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  if (!storage || !isValidBackupPreferences(value)) return false

  let previousAppPreferences: string | null = null
  let previousReminderLead: string | null = null
  try {
    previousAppPreferences = storage.getItem(APP_PREFERENCES_KEY)
    previousReminderLead = storage.getItem(PLANNER_REMINDER_LEAD_KEY)
  } catch {
    // If the pre-import snapshot cannot be read, do not attempt writes or rollback.
    return false
  }

  try {
    storage.setItem(APP_PREFERENCES_KEY, JSON.stringify(value.appPreferences))
    storage.setItem(PLANNER_REMINDER_LEAD_KEY, String(value.plannerReminderLeadMinutes))
  } catch {
    try {
      if (previousAppPreferences === null) storage.removeItem(APP_PREFERENCES_KEY)
      else storage.setItem(APP_PREFERENCES_KEY, previousAppPreferences)
      if (previousReminderLead === null) storage.removeItem(PLANNER_REMINDER_LEAD_KEY)
      else storage.setItem(PLANNER_REMINDER_LEAD_KEY, previousReminderLead)
    } catch {
      // Surface failure to the caller; never clear or rewrite unrelated keys.
    }
    return false
  }

  appPreferencesStore.syncFromStorage(JSON.stringify(value.appPreferences))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLANNER_REMINDER_SETTINGS_EVENT))
  return true
}
