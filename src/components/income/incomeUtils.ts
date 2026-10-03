/**
 * Pure helpers and constants for the Income tab (v4 Wave 2C).
 * Extracted verbatim from the former monolithic Income.tsx — no behaviour change.
 */
import { parseMoneyInput } from '@/lib/moneyInput'
import type { Country, Currency, IncomeSource, IncomeSourceType, PayslipComponents } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ILS: '₪', USD: '$', EUR: '€', GBP: '£',
  JPY: '¥', CHF: 'Fr', CAD: 'CA$', AUD: 'A$',
}
export const CURRENCIES: readonly Currency[] = ['ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']

export const SOURCE_TYPES: { value: IncomeSourceType; en: string; he: string }[] = [
  { value: 'salary',     en: 'Salary',       he: 'משכורת' },
  { value: 'freelance',  en: 'Freelance',     he: 'פרילנס' },
  { value: 'business',   en: 'Business',      he: 'עסק עצמאי' },
  { value: 'rental',     en: 'Rental',        he: 'שכ"ד' },
  { value: 'investment', en: 'Investment',    he: 'השקעות' },
  { value: 'pension',    en: 'Pension',       he: 'פנסיה' },
  { value: 'other',      en: 'Other',         he: 'אחר' },
]

export const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'IL', label: 'ישראל 🇮🇱' },
  { value: 'US', label: 'USA 🇺🇸' },
  { value: 'UK', label: 'UK 🇬🇧' },
  { value: 'DE', label: 'Germany 🇩🇪' },
  { value: 'FR', label: 'France 🇫🇷' },
  { value: 'CA', label: 'Canada 🇨🇦' },
]

export const MONTHS: { value: number; en: string; he: string }[] = [
  { value: 1,  en: 'January',   he: 'ינואר' },
  { value: 2,  en: 'February',  he: 'פברואר' },
  { value: 3,  en: 'March',     he: 'מרץ' },
  { value: 4,  en: 'April',     he: 'אפריל' },
  { value: 5,  en: 'May',       he: 'מאי' },
  { value: 6,  en: 'June',      he: 'יוני' },
  { value: 7,  en: 'July',      he: 'יולי' },
  { value: 8,  en: 'August',    he: 'אוגוסט' },
  { value: 9,  en: 'September', he: 'ספטמבר' },
  { value: 10, en: 'October',   he: 'אוקטובר' },
  { value: 11, en: 'November',  he: 'נובמבר' },
  { value: 12, en: 'December',  he: 'דצמבר' },
]

export function monthName(m: number, lang: 'en' | 'he'): string {
  const found = MONTHS.find((x) => x.value === m)
  return found ? (lang === 'he' ? found.he : found.en) : ''
}

export function sourceTypeLabel(type: IncomeSourceType | undefined, lang: 'en' | 'he'): string {
  const found = SOURCE_TYPES.find((s) => s.value === (type ?? 'salary'))
  return found ? (lang === 'he' ? found.he : found.en) : ''
}

export const DEFAULT_SOURCE: Omit<IncomeSource, 'id'> = {
  name: '',
  amount: 0,
  period: 'monthly',
  type: 'salary',
  isGross: true,
  useManualNet: false,
  country: 'IL',
  taxCreditPoints: 2.25,
  incomeType: 'fixed',
  insuredSalaryRatio: 100,
  useContributions: false,
  pensionEmployee: 6,
  pensionEmployer: 6.5,
  educationFundEmployee: 2.5,
  educationFundEmployer: 7.5,
  severanceEmployer: 8.33,
}

export const DEFAULT_PAYSLIP_COMPONENTS: PayslipComponents = {
  base: 0,
  overtime125: 0,
  overtime150: 0,
  otherTaxable: 0,
  imputedIncome: 0,
  nonTaxableReimbursements: 0,
}

// ── Payslip maths ─────────────────────────────────────────────────────────────

export function computeTaxableGross(c: PayslipComponents): number {
  return c.base + c.overtime125 + c.overtime150 + c.otherTaxable + c.imputedIncome
}

export function computeTotalGross(c: PayslipComponents): number {
  return computeTaxableGross(c) + c.nonTaxableReimbursements
}

// ── Numeric text fields ───────────────────────────────────────────────────────

/**
 * Parse the text of a numeric field. Returns `fallback` when the text is empty
 * or invalid, so a caller can never store NaN. Negative input is rejected
 * (→ fallback) unless `allowNegative` is set.
 */
export function parseNumericField<F extends number | undefined>(
  text: string,
  fallback: F,
  allowNegative = false,
): number | F {
  const parsed = parseMoneyInput(text, { allowNegative })
  return parsed === null ? fallback : parsed
}

/**
 * Initial text for a numeric field. `zeroAsEmpty` mirrors the legacy
 * `value={x || ''}` pattern: a stored 0 shows as an empty field.
 */
export function numericFieldText(value: number | undefined, zeroAsEmpty = false): string {
  if (value === undefined || !Number.isFinite(value)) return ''
  if (zeroAsEmpty && value === 0) return ''
  return String(value)
}

// ── Past-month picker ─────────────────────────────────────────────────────────

/** The month before `now` (1–12) and its year — the "Past month" default. */
export function previousMonth(now: Date): { month: number; year: number } {
  return now.getMonth() === 0
    ? { month: 12, year: now.getFullYear() - 1 }
    : { month: now.getMonth(), year: now.getFullYear() }
}

/** Months selectable for `year`: only months strictly before the current month. */
export function selectableMonths(year: number, now: Date): number[] {
  const curM = now.getMonth() + 1
  const curY = now.getFullYear()
  return MONTHS.map((m) => m.value).filter((m) => {
    if (year === curY) return m < curM
    if (year > curY) return false
    return true
  })
}

/** When switching to the current year, a month ≥ the current month is clamped back. */
export function clampPastMonth(year: number, month: number, now: Date): number {
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  if (year === curY && month >= curM) return curM > 1 ? curM - 1 : 12
  return month
}

/** The last 3 years, newest first. */
export function selectableYears(now: Date): number[] {
  return Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)
}
