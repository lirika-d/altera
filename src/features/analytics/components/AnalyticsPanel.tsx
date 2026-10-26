import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AnalyticsPanel({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-border bg-[#141412] p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg leading-tight text-text-primary">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
