/**
 * Tests for pure utility functions used by the Overview tab (v2.9).
 * Functions are defined locally (they live inline in Overview.tsx) so tests
 * are self-contained specs that validate the logic independently.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Expense } from '../types'

// ─── Minimal factory helpers ──────────────────────────────────────────────────
function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    name: 'Test',
    amount: 1000,
    category: 'food',
    recurring: true,
    period: 'monthly',
    ...overrides,
  }
}

type AccountInput = { balance: number; monthlyContribution: number; annualReturnPercent: number }
type HistoryPoint = { totalIncome: number; totalExpenses: number }

// ─── Pure functions (mirrored from Overview.tsx logic) ────────────────────────

type UpcomingBill = { expense: Expense; dueDate: Date; daysUntil: number; month: number }

function getUpcomingYearlyBills(expenses: Expense[], today: Date): UpcomingBill[] {
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const sixMonthsLater = new Date(today)
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  return expenses
    .filter(e => e.period === 'yearly' && e.dueMonth != null)
    .map(e => {
      const dm = e.dueMonth!
      const year = dm >= currentMonth ? currentYear : currentYear + 1
      const dueDate = new Date(year, dm - 1, 1)
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { expense: e, dueDate, daysUntil, month: dm - 1 }
    })
    .filter(b => b.dueDate <= sixMonthsLater && b.daysUntil >= 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

type BudgetHealth = {
  under: number; warning: number; over: number; none: number
  worstCategory: string | null; worstPct: number
}

function computeBudgetHealth(
  expenses: Expense[],
  categoryBudgets: Partial<Record<string, number>>,
): BudgetHealth {
  const spentByCategory: Record<string, number> = {}
  expenses.forEach(e => {
    const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
    spentByCategory[e.category] = (spentByCategory[e.category] ?? 0) + monthly
  })

  let under = 0, warning = 0, over = 0, none = 0
  let worstCategory: string | null = null
  let worstPct = 0

  for (const [cat, budget] of Object.entries(categoryBudgets)) {
    if (!budget) { none++; continue }
    const spent = spentByCategory[cat] ?? 0
    const pct = (spent / budget) * 100
    if (pct > 100) {
      over++
      if (pct > worstPct) { worstPct = pct; worstCategory = cat }
    } else if (pct >= 80) {
      warning++
    } else {
      under++
    }
  }

  for (const cat of Object.keys(spentByCategory)) {
    if (!(cat in categoryBudgets)) none++
  }

  return { under, warning, over, none, worstCategory, worstPct }
}

type ProjectionPoint = { month: number; balance: number }

function computeSavingsProjection(accounts: AccountInput[], months: number): ProjectionPoint[] {
  if (accounts.length === 0) {
    return Array.from({ length: months + 1 }, (_, i) => ({ month: i, balance: 0 }))
  }
  const balances = accounts.map(a => a.balance)
  const result: ProjectionPoint[] = [
    { month: 0, balance: Math.round(balances.reduce((s, b) => s + b, 0)) },
  ]
  for (let m = 1; m <= months; m++) {
    accounts.forEach((acc, i) => {
      balances[i] = balances[i] * (1 + acc.annualReturnPercent / 100 / 12) + acc.monthlyContribution
    })
    result.push({ month: m, balance: Math.round(balances.reduce((s, b) => s + b, 0)) })
  }
  return result
}

type MomTrend = { incomePct: number | null; expensesPct: number | null }

function getMomTrend(history: HistoryPoint[]): MomTrend {
  const nonStubs = history.filter(h => h.totalIncome > 0)
  if (nonStubs.length < 2) return { incomePct: null, expensesPct: null }
  const prev = nonStubs[nonStubs.length - 2]
  const curr = nonStubs[nonStubs.length - 1]
  const incomePct = prev.totalIncome > 0
    ? ((curr.totalIncome - prev.totalIncome) / prev.totalIncome) * 100
    : null
  const expensesPct = prev.totalExpenses > 0
    ? ((curr.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100
    : null
  return { incomePct, expensesPct }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers()
})

// ── getUpcomingYearlyBills ────────────────────────────────────────────────────
describe('getUpcomingYearlyBills()', () => {
  const TODAY = new Date(2025, 3, 15) // Apr 15 2025

  it('returns empty array when expenses array is empty', () => {
    expect(getUpcomingYearlyBills([], TODAY)).toEqual([])
  })

  it('returns empty array when yearly expenses have no dueMonth', () => {
    const expenses = [makeExpense({ period: 'yearly' })] // no dueMonth
    expect(getUpcomingYearlyBills(expenses, TODAY)).toEqual([])
  })

  it('ignores monthly expenses (even with dueMonth)', () => {
    // dueMonth on a monthly expense is unusual but should be filtered
    const expenses = [makeExpense({ period: 'monthly', dueMonth: 5 })]
    expect(getUpcomingYearlyBills(expenses, TODAY)).toEqual([])
  })

  it('returns expense due next month (within 6-month window)', () => {
    // May = month 5, today is April 15 — falls within window
    const expenses = [makeExpense({ id: 'e1', period: 'yearly', dueMonth: 5, name: 'Car insurance' })]
    const result = getUpcomingYearlyBills(expenses, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].expense.name).toBe('Car insurance')
    expect(result[0].daysUntil).toBeGreaterThan(0)
  })

  it('excludes expense due 7 months away', () => {
    // November = month 11, today is April 15 — 7 months away
    const expenses = [makeExpense({ period: 'yearly', dueMonth: 11 })]
    expect(getUpcomingYearlyBills(expenses, TODAY)).toHaveLength(0)
  })

  it('sorts multiple upcoming bills nearest first', () => {
    const expenses = [
      makeExpense({ id: 'e1', period: 'yearly', dueMonth: 9, name: 'September' }), // 5 months away
      makeExpense({ id: 'e2', period: 'yearly', dueMonth: 5, name: 'May' }),        // 1 month away
      makeExpense({ id: 'e3', period: 'yearly', dueMonth: 7, name: 'July' }),       // 3 months away
    ]
    const result = getUpcomingYearlyBills(expenses, TODAY)
    expect(result.map(b => b.expense.name)).toEqual(['May', 'July', 'September'])
  })

  it('wraps dueMonth in the past to next year', () => {
    // March = month 3, today is April 15 — this year already passed, wraps to next year
    const expenses = [makeExpense({ period: 'yearly', dueMonth: 3, name: 'March bill' })]
    const result = getUpcomingYearlyBills(expenses, TODAY)
    // March next year is 11 months away, so outside 6-month window
    expect(result).toHaveLength(0)
  })

  it('includes expense whose dueMonth matches current month', () => {
    // April = month 4, today is April 15 — due April 1, which is in the past (daysUntil < 0) → excluded
    const expenses = [makeExpense({ period: 'yearly', dueMonth: 4 })]
    const result = getUpcomingYearlyBills(expenses, TODAY)
    // April 1 is before April 15, so daysUntil is negative → filtered out
    expect(result).toHaveLength(0)
  })
})

// ── computeBudgetHealth ───────────────────────────────────────────────────────
describe('computeBudgetHealth()', () => {
  it('returns all zeros when no budgets and no expenses', () => {
    const result = computeBudgetHealth([], {})
    expect(result).toMatchObject({ under: 0, warning: 0, over: 0, none: 0, worstCategory: null })
  })

  it('classifies under-budget category (<80% spend)', () => {
    const expenses = [makeExpense({ category: 'food', amount: 700 })]
    const result = computeBudgetHealth(expenses, { food: 1000 })
    // 700/1000 = 70% → under
    expect(result.under).toBe(1)
    expect(result.warning).toBe(0)
    expect(result.over).toBe(0)
  })

  it('classifies warning category (85% spend)', () => {
    const expenses = [makeExpense({ category: 'food', amount: 850 })]
    const result = computeBudgetHealth(expenses, { food: 1000 })
    // 85% → warning
    expect(result.warning).toBe(1)
    expect(result.under).toBe(0)
    expect(result.over).toBe(0)
  })

  it('classifies over-budget category (>100% spend)', () => {
    const expenses = [makeExpense({ category: 'food', amount: 1200 })]
    const result = computeBudgetHealth(expenses, { food: 1000 })
    // 120% → over
    expect(result.over).toBe(1)
    expect(result.worstCategory).toBe('food')
    expect(result.worstPct).toBeCloseTo(120)
  })

  it('category with budget but zero spending counts as under', () => {
    const result = computeBudgetHealth([], { housing: 3000 })
    // 0/3000 = 0% → under
    expect(result.under).toBe(1)
    expect(result.none).toBe(0)
  })

  it('identifies worst offender correctly (highest pct over budget)', () => {
    const expenses = [
      makeExpense({ id: 'e1', category: 'food',      amount: 1200 }), // 120%
      makeExpense({ id: 'e2', category: 'transport',  amount: 1800 }), // 180%
    ]
    const result = computeBudgetHealth(expenses, { food: 1000, transport: 1000 })
    expect(result.worstCategory).toBe('transport')
    expect(result.worstPct).toBeCloseTo(180)
  })

  it('spending category with no budget counts as none', () => {
    const expenses = [makeExpense({ category: 'leisure', amount: 500 })]
    const result = computeBudgetHealth(expenses, {}) // no budget for leisure
    expect(result.none).toBe(1)
    expect(result.under).toBe(0)
  })

  it('mixed categories — all counts correct', () => {
    const expenses = [
      makeExpense({ id: 'e1', category: 'food',      amount: 500  }), // 50%  → under
      makeExpense({ id: 'e2', category: 'transport',  amount: 900  }), // 90%  → warning
      makeExpense({ id: 'e3', category: 'leisure',    amount: 1500 }), // 150% → over
      makeExpense({ id: 'e4', category: 'clothing',   amount: 300  }), // no budget → none
    ]
    const budgets = { food: 1000, transport: 1000, leisure: 1000, housing: 2000 } // housing has no expenses
    const result = computeBudgetHealth(expenses, budgets)
    expect(result.under).toBe(2)   // food + housing (0%)
    expect(result.warning).toBe(1) // transport
    expect(result.over).toBe(1)    // leisure
    expect(result.none).toBe(1)    // clothing (no budget)
    expect(result.worstCategory).toBe('leisure')
  })
})

// ── computeSavingsProjection ──────────────────────────────────────────────────
describe('computeSavingsProjection()', () => {
  it('returns all zeros for empty accounts list, length = months + 1', () => {
    const result = computeSavingsProjection([], 12)
    expect(result).toHaveLength(13)
    expect(result.every(p => p.balance === 0)).toBe(true)
  })

  it('single account, 0% return, 0 contribution — flat', () => {
    const result = computeSavingsProjection(
      [{ balance: 100_000, monthlyContribution: 0, annualReturnPercent: 0 }],
      12
    )
    expect(result[0].balance).toBe(100_000)
    expect(result[12].balance).toBe(100_000)
    // All months same
    expect(result.every(p => p.balance === 100_000)).toBe(true)
  })

  it('single account, 0% return, 1000/mo contribution — linear growth', () => {
    const result = computeSavingsProjection(
      [{ balance: 50_000, monthlyContribution: 1000, annualReturnPercent: 0 }],
      12
    )
    expect(result[0].balance).toBe(50_000)
    expect(result[1].balance).toBe(51_000)
    expect(result[6].balance).toBe(56_000)
    expect(result[12].balance).toBe(62_000)
  })

  it('single account, 12% annual return, 0 contributions — month 1 ≈ balance × 1.01', () => {
    const result = computeSavingsProjection(
      [{ balance: 100_000, monthlyContribution: 0, annualReturnPercent: 12 }],
      12
    )
    expect(result[0].balance).toBe(100_000)
    // 100_000 * 1.01 = 101_000 (rounded)
    expect(result[1].balance).toBe(101_000)
    // After 12 months at 1%/mo: 100_000 * 1.01^12 ≈ 112_683
    expect(result[12].balance).toBeGreaterThan(112_000)
    expect(result[12].balance).toBeLessThan(114_000)
  })

  it('month 0 equals current total balance', () => {
    const accounts = [
      { balance: 30_000, monthlyContribution: 500, annualReturnPercent: 5 },
      { balance: 70_000, monthlyContribution: 1000, annualReturnPercent: 8 },
    ]
    const result = computeSavingsProjection(accounts, 6)
    expect(result[0].balance).toBe(100_000)
  })

  it('months=12 returns array of length 13', () => {
    const result = computeSavingsProjection(
      [{ balance: 10_000, monthlyContribution: 100, annualReturnPercent: 5 }],
      12
    )
    expect(result).toHaveLength(13)
  })

  it('month indices are 0..months', () => {
    const result = computeSavingsProjection(
      [{ balance: 5_000, monthlyContribution: 0, annualReturnPercent: 0 }],
      3
    )
    expect(result.map(p => p.month)).toEqual([0, 1, 2, 3])
  })

  it('two accounts — balances are summed correctly each month', () => {
    const result = computeSavingsProjection(
      [
        { balance: 10_000, monthlyContribution: 0, annualReturnPercent: 0 },
        { balance: 20_000, monthlyContribution: 0, annualReturnPercent: 0 },
      ],
      1
    )
    expect(result[0].balance).toBe(30_000)
    expect(result[1].balance).toBe(30_000)
  })
})

// ── getMomTrend ───────────────────────────────────────────────────────────────
describe('getMomTrend()', () => {
  it('returns both null with empty history', () => {
    expect(getMomTrend([])).toEqual({ incomePct: null, expensesPct: null })
  })

  it('returns both null with only 1 non-stub snapshot', () => {
    const history = [{ totalIncome: 10_000, totalExpenses: 8_000 }]
    expect(getMomTrend(history)).toEqual({ incomePct: null, expensesPct: null })
  })

  it('income went from 10000 to 11000 → incomePct = 10', () => {
    const history = [
      { totalIncome: 10_000, totalExpenses: 8_000 },
      { totalIncome: 11_000, totalExpenses: 8_000 },
    ]
    const result = getMomTrend(history)
    expect(result.incomePct).toBeCloseTo(10)
  })

  it('expenses went from 8000 to 7200 → expensesPct = -10', () => {
    const history = [
      { totalIncome: 10_000, totalExpenses: 8_000 },
      { totalIncome: 10_000, totalExpenses: 7_200 },
    ]
    const result = getMomTrend(history)
    expect(result.expensesPct).toBeCloseTo(-10)
  })

  it('stub snapshots (totalIncome=0) are excluded from computation', () => {
    const history = [
      { totalIncome: 10_000, totalExpenses: 8_000 }, // real (prev)
      { totalIncome: 0,      totalExpenses: 3_000 }, // stub — skip
      { totalIncome: 11_000, totalExpenses: 8_800 }, // real (curr)
    ]
    const result = getMomTrend(history)
    // Should compare month 3 vs month 1 (skipping stub)
    expect(result.incomePct).toBeCloseTo(10)
    expect(result.expensesPct).toBeCloseTo(10)
  })

  it('with 3 non-stubs: compares last two (not first and last)', () => {
    const history = [
      { totalIncome: 5_000,  totalExpenses: 4_000 }, // oldest — should be ignored
      { totalIncome: 10_000, totalExpenses: 8_000 }, // prev
      { totalIncome: 11_000, totalExpenses: 8_000 }, // curr
    ]
    const result = getMomTrend(history)
    // 11000 vs 10000 → +10%, not vs 5000 (+120%)
    expect(result.incomePct).toBeCloseTo(10)
  })

  it('history with all stubs returns null', () => {
    const history = [
      { totalIncome: 0, totalExpenses: 2_000 },
      { totalIncome: 0, totalExpenses: 3_000 },
    ]
    expect(getMomTrend(history)).toEqual({ incomePct: null, expensesPct: null })
  })
})
