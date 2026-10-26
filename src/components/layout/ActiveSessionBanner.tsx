import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Pause,
  Play,
  ArrowUpRight,
  Flame,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
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
  const { t } = useTranslation()
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
      title={error || t('session.open')}
      className={cn(
        'group flex items-center justify-between h-9 px-6 border-b text-xs transition-colors cursor-pointer select-none shrink-0 z-10',
        isRunning
          ? 'bg-[#1b2216]/80 border-accent-olive/30 hover:bg-[#20291a] text-text-primary'
          : 'bg-[#261f14]/80 border-accent-amber/30 hover:bg-[#2e2618] text-text-primary'
      )}
    >
      {/* Left: Indicator, Project, Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isRunning
                ? 'bg-accent-olive animate-pulse'
                : 'bg-accent-amber'
            )}
          />
          <span
            className={cn(
              'font-mono text-[11px] font-semibold uppercase tracking-wider',
              isRunning ? 'text-accent-olive' : 'text-accent-amber'
            )}
          >
            {isRunning ? t('session.running') : t('session.paused')}
          </span>
        </div>

        <div className="h-3 w-px bg-border-subtle shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span>{project?.icon || '📁'}</span>
          <span className="font-mono text-[11px] text-text-muted shrink-0">
            {project?.identifier || 'ALT'}
          </span>
          <span className="font-medium text-text-primary truncate">
            {activeSession.title}
          </span>
        </div>
      </div>

      {/* Right: Live Timer, Quick Controls, Open */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
          {isRunning && <Flame className="h-3 w-3 text-accent-olive animate-pulse" />}
          <span className={isRunning ? 'text-accent-olive' : 'text-accent-amber'}>
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
            title={isRunning ? t('session.pause') : t('session.resume')}
          >
            {isRunning ? (
              <Pause className="h-3 w-3 text-accent-amber" />
            ) : (
              <Play className="h-3 w-3 text-accent-olive" />
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
            <span>{t('session.open')}</span>
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
