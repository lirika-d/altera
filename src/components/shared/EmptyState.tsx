import type { LucideIcon } from 'lucide-react'
import { FolderGit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon = FolderGit2,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-border-subtle bg-bg-surface/30',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-secondary mb-3 shadow-inner">
        <Icon className="h-5 w-5 stroke-[1.5]" />
      </div>
      <h3 className="text-xs font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-[11px] text-text-muted max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
