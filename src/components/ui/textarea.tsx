import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[64px] w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-xs text-text-primary shadow-sm placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-blue/80 focus-visible:ring-1 focus-visible:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
