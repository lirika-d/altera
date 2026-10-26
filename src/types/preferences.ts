export type DefaultRoute = 'workspace' | 'projects' | 'my-tasks' | 'sessions' | 'calendar' | 'insights' | 'knowledge'
export type CalendarViewPreference = 'day' | 'week' | 'month'
export type DashboardSectionId = 'planning' | 'insights' | 'sessions'

export interface AppPreferences {
  schemaVersion: 1
  defaultRoute: DefaultRoute
  calendarView: CalendarViewPreference
  dashboard: {
    order: DashboardSectionId[]
    visible: DashboardSectionId[]
  }
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  schemaVersion: 1,
  defaultRoute: 'workspace',
  calendarView: 'week',
  dashboard: {
    order: ['planning', 'insights', 'sessions'],
    visible: ['planning', 'insights', 'sessions'],
  },
}

export const DASHBOARD_SECTION_IDS: readonly DashboardSectionId[] = ['planning', 'insights', 'sessions']

