import { describe, it, expect } from 'vitest'
import { estimateTax, getNetMonthly } from '@/lib/taxEstimation'
import type { IncomeSource, PayslipComponents } from '@/types'

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'test',
    name: 'Test Salary',
    amount: 30_000,
    period: 'monthly',
    type: 'salary',
    isGross: true,
    useManualNet: false,
    country: 'IL',
    taxCreditPoints: 2.25,
    insuredSalaryRatio: 100,
    useContributions: true,
    pensionEmployee: 6,
    pensionEmployer: 6.5,
    educationFundEmployee: 2.5,
    educationFundEmployer: 7.5,
    severanceEmployer: 8.33,
    ...overrides,
  }
}

// ─── Payslip components — taxable gross calculation ───────────────────────────

describe('payslip components — taxable gross calculation', () => {
  it('all components sum correctly — reimbursements excluded from taxable gross', () => {
    // base 20400 + OT125 5580 + OT150 4020 = 30000 taxable gross
    const components: PayslipComponents = {
      base: 20_400,
      overtime125: 5_580,
      overtime150: 4_020,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 0,
    }
    const taxableGross =
      components.base +
      components.overtime125 +
      components.overtime150 +
      components.otherTaxable +
      components.imputedIncome
    expect(taxableGross).toBe(30_000)
    // Confirm this matches what the tax engine sees (amount = 30000, no reimbursements)
    const src = makeSource({ amount: 30_000, payslipComponents: components })
    expect(estimateTax(src).grossMonthly).toBe(30_000)
  })

  it('nonTaxableReimbursements are excluded from taxable gross', () => {
    const withReimbursements: PayslipComponents = {
      base: 20_400,
      overtime125: 5_580,
      overtime150: 4_020,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 1_000,
    }
    const taxableGross =
      withReimbursements.base +
      withReimbursements.overtime125 +
      withReimbursements.overtime150 +
      withReimbursements.otherTaxable +
      withReimbursements.imputedIncome
    // taxable gross = 30000, NOT 31000
    expect(taxableGross).toBe(30_000)
    expect(taxableGross).not.toBe(31_000)
    // The tax engine gross (amount) is 30000 — reimbursements do not inflate it
    const src = makeSource({ amount: 30_000, payslipComponents: withReimbursements })
    expect(estimateTax(src).grossMonthly).toBe(30_000)
  })

  it('guaranteed percentage (base / taxableGross) rounds to 68%', () => {
    const components: PayslipComponents = {
      base: 20_400,
      overtime125: 5_580,
      overtime150: 4_020,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 0,
    }
    const taxableGross =
      components.base +
      components.overtime125 +
      components.overtime150 +
      components.otherTaxable +
      components.imputedIncome
    const guaranteedPct = Math.round((components.base / taxableGross) * 100)
    expect(guaranteedPct).toBe(68)
  })

  it('guaranteed percentage is 100% when base equals taxableGross', () => {
    const components: PayslipComponents = {
      base: 30_000,
      overtime125: 0,
      overtime150: 0,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 0,
    }
    const taxableGross =
      components.base +
      components.overtime125 +
      components.overtime150 +
      components.otherTaxable +
      components.imputedIncome
    const guaranteedPct = Math.round((components.base / taxableGross) * 100)
    expect(guaranteedPct).toBe(100)
  })
})

// ─── getNetMonthly — reimbursements added after tax ───────────────────────────

describe('getNetMonthly — reimbursements added after tax', () => {
  it('simple mode (no payslipComponents) returns the same value as estimateTax().netMonthly', () => {
    const src = makeSource() // no payslipComponents
    expect(getNetMonthly(src)).toBe(estimateTax(src).netMonthly)
  })

  it('advanced mode with nonTaxableReimbursements adds them after tax', () => {
    const components: PayslipComponents = {
      base: 20_400,
      overtime125: 5_580,
      overtime150: 4_020,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 500,
    }
    const src = makeSource({ amount: 30_000, payslipComponents: components })
    const taxNet = estimateTax(src).netMonthly
    expect(getNetMonthly(src)).toBe(taxNet + 500)
  })

  it('zero nonTaxableReimbursements returns the same as estimateTax().netMonthly', () => {
    const components: PayslipComponents = {
      base: 30_000,
      overtime125: 0,
      overtime150: 0,
      otherTaxable: 0,
      imputedIncome: 0,
      nonTaxableReimbursements: 0,
    }
    const src = makeSource({ amount: 30_000, payslipComponents: components })
    expect(getNetMonthly(src)).toBe(estimateTax(src).netMonthly)
  })
})

// ─── estimateTax — pensionBase and studyFundBase ──────────────────────────────

describe('estimateTax — pensionBase and studyFundBase', () => {
  it('pensionBase absent → pension deduction falls back to gross', () => {
    // gross 30000, pensionEmployee 6% → deduction = 30000 * 0.06 = 1800
    const src = makeSource({ amount: 30_000, pensionBase: undefined })
    const result = estimateTax(src)
    expect(result.pensionEmployee).toBeCloseTo(30_000 * 0.06, 5)
  })

  it('pensionBase set → pension deduction uses pensionBase not gross', () => {
    // pensionBase 20000, pensionEmployee 6% → deduction = 20000 * 0.06 = 1200 (not 1800)
    const src = makeSource({ amount: 30_000, pensionBase: 20_000 })
    const result = estimateTax(src)
    expect(result.pensionEmployee).toBeCloseTo(20_000 * 0.06, 5)
    expect(result.pensionEmployee).toBeCloseTo(1_200, 5)
    expect(result.pensionEmployee).not.toBeCloseTo(1_800, 1)
  })

  it('studyFundBase set → study fund deduction uses studyFundBase', () => {
    // studyFundBase 15712, educationFundEmployee 2.5% → 15712 * 0.025 = 392.8
    const src = makeSource({
      amount: 30_000,
      studyFundBase: 15_712,
      educationFundEmployee: 2.5,
    })
    const result = estimateTax(src)
    expect(result.educationFundEmployee).toBeCloseTo(15_712 * 0.025, 5)
    expect(result.educationFundEmployee).toBeCloseTo(392.8, 1)
  })

  it('studyFundBase absent → study fund deduction falls back to gross', () => {
    // gross 30000, educationFundEmployee 2.5% → 30000 * 0.025 = 750
    const src = makeSource({
      amount: 30_000,
      studyFundBase: undefined,
      educationFundEmployee: 2.5,
    })
    const result = estimateTax(src)
    expect(result.educationFundEmployee).toBeCloseTo(30_000 * 0.025, 5)
    expect(result.educationFundEmployee).toBeCloseTo(750, 5)
  })

  it('both bases set independently — each uses its own base without interference', () => {
    // pensionBase 30000 @ 6% = 1800; studyFundBase 15712 @ 2.5% = 392.8
    const src = makeSource({
      amount: 30_000,
      pensionBase: 30_000,
      studyFundBase: 15_712,
      pensionEmployee: 6,
      educationFundEmployee: 2.5,
    })
    const result = estimateTax(src)
    expect(result.pensionEmployee).toBeCloseTo(30_000 * 0.06, 5)
    expect(result.educationFundEmployee).toBeCloseTo(15_712 * 0.025, 5)
  })
})

// ─── Backward compatibility ───────────────────────────────────────────────────

describe('backward compatibility', () => {
  it('legacy source with no payslipMode returns the same netMonthly and deductions as before', () => {
    // Identical to the existing taxEstimation.test.ts "includes pension deduction" source
    const legacy: IncomeSource = {
      id: 'legacy',
      name: 'Legacy',
      amount: 20_000,
      period: 'monthly',
      type: 'salary',
      isGross: true,
      useManualNet: false,
      country: 'IL',
      taxCreditPoints: 2.25,
      insuredSalaryRatio: 100,
      useContributions: true,
      pensionEmployee: 6,
      pensionEmployer: 6.5,
      educationFundEmployee: 0,
      educationFundEmployer: 7.5,
      severanceEmployer: 8.33,
      // No payslipMode, no payslipComponents, no pensionBase, no studyFundBase
    }
    const result = estimateTax(legacy)
    // Pension deduction should be gross * 6% = 1200
    expect(result.pensionEmployee).toBeCloseTo(20_000 * 0.06, 5)
    // Net should be positive and reflect expected deductions
    expect(result.netMonthly).toBeGreaterThan(0)
    expect(result.isManual).toBe(false)
    expect(result.hasContributions).toBe(true)
    // Confirm getNetMonthly equals estimateTax net (no reimbursements on legacy)
    expect(getNetMonthly(legacy)).toBe(result.netMonthly)
  })

  it('legacy source with no payslipComponents — getNetMonthly equals estimateTax().netMonthly', () => {
    const src = makeSource({
      amount: 25_000,
      // No payslipComponents at all
    })
    const taxNet = estimateTax(src).netMonthly
    expect(getNetMonthly(src)).toBe(taxNet)
  })
})
