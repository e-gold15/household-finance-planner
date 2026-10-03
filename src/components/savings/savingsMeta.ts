import type { AccountType, Liquidity, SavingsAccount } from '@/types'

export type LiquidityBadgeVariant = 'success' | 'info' | 'warning' | 'danger'

export const ACCOUNT_TYPES: ReadonlyArray<{ value: AccountType; en: string; he: string }> = [
  { value: 'checking', en: 'Checking', he: 'עו"ש' },
  { value: 'savings', en: 'Savings', he: 'חיסכון' },
  { value: 'deposit', en: 'Deposit', he: 'פיקדון' },
  { value: 'pension', en: 'Pension', he: 'פנסיה' },
  { value: 'study_fund', en: 'Study Fund', he: 'קרן השתלמות' },
  { value: 'stocks', en: 'Stocks', he: 'מניות' },
  { value: 'crypto', en: 'Crypto', he: 'קריפטו' },
  { value: 'real_estate', en: 'Real Estate', he: 'נדל"ן' },
  { value: 'other', en: 'Other', he: 'אחר' },
]

export const LIQUIDITIES: ReadonlyArray<{ value: Liquidity; en: string; he: string; variant: LiquidityBadgeVariant }> = [
  { value: 'immediate', en: 'Immediate', he: 'מיידי', variant: 'success' },
  { value: 'short', en: 'Short-term', he: 'קצר טווח', variant: 'info' },
  { value: 'medium', en: 'Medium-term', he: 'בינוני', variant: 'warning' },
  { value: 'locked', en: 'Locked', he: 'נעול', variant: 'danger' },
]

export const isLiquid = (a: SavingsAccount) => a.liquidity === 'immediate' || a.liquidity === 'short'

/**
 * Balance at the end of last month, derived from the auto-increment log for the
 * current month, falling back to `balance − monthlyContribution`.
 * Returns null when there is nothing meaningful to show. (Logic unchanged from v3.)
 */
export function computeLastMonthBalance(account: SavingsAccount, now: Date = new Date()): number | null {
  const currentYearMonth = now.toISOString().slice(0, 7)
  const log = account.autoIncrementLog

  if (Array.isArray(log) && log.length > 0) {
    const thisMonthAdded = log
      .filter((e) => e.month === currentYearMonth)
      .reduce((s, e) => s + e.amount, 0)
    const lastMonthBalance = account.balance - thisMonthAdded
    return lastMonthBalance > 0 ? lastMonthBalance : null
  }

  // Fallback: rough estimate using monthlyContribution
  if (account.monthlyContribution > 0) {
    const lastMonthBalance = account.balance - account.monthlyContribution
    return lastMonthBalance > 0 ? lastMonthBalance : null
  }

  return null
}
