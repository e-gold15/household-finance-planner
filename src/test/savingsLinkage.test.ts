/**
 * Tests for the v2.7 savings expense → account linkage feature.
 *
 * When an Expense has `category === 'savings'` and a `linkedAccountId` set,
 * the three expense CRUD helpers must mirror the monthly-equivalent contribution
 * onto the linked SavingsAccount's `monthlyContribution` field:
 *
 *   addExpense    — set account.monthlyContribution to monthly-equivalent amount
 *   updateExpense — update monthlyContribution on old/new accounts as needed
 *   deleteExpense — reset account.monthlyContribution to 0
 *
 * All tests exercise pure logic and data transforms — no React rendering required.
 */

import { describe, it, expect } from 'vitest'
import type { FinanceData, Expense, SavingsAccount } from '@/types'

// ─── Pure helper functions (mirror intended FinanceContext v2.7 logic) ────────

let _idCounter = 0
function generateId(): string {
  return `test-id-${++_idCounter}`
}

/** Compute the monthly-equivalent amount for an expense. */
function monthlyAmount(expense: Pick<Expense, 'amount' | 'period'>): number {
  return expense.period === 'yearly' ? expense.amount / 12 : expense.amount
}

function addExpense(data: FinanceData, expense: Omit<Expense, 'id'>): FinanceData {
  const newExpense: Expense = { ...expense, id: generateId() }
  let accounts = data.accounts

  if (newExpense.category === 'savings' && newExpense.linkedAccountId) {
    const monthly = monthlyAmount(newExpense)
    accounts = accounts.map((a) =>
      a.id === newExpense.linkedAccountId
        ? { ...a, monthlyContribution: monthly }
        : a
    )
  }

  return { ...data, expenses: [...data.expenses, newExpense], accounts }
}

function updateExpense(data: FinanceData, newExpense: Expense): FinanceData {
  const oldExpense = data.expenses.find((e) => e.id === newExpense.id)
  let accounts = data.accounts

  const oldLinked =
    oldExpense?.category === 'savings' && oldExpense?.linkedAccountId
      ? oldExpense.linkedAccountId
      : null
  const newLinked =
    newExpense.category === 'savings' && newExpense.linkedAccountId
      ? newExpense.linkedAccountId
      : null

  if (oldLinked && newLinked && oldLinked === newLinked) {
    // Same account: update monthly contribution
    const monthly = monthlyAmount(newExpense)
    accounts = accounts.map((a) =>
      a.id === newLinked ? { ...a, monthlyContribution: monthly } : a
    )
  } else if (oldLinked && newLinked && oldLinked !== newLinked) {
    // Different accounts: reset old, set new
    const monthly = monthlyAmount(newExpense)
    accounts = accounts.map((a) => {
      if (a.id === oldLinked) return { ...a, monthlyContribution: 0 }
      if (a.id === newLinked) return { ...a, monthlyContribution: monthly }
      return a
    })
  } else if (oldLinked && !newLinked) {
    // Link removed or category changed away from savings: reset old
    accounts = accounts.map((a) =>
      a.id === oldLinked ? { ...a, monthlyContribution: 0 } : a
    )
  } else if (!oldLinked && newLinked) {
    // New link added: set new account
    const monthly = monthlyAmount(newExpense)
    accounts = accounts.map((a) =>
      a.id === newLinked ? { ...a, monthlyContribution: monthly } : a
    )
  }
  // else: no link on either side — accounts unchanged

  return {
    ...data,
    expenses: data.expenses.map((e) => (e.id === newExpense.id ? newExpense : e)),
    accounts,
  }
}

function deleteExpense(data: FinanceData, expenseId: string): FinanceData {
  const expense = data.expenses.find((e) => e.id === expenseId)
  let accounts = data.accounts

  if (expense?.category === 'savings' && expense?.linkedAccountId) {
    accounts = accounts.map((a) =>
      a.id === expense.linkedAccountId ? { ...a, monthlyContribution: 0 } : a
    )
  }

  return { ...data, expenses: data.expenses.filter((e) => e.id !== expenseId), accounts }
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'account-1',
    name: 'Emergency Fund',
    type: 'savings',
    balance: 10000,
    liquidity: 'immediate',
    annualReturnPercent: 2,
    monthlyContribution: 0,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    name: 'Pension contribution',
    amount: 1000,
    category: 'savings',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
    ...overrides,
  }
}

function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
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

// ─── addExpense() ─────────────────────────────────────────────────────────────

describe('addExpense()', () => {
  it('sets monthlyContribution on the linked account', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 0 })
    const data = makeData({ accounts: [account] })
    const result = addExpense(data, {
      name: 'Pension',
      amount: 1500,
      category: 'savings',
      recurring: true,
      period: 'monthly',
      linkedAccountId: 'acc-1',
    })
    expect(result.accounts[0].monthlyContribution).toBe(1500)
  })

  it('yearly expense → monthlyContribution = amount / 12', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 0 })
    const data = makeData({ accounts: [account] })
    const result = addExpense(data, {
      name: 'Annual savings plan',
      amount: 12000,
      category: 'savings',
      recurring: true,
      period: 'yearly',
      linkedAccountId: 'acc-1',
    })
    expect(result.accounts[0].monthlyContribution).toBe(1000) // 12000 / 12
  })

  it('no linkedAccountId → accounts unchanged', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 500 })
    const data = makeData({ accounts: [account] })
    const result = addExpense(data, {
      name: 'Pension',
      amount: 1500,
      category: 'savings',
      recurring: true,
      period: 'monthly',
      // no linkedAccountId
    })
    expect(result.accounts[0].monthlyContribution).toBe(500)
  })

  it('category ≠ savings → accounts unchanged even if linkedAccountId is set', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 300 })
    const data = makeData({ accounts: [account] })
    const result = addExpense(data, {
      name: 'Gym membership',
      amount: 200,
      category: 'health',
      recurring: true,
      period: 'monthly',
      linkedAccountId: 'acc-1',
    })
    expect(result.accounts[0].monthlyContribution).toBe(300)
  })

  it('linkedAccountId not found in accounts → no crash, accounts unchanged', () => {
    const account = makeAccount({ id: 'acc-real', monthlyContribution: 100 })
    const data = makeData({ accounts: [account] })
    expect(() =>
      addExpense(data, {
        name: 'Pension',
        amount: 1000,
        category: 'savings',
        recurring: true,
        period: 'monthly',
        linkedAccountId: 'acc-nonexistent',
      })
    ).not.toThrow()
    const result = addExpense(data, {
      name: 'Pension',
      amount: 1000,
      category: 'savings',
      recurring: true,
      period: 'monthly',
      linkedAccountId: 'acc-nonexistent',
    })
    expect(result.accounts[0].monthlyContribution).toBe(100)
  })

  it('multiple accounts — only the linked one is affected', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Fund A', monthlyContribution: 0 })
    const acc2 = makeAccount({ id: 'acc-2', name: 'Fund B', monthlyContribution: 500 })
    const acc3 = makeAccount({ id: 'acc-3', name: 'Fund C', monthlyContribution: 200 })
    const data = makeData({ accounts: [acc1, acc2, acc3] })
    const result = addExpense(data, {
      name: 'Pension',
      amount: 800,
      category: 'savings',
      recurring: true,
      period: 'monthly',
      linkedAccountId: 'acc-2',
    })
    expect(result.accounts[0].monthlyContribution).toBe(0)   // acc-1 unchanged
    expect(result.accounts[1].monthlyContribution).toBe(800) // acc-2 updated
    expect(result.accounts[2].monthlyContribution).toBe(200) // acc-3 unchanged
  })
})

// ─── updateExpense() ──────────────────────────────────────────────────────────

describe('updateExpense()', () => {
  it('same account new amount → monthlyContribution updated to new amount', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 1000 })
    const expense = makeExpense({ id: 'exp-1', amount: 1000, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, amount: 1800 }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(1800)
  })

  it('switches account → old account reset to 0, new account set to new amount', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Old Fund', monthlyContribution: 1000 })
    const acc2 = makeAccount({ id: 'acc-2', name: 'New Fund', monthlyContribution: 200 })
    const expense = makeExpense({ id: 'exp-1', amount: 1000, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [acc1, acc2], expenses: [expense] })
    const updated = { ...expense, linkedAccountId: 'acc-2', amount: 600 }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(0)   // old account reset
    expect(result.accounts[1].monthlyContribution).toBe(600) // new account set
  })

  it('category changes away from savings → old account reset to 0', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 700 })
    const expense = makeExpense({ id: 'exp-1', amount: 700, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, category: 'food' as const }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(0)
  })

  it('adds link (was unlinked) → new account set to expense amount', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 0 })
    const expense = makeExpense({ id: 'exp-1', amount: 900, category: 'savings', linkedAccountId: undefined })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, linkedAccountId: 'acc-1' }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(900)
  })

  it('removes link (linkedAccountId cleared) → old account reset to 0', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 500 })
    const expense = makeExpense({ id: 'exp-1', amount: 500, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, linkedAccountId: undefined }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(0)
  })

  it('no linkedAccountId on either old or new expense → accounts unchanged', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 250 })
    const expense = makeExpense({
      id: 'exp-1',
      amount: 300,
      category: 'food',
      linkedAccountId: undefined,
    })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, amount: 400 }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(250)
  })

  it('old linkedAccountId not found in accounts → no crash, update still applies', () => {
    const account = makeAccount({ id: 'acc-real', monthlyContribution: 100 })
    const expense = makeExpense({ id: 'exp-1', amount: 600, linkedAccountId: 'acc-ghost' })
    const data = makeData({ accounts: [account], expenses: [expense] })
    expect(() => updateExpense(data, { ...expense, amount: 800 })).not.toThrow()
    const result = updateExpense(data, { ...expense, amount: 800 })
    // The ghost account isn't in the list; acc-real should be untouched
    expect(result.accounts[0].monthlyContribution).toBe(100)
    // Expense itself should be updated
    expect(result.expenses[0].amount).toBe(800)
  })

  it('yearly expense updated → monthlyContribution recalculated as amount / 12', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 600 }) // was 7200/12
    const expense = makeExpense({
      id: 'exp-1',
      amount: 7200,
      period: 'yearly',
      linkedAccountId: 'acc-1',
    })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const updated = { ...expense, amount: 12000 }
    const result = updateExpense(data, updated)
    expect(result.accounts[0].monthlyContribution).toBe(1000) // 12000 / 12
  })
})

// ─── deleteExpense() ──────────────────────────────────────────────────────────

describe('deleteExpense()', () => {
  it('linked savings expense deleted → account monthlyContribution set to 0', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 1200 })
    const expense = makeExpense({ id: 'exp-1', amount: 1200, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const result = deleteExpense(data, 'exp-1')
    expect(result.accounts[0].monthlyContribution).toBe(0)
    expect(result.expenses).toHaveLength(0)
  })

  it('expense with no linkedAccountId deleted → accounts unchanged', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 800 })
    const expense = makeExpense({ id: 'exp-1', linkedAccountId: undefined })
    const data = makeData({ accounts: [account], expenses: [expense] })
    const result = deleteExpense(data, 'exp-1')
    expect(result.accounts[0].monthlyContribution).toBe(800)
  })

  it('multiple accounts — only the linked account is reset to 0 on delete', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Fund A', monthlyContribution: 500 })
    const acc2 = makeAccount({ id: 'acc-2', name: 'Fund B', monthlyContribution: 750 })
    const acc3 = makeAccount({ id: 'acc-3', name: 'Fund C', monthlyContribution: 300 })
    const expense = makeExpense({ id: 'exp-1', amount: 750, linkedAccountId: 'acc-2' })
    const data = makeData({ accounts: [acc1, acc2, acc3], expenses: [expense] })
    const result = deleteExpense(data, 'exp-1')
    expect(result.accounts[0].monthlyContribution).toBe(500) // acc-1 untouched
    expect(result.accounts[1].monthlyContribution).toBe(0)   // acc-2 reset
    expect(result.accounts[2].monthlyContribution).toBe(300) // acc-3 untouched
  })
})

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('no mutation', () => {
  it('addExpense does not mutate the original data object', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 0 })
    const data = makeData({ accounts: [account] })
    const originalContribution = data.accounts[0].monthlyContribution
    const originalExpenseCount = data.expenses.length

    addExpense(data, {
      name: 'Pension',
      amount: 1000,
      category: 'savings',
      recurring: true,
      period: 'monthly',
      linkedAccountId: 'acc-1',
    })

    expect(data.accounts[0].monthlyContribution).toBe(originalContribution)
    expect(data.expenses.length).toBe(originalExpenseCount)
  })

  it('updateExpense does not mutate the original data object', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 500 })
    const expense = makeExpense({ id: 'exp-1', amount: 500, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })

    updateExpense(data, { ...expense, amount: 999 })

    expect(data.accounts[0].monthlyContribution).toBe(500)
    expect(data.expenses[0].amount).toBe(500)
  })

  it('deleteExpense does not mutate the original data object', () => {
    const account = makeAccount({ id: 'acc-1', monthlyContribution: 800 })
    const expense = makeExpense({ id: 'exp-1', amount: 800, linkedAccountId: 'acc-1' })
    const data = makeData({ accounts: [account], expenses: [expense] })

    deleteExpense(data, 'exp-1')

    expect(data.accounts[0].monthlyContribution).toBe(800)
    expect(data.expenses).toHaveLength(1)
  })
})
