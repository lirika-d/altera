import { cn } from '@/lib/utils'

interface ProgressBarProps {
  progress: number
  showPercentage?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
  barClassName?: string
}

export function ProgressBar({
  progress,
  showPercentage = false,
  size = 'default',
  className,
  barClassName,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)))

  const heightClass = {
    sm: 'h-1',
    default: 'h-1.5',
    lg: 'h-2',
  }[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'w-full bg-border-subtle rounded-full overflow-hidden relative',
          heightClass
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            clamped === 100 ? 'bg-accent-green' : 'bg-accent-blue',
            barClassName
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showPercentage && (
        <span className="font-mono text-[11px] text-text-muted shrink-0 w-8 text-right tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  )
}
