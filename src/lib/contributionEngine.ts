import type { FinanceData, SavingsAccount } from '@/types'

/**
 * Returns the number of whole calendar months elapsed from `from` to `to`.
 * Both strings must be in "YYYY-MM" format.
 *
 * Examples:
 *   monthsBetween("2026-02", "2026-05") === 3
 *   monthsBetween("2025-11", "2026-02") === 3
 *   monthsBetween("2026-05", "2026-05") === 0
 *   monthsBetween("2026-06", "2026-05") === -1  (negative = future)
 */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/**
 * Returns true if the account qualifies for auto-increment:
 *   - monthlyContribution > 0
 *   - At least one expense has linkedAccountId === account.id
 *     AND (expenseType === 'fixed' OR expenseType is absent/undefined)
 */
function isLinkedFixedAccount(account: SavingsAccount, expenses: FinanceData['expenses']): boolean {
  if (account.monthlyContribution <= 0) return false
  return expenses.some(
    (e) =>
      e.linkedAccountId === account.id &&
      (e.expenseType === 'fixed' || e.expenseType == null),
  )
}

const MAX_ELAPSED = 24
const MAX_LOG_ENTRIES = 24

/**
 * For each savings account that has monthlyContribution > 0 AND is linked
 * to at least one fixed expense, compute how many calendar months have elapsed
 * since lastAutoIncrementMonth and increment the balance accordingly.
 *
 * Rules:
 * - If lastAutoIncrementMonth is absent: treat elapsed = 0 (safe first-run, no retroactive jump)
 * - elapsed = monthsBetween(lastAutoIncrementMonth, nowYearMonth)
 * - If elapsed <= 0: skip (same month or future)
 * - Cap elapsed at 24 months maximum
 * - balance += monthlyContribution * elapsed
 * - Append to autoIncrementLog (cap log at 24 entries, drop oldest)
 * - Set lastAutoIncrementMonth = nowYearMonth
 * - Returns new FinanceData (immutable — never mutates input)
 */
export function applyMonthlyContributions(data: FinanceData, nowYearMonth: string): FinanceData {
  let changed = false

  const nextAccounts = data.accounts.map((account) => {
    // Only qualifying accounts get auto-incremented
    if (!isLinkedFixedAccount(account, data.expenses)) return account

    // Safe first-run: if no prior month recorded, set marker but don't add money
    if (!account.lastAutoIncrementMonth) {
      changed = true
      return { ...account, lastAutoIncrementMonth: nowYearMonth }
    }

    const elapsed = Math.min(
      MAX_ELAPSED,
      monthsBetween(account.lastAutoIncrementMonth, nowYearMonth),
    )

    // Same month or future — nothing to do
    if (elapsed <= 0) return account

    const increment = account.monthlyContribution * elapsed
    const newBalance = account.balance + increment

    const newLogEntry = { month: nowYearMonth, amount: increment }
    const existingLog = account.autoIncrementLog ?? []
    const newLog = [...existingLog, newLogEntry].slice(-MAX_LOG_ENTRIES)

    changed = true
    return {
      ...account,
      balance: newBalance,
      lastAutoIncrementMonth: nowYearMonth,
      autoIncrementLog: newLog,
    }
  })

  if (!changed) return data
  return { ...data, accounts: nextAccounts }
}
