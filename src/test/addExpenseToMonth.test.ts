/**
 * Tests for the v2.4 / v2.4.1 addExpenseToMonth feature.
 *
 * addExpenseToMonth(year, month, item, expenses) either:
 *   - Adds the item to an existing snapshot for that year/month, updating categoryActuals
 *   - Creates a stub snapshot pre-populated with fixed recurring expenses when none exists
 *
 * All tests exercise pure logic — no React rendering required.
 * The helper below mirrors the FinanceContext implementation exactly.
 */

import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, HistoricalExpense, Expense, ExpenseCategory } from '@/types'

// ─── Constants (mirrors FinanceContext) ───────────────────────────────────────

const MONTH_NAMES_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ─── Pure helper (mirrors FinanceContext addExpenseToMonth logic) ─────────────

let _idCounter = 0
function generateId(): string {
  return `test-id-${++_idCounter}`
}

function addExpenseToMonth(
  history: MonthSnapshot[],
  year: number,
  month: number,
  item: Omit<HistoricalExpense, 'id'>,
  expenses: Expense[] = []
): MonthSnapshot[] {
  const newItem: HistoricalExpense = { ...item, id: generateId() }
  const label = `${MONTH_NAMES_EN[month - 1]} ${year}`
  const targetDate = new Date(year, month - 1, 1).toISOString()

  const existingIdx = history.findIndex((h) => {
    const hDate = new Date(h.date)
    return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
  })

  if (existingIdx !== -1) {
    return history.map((h, i) => {
      if (i !== existingIdx) return h
      const prevActuals = h.categoryActuals ?? {}
      return {
        ...h,
        historicalExpenses: [...(h.historicalExpenses ?? []), newItem],
        categoryActuals: {
          ...prevActuals,
          [item.category]: (prevActuals[item.category] ?? 0) + item.amount,
        },
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
    // Stack the manually-entered one-off item on top
    categoryActuals[item.category] = (categoryActuals[item.category] ?? 0) + item.amount

    const stub: MonthSnapshot = {
      id: generateId(),
      label,
      date: targetDate,
      totalIncome: 0,
      totalExpenses: fixedTotal + item.amount,
      totalSavings: 0,
      freeCashFlow: 0,
      categoryActuals,
      historicalExpenses: [newItem],
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

// ─── Test 1: Adds to existing snapshot ────────────────────────────────────────

describe('addExpenseToMonth() — existing snapshot', () => {
  it('appends item to historicalExpenses and increments categoryActuals', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      categoryActuals: { health: 500 },
      historicalExpenses: [],
    })

    const result = addExpenseToMonth([snap], 2026, 4, {
      name: 'Dentist',
      amount: 800,
      category: 'health',
    })

    expect(result).toHaveLength(1)
    expect(result[0].historicalExpenses).toHaveLength(1)
    expect(result[0].historicalExpenses![0].name).toBe('Dentist')
    expect(result[0].historicalExpenses![0].amount).toBe(800)
    expect(result[0].categoryActuals?.health).toBe(1300) // 500 + 800
  })
})

// ─── Test 2: Creates stub snapshot when none exists ───────────────────────────

describe('addExpenseToMonth() — stub creation', () => {
  it('creates a stub snapshot with correct label when no snapshot exists for that month', () => {
    const result = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    expect(result).toHaveLength(1)
    const stub = result[0]
    expect(stub.label).toBe('March 2026')
  })

  it('stub snapshot income/savings/cashflow are zero; totalExpenses equals item amount when no recurring expenses', () => {
    const result = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    const stub = result[0]
    expect(stub.totalIncome).toBe(0)
    expect(stub.totalExpenses).toBe(1200) // no fixed recurring expenses → only the item
    expect(stub.totalSavings).toBe(0)
    expect(stub.freeCashFlow).toBe(0)
  })

  it('stub has date set to ISO string of the first of the month', () => {
    const result = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    const stub = result[0]
    const parsed = new Date(stub.date)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth() + 1).toBe(3)
    expect(parsed.getDate()).toBe(1)
  })
})

// ─── Test 3: Stub creation sets categoryActuals from the first item ───────────

describe('addExpenseToMonth() — stub categoryActuals', () => {
  it('categoryActuals on stub reflects the first item\'s category and amount', () => {
    const result = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    const stub = result[0]
    expect(stub.categoryActuals?.transport).toBe(1200)
    // Other categories should not be present
    expect(stub.categoryActuals?.health).toBeUndefined()
  })
})

// ─── Test 4: Second item to same stub-month accumulates correctly ─────────────

describe('addExpenseToMonth() — two calls to same stub month', () => {
  it('second call finds the stub and accumulates categoryActuals correctly', () => {
    // First call — creates stub
    let history = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    // Second call — should find the stub, not create another
    history = addExpenseToMonth(history, 2026, 3, {
      name: 'Bus pass',
      amount: 200,
      category: 'transport',
    })

    expect(history).toHaveLength(1)
    expect(history[0].historicalExpenses).toHaveLength(2)
    expect(history[0].categoryActuals?.transport).toBe(1400) // 1200 + 200
  })
})

// ─── Test 5: Does not touch other snapshots in history ────────────────────────

describe('addExpenseToMonth() — sibling snapshots unchanged', () => {
  it('only modifies the target month snapshot; other snapshots are returned untouched', () => {
    const marchSnap = buildSnapshot({
      id: 'snap-march',
      label: 'March 2026',
      date: '2026-03-01T00:00:00.000Z',
      totalIncome: 8000,
      totalExpenses: 4000,
      totalSavings: 500,
      freeCashFlow: 3500,
      categoryActuals: { food: 1000 },
      historicalExpenses: [],
    })
    const aprilSnap = buildSnapshot({
      id: 'snap-april',
      label: 'April 2026',
      date: '2026-04-01T00:00:00.000Z',
      categoryActuals: { health: 300 },
      historicalExpenses: [],
    })

    const result = addExpenseToMonth([marchSnap, aprilSnap], 2026, 4, {
      name: 'Dentist',
      amount: 800,
      category: 'health',
    })

    // March snapshot must be identical (same reference or deep equal)
    expect(result[0]).toEqual(marchSnap)
    // April snapshot must be updated
    expect(result[1].categoryActuals?.health).toBe(1100) // 300 + 800
  })
})

// ─── Test 6: Stub label format ────────────────────────────────────────────────

describe('addExpenseToMonth() — stub label format', () => {
  it('label is "Month YYYY" format — not "M/YYYY" or numeric', () => {
    const result = addExpenseToMonth([], 2026, 3, {
      name: 'Car repair',
      amount: 1200,
      category: 'transport',
    })

    expect(result[0].label).toBe('March 2026')
    expect(result[0].label).not.toMatch(/\d+\/\d+/)  // not "3/2026"
    expect(result[0].label).not.toMatch(/^\d/)        // does not start with a digit
  })
})

// ─── Bonus Test 7: Existing snapshot with categoryActuals — increment without losing data ──

describe('addExpenseToMonth() — existing snapshot with pre-existing actuals', () => {
  it('increments the target category without wiping other categories in categoryActuals', () => {
    const snap = buildSnapshot({
      id: 'snap-april',
      date: '2026-04-01T00:00:00.000Z',
      categoryActuals: { food: 2000, health: 500, transport: 300 },
      historicalExpenses: [],
    })

    const result = addExpenseToMonth([snap], 2026, 4, {
      name: 'Pharmacy',
      amount: 150,
      category: 'health',
    })

    expect(result[0].categoryActuals?.food).toBe(2000)      // unchanged
    expect(result[0].categoryActuals?.transport).toBe(300)  // unchanged
    expect(result[0].categoryActuals?.health).toBe(650)     // 500 + 150
  })
})

// ─── Bonus Test 8: Year boundary — January label ──────────────────────────────

describe('addExpenseToMonth() — year boundary', () => {
  it('January stub is labeled "January 2025" not "January 2026"', () => {
    const result = addExpenseToMonth([], 2025, 1, {
      name: 'New Year dinner',
      amount: 400,
      category: 'food',
    })

    expect(result[0].label).toBe('January 2025')
  })

  it('December stub is labeled "December 2024"', () => {
    const result = addExpenseToMonth([], 2024, 12, {
      name: 'Holiday gifts',
      amount: 600,
      category: 'leisure',
    })

    expect(result[0].label).toBe('December 2024')
  })
})

// ─── v2.4.1: Fixed expense pre-population ─────────────────────────────────────

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

describe('addExpenseToMonth() — fixed expense pre-population (v2.4.1)', () => {
  it('stub totalExpenses includes fixed recurring monthly expenses plus the item', () => {
    const rent = buildExpense({ name: 'Rent', amount: 3000, category: 'housing' })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [rent]
    )

    const stub = result[0]
    expect(stub.totalExpenses).toBe(4200) // 3000 rent + 1200 item
  })

  it('stub categoryActuals includes fixed recurring expense amounts', () => {
    const rent = buildExpense({ name: 'Rent', amount: 3000, category: 'housing' })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [rent]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.housing).toBe(3000)
    expect(stub.categoryActuals?.transport).toBe(1200)
  })

  it('yearly fixed expenses are converted to monthly amount (amount / 12)', () => {
    const insurance = buildExpense({
      name: 'Annual Insurance',
      amount: 1200,
      period: 'yearly',
      category: 'insurance',
    })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Dentist', amount: 500, category: 'health' },
      [insurance]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.insurance).toBe(100) // 1200 / 12
    expect(stub.totalExpenses).toBe(600) // 100 + 500
  })

  it('variable recurring expenses are NOT pre-populated', () => {
    const groceries = buildExpense({
      name: 'Groceries',
      amount: 2000,
      category: 'food',
      expenseType: 'variable',
    })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [groceries]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.food).toBeUndefined()
    expect(stub.totalExpenses).toBe(1200) // only the item
  })

  it('non-recurring expenses are NOT pre-populated', () => {
    const oneOff = buildExpense({
      name: 'One-off purchase',
      amount: 500,
      category: 'leisure',
      recurring: false,
    })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [oneOff]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.leisure).toBeUndefined()
    expect(stub.totalExpenses).toBe(1200)
  })

  it('item amount stacks on top of fixed expense in same category', () => {
    const rent = buildExpense({ name: 'Rent', amount: 3000, category: 'housing' })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Maintenance fee', amount: 200, category: 'housing' },
      [rent]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.housing).toBe(3200) // 3000 + 200
    expect(stub.totalExpenses).toBe(3200)
  })

  it('expenseType undefined is treated as fixed and pre-populated', () => {
    const legacy = buildExpense({
      name: 'Legacy expense',
      amount: 500,
      category: 'other',
      expenseType: undefined,
    })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [legacy]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.other).toBe(500)
    expect(stub.totalExpenses).toBe(1700)
  })

  it('multiple fixed expenses across different categories are all pre-populated', () => {
    const rent = buildExpense({ name: 'Rent', amount: 3000, category: 'housing' })
    const insurance = buildExpense({ name: 'Insurance', amount: 200, category: 'insurance' })
    const result = addExpenseToMonth(
      [],
      2026, 3,
      { name: 'Car repair', amount: 1200, category: 'transport' },
      [rent, insurance]
    )

    const stub = result[0]
    expect(stub.categoryActuals?.housing).toBe(3000)
    expect(stub.categoryActuals?.insurance).toBe(200)
    expect(stub.categoryActuals?.transport).toBe(1200)
    expect(stub.totalExpenses).toBe(4400) // 3000 + 200 + 1200
  })

  it('pre-population does NOT affect existing snapshot branch', () => {
    const snap = buildSnapshot({
      id: 'snap-march',
      date: '2026-03-01T00:00:00.000Z',
      categoryActuals: { health: 500 },
      historicalExpenses: [],
    })
    const rent = buildExpense({ name: 'Rent', amount: 3000, category: 'housing' })

    const result = addExpenseToMonth(
      [snap],
      2026, 3,
      { name: 'Dentist', amount: 800, category: 'health' },
      [rent]
    )

    // Existing snapshot: only the item is added, not the rent
    expect(result[0].categoryActuals?.housing).toBeUndefined()
    expect(result[0].categoryActuals?.health).toBe(1300) // 500 + 800
  })
})
