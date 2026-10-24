import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'subtle'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-accent-blue/15 text-accent-blue border-accent-blue/20',
    secondary: 'bg-bg-elevated text-text-secondary border-border',
    outline: 'text-text-secondary border-border bg-transparent',
    success: 'bg-accent-green/15 text-accent-green border-accent-green/20',
    warning: 'bg-accent-amber/15 text-accent-amber border-accent-amber/20',
    destructive: 'bg-accent-red/15 text-accent-red border-accent-red/20',
    subtle: 'bg-white/5 text-text-secondary border-transparent',
  }[variant]

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        variantClasses,
        className
      )}
      {...props}
    />
  )
}
