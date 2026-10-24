import { useLocation, useNavigate } from 'react-router-dom'
import {
  Pause,
  Play,
  ArrowUpRight,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useActiveSession,
  useLiveElapsedMs,
  useSessionActions,
  formatTimer,
} from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

export function ActiveSessionBanner() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeSession = useActiveSession()
  const allProjects = useProjects() || []
  const { pause, resume, isLoading, error } = useSessionActions()
  const liveElapsedMs = useLiveElapsedMs(activeSession)

  // Do not duplicate when user is already on the dedicated /sessions page
  if (!activeSession || location.pathname === '/sessions') {
    return null
  }

  const project = allProjects.find((p) => p.id === activeSession.projectId)
  const isRunning = activeSession.status === 'running'

  const handleToggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (isRunning) {
        await pause(activeSession.id)
      } else {
        await resume(activeSession.id)
      }
    } catch {
      // Keep the action error available in the banner tooltip.
    }
  }

  return (
    <div
      onClick={() => navigate('/sessions')}
      title={error || 'Open active work session'}
      className={cn(
        'group flex items-center justify-between h-9 px-4 border-b text-xs transition-colors cursor-pointer select-none shrink-0 z-10',
        isRunning
          ? 'bg-accent-blue/10 border-accent-blue/30 hover:bg-accent-blue/15 text-text-primary'
          : 'bg-accent-amber/10 border-accent-amber/30 hover:bg-accent-amber/15 text-text-primary'
      )}
    >
      {/* Left: Indicator, Project, Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isRunning
                ? 'bg-accent-green animate-pulse'
                : 'bg-accent-amber'
            )}
          />
          <span
            className={cn(
              'font-mono text-[10px] font-semibold uppercase',
              isRunning ? 'text-accent-green' : 'text-accent-amber'
            )}
          >
            {activeSession.status}
          </span>
        </div>

        <div className="h-3 w-px bg-border-subtle shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span>{project?.icon || '📁'}</span>
          <span className="font-mono text-[10px] text-text-muted shrink-0">
            {project?.identifier || 'ALT'}
          </span>
          <span className="font-medium text-text-primary truncate">
            {activeSession.title}
          </span>
        </div>
      </div>

      {/* Right: Live Timer, Quick Controls, Open */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
          {isRunning && <Flame className="h-3 w-3 text-accent-blue animate-pulse" />}
          <span className={isRunning ? 'text-accent-blue' : 'text-accent-amber'}>
            {formatTimer(liveElapsedMs)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleToggleTimer}
            disabled={isLoading}
            className="h-6 px-1.5 text-text-secondary hover:text-text-primary"
            title={isRunning ? 'Pause session' : 'Resume session'}
          >
            {isRunning ? (
              <Pause className="h-3 w-3 text-accent-amber" />
            ) : (
              <Play className="h-3 w-3 text-accent-green" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              navigate('/sessions')
            }}
            className="h-6 px-1.5 gap-1 text-[11px] text-text-secondary group-hover:text-text-primary"
          >
            <span>Open</span>
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
