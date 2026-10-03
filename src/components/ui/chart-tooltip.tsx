import * as React from 'react'
import { cn } from '@/lib/utils'

type ChartValue = number | string | ReadonlyArray<number | string>

/** Structural subset of a Recharts tooltip payload entry. */
export interface ChartTooltipEntry {
  name?: number | string
  value?: ChartValue
  color?: string
  fill?: string
  dataKey?: unknown
  payload?: unknown
}

export interface ChartTooltipProps {
  /** Injected by Recharts. */
  active?: boolean
  /** Injected by Recharts. */
  payload?: ReadonlyArray<ChartTooltipEntry>
  /** Injected by Recharts. */
  label?: React.ReactNode
  /** Format each value (e.g. `(v) => formatCurrency(v, currency, locale)`). */
  formatValue?: (value: number, name: string, entry: ChartTooltipEntry) => React.ReactNode
  /** Format the heading (category / month). */
  formatLabel?: (label: React.ReactNode) => React.ReactNode
  /** Map a series name (e.g. category key) to a display name. */
  formatName?: (name: string, entry: ChartTooltipEntry) => React.ReactNode
  hideLabel?: boolean
  className?: string
}

/**
 * Styled Recharts tooltip content. `dir="auto"` so Hebrew names lay out RTL
 * while values stay LTR-isolated (fixes "₪תחבורה : 1,850", audit B2).
 *
 * Usage: `<Tooltip content={<ChartTooltip formatValue={(v) => formatCurrency(v, c, l)} />} />`
 */
function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  formatName,
  hideLabel = false,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const heading = hideLabel || label === undefined || label === null || label === '' ? null : formatLabel ? formatLabel(label) : label

  return (
    <div
      dir="auto"
      className={cn(
        'min-w-[8rem] max-w-[16rem] rounded-lg border bg-surface-2 px-3 py-2 text-xs text-card-foreground shadow-lg',
        className
      )}
    >
      {heading !== null && <div className="mb-1 font-medium text-foreground">{heading}</div>}
      <ul className="space-y-1">
        {payload.map((entry, i) => {
          const rawName = entry.name === undefined ? '' : String(entry.name)
          const numeric = typeof entry.value === 'number' ? entry.value : Number(entry.value)
          const shown =
            formatValue && Number.isFinite(numeric)
              ? formatValue(numeric, rawName, entry)
              : Array.isArray(entry.value)
                ? entry.value.join(' – ')
                : String(entry.value ?? '')
          const swatch = entry.color ?? entry.fill
          return (
            <li key={`${rawName}-${i}`} className="flex items-center gap-2">
              {swatch && (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: swatch }}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {formatName ? formatName(rawName, entry) : rawName}
              </span>
              <bdi dir="ltr" className="num whitespace-nowrap font-medium tabular-nums text-foreground">
                {shown}
              </bdi>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export { ChartTooltip }
