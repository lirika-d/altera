import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarDays, Link2, Timer, CheckCircle2, ArrowRight, Plus } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useRecentlyVisitedProjects, useActiveProjects, useProjects } from '@/hooks/useProjects'
import { useMyTasks, useAllTasks } from '@/hooks/useTasks'
import { useAllSessions } from '@/hooks/useSessions'
import { useNotes } from '@/hooks/useKnowledge'
import { StartSessionDialog } from '@/components/sessions/StartSessionDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { HeroArtwork } from '@/components/shared/HeroArtwork'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types'
import { cn } from '@/lib/utils'
import { useCalendarData } from '@/hooks/useCalendarData'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { getCalendarRange, localDateKey } from '@/lib/calendarDates'
import { formatCompactDuration, sumPlannedDuration } from '@/lib/planner'
import { appRoutes } from '@/lib/appRoutes'
import { WeeklyAnalyticsSummary } from '@/features/analytics/components/WeeklyAnalyticsSummary'
import { useAppPreferences } from '@/hooks/useAppPreferences'

function getGreetingKey(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'night'
}

function formatRelativeTime(date: Date, lang: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (lang === 'ru') {
    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes}м назад`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}ч назад`
    const days = Math.floor(hours / 24)
    return `${days}д назад`
  }
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatSessionTime(date: Date): string {
  const d = new Date(date)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatSessionDuration(ms: number, lang: string): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (lang === 'ru') {
    if (hours > 0) return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`
    return `${Math.max(1, minutes)}м`
  }
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${Math.max(1, minutes)}m`
}

export function Dashboard() {
  const { t, tx, i18n } = useTranslation()
  const navigate = useNavigate()
  const { setIsCreateProjectOpen } = useAppStore()
  const preferences = useAppPreferences()
  const visibleSections = new Set(preferences.dashboard.visible)
  const showPlanning = visibleSections.has('planning')
  const showInsights = visibleSections.has('insights')
  const showSessions = visibleSections.has('sessions')

  const recentProjects = useRecentlyVisitedProjects(3) || []
  const activeProjects = useActiveProjects() || []
  const projectRows = useProjects()
  const allProjects = projectRows || []
  const allTasks = useAllTasks() || []
  const myTasks = useMyTasks(6) || []
  const sessionRows = useAllSessions(showInsights || showSessions)
  const allSessions = sessionRows || []
  const recentNotes = useNotes() || []
  const now = useMinuteNow()
  const todayRange = getCalendarRange(now, 'day', 'ru')
  const todayCalendar = useCalendarData(todayRange.start, todayRange.end, showPlanning)
  const todayKey = localDateKey(now)

  const [sessionTargetProject, setSessionTargetProject] = React.useState<Project | null>(null)
  const [isStartSessionOpen, setIsStartSessionOpen] = React.useState(false)

  // Primary Hero Project selection (matching Stitch reference)
  const heroProject = recentProjects[0] || activeProjects[0] || allProjects[0]
  const todayTopTask = myTasks[0] || allTasks.find((task) => task.status !== 'done')
  const noteTaskProject = todayTopTask?.project || (todayTopTask ? allProjects.find((p) => p.id === todayTopTask.projectId) : undefined)
  const mostRecentNote = recentNotes[0]
  const noteLinkedProject = allProjects.find((p) => p.id === mostRecentNote?.projectId)

  // Completed vs pending counts
  const pendingTasks = allTasks.filter((task) => task.status !== 'done')
  const overdueTasks = allTasks.filter(task => (task.status === 'todo' || task.status === 'in_progress')
    && task.dueDate && localDateKey(task.dueDate) < todayKey)
  const todayPlannedBlocks = todayCalendar.blocks.filter(block => block.status === 'planned')
  const nextPlannedBlock = todayPlannedBlocks.filter(block => block.scheduledEnd > now)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())[0]
  const recentSessionsList = allSessions.slice(0, 4)

  const greetingTimeKey = getGreetingKey()
  const greetingWord = t(`dashboard.greeting.${greetingTimeKey}`)
  const userName = t('dashboard.greetingUser')

  return (
    <div className="w-full px-5 sm:px-7 lg:px-8 py-6 flex flex-col gap-6">
      {/* ─── 1. Greeting Header (Stitch Reference) ─── */}
      <div className="space-y-2">
        <h1 className="font-serif text-[30px] sm:text-[32px] font-normal leading-[1.15] text-text-primary tracking-[-0.025em]">
          {greetingWord}, {userName}.
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
          {pendingTasks.length > 0 && heroProject ? (
            <span>
              {i18n.language === 'ru' ? (
                <>
                  {tx("У вас")}{' '}
                  <span className="text-text-primary font-medium">{pendingTasks.length}</span>{' '}
                  {pendingTasks.length === 1
                    ? tx("незавершенная задача на сегодня")
                    : pendingTasks.length >= 2 && pendingTasks.length <= 4
                    ? tx("незавершенные задачи на сегодня")
                    : tx("незавершенных задач на сегодня")}
                  {tx(". Рекомендуем начать с")}{' '}
                  <Link
                    to={`/projects/${heroProject.id}`}
                    className="text-text-primary underline underline-offset-4 decoration-text-muted hover:decoration-accent-olive hover:text-accent-olive transition-colors font-medium"
                  >
                    {heroProject.name}
                  </Link>
                  .
                </>
              ) : (
                <>
                  {tx("You have")}{' '}
                  <span className="text-text-primary font-medium">{pendingTasks.length}</span>{' '}
                  {tx("pending tasks for today. We recommend starting with")}{' '}
                  <Link
                    to={`/projects/${heroProject.id}`}
                    className="text-text-primary underline underline-offset-4 decoration-text-muted hover:decoration-accent-olive hover:text-accent-olive transition-colors font-medium"
                  >
                    {heroProject.name}
                  </Link>
                  .
                </>
              )}
            </span>
          ) : (
            t('dashboard.subheadingEmpty')
          )}
        </p>
      </div>

      {/* ─── 2. Continue Working (Hero Card + Right Stack) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-base sm:text-[17px] font-semibold text-text-primary">
            {t('dashboard.continueWorking')}
          </h2>
          <Link
            to="/projects"
            className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {t('dashboard.allProjects')}
          </Link>
        </div>

        {heroProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 items-stretch">
            {/* Left Hero Card */}
            <div className="rounded-lg border border-border bg-bg-surface hover:border-[#3a3d34] p-5 relative overflow-hidden transition-colors flex flex-col justify-between min-h-[224px] group">
              {/* Subtle Architectural 3D Background Artwork */}
              <HeroArtwork className="left-auto w-[34%] opacity-30" />

              {/* Card Header Tags */}
              <div className="flex items-center gap-3 z-10">
                <span className="text-[11px] uppercase tracking-[0.05em] px-2 py-0.5 rounded border border-accent-olive/25 bg-accent-olive/10 text-accent-olive font-semibold">
                  {t('dashboard.product')}
                </span>
                <span className="text-xs text-text-muted">
                  {t('dashboard.updatedAgo', {
                    time: formatRelativeTime(heroProject.updatedAt, i18n.language),
                  })}
                </span>
              </div>

              {/* Card Center Content */}
              <div className="my-auto py-2 space-y-1.5 z-10 max-w-[78%]">
                <h3 className="font-serif text-[22px] sm:text-2xl font-normal text-text-primary tracking-[-0.02em] leading-[1.2]">
                  {heroProject.name}
                </h3>
                <p className="text-[13px] sm:text-sm text-text-secondary leading-relaxed max-w-[420px] line-clamp-2">
                  {heroProject.description || heroProject.nextAction || t('dashboard.noNextAction')}
                </p>
              </div>

              {/* Card Footer: Frosted Glass Button & Project Identifier */}
              <div className="flex flex-wrap items-center justify-between gap-2 z-10 pt-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${heroProject.id}`)}
                    className="h-8 px-3 sm:px-4 rounded-md text-[13px] font-medium whitespace-nowrap text-text-primary bg-bg-elevated hover:bg-bg-hover border border-border transition-colors select-none cursor-pointer"
                  >
                    {t('dashboard.openProject')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionTargetProject(heroProject)}
                    className="h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap text-[#171914] bg-accent-olive hover:brightness-110 border border-accent-olive transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Timer className="h-3.5 w-3.5" />
                    <span>{t('dashboard.resumeWork')}</span>
                  </button>
                </div>

                {heroProject.identifier && (
                  <span className="hidden sm:inline font-mono text-xs text-text-secondary px-2 py-1 rounded bg-bg-base border border-border-subtle">
                    {heroProject.identifier}
                  </span>
                )}
              </div>
            </div>

            {/* Right Stack: Today's Task + Recent Note */}
            <div className="flex flex-col rounded-lg border border-border bg-bg-surface divide-y divide-border-subtle overflow-hidden">
              {/* Card 1: Today's Task with Left 3px Olive Accent Line */}
              <button
                type="button"
                onClick={() => navigate('/my-tasks')}
                className={cn(
                  'w-full text-left flex-1 border-0 border-l-2 rounded-none bg-transparent p-4 hover:bg-bg-elevated/50 transition-colors cursor-pointer flex flex-col justify-between min-h-[108px] group',
                  todayTopTask ? 'border-l-accent-olive' : 'border-l-transparent'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                    {t('dashboard.todayTask')}
                  </span>
                  {todayTopTask ? (
                    <span className={cn(
                      'text-xs font-normal',
                      todayTopTask.priority === 'urgent'
                        ? 'text-accent-red font-medium'
                        : todayTopTask.priority === 'high'
                        ? 'text-accent-olive font-medium'
                        : 'text-[#9c9a8e]'
                    )}>
                      {todayTopTask.priority === 'urgent'
                        ? t('dashboard.urgentPriority')
                        : todayTopTask.priority === 'high'
                        ? t('dashboard.highPriority')
                        : todayTopTask.priority === 'medium'
                        ? t('dashboard.mediumPriority')
                        : t('dashboard.lowPriority')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-accent-olive">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{i18n.language === 'ru' ? tx("Все выполнено") : tx("All clear")}</span>
                    </span>
                  )}
                </div>

                {todayTopTask ? (
                  <div className="space-y-1">
                    <h4 className="text-[15px] font-medium text-text-primary line-clamp-1 group-hover:text-accent-olive transition-colors">
                      {todayTopTask.title}
                    </h4>
                    {(noteTaskProject?.name || heroProject?.name) && (
                      <p className="text-[13px] text-[#9c9a8e] line-clamp-2 leading-relaxed">
                        {noteTaskProject?.name || heroProject?.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="my-auto py-1">
                    <p className="text-sm font-medium text-text-primary">
                      {t('dashboard.noTasks')}
                    </p>
                    <p className="text-xs text-[#9c9a8e] line-clamp-2 mt-0.5 font-light">
                      {t('dashboard.noTasksDesc')}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 text-xs text-text-secondary group-hover:text-accent-olive transition-colors">
                  <span className="text-[11px] font-medium">
                    {i18n.language === 'ru' ? tx("Открыть Мои задачи") : tx("Open My Tasks")}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Card 2: Recent Note */}
              <button
                type="button"
                onClick={() => {
                  if (mostRecentNote) {
                    navigate(`/knowledge?tab=notes&note=${mostRecentNote.id}`)
                  } else {
                    navigate('/knowledge?tab=notes')
                  }
                }}
                className="w-full text-left flex-1 border-0 rounded-none bg-transparent p-4 hover:bg-bg-elevated/50 transition-colors cursor-pointer flex flex-col justify-between min-h-[108px] group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                    {t('dashboard.recentNote')}
                  </span>
                  {mostRecentNote ? (
                    <span className="text-xs text-text-muted">
                      {formatRelativeTime(mostRecentNote.updatedAt, i18n.language)}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">
                      {i18n.language === 'ru' ? tx("База знаний") : tx("Knowledge")}
                    </span>
                  )}
                </div>

                {mostRecentNote ? (
                  <div>
                    <h4 className="text-[15px] font-medium text-text-primary line-clamp-1 group-hover:text-accent-olive transition-colors">
                      {mostRecentNote.title}
                    </h4>
                    {noteLinkedProject?.name && (
                      <div className="flex items-center gap-1.5 text-xs text-[#828075] mt-2">
                        <Link2 className="h-3.5 w-3.5 text-[#828075]" />
                        <span className="truncate">
                          {t('dashboard.linkedTo')}: {noteLinkedProject.name}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="my-auto py-1">
                    <p className="text-sm font-medium text-text-primary">
                      {t('dashboard.noNotes')}
                    </p>
                    <p className="text-xs text-[#9c9a8e] line-clamp-2 mt-0.5 font-light">
                      {t('dashboard.noNotesDesc')}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 text-xs text-text-secondary group-hover:text-accent-olive transition-colors">
                  <span className="text-[11px] font-medium">
                    {mostRecentNote
                      ? (i18n.language === 'ru' ? 'Читать заметку' : 'Read Note')
                      : (i18n.language === 'ru' ? 'Открыть Базу знаний' : 'Open Knowledge Hub')}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        ) : (
          <EmptyState
            title={t('dashboard.noProjects')}
            description={t('dashboard.noProjectsDesc')}
            actionLabel={t('dashboard.createProject')}
            onAction={() => setIsCreateProjectOpen(true)}
          />
        )}
      </div>

      {/* Compact planning context. Continue Working remains the primary dashboard action. */}
      <section hidden={!showPlanning} style={{ order: preferences.dashboard.order.indexOf('planning') + 1 }} aria-labelledby="today-planning-title" className="border-y border-border-subtle px-1 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-accent-olive" />
            <h2 id="today-planning-title" className="font-sans text-sm font-semibold text-text-primary">{t('dashboard.todayPlanning')}</h2>
            <span className="font-mono text-xs text-text-muted">{formatCompactDuration(sumPlannedDuration(todayPlannedBlocks), i18n.language)}</span>
          </div>
          <Link to={appRoutes.calendar()} className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-2.5 text-[11px] text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive"><CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />{t('dashboard.openCalendar')}</Link>
        </div>
        {(nextPlannedBlock || overdueTasks.length > 0) ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            {nextPlannedBlock ? <Link to={appRoutes.calendarBlock(nextPlannedBlock.id)} className="flex min-w-0 items-center gap-2 text-text-secondary hover:text-text-primary"><span className="shrink-0 font-mono text-[10px] text-accent-olive">{nextPlannedBlock.scheduledStart.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span><span className="truncate">{nextPlannedBlock.title}</span></Link> : <span className="text-text-muted">{t('dashboard.noPlannedWork')}</span>}
            {overdueTasks.length > 0 ? <Link to={appRoutes.task(overdueTasks[0].id, overdueTasks[0].projectId)} className="flex shrink-0 items-center gap-1.5 text-[#c27b66] hover:text-[#d69582]"><span>{t('dashboard.overdueTasks', { count: overdueTasks.length })}</span><span className="max-w-40 truncate">{overdueTasks[0].title}</span></Link> : <span className="text-text-muted">{t('dashboard.noOverdueTasks')}</span>}
          </div>
        ) : <p className="mt-2 border-t border-border-subtle pt-2 text-xs text-text-muted">{t('dashboard.planningEmpty')}</p>}
      </section>

      <div hidden={!showInsights} style={{ order: preferences.dashboard.order.indexOf('insights') + 1 }}>
        <WeeklyAnalyticsSummary projects={allProjects} sessions={allSessions} now={now} isLoading={projectRows === undefined || sessionRows === undefined} />
      </div>

      {/* ─── 3. Recent Sessions (Stitch Reference Table) ─── */}
      <div hidden={!showSessions} style={{ order: preferences.dashboard.order.indexOf('sessions') + 1 }} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-base sm:text-[17px] font-semibold text-text-primary">
            {t('dashboard.recentSessions')}
          </h2>
          <Link
            to="/sessions"
            className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {t('dashboard.sessionHistory')}
          </Link>
        </div>

        {recentSessionsList.length > 0 ? (
          <div className="rounded-[8px] border border-border bg-bg-surface overflow-hidden">
            <div className="divide-y divide-border-subtle">
              {recentSessionsList.map((session) => {
                const sessionProject = allProjects.find((p) => p.id === session.projectId)
                const isCompleted =
                  session.status === 'completed' &&
                  session.outcome !== 'progress' &&
                  session.outcome !== 'saved'
                const isRunning = session.status === 'running'
                const isSaved =
                  session.outcome === 'progress' ||
                  session.outcome === 'saved' ||
                  session.status === 'paused'

                return (
                  <div
                    key={session.id}
                    onClick={() => navigate('/sessions')}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg-elevated/40 transition-colors text-xs cursor-pointer group"
                  >
                    {/* Time & Session Title */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="font-mono text-xs text-[#828075] w-14 shrink-0">
                        {formatSessionTime(session.startedAt)}
                      </span>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            isCompleted
                              ? 'bg-accent-olive'
                              : isRunning
                              ? 'bg-accent-green animate-pulse'
                              : 'bg-[#828075]'
                          )}
                        />
                        <span className="text-sm font-medium text-text-primary truncate group-hover:text-accent-olive transition-colors">
                          {session.title || `${t('dashboard.focusSession')}: ${sessionProject?.name || ''}`}
                        </span>
                      </div>
                    </div>

                    {/* Duration & Compact Status Badge */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 sm:pl-4">
                      <span className="text-[#828075] text-xs">
                        {t('dashboard.duration')}:{' '}
                        <span className="font-mono text-[#c4c2b6]">
                          {formatSessionDuration(session.accumulatedDurationMs, i18n.language)}
                        </span>
                      </span>

                      <span
                        className={cn(
                          'h-5 px-2.5 inline-flex items-center justify-center rounded-[3px] border font-mono text-[10px] uppercase tracking-wider font-semibold',
                          isCompleted
                            ? 'bg-[#1b2216] text-accent-olive border-accent-olive/30'
                            : isRunning
                            ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                            : 'bg-[#191917] text-[#9c9a8e] border-[#282823]'
                        )}
                      >
                        {isCompleted
                          ? t('dashboard.status.completed')
                          : isRunning
                          ? t('dashboard.status.running')
                          : isSaved
                          ? t('dashboard.status.saved')
                          : t('dashboard.status.completed')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Thoughtfully designed compact empty state with working actions using existing routes */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4 bg-bg-surface rounded-lg border border-border">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated border border-border text-accent-olive">
                <Timer className="h-4 w-4 stroke-[1.75]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {t('dashboard.noSessions')}
                </p>
                <p className="text-xs text-[#9c9a8e] truncate mt-0.5 font-light">
                  {t('dashboard.noSessionsDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/sessions')}
                className="text-xs font-sans h-7 text-text-secondary hover:text-text-primary border-border hover:border-border/80"
              >
                {t('dashboard.sessionHistory')}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
              <Button
                size="sm"
                variant="olive"
                onClick={() => setIsStartSessionOpen(true)}
                className="text-xs font-sans h-7 gap-1.5"
              >
                <Plus className="h-3 w-3" />
                <span>{t('sessions.newSession')}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Start Session Dialog when resuming project work or triggering new session */}
      <StartSessionDialog
        open={isStartSessionOpen || !!sessionTargetProject}
        onOpenChange={(open) => {
          if (!open) {
            setIsStartSessionOpen(false)
            setSessionTargetProject(null)
          }
        }}
        initialProjectId={sessionTargetProject?.id || heroProject?.id}
      />
    </div>
  )
}
