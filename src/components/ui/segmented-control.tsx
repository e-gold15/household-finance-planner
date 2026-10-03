import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  icon?: LucideIcon
  disabled?: boolean
  /** Needed when `label` is not plain text. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  /** Provide one of aria-label / aria-labelledby — the group needs a name. */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** Stretch segments to fill the row (default true). */
  fullWidth?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * 2–4 option toggle with radiogroup semantics. Every segment is ≥ 44px.
 * Keyboard: ←/→/↑/↓ move and select (arrows follow the visual order in RTL),
 * Home/End jump to the first/last option. Roving tabindex.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  fullWidth = true,
  disabled = false,
  className,
  id,
  ...aria
}: SegmentedControlProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  const enabled = options.map((o) => !disabled && !o.disabled)
  const selectedIndex = options.findIndex((o) => o.value === value)
  const focusableIndex = selectedIndex >= 0 && enabled[selectedIndex] ? selectedIndex : enabled.indexOf(true)

  const move = (from: number, step: 1 | -1) => {
    const n = options.length
    for (let i = 1; i <= n; i++) {
      const next = (from + step * i + n) % n
      if (enabled[next]) return next
    }
    return from
  }

  const select = (index: number) => {
    const opt = options[index]
    if (!opt || !enabled[index]) return
    refs.current[index]?.focus()
    if (opt.value !== value) onValueChange(opt.value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isRtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    let target: number | null = null
    switch (e.key) {
      case 'ArrowRight':
        target = move(index, isRtl ? -1 : 1)
        break
      case 'ArrowLeft':
        target = move(index, isRtl ? 1 : -1)
        break
      case 'ArrowDown':
        target = move(index, 1)
        break
      case 'ArrowUp':
        target = move(index, -1)
        break
      case 'Home':
        target = enabled.indexOf(true)
        break
      case 'End':
        target = enabled.lastIndexOf(true)
        break
      default:
        return
    }
    e.preventDefault()
    if (target !== null && target >= 0) select(target)
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      aria-disabled={disabled || undefined}
      className={cn('gap-1 rounded-lg bg-muted p-1', fullWidth ? 'flex w-full' : 'inline-flex', className)}
    >
      {options.map((opt, i) => {
        const checked = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={opt.ariaLabel}
            disabled={!enabled[i]}
            tabIndex={i === focusableIndex ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-muted',
              'disabled:pointer-events-none disabled:opacity-50',
              fullWidth && 'flex-1',
              checked
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
