/**
 * Tests for the v2.6 addIncomeToMonth feature.
 *
 * addIncomeToMonth(year, month, item, expenses) either:
 *   - Adds the income item to an existing snapshot for that year/month, incrementing
 *     totalIncome and recomputing freeCashFlow = totalIncome - totalExpenses - totalSavings
 *   - Creates a stub snapshot when none exists for that month, pre-populated with:
 *       - totalIncome    = item.amount
 *       - totalExpenses  = sum of fixed recurring expenses (monthly equivalent)
 *       - totalSavings   = 0
 *       - freeCashFlow   = totalIncome - totalExpenses  (unlike expense stubs which hardcode 0)
 *       - categoryActuals pre-populated from fixed expenses
 *       - historicalIncomes: [newItem]
 *
 * All tests exercise pure logic — no React rendering required.
 * The helper below mirrors the FinanceContext implementation exactly.
 */

import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, HistoricalIncome, Expense, ExpenseCategory } from '@/types'

// ─── Constants (mirrors FinanceContext) ───────────────────────────────────────

const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ─── Pure helper (mirrors what FinanceContext addIncomeToMonth should implement) ─

let _idCounter = 0
function generateId(): string {
  return `test-id-${++_idCounter}`
}

function addIncomeToMonth(
  history: MonthSnapshot[],
  year: number,
  month: number,
  item: Omit<HistoricalIncome, 'id'>,
  expenses: Expense[] = []
): MonthSnapshot[] {
  const newItem: HistoricalIncome = { ...item, id: generateId() }
  const label = `${MONTH_NAMES_EN[month - 1]} ${year}`
  const targetDate = new Date(year, month - 1, 1).toISOString()

  const existingIdx = history.findIndex((h) => {
    const hDate = new Date(h.date)
    return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
  })

  if (existingIdx !== -1) {
    return history.map((h, i) => {
      if (i !== existingIdx) return h
      const newTotalIncome = h.totalIncome + item.amount
      return {
        ...h,
        historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
        totalIncome: newTotalIncome,
        freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
      }
    })
  } else {
    // Pre-populate stub with fixed recurring expenses (rent, insurance, etc.)
    // Variable expenses are excluded — they differ month to month.
    const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
    let fixedTotal = 0
    expenses
      .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
      .forEach((e) => {
        const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
        categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
        fixedTotal += monthly
      })

    const stub: MonthSnapshot = {
      id: generateId(),
      label,
      date: targetDate,
      totalIncome: item.amount,
      totalExpenses: fixedTotal,
      totalSavings: 0,
      freeCashFlow: item.amount - fixedTotal,
      categoryActuals,
      historicalIncomes: [newItem],
    }
    return [...history, stub]
  }
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

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

function buildExpense(overrides: Partial<Expense> & { category: Expense['category'] }): Expense {
  return {
    id: generateId(),
    name: 'Expense',
    amount: 1000,
    period: 'monthly',
    recurring: true,
    expenseType: 'fixed',
    ...overrides,
  }
}

// ─── Test group 1: Adds to existing snapshot ──────────────────────────────────

describe('addIncomeToMonth() — existing snapshot', () => {
  it('appends item to historicalIncomes without creating a new snapshot', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      historicalIncomes: [],
    })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Alice',
      amount: 5000,
    })

    expect(result).toHaveLength(1)
    expect(result[0].historicalIncomes).toHaveLength(1)
    expect(result[0].historicalIncomes![0].memberName).toBe('Alice')
    expect(result[0].historicalIncomes![0].amount).toBe(5000)
  })

  it('increments totalIncome on existing snapshot', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 10000,
    })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Bob',
      amount: 4000,
    })

    expect(result[0].totalIncome).toBe(14000) // 10000 + 4000
  })

  it('recomputes freeCashFlow = totalIncome - totalExpenses - totalSavings on existing snapshot', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 10000,
      totalExpenses: 5000,
      totalSavings: 1000,
      freeCashFlow: 4000,
    })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Alice',
      amount: 3000,
    })

    // newTotalIncome = 10000 + 3000 = 13000; freeCashFlow = 13000 - 5000 - 1000 = 7000
    expect(result[0].freeCashFlow).toBe(7000)
  })

  it('FCF recompute correctly accounts for totalSavings on existing snapshot', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 8000,
      totalExpenses: 4000,
      totalSavings: 2000,
      freeCashFlow: 2000,
    })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Carol',
      amount: 5000,
    })

    // newTotalIncome = 13000; freeCashFlow = 13000 - 4000 - 2000 = 7000
    expect(result[0].freeCashFlow).toBe(7000)
    expect(result[0].totalIncome).toBe(13000)
  })

  it('appends correctly when snapshot already has prior historicalIncomes', () => {
    const existing: HistoricalIncome = { id: 'item-old', memberName: 'Alice', amount: 8000 }
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 8000,
      historicalIncomes: [existing],
    })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Bob',
      amount: 5000,
    })

    expect(result[0].historicalIncomes).toHaveLength(2)
    expect(result[0].historicalIncomes![0].memberName).toBe('Alice') // existing preserved
    expect(result[0].historicalIncomes![1].memberName).toBe('Bob')   // new item appended
    expect(result[0].totalIncome).toBe(13000) // 8000 + 5000
  })

  it('only modifies the target month snapshot; sibling snapshots are returned untouched', () => {
    const marchSnap = buildSnapshot({
      id: 'snap-march',
      label: 'March 2026',
      date: '2026-03-01T00:00:00.000Z',
      totalIncome: 9000,
      totalExpenses: 4500,
      totalSavings: 500,
      freeCashFlow: 4000,
    })
    const aprilSnap = buildSnapshot({
      id: 'snap-april',
      label: 'April 2026',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 10000,
      totalExpenses: 5000,
      totalSavings: 1000,
      freeCashFlow: 4000,
    })

    const result = addIncomeToMonth([marchSnap, aprilSnap], 2026, 4, {
      memberName: 'Alice',
      amount: 2000,
    })

    // March must be identical
    expect(result[0]).toEqual(marchSnap)
    // April must be updated
    expect(result[1].totalIncome).toBe(12000)
  })
})

// ─── Test group 2: Stub creation when no snapshot exists ──────────────────────

describe('addIncomeToMonth() — stub creation', () => {
  it('creates a new stub snapshot when no snapshot exists for that month', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    })

    expect(result).toHaveLength(1)
  })

  it('stub has correct totalIncome equal to item.amount', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    })

    expect(result[0].totalIncome).toBe(12000)
  })

  it('stub freeCashFlow = totalIncome - totalExpenses (not hardcoded 0)', () => {
    const rent = buildExpense({ name: 'Rent', amount: 4000, category: 'housing' })
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [rent])

    // totalIncome = 12000, totalExpenses = 4000 (rent), freeCashFlow = 8000
    expect(result[0].freeCashFlow).toBe(8000)
    expect(result[0].totalIncome).toBe(12000)
    expect(result[0].totalExpenses).toBe(4000)
  })

  it('stub freeCashFlow = totalIncome when no fixed expenses exist', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    })

    // totalExpenses = 0 (no fixed expenses), freeCashFlow = 12000 - 0 = 12000
    expect(result[0].freeCashFlow).toBe(12000)
    expect(result[0].totalSavings).toBe(0)
  })

  it('stub totalSavings is 0', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Bob',
      amount: 7500,
    })

    expect(result[0].totalSavings).toBe(0)
  })

  it('stub income item appears in historicalIncomes', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
      note: 'March salary',
    })

    expect(result[0].historicalIncomes).toHaveLength(1)
    expect(result[0].historicalIncomes![0].memberName).toBe('Alice')
    expect(result[0].historicalIncomes![0].amount).toBe(12000)
    expect(result[0].historicalIncomes![0].note).toBe('March salary')
  })

  it('stub label format is "Month YYYY"', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    })

    expect(result[0].label).toBe('March 2026')
    expect(result[0].label).not.toMatch(/\d+\/\d+/)  // not "3/2026"
    expect(result[0].label).not.toMatch(/^\d/)        // does not start with a digit
  })

  it('stub date is set to the first of the month (ISO string)', () => {
    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    })

    const parsed = new Date(result[0].date)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth() + 1).toBe(3)
    expect(parsed.getDate()).toBe(1)
  })
})

// ─── Test group 3: Stub fixed expense pre-population ─────────────────────────

describe('addIncomeToMonth() — stub fixed expense pre-population', () => {
  it('stub totalExpenses = sum of fixed recurring monthly expenses', () => {
    const rent = buildExpense({ name: 'Rent', amount: 4000, category: 'housing' })
    const insurance = buildExpense({ name: 'Insurance', amount: 300, category: 'insurance' })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [rent, insurance])

    expect(result[0].totalExpenses).toBe(4300) // 4000 + 300
  })

  it('stub pre-populates categoryActuals from fixed recurring expenses', () => {
    const rent = buildExpense({ name: 'Rent', amount: 4000, category: 'housing' })
    const insurance = buildExpense({ name: 'Insurance', amount: 300, category: 'insurance' })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [rent, insurance])

    expect(result[0].categoryActuals?.housing).toBe(4000)
    expect(result[0].categoryActuals?.insurance).toBe(300)
  })

  it('yearly fixed expenses are converted to monthly equivalent (amount / 12)', () => {
    const annualInsurance = buildExpense({
      name: 'Annual Insurance',
      amount: 2400,
      period: 'yearly',
      category: 'insurance',
    })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [annualInsurance])

    expect(result[0].categoryActuals?.insurance).toBe(200) // 2400 / 12
    expect(result[0].totalExpenses).toBe(200)
    expect(result[0].freeCashFlow).toBe(11800) // 12000 - 200
  })

  it('stub excludes variable recurring expenses from pre-population', () => {
    const groceries = buildExpense({
      name: 'Groceries',
      amount: 2000,
      category: 'food',
      expenseType: 'variable',
    })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [groceries])

    expect(result[0].categoryActuals?.food).toBeUndefined()
    expect(result[0].totalExpenses).toBe(0) // variable not included
    expect(result[0].freeCashFlow).toBe(12000)
  })

  it('stub excludes non-recurring expenses from pre-population', () => {
    const oneOff = buildExpense({
      name: 'One-off gadget purchase',
      amount: 1500,
      category: 'leisure',
      recurring: false,
    })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [oneOff])

    expect(result[0].categoryActuals?.leisure).toBeUndefined()
    expect(result[0].totalExpenses).toBe(0)
  })

  it('expenseType undefined is treated as fixed and included in pre-population', () => {
    const legacy = buildExpense({
      name: 'Legacy expense',
      amount: 600,
      category: 'other',
      expenseType: undefined,
    })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [legacy])

    expect(result[0].categoryActuals?.other).toBe(600)
    expect(result[0].totalExpenses).toBe(600)
    expect(result[0].freeCashFlow).toBe(11400) // 12000 - 600
  })

  it('multiple fixed expenses across different categories are all pre-populated', () => {
    const rent = buildExpense({ name: 'Rent', amount: 4000, category: 'housing' })
    const insurance = buildExpense({ name: 'Insurance', amount: 300, category: 'insurance' })
    const electric = buildExpense({ name: 'Electric', amount: 200, category: 'utilities' })

    const result = addIncomeToMonth([], 2026, 3, {
      memberName: 'Alice',
      amount: 12000,
    }, [rent, insurance, electric])

    expect(result[0].categoryActuals?.housing).toBe(4000)
    expect(result[0].categoryActuals?.insurance).toBe(300)
    expect(result[0].categoryActuals?.utilities).toBe(200)
    expect(result[0].totalExpenses).toBe(4500)
    expect(result[0].freeCashFlow).toBe(7500) // 12000 - 4500
  })

  it('pre-population does NOT affect the existing snapshot branch', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 10000,
      totalExpenses: 5000,
      totalSavings: 1000,
      freeCashFlow: 4000,
    })
    const rent = buildExpense({ name: 'Rent', amount: 4000, category: 'housing' })

    const result = addIncomeToMonth([snap], 2026, 4, {
      memberName: 'Alice',
      amount: 3000,
    }, [rent])

    // Existing snapshot: totalExpenses unchanged, freeCashFlow recomputed from totalIncome delta
    expect(result[0].totalExpenses).toBe(5000) // not 4000 (rent not added to existing)
    expect(result[0].totalIncome).toBe(13000)  // 10000 + 3000
    expect(result[0].freeCashFlow).toBe(7000)  // 13000 - 5000 - 1000
  })
})

// ─── Test group 4: No mutation ────────────────────────────────────────────────

describe('addIncomeToMonth() — immutability', () => {
  it('does not mutate the original history array', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 10000,
      historicalIncomes: [],
    })
    const history = [snap]
    const originalLength = history.length
    const originalIncome = snap.totalIncome
    const originalIncomeItems = snap.historicalIncomes!.length

    addIncomeToMonth(history, 2026, 4, { memberName: 'Alice', amount: 5000 })

    expect(history.length).toBe(originalLength)
    expect(snap.totalIncome).toBe(originalIncome)
    expect(snap.historicalIncomes!.length).toBe(originalIncomeItems)
  })

  it('does not mutate the original snapshot when creating a stub (empty history)', () => {
    const history: MonthSnapshot[] = []
    addIncomeToMonth(history, 2026, 3, { memberName: 'Alice', amount: 8000 })
    expect(history).toHaveLength(0)
  })
})

// ─── Test group 5: Year boundary ─────────────────────────────────────────────

describe('addIncomeToMonth() — year boundary', () => {
  it('January stub is labeled "January 2025" not "January 2026"', () => {
    const result = addIncomeToMonth([], 2025, 1, {
      memberName: 'Alice',
      amount: 10000,
    })

    expect(result[0].label).toBe('January 2025')
  })

  it('December stub is labeled "December 2024"', () => {
    const result = addIncomeToMonth([], 2024, 12, {
      memberName: 'Bob',
      amount: 9500,
    })

    expect(result[0].label).toBe('December 2024')
  })
})
