/**
 * Tests for src/lib/contributionEngine.ts
 *
 * Covers:
 *   monthsBetween(from, to)
 *     - same month → 0
 *     - one month later → 1
 *     - three months later → 3
 *     - crosses year boundary → 3
 *     - `to` before `from` → negative
 *
 *   applyMonthlyContributions(data, nowYearMonth)
 *     - happy path: first-run sets marker, balance unchanged
 *     - 1-month elapsed → balance += contribution × 1
 *     - 3-month elapsed → balance += contribution × 3
 *     - multiple accounts incremented independently
 *     - log entry appended after increment
 *     - log capped at 24 entries
 *     - lastAutoIncrementMonth updated to nowYearMonth
 *     - idempotency: second call same month → no change
 *     - zero contribution → skipped
 *     - no linked expense → skipped
 *     - variable-expense link → skipped
 *     - undefined expenseType on linked expense → qualifies
 *     - elapsed > 24 → capped at 24
 *     - deductedFromSalary: true → still qualifies
 *     - immutability: input data not mutated
 *     - history array unchanged on output
 */

import { describe, it, expect } from 'vitest'
import { monthsBetween, applyMonthlyContributions } from '@/lib/contributionEngine'
import type { FinanceData, SavingsAccount, Expense } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'acc1',
    name: 'Emergency Fund',
    type: 'savings',
    balance: 10_000,
    liquidity: 'immediate',
    annualReturnPercent: 3,
    monthlyContribution: 500,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp1',
    name: 'Savings transfer',
    amount: 500,
    category: 'savings',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
    linkedAccountId: 'acc1',
    ...overrides,
  }
}

function makeFinanceData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    members: [],
    expenses: [],
    accounts: [],
    goals: [],
    history: [],
    emergencyBufferMonths: 3,
    currency: 'ILS',
    locale: 'he-IL',
    darkMode: false,
    language: 'en',
    categoryBudgets: {},
    ...overrides,
  }
}

// ─── monthsBetween() ─────────────────────────────────────────────────────────

describe('monthsBetween()', () => {
  it('returns 0 for the same month', () => {
    const result: number = monthsBetween('2026-05', '2026-05')
    expect(result).toBe(0)
  })

  it('returns 1 for one month later', () => {
    const result: number = monthsBetween('2026-04', '2026-05')
    expect(result).toBe(1)
  })

  it('returns 3 for three months later', () => {
    const result: number = monthsBetween('2026-02', '2026-05')
    expect(result).toBe(3)
  })

  it('returns 3 when crossing a year boundary (Dec → Mar)', () => {
    const result: number = monthsBetween('2025-12', '2026-03')
    expect(result).toBe(3)
  })

  it('returns a negative number when `to` is before `from`', () => {
    const result: number = monthsBetween('2026-06', '2026-05')
    expect(result).toBe(-1)
  })
})

// ─── applyMonthlyContributions() ─────────────────────────────────────────────

describe('applyMonthlyContributions()', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it('safe first-run: sets lastAutoIncrementMonth, balance unchanged', () => {
    const account = makeAccount({ monthlyContribution: 500, lastAutoIncrementMonth: undefined })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    const updated = result.accounts[0]

    expect(updated.balance).toBe(10_000)
    expect(updated.lastAutoIncrementMonth).toBe('2026-05')
  })

  it('1-month elapsed → balance += monthlyContribution × 1', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_500)
  })

  it('3-month elapsed → balance += monthlyContribution × 3', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-02',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(11_500)
  })

  it('multiple accounts are each incremented independently', () => {
    const acc1 = makeAccount({
      id: 'acc1',
      balance: 10_000,
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const acc2 = makeAccount({
      id: 'acc2',
      balance: 5_000,
      monthlyContribution: 200,
      lastAutoIncrementMonth: '2026-03',
    })
    const exp1 = makeExpense({ id: 'e1', linkedAccountId: 'acc1', expenseType: 'fixed' })
    const exp2 = makeExpense({ id: 'e2', linkedAccountId: 'acc2', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [acc1, acc2], expenses: [exp1, exp2] })

    const result = applyMonthlyContributions(data, '2026-05')
    // acc1: 1 month × 500 = +500
    expect(result.accounts[0].balance).toBe(10_500)
    // acc2: 2 months × 200 = +400
    expect(result.accounts[1].balance).toBe(5_400)
  })

  it('appends a log entry after increment', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
      autoIncrementLog: [],
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    const log = result.accounts[0].autoIncrementLog!
    expect(log).toHaveLength(1)
    expect(log[0].month).toBe('2026-05')
    expect(log[0].amount).toBe(500)
  })

  it('caps log at 24 entries when adding a 25th', () => {
    // Pre-fill log with 24 entries
    const existingLog = Array.from({ length: 24 }, (_, i) => ({
      month: `2024-${String(i + 1).padStart(2, '0')}`,
      amount: 100,
    }))
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
      autoIncrementLog: existingLog,
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    const log = result.accounts[0].autoIncrementLog!
    expect(log).toHaveLength(24)
    // Oldest entry was dropped; newest is the increment we just applied
    expect(log[log.length - 1].month).toBe('2026-05')
  })

  it('sets lastAutoIncrementMonth to nowYearMonth after increment', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-03',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].lastAutoIncrementMonth).toBe('2026-05')
  })

  // ── Idempotency ─────────────────────────────────────────────────────────────

  it('calling twice with the same nowYearMonth leaves balance unchanged on the second call', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const first = applyMonthlyContributions(data, '2026-05')
    const second = applyMonthlyContributions(first, '2026-05')

    // Balance unchanged between first and second call
    expect(second.accounts[0].balance).toBe(first.accounts[0].balance)
    // Specifically: only incremented once
    expect(second.accounts[0].balance).toBe(10_500)
  })

  // ── Qualification rules ─────────────────────────────────────────────────────

  it('account with monthlyContribution === 0 is skipped, balance unchanged', () => {
    const account = makeAccount({
      monthlyContribution: 0,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_000)
  })

  it('account with no linked expense is skipped, balance unchanged', () => {
    // No expenses at all
    const account = makeAccount({
      id: 'acc-orphan',
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const data = makeFinanceData({ accounts: [account], expenses: [] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_000)
  })

  it('account linked to a variable expense is skipped, balance unchanged', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'variable' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_000)
  })

  it('account linked to an expense with undefined expenseType qualifies and increments', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    // expenseType absent — should be treated as fixed
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: undefined })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_500)
  })

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('elapsed months > 24 are capped at 24', () => {
    // lastAutoIncrementMonth is 36 months ago; cap should be 24
    const account = makeAccount({
      balance: 0,
      monthlyContribution: 100,
      lastAutoIncrementMonth: '2023-05',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    // At most 24 months × 100 = 2400, NOT 36 months × 100 = 3600
    expect(result.accounts[0].balance).toBe(2_400)
  })

  it('account with deductedFromSalary: true still qualifies and increments', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
      deductedFromSalary: true,
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const result = applyMonthlyContributions(data, '2026-05')
    expect(result.accounts[0].balance).toBe(10_500)
  })

  it('does not mutate the input data object', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const data = makeFinanceData({ accounts: [account], expenses: [expense] })

    const originalBalance = data.accounts[0].balance

    applyMonthlyContributions(data, '2026-05')

    // Input object was not mutated
    expect(data.accounts[0].balance).toBe(originalBalance)
    expect(data.accounts[0].lastAutoIncrementMonth).toBe('2026-04')
  })

  it('returns new FinanceData with updated accounts while history remains unchanged', () => {
    const account = makeAccount({
      monthlyContribution: 500,
      lastAutoIncrementMonth: '2026-04',
    })
    const expense = makeExpense({ linkedAccountId: 'acc1', expenseType: 'fixed' })
    const snap = {
      id: 'snap1',
      label: 'April 2026',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 9_000,
      totalExpenses: 3_000,
      totalSavings: 500,
      freeCashFlow: 5_500,
    }
    const data = makeFinanceData({ accounts: [account], expenses: [expense], history: [snap] })

    const result = applyMonthlyContributions(data, '2026-05')

    // Result is a new object (not the same reference)
    expect(result).not.toBe(data)
    // Accounts were updated
    expect(result.accounts[0].balance).toBe(10_500)
    // History is untouched
    expect(result.history).toHaveLength(1)
    expect(result.history[0]).toEqual(snap)
  })
})
