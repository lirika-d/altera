import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, Target, CheckCircle2, Timer } from 'lucide-react'
import type { Project } from '@/types'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import { Button } from '@/components/ui/button'
import { useLatestProjectSession, useActiveSession } from '@/hooks/useSessions'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

interface ProjectCardProps {
  project: Project
  className?: string
  onResumeWork?: (project: Project) => void
}

function formatRelativeTime(date: Date | undefined, language: string, tx: (source: string) => string): string {
  if (!date) return tx('Recently')
  const parsedDate = new Date(date)
  const diff = Date.now() - parsedDate.getTime()
  if (!Number.isFinite(diff)) return tx('Recently')
  const relative = new Intl.RelativeTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    numeric: 'auto',
    style: 'narrow',
  })
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return relative.format(0, 'second')
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return relative.format(-days, 'day')
}

export function ProjectCard({ project, className, onResumeWork }: ProjectCardProps) {
  const { tx, i18n } = useTranslation()
  const navigate = useNavigate()
  const latestSession = useLatestProjectSession(project.id)
  const activeSession = useActiveSession()

  const isThisProjectActive = activeSession?.projectId === project.id

  const handleResumeWork = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeSession) {
      navigate('/sessions')
    } else if (onResumeWork) {
      onResumeWork(project)
    } else {
      navigate(`/projects/${project.id}`)
    }
  }

  let resumeButtonLabel = 'Resume Work'
  if (activeSession) {
    resumeButtonLabel = isThisProjectActive ? 'Resume Active Session' : 'View Active Session'
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className={cn(
        'group relative flex flex-col justify-between p-4 rounded-lg border border-border bg-bg-surface hover:bg-bg-elevated hover:border-border/80 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md',
        isThisProjectActive && 'ring-1 ring-accent-olive/40 border-accent-olive/50',
        className
      )}
    >
      <div>
        {/* Top bar: icon, identifier, status, and last session date */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex h-6 w-6 items-center justify-center rounded text-sm bg-bg-base border border-border shrink-0 select-none"
              style={{ borderColor: `${project.color}30` }}
            >
              {project.icon || '📁'}
            </span>
            <span className="font-mono text-[11px] font-semibold text-text-secondary tracking-wider">
              {project.identifier}
            </span>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Project Name */}
        <h4 className="text-xs font-semibold text-text-primary line-clamp-1 group-hover:text-accent-olive transition-colors mb-1.5">
          {project.name}
        </h4>

        {/* Last Recorded Accomplishment (if available from previous session) */}
        {latestSession?.accomplishments ? (
          <div className="my-2 p-2 rounded-md bg-accent-green/5 border border-accent-green/20">
            <div className="flex items-center justify-between text-[10px] font-medium text-accent-green mb-0.5">
              <span className="flex items-center gap-1 uppercase tracking-wider font-semibold">
                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                <span>{tx("Last Accomplishment")}</span>
              </span>
              <span className="font-mono text-text-muted text-[9px]">
                {formatRelativeTime(latestSession.endedAt || latestSession.updatedAt, i18n.language, tx)}
              </span>
            </div>
            <p className="text-[11px] text-text-primary line-clamp-2 leading-tight">
              {latestSession.accomplishments}
            </p>
          </div>
        ) : null}

        {/* Next Action Highlight */}
        <div className="my-2 p-2 rounded-md bg-bg-base/70 border border-border-subtle group-hover:border-border transition-colors">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-accent-olive mb-1 uppercase tracking-wider">
            <Target className="h-3 w-3 shrink-0" />
            <span>{tx("Next Action")}</span>
          </div>
          <p className="text-xs text-text-primary font-medium line-clamp-2 leading-tight">
            {project.nextAction || tx('No next action set')}
          </p>
        </div>
      </div>

      {/* Bottom meta: progress bar, session date & Resume button */}
      <div className="mt-2 pt-2 border-t border-border-subtle space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
            <span>{tx("Progress")}</span>
            <span className="font-mono tabular-nums">{project.progress}%</span>
          </div>
          <ProgressBar progress={project.progress} size="sm" />
        </div>

        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" />
            {latestSession
              ? `${tx('Session:')} ${formatRelativeTime(latestSession.endedAt || latestSession.updatedAt, i18n.language, tx)}`
              : `${tx('Visited:')} ${formatRelativeTime(project.lastVisitedAt, i18n.language, tx)}`}
          </span>
          <span className="flex items-center gap-0.5 text-text-secondary group-hover:text-accent-olive group-hover:translate-x-0.5 transition-all">
            {tx("Workspace")}<ArrowRight className="h-3 w-3" />
          </span>
        </div>

        {/* Explicit Resume Work Button */}
        <Button
          type="button"
          size="xs"
          variant={isThisProjectActive ? 'default' : 'secondary'}
          onClick={handleResumeWork}
          className="w-full gap-1.5 h-7 text-[11px] font-medium shadow-sm"
        >
          <Timer className="h-3 w-3 text-accent-olive" />
          <span>{tx(resumeButtonLabel)}</span>
        </Button>
      </div>
    </div>
  )
}
