import { t } from '@/lib/utils'
import type { Expense } from '@/types'

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EN_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Short human date for a createdAt ISO string, e.g. "28 May" or "28 May 2024". */
export function formatAddedDate(iso: string, lang: 'en' | 'he'): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  if (lang === 'he') {
    const m = HE_MONTHS[d.getMonth()]
    return sameYear ? `${d.getDate()} ב${m}` : `${d.getDate()} ב${m} ${d.getFullYear()}`
  }
  const m = EN_MONTHS_SHORT[d.getMonth()]
  return sameYear ? `${d.getDate()} ${m}` : `${d.getDate()} ${m} ${d.getFullYear()}`
}

/** Day-separator label for the By-date view: Today / Yesterday / "28 May". */
export function dateSeparatorLabel(iso: string, lang: 'en' | 'he'): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return t('No date', 'ללא תאריך', lang)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return t('Today', 'היום', lang)
  if (diffDays === 1) return t('Yesterday', 'אתמול', lang)
  const sameYear = d.getFullYear() === now.getFullYear()
  if (lang === 'he') {
    const m = HE_MONTHS[d.getMonth()]
    return sameYear ? `${d.getDate()} ב${m}` : `${d.getDate()} ב${m} ${d.getFullYear()}`
  }
  const m = EN_MONTHS_LONG[d.getMonth()]
  return sameYear ? `${d.getDate()} ${m}` : `${d.getDate()} ${m} ${d.getFullYear()}`
}

/** Months until the next occurrence of a due month (0 = this month). */
export function monthsUntilDue(dueMonth: number): number {
  const current = new Date().getMonth() + 1
  if (dueMonth === current) return 0
  if (dueMonth > current) return dueMonth - current
  return 12 - current + dueMonth
}

/** Monthly-equivalent amount (yearly ÷ 12). */
export function monthlyAmount(e: Pick<Expense, 'amount' | 'period'>): number {
  return e.period === 'yearly' ? e.amount / 12 : e.amount
}

/** Treat a missing expenseType as 'fixed' (backward compat). */
export function isFixedExpense(e: Pick<Expense, 'expenseType'>): boolean {
  return (e.expenseType ?? 'fixed') === 'fixed'
}

/** True when `iso` falls in a calendar month before the current one. */
export function isBeforeCurrentMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth())
}
