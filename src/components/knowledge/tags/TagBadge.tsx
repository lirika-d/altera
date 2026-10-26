import * as React from 'react'
import type { Tag } from '@/types'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTagColorOption } from './tagColors'

export interface TagBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  tag: Tag | { id?: string; name: string; color?: string }
  onRemove?: (tag: Tag | { id?: string; name: string; color?: string }) => void
  onClick?: (tag: Tag | { id?: string; name: string; color?: string }) => void
  size?: 'sm' | 'default' | 'lg'
  removable?: boolean
  showHash?: boolean
  disabled?: boolean
}

/**
 * TagBadge — Compact tag pill with color dot, tag name, and optional onRemove (X) button.
 */
export function TagBadge({
  tag,
  onRemove,
  onClick,
  size = 'default',
  removable,
  showHash = true,
  disabled = false,
  className,
  ...props
}: TagBadgeProps) {
  const colorOption = getTagColorOption(tag.color)
  const isInteractive = Boolean(onClick) && !disabled
  const canRemove = Boolean(onRemove || removable) && !disabled

  const handleBadgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    if (onClick) {
      e.stopPropagation()
      onClick(tag)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      e.stopPropagation()
      onClick(tag)
    }
  }

  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (onRemove && !disabled) {
      onRemove(tag)
    }
  }

  const sizeClasses = {
    sm: 'text-[10px] h-4 px-1.5 gap-1',
    default: 'text-[11px] h-5 px-2 gap-1.5',
    lg: 'text-xs h-6 px-2.5 gap-2',
  }[size]

  const dotSizeClasses = {
    sm: 'h-1.5 w-1.5',
    default: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }[size]

  const removeIconSizeClasses = {
    sm: 'h-2.5 w-2.5',
    default: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  }[size]

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={handleBadgeClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group inline-flex items-center rounded-full font-medium transition-colors select-none border',
        'bg-bg-elevated/80 border-border hover:border-border/80 text-text-secondary',
        colorOption.bgClass,
        colorOption.borderClass,
        isInteractive && 'cursor-pointer hover:text-text-primary active:scale-[0.98]',
        disabled && 'opacity-50 pointer-events-none',
        sizeClasses,
        className
      )}
      {...props}
    >
      {/* Color Dot */}
      <span
        className={cn('rounded-full shrink-0 shadow-sm transition-transform', dotSizeClasses)}
        style={{ backgroundColor: colorOption.color }}
        aria-hidden="true"
      />

      {/* Tag Name */}
      <span className={cn('truncate font-sans tracking-tight', colorOption.textClass)}>
        {showHash ? `#${tag.name}` : tag.name}
      </span>

      {/* Optional Remove (X) Button */}
      {canRemove && (
        <button
          type="button"
          onClick={handleRemoveClick}
          aria-label={`Remove tag ${tag.name}`}
          className={cn(
            'inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-black/20 focus:outline-none transition-colors p-0.5 -mr-0.5',
            disabled && 'pointer-events-none'
          )}
        >
          <X className={removeIconSizeClasses} />
        </button>
      )}
    </div>
  )
}
