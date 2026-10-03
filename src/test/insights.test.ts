/**
 * Tests for src/lib/insights.ts — v4.0 Home (PRD §2.E).
 * `today` is always injected; nothing here depends on the wall clock.
 */
import { describe, it, expect } from 'vitest'
import {
  buildExpenseDonut,
  buildInsights,
  computeBudgetHealth,
  computeLegacyTotals,
  computeMonthlyPlan,
  computeSavingsProjection,
  daysInMonthOf,
  findActionableSurplus,
  findBriefingSnapshot,
  getOnboardingState,
  getUpcomingBills,
  MAX_INSIGHTS,
  monthlyAmount,
  spentByCategory,
} from '../lib/insights'
import { getNetMonthly } from '../lib/taxEstimation'
import { DEMO_FINANCE_DATA } from '../lib/demoData'
import type {
  BriefingResult,
  Expense,
  FinanceData,
  Goal,
  HouseholdMember,
  IncomeSource,
  MonthSnapshot,
  SavingsAccount,
} from '../types'

// ─── Factories ───────────────────────────────────────────────────────────────

let seq = 0
const nextId = (p: string) => `${p}-${++seq}`

function makeSource(net: number, overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: nextId('src'),
    name: 'Salary',
    amount: net,
    period: 'monthly',
    type: 'salary',
    isGross: false,
    useManualNet: true,
    manualNetOverride: net,
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

function makeMember(nets: number[], name = 'Dana'): HouseholdMember {
  return { id: nextId('mem'), name, sources: nets.map((n) => makeSource(n)) }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: nextId('exp'),
    name: 'Expense',
    amount: 1000,
    category: 'food',
    recurring: true,
    period: 'monthly',
    ...overrides,
  }
}

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: nextId('acc'),
    name: 'Savings',
    type: 'savings',
    balance: 10_000,
    liquidity: 'immediate',
    annualReturnPercent: 3,
    monthlyContribution: 0,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: nextId('goal'),
    name: 'Trip',
    targetAmount: 10_000,
    currentAmount: 1_000,
    deadline: '2027-12-01',
    priority: 'medium',
    notes: '',
    useLiquidSavings: false,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<MonthSnapshot> = {}): MonthSnapshot {
  return {
    id: nextId('snap'),
    label: 'September 2026',
    date: new Date(2026, 8, 1, 12).toISOString(),
    totalIncome: 20_000,
    totalExpenses: 15_000,
    totalSavings: 1_000,
    freeCashFlow: 4_000,
    ...overrides,
  }
}

function makeBriefing(score = 80): BriefingResult {
  return { headline: 'Solid month', score, bullets: [], advice: '', generatedAt: '2026-10-01T00:00:00.000Z' }
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

/** Independent copy of the pre-v4 Overview.tsx FCF arithmetic (do not refactor). */
function legacyOverviewFCF(data: FinanceData): number {
  const totalIncome = data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0)
  const linkedIds = new Set(
    data.expenses.filter((e) => e.linkedAccountId && e.category === 'savings').map((e) => e.linkedAccountId!)
  )
  const totalContributions = data.accounts
    .filter((a) => !linkedIds.has(a.id) && !a.deductedFromSalary)
    .reduce((s, a) => s + a.monthlyContribution, 0)
  return totalIncome - totalExpenses - totalContributions
}

// Mid-month reference date: 15 Oct 2026 (31-day month), local time.
const MID_OCT = new Date(2026, 9, 15, 10, 0, 0)

// ─── FCF equality ────────────────────────────────────────────────────────────

describe('computeMonthlyPlan() — leftToSpend ≡ legacy FCF', () => {
  const linkedAcc = makeAccount({ id: 'acc-linked', monthlyContribution: 1_500 })
  const salaryAcc = makeAccount({ id: 'acc-salary', monthlyContribution: 900, deductedFromSalary: true })
  const plainAcc = makeAccount({ id: 'acc-plain', monthlyContribution: 700 })

  const fixtures: Array<[string, FinanceData]> = [
    ['demo data', DEMO_FINANCE_DATA],
    ['empty household', makeData()],
    ['income only', makeData({ members: [makeMember([12_000])] })],
    ['expenses only', makeData({ expenses: [makeExpense({ amount: 3_000 })] })],
    ['fixed + variable mix', makeData({
      members: [makeMember([15_000, 2_500])],
      expenses: [
        makeExpense({ amount: 6_000, expenseType: 'fixed', category: 'housing' }),
        makeExpense({ amount: 1_234.56, expenseType: 'variable' }),
        makeExpense({ amount: 410.1, expenseType: 'variable', category: 'leisure' }),
      ],
    })],
    ['legacy expenses without expenseType', makeData({
      members: [makeMember([9_000])],
      expenses: [makeExpense({ amount: 2_000 }), makeExpense({ amount: 333.33, category: 'health' })],
    })],
    ['yearly expenses smoothed', makeData({
      members: [makeMember([10_000])],
      expenses: [
        makeExpense({ amount: 3_600, period: 'yearly', category: 'insurance', dueMonth: 3 }),
        makeExpense({ amount: 1_000, period: 'yearly', expenseType: 'variable', category: 'clothing' }),
      ],
    })],
    ['linked savings expense (no double count)', makeData({
      members: [makeMember([14_000])],
      expenses: [makeExpense({ amount: 1_500, category: 'savings', linkedAccountId: 'acc-linked' })],
      accounts: [linkedAcc, plainAcc],
    })],
    ['deductedFromSalary accounts excluded', makeData({
      members: [makeMember([14_000])],
      accounts: [salaryAcc, plainAcc],
    })],
    ['linkedAccountId on a non-savings category is ignored', makeData({
      members: [makeMember([14_000])],
      expenses: [makeExpense({ amount: 500, category: 'food', linkedAccountId: 'acc-linked' })],
      accounts: [linkedAcc],
    })],
    ['deficit household', makeData({
      members: [makeMember([5_000])],
      expenses: [makeExpense({ amount: 6_000, category: 'housing' }), makeExpense({ amount: 900, expenseType: 'variable' })],
      accounts: [plainAcc],
    })],
    ['multiple members, fractional amounts', makeData({
      members: [makeMember([10_000.1, 333.3], 'A'), makeMember([7_777.77], 'B')],
      expenses: [
        makeExpense({ amount: 0.1, expenseType: 'variable' }),
        makeExpense({ amount: 0.2, expenseType: 'fixed' }),
        makeExpense({ amount: 1_999.99, period: 'yearly' }),
      ],
      accounts: [plainAcc, salaryAcc, makeAccount({ monthlyContribution: 123.45 })],
    })],
    ['zero-amount entries', makeData({
      members: [makeMember([0])],
      expenses: [makeExpense({ amount: 0 }), makeExpense({ amount: 0, expenseType: 'variable' })],
    })],
  ]

  it.each(fixtures)('%s: leftToSpend equals legacy FCF exactly', (_name, data) => {
    const plan = computeMonthlyPlan(data, MID_OCT)
    expect(plan.leftToSpend).toBe(legacyOverviewFCF(data))
    expect(plan.leftToSpend).toBe(computeLegacyTotals(data).freeCashFlow)
  })

  it.each(fixtures)('%s: spendable − variableSpent ≡ leftToSpend', (_name, data) => {
    const plan = computeMonthlyPlan(data, MID_OCT)
    expect(plan.spendable - plan.variableSpent).toBeCloseTo(plan.leftToSpend, 6)
    expect(plan.income - plan.fixed - plan.savingsContrib).toBeCloseTo(plan.spendable, 9)
  })

  it('has at least 10 non-demo fixtures', () => {
    expect(fixtures.length - 1).toBeGreaterThanOrEqual(10)
  })
})

// ─── Components of the plan ─────────────────────────────────────────────────

describe('computeMonthlyPlan() — components', () => {
  it('treats undefined expenseType as fixed and yearly as ÷12', () => {
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [
        makeExpense({ amount: 1_200 }),
        makeExpense({ amount: 2_400, period: 'yearly', expenseType: 'fixed' }),
        makeExpense({ amount: 1_200, period: 'yearly', expenseType: 'variable' }),
        makeExpense({ amount: 300, expenseType: 'variable' }),
      ],
    }), MID_OCT)
    expect(plan.fixed).toBe(1_400)
    expect(plan.variableSpent).toBe(400)
  })

  it('excludes linked and deductedFromSalary accounts from savingsContrib', () => {
    const linked = makeAccount({ monthlyContribution: 1_000 })
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 1_000, category: 'savings', linkedAccountId: linked.id })],
      accounts: [linked, makeAccount({ monthlyContribution: 600, deductedFromSalary: true }), makeAccount({ monthlyContribution: 250 })],
    }), MID_OCT)
    expect(plan.savingsContrib).toBe(250)
    expect(plan.fixed).toBe(1_000) // the linked savings expense counts as a fixed cost
  })

  it('computes days/pace from today (mid-month)', () => {
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 2_000, expenseType: 'variable' })],
    }), MID_OCT)
    expect(plan.daysInMonth).toBe(31)
    expect(plan.dayOfMonth).toBe(15)
    expect(plan.daysLeft).toBe(17)
    expect(plan.elapsedPct).toBeCloseTo((14 / 31) * 100, 9)
    expect(plan.spentPct).toBeCloseTo(20, 9)
    expect(plan.dailyAllowance).toBeCloseTo(8_000 / 17, 9)
  })

  it('first day of month: elapsed 0%, daysLeft = daysInMonth', () => {
    const plan = computeMonthlyPlan(makeData({ members: [makeMember([10_000])] }), new Date(2026, 1, 1, 0, 5))
    expect(plan.daysInMonth).toBe(28)
    expect(plan.daysLeft).toBe(28)
    expect(plan.elapsedPct).toBe(0)
    expect(plan.dailyAllowance).toBeCloseTo(10_000 / 28, 9)
  })

  it('last day of month: daysLeft = 1 (today counts), allowance = everything left', () => {
    const plan = computeMonthlyPlan(makeData({ members: [makeMember([10_000])] }), new Date(2026, 11, 31, 23, 59))
    expect(plan.daysInMonth).toBe(31)
    expect(plan.daysLeft).toBe(1)
    expect(plan.elapsedPct).toBeCloseTo((30 / 31) * 100, 9)
    expect(plan.dailyAllowance).toBe(10_000)
  })

  it('handles leap-year February', () => {
    expect(daysInMonthOf(new Date(2028, 1, 10))).toBe(29)
    expect(daysInMonthOf(new Date(2027, 1, 10))).toBe(28)
  })
})

// ─── Status ─────────────────────────────────────────────────────────────────

describe('computeMonthlyPlan() — status', () => {
  it("no income → 'no-income' even with expenses", () => {
    const plan = computeMonthlyPlan(makeData({ expenses: [makeExpense({ amount: 500 })] }), MID_OCT)
    expect(plan.status).toBe('no-income')
    expect(plan.dailyAllowance).toBe(0)
  })

  it('negative income is also no-income', () => {
    const plan = computeMonthlyPlan(makeData({ members: [makeMember([-100])] }), MID_OCT)
    expect(plan.status).toBe('no-income')
  })

  it("spendable ≤ 0 → 'over' and spentPct is null", () => {
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([5_000])],
      expenses: [makeExpense({ amount: 5_000, category: 'housing' })],
    }), MID_OCT)
    expect(plan.spendable).toBe(0)
    expect(plan.leftToSpend).toBe(0)
    expect(plan.spentPct).toBeNull()
    expect(plan.status).toBe('over')
    expect(plan.dailyAllowance).toBe(0)
  })

  it("overspent (leftToSpend < 0, spendable > 0) → 'over'", () => {
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 6_000 }), makeExpense({ amount: 4_500, expenseType: 'variable' })],
    }), MID_OCT)
    expect(plan.spendable).toBe(4_000)
    expect(plan.leftToSpend).toBe(-500)
    expect(plan.spentPct).toBeGreaterThan(100)
    expect(plan.status).toBe('over')
    expect(plan.dailyAllowance).toBe(0)
  })

  it("spending > elapsed + 10 points → 'ahead'", () => {
    // elapsed on 15 Oct ≈ 45.2%; spent 60%
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 6_000, expenseType: 'variable' })],
    }), MID_OCT)
    expect(plan.spentPct).toBeCloseTo(60, 9)
    expect(plan.status).toBe('ahead')
  })

  it("spending within elapsed + 10 → 'on-track'", () => {
    const plan = computeMonthlyPlan(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 5_000, expenseType: 'variable' })],
    }), MID_OCT)
    expect(plan.spentPct).toBeCloseTo(50, 9)
    expect(plan.status).toBe('on-track')
  })

  it('first day of month: any variable spend > 10% is ahead', () => {
    const data = makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 1_100, expenseType: 'variable' })],
    })
    expect(computeMonthlyPlan(data, new Date(2026, 9, 1)).status).toBe('ahead')
    expect(computeMonthlyPlan(data, new Date(2026, 9, 31)).status).toBe('on-track')
  })
})

// ─── Surplus detection ──────────────────────────────────────────────────────

describe('findActionableSurplus()', () => {
  it('returns the most recent past-month snapshot with remaining surplus', () => {
    const a = makeSnapshot({ date: new Date(2026, 7, 1, 12).toISOString() })
    const b = makeSnapshot({ date: new Date(2026, 8, 1, 12).toISOString() })
    expect(findActionableSurplus([a, b], MID_OCT)?.id).toBe(b.id)
  })

  it('skips stubs, actioned, fully allocated and current-month snapshots', () => {
    const history = [
      makeSnapshot({ totalIncome: 0 }),
      makeSnapshot({ surplusActioned: true }),
      makeSnapshot({ freeCashFlow: 1_000, surplusAllocated: 1_000 }),
      makeSnapshot({ date: new Date(2026, 9, 2, 12).toISOString() }),
      makeSnapshot({ freeCashFlow: -50 }),
    ]
    expect(findActionableSurplus(history, MID_OCT)).toBeNull()
  })

  it('handles the year boundary (Dec snapshot seen in January)', () => {
    const dec = makeSnapshot({ date: new Date(2026, 11, 1, 12).toISOString() })
    expect(findActionableSurplus([dec], new Date(2027, 0, 5))?.id).toBe(dec.id)
  })
})

// ─── Insights ───────────────────────────────────────────────────────────────

describe('buildInsights()', () => {
  function insightsFor(data: FinanceData, today = MID_OCT) {
    return buildInsights(data, computeMonthlyPlan(data, today), today)
  }

  it('returns nothing for a healthy, quiet household', () => {
    const data = makeData({ members: [makeMember([10_000])], expenses: [makeExpense({ amount: 2_000 })] })
    expect(insightsFor(data)).toEqual([])
  })

  it('deficit: amount over and structural flag', () => {
    const structural = insightsFor(makeData({
      members: [makeMember([5_000])],
      expenses: [makeExpense({ amount: 5_600, category: 'housing' })],
    }))
    expect(structural[0]).toMatchObject({ id: 'deficit', tone: 'danger', amount: 600, structural: true })

    const overspent = insightsFor(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 6_000 }), makeExpense({ amount: 4_250, expenseType: 'variable' })],
    }))
    expect(overspent[0]).toMatchObject({ id: 'deficit', amount: 250, structural: false })
  })

  it('no deficit card when there is no income (hero handles it)', () => {
    const ins = insightsFor(makeData({ expenses: [makeExpense({ amount: 900 })] }))
    expect(ins.find((i) => i.id === 'deficit')).toBeUndefined()
  })

  it('surplus requires a goal or an account (SurplusBanner rule)', () => {
    const snap = makeSnapshot({ freeCashFlow: 3_000, surplusAllocated: 500 })
    const base = { members: [makeMember([10_000])], history: [snap] }
    expect(insightsFor(makeData(base)).find((i) => i.id === 'surplus')).toBeUndefined()
    const withGoal = insightsFor(makeData({ ...base, goals: [makeGoal()] }))
    expect(withGoal.find((i) => i.id === 'surplus')).toMatchObject({ snapshotId: snap.id, amount: 2_500, tone: 'success' })
    const withAcc = insightsFor(makeData({ ...base, accounts: [makeAccount()] }))
    expect(withAcc.find((i) => i.id === 'surplus')).toBeDefined()
  })

  it('over-budget uses all monthly expenses by category and spent > budget > 0', () => {
    const ins = insightsFor(makeData({
      members: [makeMember([20_000])],
      expenses: [
        makeExpense({ amount: 1_000, category: 'food' }),
        makeExpense({ amount: 600, category: 'food', expenseType: 'variable' }),
        makeExpense({ amount: 2_400, period: 'yearly', category: 'leisure' }), // 200/mo
        makeExpense({ amount: 100, category: 'health' }),
      ],
      categoryBudgets: { food: 1_500, leisure: 100, health: 0, transport: 50 },
    }))
    const ob = ins.find((i) => i.id === 'over-budget')
    expect(ob).toBeDefined()
    if (ob?.id !== 'over-budget') throw new Error('expected over-budget')
    expect(ob.categories).toEqual(['leisure', 'food']) // sorted by overrun ratio, health (0 budget) excluded
    expect(ob.worst).toEqual({ category: 'leisure', spent: 200, budget: 100 })
  })

  it('spent exactly equal to budget is not over', () => {
    const ins = insightsFor(makeData({
      members: [makeMember([20_000])],
      expenses: [makeExpense({ amount: 1_500, category: 'food' })],
      categoryBudgets: { food: 1_500 },
    }))
    expect(ins.find((i) => i.id === 'over-budget')).toBeUndefined()
  })

  it('bill-due: yearly with dueMonth this month or next (Dec → Jan wrap)', () => {
    const data = makeData({
      members: [makeMember([20_000])],
      expenses: [
        makeExpense({ name: 'Insurance', amount: 3_600, period: 'yearly', dueMonth: 1 }),
        makeExpense({ name: 'Arnona', amount: 1_200, period: 'yearly', dueMonth: 12 }),
        makeExpense({ name: 'Later', amount: 500, period: 'yearly', dueMonth: 3 }),
        makeExpense({ name: 'Monthly w/ dueMonth', amount: 50, period: 'monthly', dueMonth: 12 }),
      ],
    })
    const ins = insightsFor(data, new Date(2026, 11, 10))
    const bill = ins.find((i) => i.id === 'bill-due')
    if (bill?.id !== 'bill-due') throw new Error('expected bill-due')
    expect(bill.bills.map((b) => b.name)).toEqual(['Arnona', 'Insurance'])
    expect(bill.bills[0].thisMonth).toBe(true)
    expect(bill.bills[1].thisMonth).toBe(false)
  })

  it('pace-ahead when spending runs ahead of the calendar', () => {
    const ins = insightsFor(makeData({
      members: [makeMember([10_000])],
      expenses: [makeExpense({ amount: 6_000, expenseType: 'variable' })],
    }))
    expect(ins.map((i) => i.id)).toEqual(['pace-ahead'])
  })

  it('deficit and pace-ahead never co-occur', () => {
    const scenarios: FinanceData[] = [
      makeData({ members: [makeMember([10_000])], expenses: [makeExpense({ amount: 11_000, expenseType: 'variable' })] }),
      makeData({ members: [makeMember([10_000])], expenses: [makeExpense({ amount: 9_900, expenseType: 'variable' })] }),
      makeData({ members: [makeMember([4_000])], expenses: [makeExpense({ amount: 4_500 }), makeExpense({ amount: 10, expenseType: 'variable' })] }),
    ]
    for (const data of scenarios) {
      for (const day of [1, 10, 20, 31]) {
        const ids = insightsFor(data, new Date(2026, 9, day)).map((i) => i.id)
        expect(ids.includes('deficit') && ids.includes('pace-ahead')).toBe(false)
      }
    }
  })

  it('briefing insight from the auto snapshot (or latest non-stub)', () => {
    const auto = makeSnapshot({ autoSnapshot: true, date: new Date(2026, 9, 1).toISOString(), aiBriefing: makeBriefing(72) })
    const ins = insightsFor(makeData({ members: [makeMember([10_000])], history: [makeSnapshot({ surplusActioned: true }), auto] }))
    expect(ins.find((i) => i.id === 'briefing')).toMatchObject({ snapshotId: auto.id, score: 72, tone: 'neutral' })

    const noBriefing = insightsFor(makeData({ members: [makeMember([10_000])], history: [makeSnapshot({ autoSnapshot: true, surplusActioned: true })] }))
    expect(noBriefing.find((i) => i.id === 'briefing')).toBeUndefined()
  })

  it('caps at 3 cards in priority order', () => {
    const data = makeData({
      members: [makeMember([10_000])],
      expenses: [
        makeExpense({ amount: 6_000, category: 'housing' }),
        makeExpense({ amount: 4_500, expenseType: 'variable', category: 'food' }),
        makeExpense({ amount: 1_200, period: 'yearly', dueMonth: 10, category: 'insurance' }),
      ],
      categoryBudgets: { food: 1_000 },
      goals: [makeGoal()],
      history: [
        makeSnapshot({ freeCashFlow: 2_000 }),
        makeSnapshot({ autoSnapshot: true, date: new Date(2026, 9, 1).toISOString(), aiBriefing: makeBriefing() }),
      ],
    })
    const ins = insightsFor(data)
    expect(ins).toHaveLength(MAX_INSIGHTS)
    expect(ins.map((i) => i.id)).toEqual(['deficit', 'surplus', 'over-budget'])
  })

  it('fills remaining slots with lower priorities in order', () => {
    const data = makeData({
      members: [makeMember([10_000])],
      expenses: [
        makeExpense({ amount: 6_000, expenseType: 'variable', category: 'food' }),
        makeExpense({ amount: 1_200, period: 'yearly', dueMonth: 11, category: 'insurance' }),
      ],
      history: [makeSnapshot({ autoSnapshot: true, surplusActioned: true, date: new Date(2026, 9, 1).toISOString(), aiBriefing: makeBriefing() })],
    })
    expect(insightsFor(data).map((i) => i.id)).toEqual(['bill-due', 'pace-ahead', 'briefing'])
  })

  it('works on demo data without throwing and respects the cap', () => {
    const ins = insightsFor(DEMO_FINANCE_DATA)
    expect(ins.length).toBeLessThanOrEqual(MAX_INSIGHTS)
    const priorities = ins.map((i) => i.priority)
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities)
  })
})

// ─── Briefing snapshot ──────────────────────────────────────────────────────

describe('findBriefingSnapshot()', () => {
  it('prefers the non-stub auto snapshot', () => {
    const auto = makeSnapshot({ autoSnapshot: true, date: new Date(2026, 9, 1).toISOString() })
    const later = makeSnapshot({ date: new Date(2026, 9, 20).toISOString() })
    expect(findBriefingSnapshot([auto, later])?.id).toBe(auto.id)
  })

  it('falls back to latest non-stub by date; ignores stubs', () => {
    const a = makeSnapshot({ date: new Date(2026, 6, 1).toISOString() })
    const b = makeSnapshot({ date: new Date(2026, 8, 1).toISOString() })
    const stub = makeSnapshot({ totalIncome: 0, date: new Date(2026, 9, 1).toISOString() })
    expect(findBriefingSnapshot([b, a, stub])?.id).toBe(b.id)
    expect(findBriefingSnapshot([stub])).toBeNull()
  })
})

// ─── Budget health ──────────────────────────────────────────────────────────

describe('computeBudgetHealth()', () => {
  it('returns null without budgets', () => {
    expect(computeBudgetHealth(makeData())).toBeNull()
  })

  it('counts under / warning / over / none like the v2.9 gauge', () => {
    const h = computeBudgetHealth(makeData({
      expenses: [
        makeExpense({ amount: 500, category: 'food' }),      // 50% → under
        makeExpense({ amount: 900, category: 'transport' }), // 90% → warning
        makeExpense({ amount: 1_500, category: 'leisure' }), // 150% → over
        makeExpense({ amount: 300, category: 'health' }),    // no budget → none
      ],
      categoryBudgets: { food: 1_000, transport: 1_000, leisure: 1_000, clothing: 0 },
    }))
    expect(h).toEqual({ under: 1, warning: 1, over: 1, none: 2, worstCategory: 'leisure', worstPct: 150 })
  })
})

// ─── Upcoming bills ─────────────────────────────────────────────────────────

describe('getUpcomingBills()', () => {
  it('lists yearly bills due within 6 months, sorted, never in the past', () => {
    const today = new Date(2026, 9, 1, 0, 0, 0)
    const bills = getUpcomingBills([
      makeExpense({ name: 'Jan', period: 'yearly', dueMonth: 1 }),
      makeExpense({ name: 'Oct', period: 'yearly', dueMonth: 10 }),
      makeExpense({ name: 'Jun', period: 'yearly', dueMonth: 6 }),
      makeExpense({ name: 'Monthly', period: 'monthly', dueMonth: 11 }),
    ], today)
    expect(bills.map((b) => b.expense.name)).toEqual(['Oct', 'Jan'])
    expect(bills[0].daysUntil).toBe(0)
  })
})

// ─── Donut ──────────────────────────────────────────────────────────────────

describe('buildExpenseDonut()', () => {
  it('empty → no slices', () => {
    expect(buildExpenseDonut([])).toEqual({ total: 0, slices: [] })
    expect(buildExpenseDonut([makeExpense({ amount: 0 })]).slices).toEqual([])
  })

  it('sorts descending, uses monthly amounts and stable category colours', () => {
    const d = buildExpenseDonut([
      makeExpense({ amount: 100, category: 'food' }),
      makeExpense({ amount: 12_000, period: 'yearly', category: 'housing' }), // 1000
      makeExpense({ amount: 400, category: 'food' }),
    ])
    expect(d.total).toBe(1_500)
    expect(d.slices.map((s) => s.key)).toEqual(['housing', 'food'])
    expect(d.slices[0].color).toBe('hsl(var(--chart-7))')
    expect(d.slices[1].pct).toBeCloseTo((500 / 1500) * 100, 9)
  })

  it('≤ 6 slices are never grouped, even if tiny', () => {
    const d = buildExpenseDonut([
      makeExpense({ amount: 10_000, category: 'housing' }),
      makeExpense({ amount: 10, category: 'food' }),
    ])
    expect(d.slices).toHaveLength(2)
    expect(d.slices.some((s) => s.grouped)).toBe(false)
  })

  it('> 6 slices: groups < 4% (and the other category) into a trailing Other', () => {
    const d = buildExpenseDonut([
      makeExpense({ amount: 5_000, category: 'housing' }),
      makeExpense({ amount: 2_000, category: 'food' }),
      makeExpense({ amount: 1_000, category: 'transport' }),
      makeExpense({ amount: 800, category: 'education' }),
      makeExpense({ amount: 600, category: 'insurance' }),
      makeExpense({ amount: 200, category: 'leisure' }), // 2%
      makeExpense({ amount: 150, category: 'clothing' }), // 1.5%
      makeExpense({ amount: 250, category: 'other' }),   // 2.5%
    ])
    expect(d.total).toBe(10_000)
    const last = d.slices[d.slices.length - 1]
    expect(last.grouped).toBe(true)
    expect(last.key).toBe('other')
    expect(last.value).toBe(600)
    expect([...last.categories].sort()).toEqual(['clothing', 'leisure', 'other'])
    expect(d.slices.filter((s) => s.key === 'other')).toHaveLength(1)
    expect(d.slices.reduce((s, x) => s + x.value, 0)).toBe(d.total)
  })
})

// ─── Misc helpers ───────────────────────────────────────────────────────────

describe('helpers', () => {
  it('monthlyAmount smooths yearly', () => {
    expect(monthlyAmount({ amount: 1_200, period: 'yearly' })).toBe(100)
    expect(monthlyAmount({ amount: 1_200, period: 'monthly' })).toBe(1_200)
  })

  it('spentByCategory sums all expenses monthly', () => {
    expect(spentByCategory([
      makeExpense({ amount: 100, category: 'food' }),
      makeExpense({ amount: 1_200, period: 'yearly', category: 'food', expenseType: 'variable' }),
    ])).toEqual({ food: 200 })
  })

  it('onboarding shows only with no income and no expenses; steps are derived', () => {
    expect(getOnboardingState(makeData(), 0)).toEqual({ show: true, hasIncome: false, hasExpense: false, hasGoal: false })
    expect(getOnboardingState(makeData({ goals: [makeGoal()] }), 0)).toMatchObject({ show: true, hasGoal: true })
    expect(getOnboardingState(makeData({ expenses: [makeExpense()] }), 0).show).toBe(false)
    expect(getOnboardingState(makeData(), 5_000).show).toBe(false)
  })
})

// ─── Savings projection ─────────────────────────────────────────────────────

describe('computeSavingsProjection()', () => {
  it('returns null with no accounts', () => {
    expect(computeSavingsProjection([])).toBeNull()
  })

  it('compounds monthly and adds contributions (13 points)', () => {
    const p = computeSavingsProjection([makeAccount({ balance: 12_000, annualReturnPercent: 0, monthlyContribution: 100 })])
    expect(p?.points).toHaveLength(13)
    expect(p?.points[0].balance).toBe(12_000)
    expect(p?.projected).toBe(13_200)
    expect(p?.weightedReturn).toBe(0)
  })

  it('weights return by balance', () => {
    const p = computeSavingsProjection([
      makeAccount({ balance: 30_000, annualReturnPercent: 2 }),
      makeAccount({ balance: 10_000, annualReturnPercent: 6 }),
    ])
    expect(p?.weightedReturn).toBeCloseTo(3, 9)
    expect(p!.projected).toBeGreaterThan(40_000)
  })
})
