import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Convenience primary CTA. For anything custom pass `action` instead. */
  actionLabel?: string
  onAction?: () => void
  actionIcon?: LucideIcon
  /** Custom action node(s) rendered under the text (overrides actionLabel/onAction). */
  action?: React.ReactNode
  /** Tighter padding for use inside cards. */
  compact?: boolean
}

/** Shared empty state (mockup 03): icon tile + title + description + CTA. */
function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl bg-primary-subtle text-primary-strong',
            compact ? 'h-10 w-10' : 'h-14 w-14'
          )}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden="true" />
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <p className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action ??
        (actionLabel && onAction ? (
          <Button onClick={onAction} className="mt-1">
            {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden="true" />}
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  )
}

export { EmptyState }
