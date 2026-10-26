import { Clock, Calendar, CheckCircle, Activity } from 'lucide-react'
import {
  useAllSessions,
  useActiveSession,
  useLiveElapsedMs,
  formatDuration,
} from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { useTranslation } from '@/i18n'

export function SessionStatsOverview() {
  const { t } = useTranslation()
  const allSessions = useAllSessions() || []
  const activeSession = useActiveSession()
  const liveElapsedMs = useLiveElapsedMs(activeSession)
  const allProjects = useProjects() || []
  const now = useMinuteNow()

  // Compute metrics
  const todayStr = now.toDateString()

  // Week starting Monday 00:00:00
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  let focusTodayMs = 0
  let focusWeekMs = 0
  let completedCount = 0

  for (const s of allSessions) {
    if (s.status === 'completed') {
      completedCount++
      const sDate = new Date(s.startedAt)
      if (sDate.toDateString() === todayStr) {
        focusTodayMs += s.accumulatedDurationMs
      }
      if (sDate >= startOfWeek) {
        focusWeekMs += s.accumulatedDurationMs
      }
    }
  }

  // Include running/paused active session time in today & this week
  if (activeSession) {
    const sDate = new Date(activeSession.startedAt)
    if (sDate.toDateString() === todayStr) {
      focusTodayMs += liveElapsedMs
    }
    if (sDate >= startOfWeek) {
      focusWeekMs += liveElapsedMs
    }
  }

  const activeProject = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  const todaySessionsCount = allSessions.filter((s) => new Date(s.startedAt).toDateString() === todayStr).length

  const statCards = [
    {
      title: t('sessions.overview.todayFocus'),
      value: formatDuration(focusTodayMs),
      subtext: `${todaySessionsCount} ${todaySessionsCount === 1 ? 'session' : 'sessions'}`,
      icon: Clock,
      color: 'text-[#8a9e6b]',
    },
    {
      title: t('sessions.overview.weekFocus'),
      value: formatDuration(focusWeekMs),
      subtext: 'Mon – Today',
      icon: Calendar,
      color: 'text-[#a3b899]',
    },
    {
      title: t('sessions.overview.completedSessions'),
      value: completedCount.toString(),
      subtext: 'Total sprints',
      icon: CheckCircle,
      color: 'text-[#8a9e6b]',
    },
    {
      title: t('sessions.activePanel.currentSprint'),
      value: activeSession
        ? activeSession.status === 'running'
          ? t('sessions.activePanel.running')
          : t('sessions.activePanel.paused')
        : 'Idle',
      subtext: activeSession
        ? activeProject?.name || activeSession.title
        : 'Ready to focus',
      icon: Activity,
      color: activeSession
        ? activeSession.status === 'running'
          ? 'text-[#8a9e6b]'
          : 'text-amber-400'
        : 'text-[#6b7280]',
      isPulsing: activeSession?.status === 'running',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
      {statCards.map((c, index) => {
        const Icon = c.icon
        return (
          <div
            key={c.title}
            className={`flex flex-col justify-between p-3.5 transition-colors hover:bg-bg-elevated/30 border-border-subtle ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b md:border-b-0' : ''} ${index < 3 ? 'md:border-r' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-semibold text-text-muted tracking-[0.04em]">
                {c.title}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-2">
                {c.isPulsing && (
                  <span className="h-2 w-2 rounded-full bg-[#8a9e6b] animate-pulse" />
                )}
                <div className="font-mono text-xl font-semibold tracking-tight text-text-primary">
                  {c.value}
                </div>
              </div>
              <div className="text-xs text-text-secondary truncate mt-0.5">
                {c.subtext}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
