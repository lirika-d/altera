import * as React from 'react'
import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appPreferencesStore, moveDashboardSection } from '@/lib/appPreferences'
import { useAppPreferences } from '@/hooks/useAppPreferences'
import { DASHBOARD_SECTION_IDS } from '@/types/preferences'
import type { AppPreferences, DashboardSectionId, DefaultRoute } from '@/types/preferences'

export function PersonalizationSettings() {
  const { t } = useTranslation()
  const preferences = useAppPreferences()
  const [storageWarning, setStorageWarning] = React.useState(false)

  const save = (change: Partial<AppPreferences> | ((current: AppPreferences) => AppPreferences)) => {
    setStorageWarning(!appPreferencesStore.update(change))
  }

  const visibleOrderedSections = preferences.dashboard.order.filter(section =>
    preferences.dashboard.visible.includes(section)
  )

  const toggleSection = (section: DashboardSectionId, checked: boolean) => {
    save(current => {
      const visible = new Set(current.dashboard.visible)
      if (checked) visible.add(section)
      else visible.delete(section)
      return { ...current, dashboard: { ...current.dashboard, visible: DASHBOARD_SECTION_IDS.filter(item => visible.has(item)) } }
    })
  }

  const moveSection = (section: DashboardSectionId, direction: -1 | 1) => {
    save(current => ({
      ...current,
      dashboard: {
        ...current.dashboard,
        order: moveDashboardSection(current.dashboard.order, current.dashboard.visible, section, direction),
      },
    }))
  }

  const reset = () => setStorageWarning(!appPreferencesStore.reset())

  const sectionLabels: Record<DashboardSectionId, string> = {
    planning: t('settings.preferences.sections.planning'),
    insights: t('settings.preferences.sections.insights'),
    sessions: t('settings.preferences.sections.sessions'),
  }

  return (
    <section aria-labelledby="personalization-title" className="overflow-hidden rounded-xl border border-[#242420] bg-[#141412] shadow-sm">
      <header className="flex items-center justify-between border-b border-[#242420] bg-[#1a1a17]/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-[#8a9e6b]" />
          <h2 id="personalization-title" className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
            {t('settings.preferences.title')}
          </h2>
        </div>
      </header>

      <div className="space-y-6 p-5">
        <p className="text-xs leading-relaxed text-[#9ca3af]">{t('settings.preferences.description')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary" htmlFor="default-route">
              {t('settings.preferences.defaultRoute')}
            </label>
            <Select value={preferences.defaultRoute} onValueChange={value => save({ defaultRoute: value as DefaultRoute })}>
              <SelectTrigger id="default-route" aria-label={t('settings.preferences.defaultRoute')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">{t('settings.preferences.routes.workspace')}</SelectItem>
                <SelectItem value="projects">{t('settings.preferences.routes.projects')}</SelectItem>
                <SelectItem value="my-tasks">{t('settings.preferences.routes.tasks')}</SelectItem>
                <SelectItem value="sessions">{t('settings.preferences.routes.sessions')}</SelectItem>
                <SelectItem value="calendar">{t('settings.preferences.routes.calendar')}</SelectItem>
                <SelectItem value="insights">{t('settings.preferences.routes.insights')}</SelectItem>
                <SelectItem value="knowledge">{t('settings.preferences.routes.knowledge')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary" htmlFor="default-calendar-view">
              {t('settings.preferences.calendarView')}
            </label>
            <Select value={preferences.calendarView} onValueChange={value => save({ calendarView: value as AppPreferences['calendarView'] })}>
              <SelectTrigger id="default-calendar-view" aria-label={t('settings.preferences.calendarView')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('calendar.day')}</SelectItem>
                <SelectItem value="week">{t('calendar.week')}</SelectItem>
                <SelectItem value="month">{t('calendar.month')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-3 border-t border-[#242420] pt-5">
          <legend className="text-sm font-medium text-text-primary">{t('settings.preferences.workspaceSections')}</legend>
          <p className="text-xs text-[#9ca3af]">{t('settings.preferences.workspaceSectionsDescription')}</p>
          <div className="space-y-2">
            {preferences.dashboard.order.map(section => {
              const visible = preferences.dashboard.visible.includes(section)
              const visibleIndex = visibleOrderedSections.indexOf(section)
              return (
                <div key={section} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#242420] bg-[#0e0e0d] px-3 py-2">
                  <label className="flex min-h-8 flex-1 cursor-pointer items-center gap-3 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={event => toggleSection(section, event.currentTarget.checked)}
                      className="h-4 w-4 accent-[#8a9e6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3b899]"
                    />
                    <span>{sectionLabels[section]}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('settings.preferences.moveUp', { name: sectionLabels[section] })}
                      disabled={!visible || visibleIndex === 0}
                      onClick={() => moveSection(section, -1)}
                    >
                      <ChevronUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('settings.preferences.moveDown', { name: sectionLabels[section] })}
                      disabled={!visible || visibleIndex === visibleOrderedSections.length - 1}
                      onClick={() => moveSection(section, 1)}
                    >
                      <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>

        {storageWarning && (
          <p role="status" className="text-xs text-amber-300">{t('settings.preferences.storageWarning')}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#242420] pt-4">
          <p className="max-w-xl text-xs leading-relaxed text-[#828075]">{t('settings.preferences.resetDescription')}</p>
          <Button type="button" variant="secondary" onClick={reset} className="gap-2">
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            {t('settings.preferences.reset')}
          </Button>
        </div>
      </div>
    </section>
  )
}

