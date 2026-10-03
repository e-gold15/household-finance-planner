import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, Minus, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface StatusChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone: StatusTone
  /** Visible text — required: status is never conveyed by colour alone. */
  label: React.ReactNode
  /** Override the default tone icon; pass `null` only if the label alone is unambiguous. */
  icon?: LucideIcon | null
  size?: 'sm' | 'md'
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-subtle text-success-strong',
  warning: 'bg-warning-subtle text-warning-strong',
  danger: 'bg-danger-subtle text-danger-strong',
  info: 'bg-info-subtle text-info-strong',
  neutral: 'bg-muted text-muted-foreground',
}

const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: Minus,
}

/** Icon + text + colour status pill (one mapping for the whole app). */
function StatusChip({ tone, label, icon, size = 'sm', className, ...props }: StatusChipProps) {
  const Icon = icon === null ? null : (icon ?? TONE_ICONS[tone])
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

export { StatusChip }
