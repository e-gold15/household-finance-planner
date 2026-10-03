import * as React from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import type { Currency, Locale } from '@/types'

export type MoneyTone = 'neutral' | 'positive' | 'negative' | 'auto' | 'muted'
export type MoneySize = 'sm' | 'md' | 'lg' | 'display'

export interface MoneyProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  value: number
  currency?: Currency
  locale?: Locale
  /**
   * neutral (default) inherits the surrounding text colour — use it for totals.
   * positive / negative use the success / danger *-strong text tokens.
   * auto picks positive (> 0), negative (< 0) or neutral (0).
   * Colour is never the only signal: combine tones with `showSign`.
   */
  tone?: MoneyTone
  /** Omit to inherit the surrounding font size. */
  size?: MoneySize
  /** Prefix "+" for positive values (negatives always show "−" from Intl). */
  showSign?: boolean
}

const SIZE_CLASSES: Record<MoneySize, string> = {
  sm: 'text-sm',
  md: 'text-base font-medium',
  lg: 'text-xl font-semibold',
  display: 'text-4xl font-bold tracking-tight',
}

const TONE_CLASSES: Record<Exclude<MoneyTone, 'auto'>, string> = {
  neutral: '',
  muted: 'text-muted-foreground',
  positive: 'text-success-strong',
  negative: 'text-danger-strong',
}

function resolveTone(tone: MoneyTone, value: number): Exclude<MoneyTone, 'auto'> {
  if (tone !== 'auto') return tone
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

/**
 * Signed variant of `formatCurrency` (same options + `signDisplay`). Intl puts
 * the "+" exactly where it puts the "−" for negatives — glued to the number,
 * with an LRM in `he-IL` — so "+15,255 ₪" never renders as "+ ₪15,255" when
 * the sign is merely concatenated in front of the locale's leading RLM.
 */
function formatSignedCurrency(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(amount)
}

/**
 * Bidi-safe money (P1-11): the formatted string is isolated in an LTR <bdi>
 * so "₪ 1,234" never garbles next to Hebrew text, with tabular numerals and
 * no wrapping. Output text is exactly `formatCurrency(value, currency, locale)`,
 * except that `showSign` on a positive value uses Intl's own sign placement.
 */
const Money = React.forwardRef<HTMLElement, MoneyProps>(
  ({ value, currency = 'ILS', locale = 'he-IL', tone = 'neutral', size, showSign = false, className, ...props }, ref) => {
    const safe = Number.isFinite(value) ? value : 0
    const text = showSign && safe > 0 ? formatSignedCurrency(safe, currency, locale) : formatCurrency(safe, currency, locale)
    const resolved = resolveTone(tone, safe)
    return (
      <bdi
        ref={ref}
        dir="ltr"
        className={cn('num inline-block whitespace-nowrap tabular-nums', size && SIZE_CLASSES[size], TONE_CLASSES[resolved], className)}
        {...props}
      >
        {text}
      </bdi>
    )
  }
)
Money.displayName = 'Money'

export { Money }
