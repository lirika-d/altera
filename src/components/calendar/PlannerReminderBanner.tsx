import { CalendarClock, CircleAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePlannerReminder, dismissPlannerReminder } from '@/hooks/usePlannerReminders'
import { appRoutes } from '@/lib/appRoutes'
import { useTranslation } from '@/i18n'

export function PlannerReminderBanner() {
  const reminder = usePlannerReminder()
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (!reminder) return null

  const isTask = reminder.kind === 'task'
  const title = isTask
    ? t('plannerReminder.overdueTask', { title: reminder.task.title })
    : t('plannerReminder.upcomingBlock', { title: reminder.block.title })
  const openTarget = () => navigate(isTask
    ? appRoutes.task(reminder.task.id, reminder.task.projectId)
    : appRoutes.calendarBlock(reminder.block.id))

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 border-b border-accent-olive/20 bg-[#171a14] px-4 py-2.5 text-xs sm:px-6">
      {isTask ? <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-[#c27b66]" /> : <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-olive" />}
      <p className="min-w-0 flex-1 truncate text-text-primary">{title}</p>
      <Button size="xs" variant="outline" onClick={openTarget}>{t('plannerReminder.open')}</Button>
      <button type="button" aria-label={t('plannerReminder.dismiss')} onClick={() => dismissPlannerReminder(reminder.key)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-muted hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive">
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
