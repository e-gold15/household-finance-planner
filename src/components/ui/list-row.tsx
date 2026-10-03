import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'onClick'> {
  /** Icon tile, avatar or category dot at the inline-start. */
  leading?: React.ReactNode
  title: React.ReactNode
  /** Secondary line: text and/or badges (wraps). */
  meta?: React.ReactNode
  /** Trailing value, usually a <Money>. */
  trailing?: React.ReactNode
  /** Row actions, usually an <ActionMenu>. Rendered outside the clickable area. */
  actions?: React.ReactNode
  /** Makes the main area a button (e.g. open the edit sheet). */
  onClick?: () => void
  /** Accessible name for the clickable area when `title` is not plain text. */
  clickLabel?: string
  /** CSS colour for a 4px inline-start strip, e.g. `hsl(var(--chart-3))`. */
  accentColor?: string
  as?: 'div' | 'li'
}

/**
 * Standard list row: leading · title/meta · trailing · actions. ≥ 56px tall,
 * text column is `min-w-0` so long names truncate instead of overflowing
 * (the P0-6 Savings overflow pattern). Never nests interactive elements.
 */
const ListRow = React.forwardRef<HTMLElement, ListRowProps>(
  ({ leading, title, meta, trailing, actions, onClick, clickLabel, accentColor, as = 'div', className, ...props }, ref) => {
    const Comp = as as React.ElementType
    const body = (
      <>
        {leading && <div className="flex shrink-0 items-center">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          {meta && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{meta}</div>
          )}
        </div>
        {trailing && <div className="shrink-0 text-end">{trailing}</div>}
      </>
    )
    return (
      <Comp
        ref={ref}
        className={cn('relative flex min-h-14 items-center gap-1', accentColor && 'ps-2', className)}
        {...props}
      >
        {accentColor && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 start-0 w-1 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        )}
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={clickLabel}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-start transition-colors duration-fast hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {body}
          </button>
        ) : (
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 py-2">{body}</div>
        )}
        {actions && <div className="flex shrink-0 items-center">{actions}</div>}
      </Comp>
    )
  }
)
ListRow.displayName = 'ListRow'

export { ListRow }
