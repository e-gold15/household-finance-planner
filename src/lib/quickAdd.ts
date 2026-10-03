/**
 * Quick Add (PRD v4 §2.D) — pure helpers.
 *
 * Nothing here touches storage or context: the sheet builds a payload with
 * `buildQuickAddExpense` and hands it to the *existing* FinanceContext methods
 * (`addExpense` / `addExpenseToMonth`) with exactly the argument shapes that
 * `ExpenseDialog` has always used.
 */
import type { Expense, ExpenseCategory, HistoricalExpense } from '@/types'
import { EXPENSE_CATEGORIES } from '@/lib/categories'

// ─── Months ──────────────────────────────────────────────────────────────────

export const MONTHS: ReadonlyArray<{ value: number; en: string; he: string }> = [
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

/** Localised month name for a 1-indexed month, '' when out of range. */
export function monthName(month: number, lang: 'en' | 'he'): string {
  const found = MONTHS.find((m) => m.value === month)
  return found ? (lang === 'he' ? found.he : found.en) : ''
}

/** Number of years offered by the past-month picker (current year + 2 back). */
export const PAST_YEARS_COUNT = 3

/** Default past-month selection: the previous calendar month. */
export function defaultPastMonth(now: Date = new Date()): { year: number; month: number } {
  return now.getMonth() === 0
    ? { year: now.getFullYear() - 1, month: 12 }
    : { year: now.getFullYear(), month: now.getMonth() } // getMonth() is 0-indexed → previous month 1-indexed
}

/** Years offered by the past-month picker, newest first. */
export function pastYearOptions(now: Date = new Date()): number[] {
  return Array.from({ length: PAST_YEARS_COUNT }, (_, i) => now.getFullYear() - i)
}

/** 1-indexed months selectable for `year` (current and future months excluded). */
export function pastMonthOptions(year: number, now: Date = new Date()): number[] {
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  if (year > curY) return []
  if (year === curY) return MONTHS.filter((m) => m.value < curM).map((m) => m.value)
  return MONTHS.map((m) => m.value)
}

/**
 * Month to keep selected after the year changes. Matches the legacy picker:
 * switching back to the current year clamps an invalid month to the latest
 * valid one (the previous month).
 */
export function clampPastMonth(year: number, month: number, now: Date = new Date()): number {
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  if (year === curY && month >= curM) return curM > 1 ? curM - 1 : 12
  return month
}

/** True when (year, month) is a completed month inside the picker range. */
export function isSelectablePastMonth(year: number, month: number, now: Date = new Date()): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false
  if (!pastYearOptions(now).includes(year)) return false
  return pastMonthOptions(year, now).includes(month)
}

// ─── Category ranking ────────────────────────────────────────────────────────

/** How many recent expenses decide the leading chips. */
export const RECENT_EXPENSES_FOR_RANKING = 3

function createdAtMs(e: Pick<Expense, 'createdAt'>): number | null {
  if (!e.createdAt) return null
  const ms = new Date(e.createdAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Order the category chips: the categories of the 3 most recently created
 * expenses (by `createdAt`, newest first, de-duplicated) come first, then
 * every remaining category in `allCategories` order. Expenses without a valid
 * `createdAt` never count as recent. Ties keep the later array position first
 * (expenses are appended, so later = newer). Categories that are not in
 * `allCategories` are ignored. Pure: inputs are not mutated.
 */
export function rankQuickAddCategories<C extends { value: ExpenseCategory }>(
  expenses: ReadonlyArray<Pick<Expense, 'category' | 'createdAt'>>,
  allCategories: ReadonlyArray<C>
): C[] {
  const recent = expenses
    .map((e, index) => ({ e, index, ms: createdAtMs(e) }))
    .filter((x): x is { e: Pick<Expense, 'category' | 'createdAt'>; index: number; ms: number } => x.ms !== null)
    .sort((a, b) => b.ms - a.ms || b.index - a.index)
    .slice(0, RECENT_EXPENSES_FOR_RANKING)

  const result: C[] = []
  const seen = new Set<ExpenseCategory>()
  for (const { e } of recent) {
    if (seen.has(e.category)) continue
    const def = allCategories.find((c) => c.value === e.category)
    if (!def) continue
    seen.add(e.category)
    result.push(def)
  }
  for (const c of allCategories) {
    if (!seen.has(c.value)) {
      seen.add(c.value)
      result.push(c)
    }
  }
  return result
}

// ─── Payload ─────────────────────────────────────────────────────────────────

/** Localised label for a category ('' for unknown values). */
export function categoryLabel(category: ExpenseCategory, lang: 'en' | 'he'): string {
  const def = EXPENSE_CATEGORIES.find((c) => c.value === category)
  return def ? (lang === 'he' ? def.he : def.en) : ''
}

/** True for a finite amount strictly greater than 0. */
export function isValidQuickAddAmount(amount: number | null | undefined): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0
}

export interface QuickAddInput {
  /** Parsed amount (`parseMoneyInput` result). `null`, 0, negative, NaN → invalid. */
  amount: number | null
  /** `null` until the user picks a chip (no chip is preselected). */
  category: ExpenseCategory | null
  /** Optional; blank → the localised category label. */
  name?: string
  when: 'current' | 'past'
  /** Required when `when === 'past'`. 1-indexed month. */
  pastYear?: number
  pastMonth?: number
  lang: 'en' | 'he'
  /** Injected clock for deterministic tests. */
  now?: Date
}

export type QuickAddPayload =
  | { kind: 'current'; expense: Omit<Expense, 'id'> }
  | { kind: 'past'; year: number; month: number; item: Omit<HistoricalExpense, 'id'> }

/**
 * Build the context call for a quick-add entry, or `null` when the input is
 * not saveable (missing category, amount not > 0, or an out-of-range past
 * month). An invalid amount is never coerced to 0.
 *
 * - `current` → the argument for `addExpense(...)`: the same variable-monthly
 *   defaults ExpenseDialog creates (`recurring: true`, `period: 'monthly'`,
 *   `expenseType: 'variable'`, `createdAt` = now). No `dueMonth`,
 *   `linkedAccountId` or `id` (the context generates the id).
 * - `past` → the arguments for `addExpenseToMonth(year, month, item)` with
 *   `item = { name, amount, category }`, exactly like ExpenseDialog.
 */
export function buildQuickAddExpense(input: QuickAddInput): QuickAddPayload | null {
  const { amount, category, when, lang } = input
  const now = input.now ?? new Date()
  if (!category || !EXPENSE_CATEGORIES.some((c) => c.value === category)) return null
  if (!isValidQuickAddAmount(amount)) return null

  const name = (input.name ?? '').trim() || categoryLabel(category, lang)

  if (when === 'past') {
    const year = input.pastYear
    const month = input.pastMonth
    if (year === undefined || month === undefined || !isSelectablePastMonth(year, month, now)) return null
    return { kind: 'past', year, month, item: { name, amount, category } }
  }

  return {
    kind: 'current',
    expense: {
      name,
      amount,
      category,
      recurring: true,
      period: 'monthly',
      expenseType: 'variable',
      createdAt: now.toISOString(),
    },
  }
}
