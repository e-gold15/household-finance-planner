import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Classes for the fill (e.g. `bg-warning`). */
  indicatorClassName?: string
}

/**
 * Width-based fill anchored at the inline-start edge, so it fills from the
 * right in RTL and from the left in LTR (P0-12). Value is clamped to 0–100.
 */
const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, ...props }, ref) => {
    const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0
    const safeMax = max > 0 ? max : 100
    const pct = Math.min(100, Math.max(0, (raw / safeMax) * 100))
    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        value={value == null ? value : Math.min(safeMax, Math.max(0, raw))}
        max={safeMax}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'absolute inset-y-0 start-0 h-full rounded-full bg-primary transition-[width] duration-slow ease-standard',
            indicatorClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </ProgressPrimitive.Root>
    )
  }
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
