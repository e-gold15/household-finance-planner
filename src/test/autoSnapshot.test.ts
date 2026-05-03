/**
 * Tests for the Auto-Snapshot Current Month feature.
 *
 * Since autoSnapshotCurrentMonth() lives inside a React context and relies on
 * setData, we extract and test the business logic as a pure function — the same
 * pattern used in surplusAction.test.ts and other context-logic test files.
 *
 * Covers:
 * - Happy path: creates a new snapshot when history is empty
 * - autoSnapshot flag and autoSnapshotUpdatedAt fields
 * - Computed totals (income, expenses, savings, FCF)
 * - categoryActuals pre-population
 * - Refresh: updates totals but preserves user-edited fields (historicalExpenses,
 *   surplusActioned, id)
 * - Manual snapshot protection: never overwrites a manual snapshot
 * - Edge case: existing auto-snapshot for a different month
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  FinanceData,
  MonthSnapshot,
  HouseholdMember,
  Expense,
  SavingsAccount,
  IncomeSource,
} from '../types'

// ─── Fixed "now" used across all tests ───────────────────────────────────────
// May 3 2026 — matches the project's current date so tests are stable.
const FIXED_NOW = new Date('2026-05-03T10:00:00.000Z')
const CURRENT_YEAR  = 2026
const CURRENT_MONTH = 5   // 1-indexed (May)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIncomeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'src1',
    name: 'Salary',
    amount: 10_000,
    period: 'monthly',
    type: 'salary',
    isGross: false,
    useManualNet: true,
    manualNetOverride: 10_000,
    country: 'IL',
    taxCreditPoints: 2.25,
    insuredSalaryRatio: 100,
    useContributions: false,
    pensionEmployee: 0,
    educationFundEmployee: 0,
    pensionEmployer: 0,
    educationFundEmployer: 0,
    severanceEmployer: 0,
    ...overrides,
  }
}

function makeMember(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id: 'mem1',
    name: 'Alice',
    sources: [makeIncomeSource()],
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp1',
    name: 'Rent',
    amount: 3_000,
    category: 'housing',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
    ...overrides,
  }
}

function makeSavingsAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
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

function makeSnapshot(overrides: Partial<MonthSnapshot> = {}): MonthSnapshot {
  return {
    id: 'snap-existing',
    label: 'May 2026',
    date: `${CURRENT_YEAR}-0${CURRENT_MONTH}-01T00:00:00.000Z`,
    totalIncome: 8_000,
    totalExpenses: 3_000,
    totalSavings: 500,
    freeCashFlow: 4_500,
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

// ─── Pure extraction of autoSnapshotCurrentMonth logic ───────────────────────
//
// This mirrors the implementation in FinanceContext.tsx exactly.
// If the implementation changes, update this function to match.

function getUnlinkedContributions(accounts: SavingsAccount[], expenses: Expense[]): number {
  const linkedIds = new Set(
    expenses
      .filter(e => e.linkedAccountId && e.category === 'savings')
      .map(e => e.linkedAccountId!)
  )
  return accounts
    .filter(a => !linkedIds.has(a.id) && !a.deductedFromSalary)
    .reduce((s, a) => s + a.monthlyContribution, 0)
}

// Simplified net-monthly for test purposes: when useManualNet=true, use manualNetOverride.
// This matches what getNetMonthly() returns for our test income sources.
function getTestNetMonthly(source: IncomeSource): number {
  if (source.useManualNet && source.manualNetOverride !== undefined) {
    return source.manualNetOverride
  }
  return source.amount
}

let idCounter = 0
function generateTestId(): string {
  return `test-uuid-${++idCounter}`
}

function autoSnapshotCurrentMonth(d: FinanceData, now: Date): FinanceData {
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1   // 1-indexed

  const totalIncome   = d.members.reduce(
    (s, m) => s + m.sources.reduce((ss, src) => ss + getTestNetMonthly(src), 0),
    0
  )
  const totalExpenses = d.expenses.reduce(
    (s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount),
    0
  )
  const totalSavings  = getUnlinkedContributions(d.accounts, d.expenses)
  const label         = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const autoSnapshotUpdatedAt = now.toISOString()

  const categoryActuals: Partial<Record<string, number>> = {}
  d.expenses.forEach((e) => {
    const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
    categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
  })

  const existingIdx = d.history.findIndex((h) => {
    const hDate = new Date(h.date)
    return hDate.getFullYear() === currentYear && hDate.getMonth() + 1 === currentMonth
  })

  if (existingIdx !== -1) {
    const existing = d.history[existingIdx]

    // Manual snapshot — never overwrite
    if (!existing.autoSnapshot) return d

    // Auto-snapshot — refresh computed totals, preserve all user-edited fields
    const updated: MonthSnapshot = {
      ...existing,
      totalIncome,
      totalExpenses,
      totalSavings,
      freeCashFlow: totalIncome - totalExpenses - totalSavings,
      categoryActuals,
      autoSnapshotUpdatedAt,
    }
    return {
      ...d,
      history: d.history.map((h, i) => i === existingIdx ? updated : h),
    }
  }

  // No snapshot yet for this month — create a new auto-snapshot
  const snapshot: MonthSnapshot = {
    id: generateTestId(),
    label,
    date: now.toISOString(),
    totalIncome,
    totalExpenses,
    totalSavings,
    freeCashFlow: totalIncome - totalExpenses - totalSavings,
    categoryActuals,
    autoSnapshot: true,
    autoSnapshotUpdatedAt,
  }
  return { ...d, history: [...d.history, snapshot] }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  idCounter = 0
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Happy path: creating a new snapshot ──────────────────────────────────────
describe('autoSnapshotCurrentMonth() — new snapshot', () => {
  it('creates a new snapshot when history is empty', () => {
    const data = makeFinanceData()
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history).toHaveLength(1)
  })

  it('new snapshot has autoSnapshot: true', () => {
    const data = makeFinanceData()
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].autoSnapshot).toBe(true)
  })

  it('new snapshot has autoSnapshotUpdatedAt set as ISO string', () => {
    const data = makeFinanceData()
    const result = autoSnapshotCurrentMonth(data, new Date())
    const updatedAt = result.history[0].autoSnapshotUpdatedAt
    expect(updatedAt).toBeDefined()
    // Must be a parseable ISO string
    expect(() => new Date(updatedAt!)).not.toThrow()
    expect(new Date(updatedAt!).toISOString()).toBe(FIXED_NOW.toISOString())
  })

  it('new snapshot totalIncome equals sum of member net monthly income', () => {
    // Two members: Alice (10,000) and Bob (5,000)
    const data = makeFinanceData({
      members: [
        makeMember({ id: 'mem1', name: 'Alice', sources: [makeIncomeSource({ manualNetOverride: 10_000 })] }),
        makeMember({ id: 'mem2', name: 'Bob',   sources: [makeIncomeSource({ id: 'src2', manualNetOverride: 5_000 })] }),
      ],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].totalIncome).toBe(15_000)
  })

  it('new snapshot totalIncome is 0 when no members', () => {
    const data = makeFinanceData({ members: [] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].totalIncome).toBe(0)
  })

  it('new snapshot totalExpenses equals sum of expenses (yearly ÷ 12)', () => {
    const data = makeFinanceData({
      expenses: [
        makeExpense({ id: 'e1', amount: 3_000, period: 'monthly', category: 'housing' }),
        makeExpense({ id: 'e2', amount: 1_200, period: 'yearly',  category: 'insurance' }),
      ],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    // 3_000 + 1_200/12 = 3_100
    expect(result.history[0].totalExpenses).toBe(3_100)
  })

  it('new snapshot freeCashFlow = totalIncome - totalExpenses - totalSavings', () => {
    const data = makeFinanceData({
      members:  [makeMember({ sources: [makeIncomeSource({ manualNetOverride: 10_000 })] })],
      expenses: [makeExpense({ amount: 3_000, period: 'monthly' })],
      accounts: [makeSavingsAccount({ monthlyContribution: 500 })],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    const snap = result.history[0]
    // 10_000 - 3_000 - 500 = 6_500
    expect(snap.freeCashFlow).toBe(6_500)
    expect(snap.freeCashFlow).toBe(snap.totalIncome - snap.totalExpenses - snap.totalSavings)
  })

  it('new snapshot categoryActuals is pre-populated from expenses', () => {
    const data = makeFinanceData({
      expenses: [
        makeExpense({ id: 'e1', amount: 3_000, category: 'housing',   period: 'monthly' }),
        makeExpense({ id: 'e2', amount: 1_200, category: 'insurance', period: 'yearly'  }),
        makeExpense({ id: 'e3', amount:   500, category: 'housing',   period: 'monthly' }),
      ],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    const actuals = result.history[0].categoryActuals!
    // housing: 3_000 + 500 = 3_500; insurance: 1_200/12 = 100
    expect(actuals['housing']).toBe(3_500)
    expect(actuals['insurance']).toBe(100)
  })

  it('new snapshot totalSavings excludes accounts linked via savings expenses', () => {
    // Account is linked to a savings expense — should not be double-counted
    const linkedAccount = makeSavingsAccount({ id: 'acc-linked', monthlyContribution: 800 })
    const linkedExpense = makeExpense({
      id: 'e-savings',
      category: 'savings',
      amount: 800,
      period: 'monthly',
      linkedAccountId: 'acc-linked',
    })
    const unlinkedAccount = makeSavingsAccount({ id: 'acc-free', monthlyContribution: 300 })
    const data = makeFinanceData({
      accounts: [linkedAccount, unlinkedAccount],
      expenses: [linkedExpense],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    // Only unlinked account contribution counts toward totalSavings
    expect(result.history[0].totalSavings).toBe(300)
  })
})

// ── Refresh: existing auto-snapshot for current month ────────────────────────
describe('autoSnapshotCurrentMonth() — refresh existing auto-snapshot', () => {
  it('when auto-snapshot exists for current month, refreshes totals', () => {
    const existingSnap = makeSnapshot({
      id: 'snap-auto',
      autoSnapshot: true,
      totalIncome: 8_000,   // stale value
    })
    const data = makeFinanceData({
      members:  [makeMember({ sources: [makeIncomeSource({ manualNetOverride: 10_000 })] })],
      history: [existingSnap],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history).toHaveLength(1)
    expect(result.history[0].totalIncome).toBe(10_000)   // refreshed
  })

  it('refreshed snapshot preserves the same id', () => {
    const existingSnap = makeSnapshot({ id: 'snap-auto', autoSnapshot: true })
    const data = makeFinanceData({ history: [existingSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].id).toBe('snap-auto')
  })

  it('refreshed snapshot preserves historicalExpenses (user edits not lost)', () => {
    const existingSnap = makeSnapshot({
      id: 'snap-auto',
      autoSnapshot: true,
      historicalExpenses: [
        { id: 'he1', name: 'Dentist', amount: 400, category: 'health' },
      ],
    })
    const data = makeFinanceData({ history: [existingSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].historicalExpenses).toHaveLength(1)
    expect(result.history[0].historicalExpenses![0].name).toBe('Dentist')
  })

  it('refreshed snapshot preserves surplusActioned flag', () => {
    const existingSnap = makeSnapshot({
      id: 'snap-auto',
      autoSnapshot: true,
      surplusActioned: true,
    })
    const data = makeFinanceData({ history: [existingSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].surplusActioned).toBe(true)
  })

  it('refreshed snapshot updates autoSnapshotUpdatedAt', () => {
    const oldTimestamp = '2026-05-01T06:00:00.000Z'
    const existingSnap = makeSnapshot({
      id: 'snap-auto',
      autoSnapshot: true,
      autoSnapshotUpdatedAt: oldTimestamp,
    })
    const data = makeFinanceData({ history: [existingSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].autoSnapshotUpdatedAt).toBe(FIXED_NOW.toISOString())
    expect(result.history[0].autoSnapshotUpdatedAt).not.toBe(oldTimestamp)
  })

  it('refreshed snapshot does not mutate the original data object', () => {
    const existingSnap = makeSnapshot({ id: 'snap-auto', autoSnapshot: true, totalIncome: 5_000 })
    const data = makeFinanceData({
      members:  [makeMember({ sources: [makeIncomeSource({ manualNetOverride: 10_000 })] })],
      history: [existingSnap],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    // Original still has the stale value
    expect(data.history[0].totalIncome).toBe(5_000)
    expect(result.history[0].totalIncome).toBe(10_000)
  })
})

// ── Manual snapshot protection ────────────────────────────────────────────────
describe('autoSnapshotCurrentMonth() — manual snapshot protection', () => {
  it('returns data unchanged when a manual snapshot exists for the current month', () => {
    // No autoSnapshot flag — this is a manual snapshot
    const manualSnap = makeSnapshot({ id: 'snap-manual' })
    const data = makeFinanceData({ history: [manualSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result).toBe(data)   // exact same reference — no new object created
  })

  it('does NOT create a second snapshot when a manual snapshot already exists', () => {
    const manualSnap = makeSnapshot({ id: 'snap-manual' })
    const data = makeFinanceData({ history: [manualSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history).toHaveLength(1)
  })

  it('does not change totalIncome of a manual snapshot even if members changed', () => {
    const manualSnap = makeSnapshot({ id: 'snap-manual', totalIncome: 5_000 })
    const data = makeFinanceData({
      members:  [makeMember({ sources: [makeIncomeSource({ manualNetOverride: 10_000 })] })],
      history: [manualSnap],
    })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history[0].totalIncome).toBe(5_000)   // untouched
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────
describe('autoSnapshotCurrentMonth() — edge cases', () => {
  it('when auto-snapshot exists for a different month, creates a new one for current month', () => {
    // Auto-snapshot dated to April 2026 (one month before current)
    const oldAutoSnap: MonthSnapshot = {
      id: 'snap-april',
      label: 'April 2026',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 9_000,
      totalExpenses: 3_000,
      totalSavings: 500,
      freeCashFlow: 5_500,
      autoSnapshot: true,
      autoSnapshotUpdatedAt: '2026-04-01T08:00:00.000Z',
    }
    const data = makeFinanceData({ history: [oldAutoSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    // Should now have two snapshots: April (old) + May (new)
    expect(result.history).toHaveLength(2)
    const newSnap = result.history.find(h => {
      const d = new Date(h.date)
      return d.getFullYear() === CURRENT_YEAR && d.getMonth() + 1 === CURRENT_MONTH
    })
    expect(newSnap).toBeDefined()
    expect(newSnap!.autoSnapshot).toBe(true)
  })

  it('new snapshot date falls within the current month', () => {
    const data = makeFinanceData()
    const result = autoSnapshotCurrentMonth(data, new Date())
    const snapDate = new Date(result.history[0].date)
    expect(snapDate.getFullYear()).toBe(CURRENT_YEAR)
    expect(snapDate.getMonth() + 1).toBe(CURRENT_MONTH)
  })

  it('works correctly when history has snapshots from multiple past months', () => {
    const pastSnaps: MonthSnapshot[] = [
      { id: 'jan', label: 'January 2026', date: '2026-01-01T00:00:00.000Z', totalIncome: 9_000, totalExpenses: 3_000, totalSavings: 500, freeCashFlow: 5_500 },
      { id: 'feb', label: 'February 2026', date: '2026-02-01T00:00:00.000Z', totalIncome: 9_200, totalExpenses: 2_800, totalSavings: 500, freeCashFlow: 5_900 },
    ]
    const data = makeFinanceData({ history: pastSnaps })
    const result = autoSnapshotCurrentMonth(data, new Date())
    expect(result.history).toHaveLength(3)
    const maySnap = result.history.find(h => {
      const d = new Date(h.date)
      return d.getFullYear() === CURRENT_YEAR && d.getMonth() + 1 === CURRENT_MONTH
    })
    expect(maySnap).toBeDefined()
    expect(maySnap!.autoSnapshot).toBe(true)
  })

  it('does not modify past snapshots when creating a new current-month snapshot', () => {
    const pastSnap: MonthSnapshot = {
      id: 'april',
      label: 'April 2026',
      date: '2026-04-01T00:00:00.000Z',
      totalIncome: 9_000,
      totalExpenses: 3_000,
      totalSavings: 500,
      freeCashFlow: 5_500,
    }
    const data = makeFinanceData({ history: [pastSnap] })
    const result = autoSnapshotCurrentMonth(data, new Date())
    const unchanged = result.history.find(h => h.id === 'april')
    expect(unchanged).toEqual(pastSnap)
  })
})
