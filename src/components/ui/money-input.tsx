import * as React from 'react'
import { cn } from '@/lib/utils'
import { currencySymbol, parseMoneyInput, sanitizeMoneyTyping } from '@/lib/moneyInput'
import type { Currency, Locale } from '@/types'

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode' | 'size'> {
  /** Raw string — `""` is a valid, empty value (never forced to 0). */
  value: string
  /** Called with the sanitized string and its parsed number (`null` when empty/invalid). */
  onValueChange: (value: string, parsed: number | null) => void
  currency?: Currency
  locale?: Locale
  /** `lg` = large amount entry (quick add). Default `default`. */
  size?: 'default' | 'lg'
  allowNegative?: boolean
  /** Class for the outer wrapper (the input itself takes `className`). */
  wrapperClassName?: string
}

/**
 * Money field: `type="text" inputMode="decimal"` (numeric keypad, no wheel
 * scrolling, can be emptied), currency adornment at the inline-start edge.
 * 44px+ tall and 16px+ text so iOS never zooms.
 */
const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onValueChange,
      currency = 'ILS',
      locale = 'he-IL',
      size = 'default',
      allowNegative = false,
      className,
      wrapperClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const symbol = React.useMemo(() => currencySymbol(currency, locale), [currency, locale])
    const isLg = size === 'lg'
    const wideSymbol = symbol.length > 1 // e.g. "CHF", "CA$"

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = sanitizeMoneyTyping(e.target.value, allowNegative)
      onValueChange(next, parseMoneyInput(next, { allowNegative }))
    }

    return (
      <div className={cn('relative', wrapperClassName)}>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground',
            isLg ? 'text-2xl font-semibold' : 'text-base sm:text-sm',
            disabled && 'opacity-50'
          )}
        >
          {symbol}
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'num flex w-full rounded-md border border-input bg-background pe-3 text-start tabular-nums shadow-sm transition-colors duration-fast placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            isLg
              ? cn('h-16 text-3xl font-semibold', wideSymbol ? 'ps-20' : 'ps-12')
              : cn('h-11 text-base sm:text-sm', wideSymbol ? 'ps-14' : 'ps-9'),
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
MoneyInput.displayName = 'MoneyInput'

export { MoneyInput }
