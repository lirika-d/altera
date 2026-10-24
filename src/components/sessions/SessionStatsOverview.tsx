import { Clock, Calendar, CheckCircle, Activity } from 'lucide-react'
import {
  useAllSessions,
  useActiveSession,
  useLiveElapsedMs,
  formatDuration,
} from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useMinuteNow } from '@/hooks/useMinuteNow'

export function SessionStatsOverview() {
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

  const statCards = [
    {
      title: 'Focus Time Today',
      value: formatDuration(focusTodayMs),
      subtext: `${allSessions.filter((s) => new Date(s.startedAt).toDateString() === todayStr).length} sessions logged`,
      icon: Clock,
      color: 'text-accent-blue',
      borderColor: 'border-accent-blue/20',
    },
    {
      title: 'Focus Time This Week',
      value: formatDuration(focusWeekMs),
      subtext: 'Mon – Today',
      icon: Calendar,
      color: 'text-accent-purple',
      borderColor: 'border-accent-purple/20',
    },
    {
      title: 'Completed Sessions',
      value: completedCount.toString(),
      subtext: 'Lifetime total',
      icon: CheckCircle,
      color: 'text-accent-green',
      borderColor: 'border-accent-green/20',
    },
    {
      title: 'Active Session',
      value: activeSession
        ? activeSession.status === 'running'
          ? 'Running'
          : 'Paused'
        : 'Idle',
      subtext: activeSession
        ? activeProject?.name || activeSession.title
        : 'Ready to focus',
      icon: Activity,
      color: activeSession
        ? activeSession.status === 'running'
          ? 'text-accent-green'
          : 'text-accent-amber'
        : 'text-text-muted',
      borderColor: activeSession
        ? activeSession.status === 'running'
          ? 'border-accent-green/30'
          : 'border-accent-amber/30'
        : 'border-border-subtle',
      isPulsing: activeSession?.status === 'running',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statCards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.title}
            className="p-3.5 rounded-lg border border-border bg-bg-surface flex flex-col justify-between shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                {c.title}
              </span>
              <Icon className={`h-3.5 w-3.5 ${c.color}`} />
            </div>

            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                {c.isPulsing && (
                  <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                )}
                <div className={`font-mono text-lg font-bold tracking-tight text-text-primary`}>
                  {c.value}
                </div>
              </div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">
                {c.subtext}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
