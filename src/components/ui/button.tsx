import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link' | 'olive'
  size?: 'default' | 'sm' | 'xs' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-olive/50 disabled:pointer-events-none disabled:opacity-40 select-none'

    const variantClasses = {
      default:
        'bg-accent-olive text-[#0e0e0d] font-semibold hover:bg-accent-olive/90 shadow-sm active:translate-y-[0.5px]',
      olive:
        'bg-[#273220] text-accent-olive border border-accent-olive/30 hover:bg-[#2e3b26] hover:border-accent-olive/50 active:translate-y-[0.5px]',
      secondary:
        'bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover active:translate-y-[0.5px]',
      outline:
        'border border-border bg-transparent text-text-primary hover:bg-bg-hover hover:border-border/80 active:translate-y-[0.5px]',
      ghost:
        'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      danger:
        'bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20 hover:border-accent-red/30',
      link:
        'text-accent-olive underline-offset-4 hover:underline p-0 h-auto',
    }[variant]

    const sizeClasses = {
      default: 'h-8 px-3 text-xs gap-1.5',
      sm: 'h-7 px-2.5 text-xs gap-1.5',
      xs: 'h-6 px-2 text-[11px] gap-1',
      lg: 'h-9 px-4 text-sm gap-2',
      icon: 'h-7 w-7 p-0',
    }[size]

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseClasses, variantClasses, sizeClasses, className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
