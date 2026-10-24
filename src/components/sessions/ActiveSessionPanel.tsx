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
import { cn } from '@/lib/utils'

interface ActiveSessionPanelProps {
  onStartNew: () => void
  onEndSession: () => void
}

export function ActiveSessionPanel({
  onStartNew,
  onEndSession,
}: ActiveSessionPanelProps) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border-subtle bg-bg-surface hover:border-border transition-colors shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted shrink-0">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                Focus Engine
              </h2>
              <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
                IDLE
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              No session currently active. Launch a timed focus sprint to track progress.
            </p>
          </div>
        </div>

        <Button
          onClick={onStartNew}
          size="sm"
          className="gap-1.5 shrink-0 shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Start Work Session</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4.5 bg-gradient-to-br from-bg-surface via-bg-surface to-bg-elevated transition-all duration-200 shadow-md',
        isRunning
          ? 'border-accent-blue/40 ring-1 ring-accent-blue/20'
          : 'border-accent-amber/40 ring-1 ring-accent-amber/20'
      )}
    >
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        {/* Project & Task Meta */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              isRunning
                ? 'bg-accent-green/15 text-accent-green border-accent-green/30'
                : 'bg-accent-amber/15 text-accent-amber border-accent-amber/30'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isRunning
                  ? 'bg-accent-green animate-pulse'
                  : 'bg-accent-amber'
              )}
            />
            <span className="capitalize">{activeSession.status}</span>
          </div>

          {/* Project tag */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-base border border-border-subtle text-xs">
            <span>{project?.icon || '📁'}</span>
            <span className="font-mono text-[10px] text-text-muted">
              {project?.identifier || 'PROJECT'}
            </span>
            <span className="font-medium text-text-primary truncate max-w-[180px]">
              {project?.name || 'Unknown Project'}
            </span>
          </div>

          {/* Task badge if selected */}
          {task && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-base border border-border-subtle text-[11px] text-text-secondary truncate max-w-[200px]">
              <CheckSquare className="h-3 w-3 text-text-muted shrink-0" />
              <span className="truncate">{task.title}</span>
            </div>
          )}
        </div>

        {/* Live Timer Display (Top Right on wide screens) */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-semibold text-text-muted flex items-center justify-end gap-1">
              {isRunning && <Flame className="h-2.5 w-2.5 text-accent-blue animate-pulse" />}
              Elapsed Time
            </div>
            <div
              className={cn(
                'font-mono text-2xl font-bold tracking-tight',
                isRunning ? 'text-accent-blue' : 'text-accent-amber'
              )}
            >
              {formatTimer(liveElapsedMs)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">
            {activeSession.title}
          </h2>

          {activeSession.objective ? (
            <div className="flex items-start gap-1.5 text-xs text-text-secondary">
              <Target className="h-3.5 w-3.5 text-accent-purple shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">
                {activeSession.objective}
              </span>
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              No objective set for this session.
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
          {isRunning ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePause}
              disabled={isLoading}
              className="gap-1.5 bg-bg-elevated hover:bg-bg-hover text-text-primary border-border"
            >
              <Pause className="h-3.5 w-3.5 text-accent-amber" />
              <span>Pause</span>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleResume}
              disabled={isLoading}
              className="gap-1.5 bg-accent-green hover:bg-accent-green/90 text-white"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Resume</span>
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={onEndSession}
            disabled={isLoading}
            className="gap-1.5 bg-accent-blue hover:bg-accent-blue/90 shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>End Session</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 rounded border border-accent-red/30 bg-accent-red/10 text-accent-red text-xs flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Micro-footer info */}
      <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[10px] text-text-muted font-mono">
        <span>
          Started at {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span>
          Banked: {formatDuration(activeSession.accumulatedDurationMs)}
        </span>
      </div>
    </div>
  )
}
