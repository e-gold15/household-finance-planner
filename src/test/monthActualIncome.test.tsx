/**
 * v4.2 — This month's actual net income (spec: docs/v4/spec-v4.2-this-month-actual-income.md).
 *
 * Data contract: the only model change is the optional `IncomeSource.monthActual`.
 * It travels inside the member (members = additive mergeById, unchanged), never
 * changes the planned amount, and is honoured only while its month is current.
 * Setting / resetting it never changes members.length or any sources.length.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { FinanceData, HouseholdMember, IncomeMonthActual, IncomeSource } from '@/types'
import { getNetForMonth, getNetMonthly, toYearMonth } from '@/lib/taxEstimation'
import {
  activeMonthActual,
  householdIncomeForMonth,
  setMemberSourceMonthActual,
  withMonthActual,
} from '@/lib/monthActual'
import { mergeFinanceData } from '@/lib/cloudFinance'
import { computeLegacyTotals, computeMonthlyPlan } from '@/lib/insights'
import { MonthActualDialog } from '@/components/income/MonthActualDialog'
import { SourceDialog } from '@/components/income/SourceDialog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => cleanup())

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OCT = '2026-10'
const NOV = '2026-11'
const TODAY = new Date(2026, 9, 9) // 9 Oct 2026, local time

function makeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 's1',
    name: 'Salary',
    amount: 14000,
    period: 'monthly',
    type: 'salary',
    isGross: false,
    useManualNet: false,
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

const actual = (amount: number, month = OCT, note?: string): IncomeMonthActual =>
  ({ month, amount, ...(note ? { note } : {}) })

function makeMembers(): HouseholdMember[] {
  return [
    { id: 'm1', name: 'Eilon', sources: [makeSource({ id: 's1', amount: 14000 })] },
    {
      id: 'm2',
      name: 'Sivan',
      sources: [
        makeSource({ id: 's2', amount: 12500 }),
        makeSource({ id: 's3', name: 'Freelance', amount: 2000, incomeType: 'variable' }),
      ],
    },
  ]
}

function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    members: makeMembers(),
    expenses: [
      { id: 'e1', name: 'Rent', amount: 12000, category: 'housing', recurring: true, period: 'monthly', expenseType: 'fixed' },
      { id: 'e2', name: 'Food', amount: 6200, category: 'food', recurring: true, period: 'monthly', expenseType: 'variable' },
    ],
    accounts: [
      { id: 'a1', name: 'Savings', type: 'savings', balance: 50000, liquidity: 'immediate', annualReturnPercent: 3, monthlyContribution: 3000 },
    ],
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

const sourceCounts = (members: HouseholdMember[]) => members.map((m) => m.sources.length)

// ─── toYearMonth / getNetForMonth ─────────────────────────────────────────────

describe('toYearMonth()', () => {
  it('formats local month with zero padding', () => {
    expect(toYearMonth(new Date(2026, 0, 31))).toBe('2026-01')
    expect(toYearMonth(new Date(2026, 9, 1))).toBe('2026-10')
    expect(toYearMonth(new Date(2026, 11, 31, 23, 59))).toBe('2026-12')
  })
})

describe('getNetForMonth()', () => {
  it('returns the actual when the month matches', () => {
    expect(getNetForMonth(makeSource({ monthActual: actual(16300) }), OCT)).toBe(16300)
  })

  it('returns the planned net for any other month (auto-rollover)', () => {
    const src = makeSource({ monthActual: actual(16300) })
    expect(getNetForMonth(src, NOV)).toBe(getNetMonthly(src))
    expect(getNetForMonth(src, NOV)).toBe(14000)
  })

  it('returns the planned net when no actual is set', () => {
    expect(getNetForMonth(makeSource(), OCT)).toBe(14000)
  })

  it('honours an actual of 0 (unpaid leave)', () => {
    expect(getNetForMonth(makeSource({ monthActual: actual(0) }), OCT)).toBe(0)
  })

  it('ignores a corrupt (negative / NaN) actual and falls back to planned', () => {
    expect(getNetForMonth(makeSource({ monthActual: actual(-5) }), OCT)).toBe(14000)
    expect(getNetForMonth(makeSource({ monthActual: actual(Number.NaN) }), OCT)).toBe(14000)
  })

  it('works on gross sources — the actual replaces the computed net, planned is untouched', () => {
    const src = makeSource({ isGross: true, amount: 20000, monthActual: actual(17000) })
    expect(getNetForMonth(src, OCT)).toBe(17000)
    expect(getNetMonthly(src)).toBeLessThan(20000)
    expect(getNetMonthly(src)).not.toBe(17000)
  })
})

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('withMonthActual() / setMemberSourceMonthActual()', () => {
  it('sets the actual and keeps every other field identical', () => {
    const src = makeSource({ manualNetOverride: 5, sourceCurrency: 'USD' })
    const next = withMonthActual(src, actual(16300, OCT, 'Bonus'))
    expect(next.monthActual).toEqual({ month: OCT, amount: 16300, note: 'Bonus' })
    const { monthActual: _ignored, ...rest } = next
    expect(rest).toEqual(src)
  })

  it('reset removes only monthActual', () => {
    const src = makeSource({ monthActual: actual(16300) })
    const reset = withMonthActual(src, null)
    expect('monthActual' in reset).toBe(false)
    expect(reset).toEqual(makeSource())
    expect(src.monthActual).toBeDefined() // no mutation
  })

  it('never changes members or sources counts', () => {
    const members = makeMembers()
    const set = members.map((m) => setMemberSourceMonthActual(m, 's2', actual(11350)))
    expect(set).toHaveLength(members.length)
    expect(sourceCounts(set)).toEqual(sourceCounts(members))
    const reset = set.map((m) => setMemberSourceMonthActual(m, 's2', null))
    expect(sourceCounts(reset)).toEqual(sourceCounts(members))
  })

  it('touches only the target source', () => {
    const [, sivan] = makeMembers()
    const next = setMemberSourceMonthActual(sivan, 's2', actual(11350))
    expect(next.sources[0].monthActual?.amount).toBe(11350)
    expect(next.sources[1]).toBe(sivan.sources[1])
  })

  it('returns the same member when the source is unknown', () => {
    const [eilon] = makeMembers()
    expect(setMemberSourceMonthActual(eilon, 'ghost', actual(1))).toBe(eilon)
  })

  it('activeMonthActual() only returns the current month', () => {
    const src = makeSource({ monthActual: actual(16300) })
    expect(activeMonthActual(src, OCT)?.amount).toBe(16300)
    expect(activeMonthActual(src, NOV)).toBeNull()
  })
})

describe('householdIncomeForMonth()', () => {
  it('equals planned with no actuals', () => {
    expect(householdIncomeForMonth(makeMembers(), OCT)).toEqual({ actual: 28500, planned: 28500, hasActuals: false })
  })

  it('sums actuals with planned for the rest', () => {
    const members = makeMembers()
    members[0] = setMemberSourceMonthActual(members[0], 's1', actual(16300))
    members[1] = setMemberSourceMonthActual(members[1], 's2', actual(11350))
    expect(householdIncomeForMonth(members, OCT)).toEqual({ actual: 29650, planned: 28500, hasActuals: true })
  })

  it('stale actuals from a previous month are ignored', () => {
    const members = makeMembers()
    members[0] = setMemberSourceMonthActual(members[0], 's1', actual(16300, '2026-09'))
    expect(householdIncomeForMonth(members, OCT)).toEqual({ actual: 28500, planned: 28500, hasActuals: false })
  })
})

// ─── Home plan vs goals (planned) ─────────────────────────────────────────────

describe('computeMonthlyPlan() with actuals', () => {
  it('is unchanged (bit-identical to legacy FCF) when no actual is set', () => {
    const d = makeData()
    const plan = computeMonthlyPlan(d, TODAY)
    expect(plan.leftToSpend).toBe(computeLegacyTotals(d).freeCashFlow)
    expect(plan.income).toBe(plan.plannedIncome)
  })

  it('moves income and left-to-spend by exactly the delta', () => {
    const base = makeData()
    const members = makeMembers()
    members[0] = setMemberSourceMonthActual(members[0], 's1', actual(16300))
    members[1] = setMemberSourceMonthActual(members[1], 's2', actual(11350))
    const d = makeData({ members })
    const before = computeMonthlyPlan(base, TODAY)
    const after = computeMonthlyPlan(d, TODAY)
    expect(after.income).toBe(29650)
    expect(after.plannedIncome).toBe(28500)
    expect(after.leftToSpend - before.leftToSpend).toBe(1150)
    expect(after.leftToSpend).toBe(8450)
  })

  it('legacy totals (used for goal allocation) keep the planned income', () => {
    const members = makeMembers()
    members[0] = setMemberSourceMonthActual(members[0], 's1', actual(30000))
    const d = makeData({ members })
    expect(computeLegacyTotals(d).totalIncome).toBe(28500)
    expect(computeLegacyTotals(d).freeCashFlow).toBe(computeLegacyTotals(makeData()).freeCashFlow)
  })

  it('next month falls back to planned automatically', () => {
    const members = makeMembers()
    members[0] = setMemberSourceMonthActual(members[0], 's1', actual(16300))
    const d = makeData({ members })
    const nov = computeMonthlyPlan(d, new Date(2026, 10, 1))
    expect(nov.income).toBe(28500)
    expect(nov.leftToSpend).toBe(computeLegacyTotals(d).freeCashFlow)
  })
})

// ─── Sync / merge (Data Safety Protocol) ─────────────────────────────────────

describe('mergeFinanceData() keeps monthActual', () => {
  const withActual = () => {
    const members = makeMembers()
    members[1] = setMemberSourceMonthActual(members[1], 's2', actual(11350, OCT, '3 vacation days'))
    return members
  }

  it('empty cloud — local actual survives', () => {
    const local = makeData({ members: withActual() })
    const merged = mergeFinanceData(makeData({ members: [] }), local)
    expect(merged.members).toHaveLength(2)
    expect(merged.members.find((m) => m.id === 'm2')?.sources[0].monthActual).toEqual(actual(11350, OCT, '3 vacation days'))
  })

  it('empty local — cloud actual adopted', () => {
    const cloud = makeData({ members: withActual() })
    const merged = mergeFinanceData(cloud, makeData({ members: [] }))
    expect(merged.members.find((m) => m.id === 'm2')?.sources[0].monthActual?.amount).toBe(11350)
  })

  it('diverged — A+B local, B+C cloud → A+B+C, actual kept on B', () => {
    const [eilon, sivan] = withActual()
    const noa: HouseholdMember = { id: 'm3', name: 'Noa', sources: [makeSource({ id: 's9' })] }
    const merged = mergeFinanceData(makeData({ members: [sivan, noa] }), makeData({ members: [eilon, sivan] }))
    expect(merged.members.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(merged.members.find((m) => m.id === 'm2')?.sources[0].monthActual?.amount).toBe(11350)
  })

  it('member count never decreases', () => {
    const local = makeData({ members: withActual() })
    const cloud = makeData({ members: makeMembers().slice(0, 1) })
    const merged = mergeFinanceData(cloud, local)
    expect(merged.members.length).toBeGreaterThanOrEqual(Math.max(cloud.members.length, local.members.length))
  })
})

// ─── UI ───────────────────────────────────────────────────────────────────────

describe('<MonthActualDialog />', () => {
  const renderDialog = (source: IncomeSource, onSave = vi.fn()) => {
    render(
      <MonthActualDialog
        open
        onOpenChange={() => {}}
        memberName="Sivan"
        source={source}
        yearMonth={OCT}
        monthLabel="October 2026"
        onSave={onSave}
        lang="en"
        currency="ILS"
        locale="he-IL"
      />,
    )
    return onSave
  }

  it('pre-fills the planned amount and saves the actual for this month', () => {
    const onSave = renderDialog(makeSource({ amount: 12500 }))
    const input = screen.getByLabelText('Actual net received this month') as HTMLInputElement
    expect(input.value).toBe('12500')
    fireEvent.change(input, { target: { value: '11350' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vacation days' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save for October 2026' }))
    expect(onSave).toHaveBeenCalledWith({ month: OCT, amount: 11350, note: 'Vacation days' })
  })

  it('never saves an empty value', () => {
    const onSave = renderDialog(makeSource())
    const input = screen.getByLabelText('Actual net received this month')
    fireEvent.change(input, { target: { value: '' } })
    const save = screen.getByRole('button', { name: 'Save for October 2026' })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('allows 0', () => {
    const onSave = renderDialog(makeSource())
    fireEvent.change(screen.getByLabelText('Actual net received this month'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save for October 2026' }))
    expect(onSave).toHaveBeenCalledWith({ month: OCT, amount: 0 })
  })

  it('pre-fills an existing actual and offers Reset to planned', () => {
    const onSave = renderDialog(makeSource({ monthActual: actual(16300, OCT, 'Bonus') }))
    expect((screen.getByLabelText('Actual net received this month') as HTMLInputElement).value).toBe('16300')
    fireEvent.click(screen.getByRole('button', { name: 'Reset to planned' }))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('hides Reset when only a stale (previous-month) actual exists', () => {
    renderDialog(makeSource({ monthActual: actual(16300, '2026-09') }))
    expect(screen.queryByRole('button', { name: 'Reset to planned' })).toBeNull()
  })
})

describe('<SourceDialog /> edit keeps monthActual', () => {
  it('saving an edited planned amount preserves the actual', () => {
    const onSave = vi.fn()
    const existing = makeSource({ monthActual: actual(16300, OCT, 'Bonus') })
    render(
      <SourceDialog
        open
        onOpenChange={() => {}}
        memberId="m1"
        memberName="Eilon"
        existing={existing}
        onSave={onSave}
        lang="en"
        currency="ILS"
        locale="he-IL"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save Source' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][1] as IncomeSource
    expect(saved.id).toBe('s1')
    expect(saved.monthActual).toEqual({ month: OCT, amount: 16300, note: 'Bonus' })
  })
})
