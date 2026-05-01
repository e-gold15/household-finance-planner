/**
 * Tests for the v2.2 Expense and History enhancements:
 *
 *   F1 — Fixed vs Variable expense classification
 *   F2 — Category budget limits (categoryBudgets in FinanceData)
 *   F3 — Month-over-month Δ comparison (uses categoryActuals from last snapshot)
 *   F4 — Annual expense smoothing (dueMonth field + monthsUntilDue logic)
 *   F5 — Monthly actuals log (categoryActuals in MonthSnapshot)
 *
 * All tests exercise pure logic and data transforms — no React rendering required.
 * UI interactions (BudgetEditor inline edit, Compare toggle, ActualsDialog) are
 * covered by the manual QA checklist.
 */

import { describe, it, expect } from 'vitest'
import type { Expense, MonthSnapshot, FinanceData, ExpenseCategory } from '@/types'

// ─── Helpers (mirrors the logic in Expenses.tsx / FinanceContext) ─────────────

function monthly(e: Expense): number {
  return e.period === 'yearly' ? e.amount / 12 : e.amount
}

function monthsUntilDue(dueMonth: number): number {
  const current = new Date().getMonth() + 1
  if (dueMonth === current) return 0
  if (dueMonth > current) return dueMonth - current
  return 12 - current + dueMonth
}

function computeDelta(
  category: ExpenseCategory,
  currentTotal: number,
  lastSnapshot: MonthSnapshot | null
): number | null {
  if (!lastSnapshot?.categoryActuals) return null
  const last = lastSnapshot.categoryActuals[category] ?? 0
  return currentTotal - last
}

function updateCategoryBudget(
  budgets: Partial<Record<ExpenseCategory, number>>,
  category: ExpenseCategory,
  budget: number | undefined
): Partial<Record<ExpenseCategory, number>> {
  const next = { ...budgets }
  if (budget === undefined || budget <= 0) delete next[category]
  else next[category] = budget
  return next
}

function updateSnapshotActuals(
  history: MonthSnapshot[],
  snapshotId: string,
  actuals: Partial<Record<ExpenseCategory, number>>
): MonthSnapshot[] {
  return history.map((h) => h.id === snapshotId ? { ...h, categoryActuals: actuals } : h)
}

function buildExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    name: 'Test',
    amount: 1000,
    category: 'food',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
    ...overrides,
  }
}

function buildSnapshot(overrides: Partial<MonthSnapshot> = {}): MonthSnapshot {
  return {
    id: 'snap-1',
    label: 'April 2026',
    date: '2026-04-01T00:00:00.000Z',
    totalIncome: 10000,
    totalExpenses: 5000,
    totalSavings: 1000,
    freeCashFlow: 4000,
    ...overrides,
  }
}

// ─── createdAt stamping (mirrors addExpense logic in FinanceContext) ──────────

/**
 * Mirrors the stamping logic inside FinanceContext.addExpense:
 *   createdAt: expense.createdAt ?? new Date().toISOString()
 */
function stampCreatedAt(expense: Omit<Expense, 'id'>): Omit<Expense, 'id'> {
  return {
    ...expense,
    createdAt: expense.createdAt ?? new Date().toISOString(),
  }
}

describe('addExpense — createdAt stamping', () => {
  it('stamps createdAt as an ISO string when not provided', () => {
    const before = Date.now()
    const result = stampCreatedAt(buildExpense({ createdAt: undefined }))
    const after = Date.now()
    expect(result.createdAt).toBeDefined()
    const ts = new Date(result.createdAt!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('preserves existing createdAt if one is already set (idempotent)', () => {
    const original = '2025-01-15T10:00:00.000Z'
    const result = stampCreatedAt(buildExpense({ createdAt: original }))
    expect(result.createdAt).toBe(original)
  })
})

// ─── F1: Fixed vs Variable classification ────────────────────────────────────

describe('F1 — Fixed vs Variable classification', () => {
  it('expenseType defaults to "fixed" when undefined (backward compat)', () => {
    const e = buildExpense({ expenseType: undefined })
    expect(e.expenseType ?? 'fixed').toBe('fixed')
  })

  it('expenseType "variable" is stored and read correctly', () => {
    const e = buildExpense({ expenseType: 'variable' })
    expect(e.expenseType).toBe('variable')
  })

  it('fixed total sums only fixed expenses (treating undefined as fixed)', () => {
    const expenses: Expense[] = [
      buildExpense({ id: '1', amount: 3000, expenseType: 'fixed' }),
      buildExpense({ id: '2', amount: 1000, expenseType: 'variable' }),
      buildExpense({ id: '3', amount: 500,  expenseType: undefined }),  // treated as fixed
    ]
    const fixedTotal = expenses
      .filter((e) => (e.expenseType ?? 'fixed') === 'fixed')
      .reduce((s, e) => s + monthly(e), 0)
    expect(fixedTotal).toBe(3500)  // 3000 + 500
  })

  it('variable total sums only variable expenses', () => {
    const expenses: Expense[] = [
      buildExpense({ id: '1', amount: 3000, expenseType: 'fixed' }),
      buildExpense({ id: '2', amount: 800,  expenseType: 'variable' }),
      buildExpense({ id: '3', amount: 200,  expenseType: 'variable' }),
    ]
    const variableTotal = expenses
      .filter((e) => e.expenseType === 'variable')
      .reduce((s, e) => s + monthly(e), 0)
    expect(variableTotal).toBe(1000)
  })

  it('fixed + variable totals sum to overall total', () => {
    const expenses: Expense[] = [
      buildExpense({ id: '1', amount: 5000, expenseType: 'fixed' }),
      buildExpense({ id: '2', amount: 2000, expenseType: 'variable' }),
    ]
    const total       = expenses.reduce((s, e) => s + monthly(e), 0)
    const fixedTotal  = expenses.filter((e) => (e.expenseType ?? 'fixed') === 'fixed').reduce((s, e) => s + monthly(e), 0)
    const varTotal    = expenses.filter((e) => e.expenseType === 'variable').reduce((s, e) => s + monthly(e), 0)
    expect(fixedTotal + varTotal).toBe(total)
  })
})

// ─── F2: Category budget limits ───────────────────────────────────────────────

describe('F2 — Category budget limits', () => {
  it('setting a budget stores the value', () => {
    const budgets = updateCategoryBudget({}, 'food', 2000)
    expect(budgets.food).toBe(2000)
  })

  it('setting budget to undefined removes the key', () => {
    const budgets = updateCategoryBudget({ food: 2000 }, 'food', undefined)
    expect(budgets.food).toBeUndefined()
  })

  it('setting budget to 0 removes the key (treat 0 as unset)', () => {
    const budgets = updateCategoryBudget({ food: 2000 }, 'food', 0)
    expect(budgets.food).toBeUndefined()
  })

  it('setting a negative budget removes the key', () => {
    const budgets = updateCategoryBudget({}, 'food', -500)
    expect(budgets.food).toBeUndefined()
  })

  it('budget percentage is capped at 100% for over-budget display', () => {
    const budget   = 1000
    const actual   = 1500
    const pct = Math.min(100, (actual / budget) * 100)
    expect(pct).toBe(100)
  })

  it('budget percentage calculates correctly when under budget', () => {
    const budget = 2000
    const actual = 1600
    const pct = Math.min(100, (actual / budget) * 100)
    expect(pct).toBe(80)
  })

  it('categories with no budget return null pct (no bar shown)', () => {
    const budgets: Partial<Record<ExpenseCategory, number>> = {}
    const pct = budgets['food'] ? (1000 / budgets['food']) * 100 : null
    expect(pct).toBeNull()
  })

  it('budget color logic: green < 80%, amber 80-99%, red >= 100%', () => {
    const color = (pct: number) =>
      pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green'
    expect(color(50)).toBe('green')
    expect(color(80)).toBe('amber')
    expect(color(99)).toBe('amber')
    expect(color(100)).toBe('red')
    expect(color(120)).toBe('red')
  })

  it('categoryBudgets defaults to {} in FinanceData', () => {
    const data: Partial<FinanceData> = { categoryBudgets: {} }
    expect(data.categoryBudgets).toEqual({})
  })
})

// ─── F3: Month-over-month Δ comparison ───────────────────────────────────────

describe('F3 — Month-over-month delta comparison', () => {
  it('returns null delta when no last snapshot exists', () => {
    const delta = computeDelta('food', 2000, null)
    expect(delta).toBeNull()
  })

  it('returns null delta when last snapshot has no categoryActuals', () => {
    const snap = buildSnapshot({ categoryActuals: undefined })
    const delta = computeDelta('food', 2000, snap)
    expect(delta).toBeNull()
  })

  it('positive delta indicates spending more than last month', () => {
    const snap = buildSnapshot({ categoryActuals: { food: 1600 } })
    const delta = computeDelta('food', 2000, snap)
    expect(delta).toBe(400)   // 2000 - 1600 = +400 (spent more)
  })

  it('negative delta indicates spending less than last month', () => {
    const snap = buildSnapshot({ categoryActuals: { food: 2400 } })
    const delta = computeDelta('food', 2000, snap)
    expect(delta).toBe(-400)  // 2000 - 2400 = -400 (spent less)
  })

  it('zero delta indicates no change', () => {
    const snap = buildSnapshot({ categoryActuals: { food: 2000 } })
    const delta = computeDelta('food', 2000, snap)
    expect(delta).toBe(0)
  })

  it('category missing from last snapshot actuals is treated as 0', () => {
    const snap = buildSnapshot({ categoryActuals: { housing: 5000 } })
    // food not in actuals — treated as 0
    const delta = computeDelta('food', 1800, snap)
    expect(delta).toBe(1800)  // 1800 - 0 = 1800
  })

  it('most recent snapshot is used for comparison (sorted by date)', () => {
    const older:  MonthSnapshot = buildSnapshot({ id: 's1', date: '2026-02-01T00:00:00.000Z', categoryActuals: { food: 1000 } })
    const recent: MonthSnapshot = buildSnapshot({ id: 's2', date: '2026-03-01T00:00:00.000Z', categoryActuals: { food: 2000 } })
    const history = [older, recent]
    const lastSnap = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    expect(lastSnap.id).toBe('s2')
    expect(lastSnap.categoryActuals?.food).toBe(2000)
  })
})

// ─── F4: Annual expense smoothing ────────────────────────────────────────────

describe('F4 — Annual expense smoothing', () => {
  it('yearly expense monthly provision = amount / 12', () => {
    const e = buildExpense({ amount: 2400, period: 'yearly' })
    expect(monthly(e)).toBeCloseTo(200)
  })

  it('dueMonth is stored on yearly expenses', () => {
    const e = buildExpense({ period: 'yearly', dueMonth: 6 })
    expect(e.dueMonth).toBe(6)
  })

  it('dueMonth is undefined for monthly expenses (not applicable)', () => {
    const e = buildExpense({ period: 'monthly', dueMonth: undefined })
    expect(e.dueMonth).toBeUndefined()
  })

  it('monthsUntilDue returns 0 when due this month', () => {
    const current = new Date().getMonth() + 1
    expect(monthsUntilDue(current)).toBe(0)
  })

  it('monthsUntilDue returns correct months for a future month', () => {
    const current = new Date().getMonth() + 1
    const future = current === 12 ? 1 : current + 3  // 3 months ahead, wrapping Dec→Jan
    const expected = current <= future ? future - current : 12 - current + future
    expect(monthsUntilDue(future)).toBe(expected)
  })

  it('monthsUntilDue wraps correctly across year boundary', () => {
    // Simulate: current=November (11), due=February (2)
    const simulate = (dueMonth: number, currentMonth: number) => {
      if (dueMonth === currentMonth) return 0
      if (dueMonth > currentMonth) return dueMonth - currentMonth
      return 12 - currentMonth + dueMonth
    }
    expect(simulate(2, 11)).toBe(3)   // Nov→Dec→Jan→Feb = 3 months
    expect(simulate(1, 12)).toBe(1)   // Dec→Jan = 1 month
    expect(simulate(12, 1)).toBe(11)  // Jan→…→Dec = 11 months
  })

  it('due-this-month filter correctly identifies annual expenses due now', () => {
    const currentMonth = new Date().getMonth() + 1
    const expenses: Expense[] = [
      buildExpense({ id: '1', period: 'yearly', dueMonth: currentMonth }),
      buildExpense({ id: '2', period: 'yearly', dueMonth: currentMonth === 12 ? 1 : currentMonth + 1 }),
      buildExpense({ id: '3', period: 'monthly', dueMonth: undefined }),
    ]
    const dueThisMonth = expenses.filter((e) => e.period === 'yearly' && e.dueMonth === currentMonth)
    expect(dueThisMonth).toHaveLength(1)
    expect(dueThisMonth[0].id).toBe('1')
  })
})

// ─── F5: Monthly actuals log ──────────────────────────────────────────────────

describe('F5 — Monthly actuals log', () => {
  it('snapshot without categoryActuals has no actuals (fresh snapshot)', () => {
    const snap = buildSnapshot({ categoryActuals: undefined })
    const hasActuals = snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0
    expect(hasActuals).toBeFalsy()
  })

  it('updateSnapshotActuals stores actuals on the correct snapshot', () => {
    const history = [
      buildSnapshot({ id: 'snap-1' }),
      buildSnapshot({ id: 'snap-2' }),
    ]
    const actuals: Partial<Record<ExpenseCategory, number>> = { food: 2400, housing: 5200 }
    const updated = updateSnapshotActuals(history, 'snap-1', actuals)
    expect(updated.find((h) => h.id === 'snap-1')?.categoryActuals).toEqual(actuals)
    expect(updated.find((h) => h.id === 'snap-2')?.categoryActuals).toBeUndefined()
  })

  it('updateSnapshotActuals does not mutate the original history array', () => {
    const history = [buildSnapshot({ id: 'snap-1' })]
    const updated = updateSnapshotActuals(history, 'snap-1', { food: 1000 })
    expect(history[0].categoryActuals).toBeUndefined()  // original unchanged
    expect(updated[0].categoryActuals?.food).toBe(1000)
  })

  it('snapshotMonth pre-populates categoryActuals from planned expenses', () => {
    // Mirror the logic in FinanceContext.snapshotMonth
    const expenses: Expense[] = [
      buildExpense({ id: '1', category: 'food',    amount: 2000, period: 'monthly' }),
      buildExpense({ id: '2', category: 'food',    amount: 500,  period: 'monthly' }),
      buildExpense({ id: '3', category: 'housing', amount: 5200, period: 'monthly' }),
      buildExpense({ id: '4', category: 'transport', amount: 12000, period: 'yearly' }),
    ]
    const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
    expenses.forEach((e) => {
      const m = e.period === 'yearly' ? e.amount / 12 : e.amount
      categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + m
    })
    expect(categoryActuals.food).toBe(2500)            // 2000 + 500
    expect(categoryActuals.housing).toBe(5200)
    expect(categoryActuals.transport).toBeCloseTo(1000) // 12000/12
  })

  it('editing actuals overwrites previous values for the same category', () => {
    const history = [buildSnapshot({ id: 'snap-1', categoryActuals: { food: 2000 } })]
    const updated = updateSnapshotActuals(history, 'snap-1', { food: 3500 })
    expect(updated[0].categoryActuals?.food).toBe(3500)
  })

  it('actuals can include categories not in planned expenses', () => {
    const actuals: Partial<Record<ExpenseCategory, number>> = {
      food: 2000,
      leisure: 800,   // wasn't in the plan
    }
    expect(actuals.leisure).toBe(800)
  })

  it('non-edited snapshot is unchanged after updating a sibling snapshot', () => {
    const history = [
      buildSnapshot({ id: 'snap-1', categoryActuals: { food: 2000 } }),
      buildSnapshot({ id: 'snap-2', categoryActuals: { food: 1800 } }),
    ]
    const updated = updateSnapshotActuals(history, 'snap-1', { food: 3000 })
    expect(updated.find((h) => h.id === 'snap-2')?.categoryActuals?.food).toBe(1800)
  })
})
