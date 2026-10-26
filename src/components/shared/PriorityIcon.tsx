import { AlertCircle, SignalHigh, SignalMedium, SignalLow, Minus } from 'lucide-react'
import type { Priority } from '@/types'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

interface PriorityIconProps {
  priority: Priority
  className?: string
  showLabel?: boolean
}

export function PriorityIcon({ priority, className, showLabel = false }: PriorityIconProps) {
  const { tx } = useTranslation()
  const config: Record<
    Priority,
    { label: string; icon: React.ReactNode; colorClass: string }
  > = {
    urgent: {
      label: 'Urgent',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      colorClass: 'text-accent-red',
    },
    high: {
      label: 'High',
      icon: <SignalHigh className="h-3.5 w-3.5" />,
      colorClass: 'text-accent-amber',
    },
    medium: {
      label: 'Medium',
      icon: <SignalMedium className="h-3.5 w-3.5" />,
      colorClass: 'text-accent-blue',
    },
    low: {
      label: 'Low',
      icon: <SignalLow className="h-3.5 w-3.5" />,
      colorClass: 'text-text-secondary',
    },
    none: {
      label: 'None',
      icon: <Minus className="h-3.5 w-3.5" />,
      colorClass: 'text-text-muted',
    },
  }

  const { label, icon, colorClass } = config[priority] || config.none
  const translatedLabel = tx(label)

  return (
    <span
      className={cn('inline-flex items-center gap-1 shrink-0', colorClass, className)}
      title={tx('Priority') + ': ' + translatedLabel}
    >
      {icon}
      {showLabel && <span className="text-[11px] font-medium">{translatedLabel}</span>}
    </span>
  )
}
