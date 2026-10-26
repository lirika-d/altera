import {
  Timer,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Target,
  CheckSquare,
  Plus,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useActiveSession,
  useLiveElapsedMs,
  useSessionActions,
  formatTimer,
  formatDuration,
} from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { SessionKnowledgeLinks } from '@/components/knowledge/project'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface ActiveSessionPanelProps {
  onStartNew: () => void
  onEndSession: () => void
}

export function ActiveSessionPanel({
  onStartNew,
  onEndSession,
}: ActiveSessionPanelProps) {
  const { t, tx, i18n } = useTranslation()
  const activeSession = useActiveSession()
  const allProjects = useProjects() || []
  const allTasks = useAllTasks() || []
  const { pause, resume, isLoading, error } = useSessionActions()

  const liveElapsedMs = useLiveElapsedMs(activeSession)

  const project = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  const task = activeSession?.taskId
    ? allTasks.find((t) => t.id === activeSession.taskId)
    : undefined

  const isRunning = activeSession?.status === 'running'

  const handlePause = async () => {
    if (!activeSession) return
    try {
      await pause(activeSession.id)
    } catch {
      // useSessionActions exposes the actionable error directly below.
    }
  }

  const handleResume = async () => {
    if (!activeSession) return
    try {
      await resume(activeSession.id)
    } catch {
      // useSessionActions exposes the actionable error directly below.
    }
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-[#242420] bg-[#141412] hover:border-[#2e2e28] transition-all shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a1a17] border border-[#2e2e28] text-[#8a9e6b] shrink-0">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-[#eceeed] uppercase tracking-wider">
                {t('sessions.activePanel.noActive')}
              </h2>
              <span className="font-mono text-[10px] text-[#6b7280] px-2 py-0.5 rounded bg-[#1a1a17] border border-[#242420]">
                {tx("IDLE")}</span>
            </div>
            <p className="text-xs text-[#9ca3af] mt-1 font-sans">
              {t('sessions.activePanel.noActiveDesc')}
            </p>
          </div>
        </div>

        <Button
          onClick={onStartNew}
          variant="olive"
          size="sm"
          className="gap-1.5 shrink-0 shadow-sm self-start sm:self-auto font-sans"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('sessions.activePanel.startPrompt')}</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 bg-[#141412] transition-all duration-200 shadow-md',
        isRunning
          ? 'border-[#8a9e6b]/40 ring-1 ring-[#8a9e6b]/20'
          : 'border-amber-500/40 ring-1 ring-amber-500/20'
      )}
    >
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#242420]">
        {/* Project & Task Meta */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              isRunning
                ? 'bg-[#8a9e6b]/15 text-[#8a9e6b] border-[#8a9e6b]/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isRunning
                  ? 'bg-[#8a9e6b] animate-pulse'
                  : 'bg-amber-400'
              )}
            />
            <span className="capitalize">
              {isRunning ? t('sessions.activePanel.running') : t('sessions.activePanel.paused')}
            </span>
          </div>

          {/* Project tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a17] border border-[#242420] text-xs">
            <span>{project?.icon || '📁'}</span>
            <span className="font-mono text-[10px] text-[#8a9e6b] font-medium">
              {project?.identifier || 'PROJECT'}
            </span>
            <span className="font-medium text-[#eceeed] truncate max-w-[200px]">
              {project?.name || tx('Unknown Project')}
            </span>
          </div>

          {/* Task badge if selected */}
          {task && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a17] border border-[#242420] text-xs text-[#9ca3af] truncate max-w-[220px]">
              <CheckSquare className="h-3 w-3 text-[#6b7280] shrink-0" />
              <span className="truncate">{task.title}</span>
            </div>
          )}
        </div>

        {/* Live Timer Display */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-semibold text-[#6b7280] flex items-center justify-end gap-1 tracking-wider">
              {isRunning && <Flame className="h-3 w-3 text-[#8a9e6b] animate-pulse" />}
              {tx("Elapsed Time")}</div>
            <div
              className={cn(
                'font-mono text-2xl md:text-3xl font-bold tracking-tight',
                isRunning ? 'text-[#8a9e6b]' : 'text-amber-400'
              )}
            >
              {formatTimer(liveElapsedMs)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <h2 className="font-serif text-lg md:text-xl font-medium text-[#eceeed] tracking-tight">
            {activeSession.title}
          </h2>

          {activeSession.objective ? (
            <div className="flex items-start gap-2 text-xs md:text-sm text-[#9ca3af]">
              <Target className="h-3.5 w-3.5 text-[#8a9e6b] shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">
                {activeSession.objective}
              </span>
            </div>
          ) : (
            <p className="text-xs text-[#6b7280] italic">
              {tx("No objective set for this session.")}</p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 pt-1 md:pt-0">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={isLoading}
              className="gap-1.5 bg-[#1a1a17] hover:bg-[#242420] text-[#eceeed] border-[#2e2e28]"
            >
              <Pause className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('sessions.activePanel.pause')}</span>
            </Button>
          ) : (
            <Button
              variant="olive"
              size="sm"
              onClick={handleResume}
              disabled={isLoading}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t('sessions.activePanel.resume')}</span>
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={onEndSession}
            disabled={isLoading}
            className="gap-1.5 bg-[#1f201c] hover:bg-[#2e2e28] text-[#eceeed] border border-[#3a3a30] shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#8a9e6b]" />
            <span>{t('sessions.activePanel.finish')}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Linked Knowledge Notes & Resources during Active Session */}
      <SessionKnowledgeLinks
        sessionId={activeSession.id}
        projectId={activeSession.projectId}
        sessionTitle={activeSession.title}
        compact={true}
      />

      {/* Micro-footer info */}
      <div className="pt-3 border-t border-[#242420] flex items-center justify-between text-[10px] text-[#6b7280] font-mono">
        <span>
          {tx("Started at")} {new Date(activeSession.startedAt).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span>
          {tx("Banked:")} {formatDuration(activeSession.accumulatedDurationMs)}
        </span>
      </div>
    </div>
  )
}
