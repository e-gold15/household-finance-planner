/**
 * Pure helpers for the <MoneyInput> primitive (design system v4).
 *
 * The input stores a *string* so the field can be empty — it is never forced
 * to 0 (audit P1-13). Callers parse on save with `parseMoneyInput`.
 */
import type { Currency, Locale } from '@/types'

export interface ParseMoneyOptions {
  /** When false, negative input returns null. Default: true. */
  allowNegative?: boolean
}

// Bidi / formatting marks Intl and copy-paste may inject.
const BIDI_MARKS = /[‎‏؜‪-‮⁦-⁩]/g
// Any whitespace incl. NBSP, narrow NBSP and thin space (used as group separators).
const SPACES = /[\s   ]/g
// Currency symbols and ISO codes we may see in pasted values.
const CURRENCY_TOKENS = /(ILS|NIS|USD|EUR|GBP|JPY|CHF|CAD|AUD|₪|\$|€|£|¥|ש"ח|ש״ח)/gi
const MINUS_SIGNS = /[−‒–—﹣－]/g

/**
 * Parse a user-typed money string to a number.
 *
 * - `""` / whitespace / `"abc"` / `"."` / `"1.2.3"` → `null`
 * - `"1,234.5"` → `1234.5` (comma = thousands separator)
 * - `"12,50"` → `12.5` (single comma followed by 1–2 digits = decimal comma)
 * - `"₪50"`, `"50 ₪"`, `"$1,234"`, `"1 234"` → plain numbers
 * - `"-50"`, `"−50"`, `"(50)"` → `-50` (or `null` with `allowNegative: false`)
 * - Exponents (`"1e5"`), `Infinity` and `NaN` → `null`
 */
export function parseMoneyInput(raw: string | null | undefined, options: ParseMoneyOptions = {}): number | null {
  const { allowNegative = true } = options
  if (raw == null) return null

  let s = String(raw)
    .replace(BIDI_MARKS, '')
    .replace(MINUS_SIGNS, '-')
    .replace(CURRENCY_TOKENS, '')
    .replace(SPACES, '')

  if (s === '') return null

  let negative = false
  // Accounting negatives: (50)
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  // Leading or trailing minus: -50 / 50-
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.endsWith('-')) {
    negative = !negative
    s = s.slice(0, -1)
  }

  if (s === '' || !/^[0-9.,]+$/.test(s)) return null

  const commaCount = (s.match(/,/g) ?? []).length
  const dotCount = (s.match(/\./g) ?? []).length

  if (dotCount > 1) return null

  if (dotCount === 0 && commaCount === 1 && /^\d+,\d{1,2}$/.test(s)) {
    // Decimal comma: "12,5" / "12,50"
    s = s.replace(',', '.')
  } else if (commaCount > 0) {
    // Thousands separators must sit in groups of 3 before the decimal point.
    const [intPart, fracPart] = s.split('.')
    if (!/^\d{1,3}(,\d{3})*$/.test(intPart)) return null
    s = intPart.replace(/,/g, '') + (fracPart !== undefined ? '.' + fracPart : '')
  }

  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const value = negative ? -n : n
  if (!allowNegative && value < 0) return null
  // Normalise -0 → 0
  return value === 0 ? 0 : value
}

/**
 * Filter keystrokes for a money field: keep digits, `.` and `,`, plus a single
 * leading `-` when negatives are allowed. Does not reformat or add grouping,
 * so the caret never jumps.
 */
export function sanitizeMoneyTyping(raw: string, allowNegative = false): string {
  const cleaned = raw.replace(BIDI_MARKS, '').replace(MINUS_SIGNS, '-')
  const leadingMinus = allowNegative && cleaned.trimStart().startsWith('-')
  const body = cleaned.replace(/[^0-9.,]/g, '')
  return (leadingMinus ? '-' : '') + body
}

/**
 * Convert a stored number into an editable MoneyInput string.
 * `null` / `undefined` / `NaN` → `""` (empty field, not "0").
 */
export function toMoneyInputValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(value)
}

/** The currency symbol for an ISO code in a locale, e.g. ('ILS', 'he-IL') → '₪'. */
export function currencySymbol(currency: Currency = 'ILS', locale: Locale = 'he-IL'): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')
    return part?.value ?? currency
  } catch {
    return currency
  }
}
