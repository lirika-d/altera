import type { LucideIcon } from 'lucide-react'

export function AnalyticsMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
}) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-[#141412] px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-medium leading-snug text-text-secondary">{label}</h2>
          <p className="mt-2 truncate font-serif text-[1.55rem] leading-none tracking-tight text-text-primary sm:text-[1.75rem]" title={value}>
            {value}
          </p>
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent-olive/25 bg-[#273220]/40 text-accent-olive" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-text-muted">{detail}</p>
    </article>
  )
}
