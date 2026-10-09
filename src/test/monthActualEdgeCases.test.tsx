/**
 * v4.2 — regression tests for the code-review fixes on "This month's actual":
 * zero actual ≠ "no income", payslip-adjusted planned net, invalid actuals
 * ignored everywhere, no fake delta on open, FX uses the same path as planned.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { FinanceData, IncomeMonthActual, IncomeSource } from '@/types'
import { getNetForMonth, getNetMonthly } from '@/lib/taxEstimation'
import { activeMonthActual, householdIncomeForMonth } from '@/lib/monthActual'
import { computeMonthlyPlan } from '@/lib/insights'
import { convertAmount, type FxRateCache } from '@/lib/fxRates'
import { MonthActualDialog } from '@/components/income/MonthActualDialog'
import { SourceRow } from '@/components/income/SourceRow'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(() => cleanup())

const OCT = '2026-10'
const TODAY = new Date(2026, 9, 9)

function makeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 's1', name: 'Salary', amount: 14000, period: 'monthly', type: 'salary',
    isGross: false, useManualNet: false, country: 'IL', taxCreditPoints: 2.25, insuredSalaryRatio: 100,
    useContributions: false, pensionEmployee: 0, educationFundEmployee: 0,
    pensionEmployer: 0, educationFundEmployer: 0, severanceEmployer: 0,
    ...overrides,
  }
}

const actual = (amount: number, month = OCT): IncomeMonthActual => ({ month, amount })

function dataWith(sources: IncomeSource[]): FinanceData {
  return {
    members: [{ id: 'm1', name: 'Eilon', sources }],
    expenses: [{ id: 'e1', name: 'Rent', amount: 5000, category: 'housing', recurring: true, period: 'monthly', expenseType: 'fixed' }],
    accounts: [], goals: [], history: [],
    emergencyBufferMonths: 3, currency: 'ILS', locale: 'he-IL', darkMode: false, language: 'en', categoryBudgets: {},
  }
}

describe('zero actual (unpaid leave)', () => {
  it("is 'over', not 'no-income'", () => {
    const plan = computeMonthlyPlan(dataWith([makeSource({ monthActual: actual(0) })]), TODAY)
    expect(plan.income).toBe(0)
    expect(plan.plannedIncome).toBe(14000)
    expect(plan.status).toBe('over')
    expect(plan.leftToSpend).toBe(-5000)
  })

  it("still 'no-income' when nothing is planned", () => {
    expect(computeMonthlyPlan(dataWith([]), TODAY).status).toBe('no-income')
  })
})

describe('invalid actuals are ignored consistently', () => {
  it.each([['negative', -100], ['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY]])(
    '%s actual: not active, totals use planned, plan unchanged',
    (_l, amount) => {
      const src = makeSource({ monthActual: actual(amount) })
      expect(activeMonthActual(src, OCT)).toBeNull()
      expect(getNetForMonth(src, OCT)).toBe(14000)
      expect(householdIncomeForMonth([{ id: 'm1', name: 'E', sources: [src] }], OCT).hasActuals).toBe(false)
      const plan = computeMonthlyPlan(dataWith([src]), TODAY)
      expect(plan.income).toBe(plan.plannedIncome)
    },
  )
})

describe('planned net includes payslip adjustments', () => {
  it('SourceRow compares the actual against getNetMonthly (imputed income / reimbursements)', () => {
    const src = makeSource({
      amount: 10000,
      payslipComponents: {
        base: 10000, overtime125: 0, overtime150: 0, otherTaxable: 0,
        imputedIncome: 500, nonTaxableReimbursements: 300,
      },
      monthActual: actual(10000),
    })
    const planned = getNetMonthly(src)
    expect(planned).toBe(9800)
    render(
      <ul>
        <SourceRow
          source={src} onEdit={() => {}} onDelete={() => {}} onSetActual={() => {}} onResetActual={() => {}}
          yearMonth={OCT} lang="en" currency="ILS" locale="en-US" fxRates={null}
        />
      </ul>,
    )
    // +200 vs the payslip-adjusted planned 9,800 (not +0 vs the raw estimate)
    expect(screen.getByText(/this month/).textContent).toMatch(/\+₪200/)
    expect(screen.getByText(/Planned/).textContent).toMatch(/9,800/)
  })
})

describe('<MonthActualDialog /> on open', () => {
  const open = (source: IncomeSource) =>
    render(
      <MonthActualDialog
        open onOpenChange={() => {}} memberName="Eilon" source={source} yearMonth={OCT} monthLabel="October 2026"
        onSave={() => {}} lang="en" currency="ILS" locale="en-US"
      />,
    )

  it('shows no fake delta for a fractional planned net', () => {
    const src = makeSource({ amount: 12345.678 })
    open(src)
    expect((screen.getByLabelText('Actual net received this month') as HTMLInputElement).value).toBe('12345.68')
    expect(screen.queryByText(/vs planned/)).toBeNull()
  })

  it('shows no validation error before the user edits', () => {
    open(makeSource())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('foreign-currency source', () => {
  const rates: FxRateCache = { date: '2026-10-09', base: 'ILS', rates: { USD: 0.27 } }

  it('the actual is stored in the source currency and converted exactly like the planned net', () => {
    const src = makeSource({ amount: 5000, sourceCurrency: 'USD', monthActual: actual(5500) })
    // Totals treat both in source currency (same path, no conversion at write time)
    expect(getNetForMonth(src, OCT)).toBe(5500)
    expect(getNetForMonth(src, '2026-11')).toBe(getNetMonthly(src))
    const plannedIls = convertAmount(getNetMonthly(src), 'USD', 'ILS', rates)
    const actualIls = convertAmount(getNetForMonth(src, OCT), 'USD', 'ILS', rates)
    expect(plannedIls).not.toBeNull()
    expect(actualIls).not.toBeNull()
    expect((actualIls as number) / (plannedIls as number)).toBeCloseTo(5500 / 5000, 10)
  })
})
