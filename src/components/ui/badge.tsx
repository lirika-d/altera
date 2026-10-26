import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'subtle' | 'olive'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-accent-olive/15 text-accent-olive border-accent-olive/25',
    olive: 'bg-[#21291b] text-accent-olive border-accent-olive/30',
    secondary: 'bg-bg-elevated text-text-secondary border-border',
    outline: 'text-text-secondary border-border bg-transparent',
    success: 'bg-accent-green/15 text-accent-green border-accent-green/25',
    warning: 'bg-accent-amber/15 text-accent-amber border-accent-amber/25',
    destructive: 'bg-accent-red/15 text-accent-red border-accent-red/25',
    subtle: 'bg-white/5 text-text-secondary border-border-subtle',
  }[variant]

  return (
    <div
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide transition-colors border',
        variantClasses,
        className
      )}
      {...props}
    />
  )
}
