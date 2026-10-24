import { cn } from '@/lib/utils'
import type { ProjectStatus, TaskStatus } from '@/types'

interface StatusBadgeProps {
  status: ProjectStatus | TaskStatus
  showLabel?: boolean
  className?: string
}

export function StatusBadge({ status, showLabel = true, className }: StatusBadgeProps) {
  const config: Record<
    ProjectStatus | TaskStatus,
    { label: string; dotColor: string; bgClass: string; textClass: string }
  > = {
    // Project statuses
    active: {
      label: 'Active',
      dotColor: 'bg-accent-blue',
      bgClass: 'bg-accent-blue/10 border-accent-blue/20',
      textClass: 'text-accent-blue',
    },
    backlog: {
      label: 'Backlog',
      dotColor: 'bg-text-secondary',
      bgClass: 'bg-white/5 border-border',
      textClass: 'text-text-secondary',
    },
    paused: {
      label: 'Paused',
      dotColor: 'bg-accent-amber',
      bgClass: 'bg-accent-amber/10 border-accent-amber/20',
      textClass: 'text-accent-amber',
    },
    completed: {
      label: 'Completed',
      dotColor: 'bg-accent-green',
      bgClass: 'bg-accent-green/10 border-accent-green/20',
      textClass: 'text-accent-green',
    },
    archived: {
      label: 'Archived',
      dotColor: 'bg-text-muted',
      bgClass: 'bg-white/5 border-border-subtle',
      textClass: 'text-text-muted',
    },

    // Task statuses
    todo: {
      label: 'Todo',
      dotColor: 'bg-text-muted',
      bgClass: 'bg-white/5 border-border',
      textClass: 'text-text-secondary',
    },
    in_progress: {
      label: 'In Progress',
      dotColor: 'bg-accent-amber animate-pulse',
      bgClass: 'bg-accent-amber/10 border-accent-amber/20',
      textClass: 'text-accent-amber',
    },
    done: {
      label: 'Done',
      dotColor: 'bg-accent-green',
      bgClass: 'bg-accent-green/10 border-accent-green/20',
      textClass: 'text-accent-green',
    },
    cancelled: {
      label: 'Canceled',
      dotColor: 'bg-accent-red',
      bgClass: 'bg-accent-red/10 border-accent-red/20',
      textClass: 'text-accent-red',
    },
  }

  const { label, dotColor, bgClass, textClass } = config[status] || {
    label: status,
    dotColor: 'bg-text-muted',
    bgClass: 'bg-white/5 border-border',
    textClass: 'text-text-secondary',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium leading-none select-none',
        bgClass,
        textClass,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
