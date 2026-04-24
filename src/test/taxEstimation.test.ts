import { describe, it, expect } from 'vitest'
import { estimateTax, getNetMonthly } from '@/lib/taxEstimation'
import type { IncomeSource } from '@/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'test',
    name: 'Test',
    amount: 20_000,
    period: 'monthly',
    type: 'salary',
    isGross: true,
    useManualNet: false,
    country: 'IL',
    taxCreditPoints: 2.25,
    insuredSalaryRatio: 100,
    useContributions: false,
    pensionEmployee: 6,
    educationFundEmployee: 0,
    pensionEmployer: 6.5,
    educationFundEmployer: 7.5,
    severanceEmployer: 8.33,
    ...overrides,
  }
}

// ─── Manual net override ───────────────────────────────────────────────────

describe('estimateTax() — manual net override', () => {
  it('uses manualNetOverride when useManualNet is true', () => {
    const src = makeSource({ useManualNet: true, manualNetOverride: 15_000 })
    const result = estimateTax(src)
    expect(result.isManual).toBe(true)
    expect(result.netMonthly).toBe(15_000)
    expect(result.grossMonthly).toBe(20_000)
    expect(result.totalDeductions).toBe(5_000)
  })

  it('calculates effective rate correctly for manual override', () => {
    const src = makeSource({ useManualNet: true, manualNetOverride: 15_000 })
    const result = estimateTax(src)
    expect(result.effectiveRate).toBeCloseTo(25, 0) // (5000/20000)*100 = 25%
  })
})

// ─── Net as-is (isGross = false) ──────────────────────────────────────────

describe('estimateTax() — net input', () => {
  it('returns gross as-is when isGross is false', () => {
    const src = makeSource({ isGross: false, amount: 12_000 })
    const result = estimateTax(src)
    expect(result.netMonthly).toBe(12_000)
    expect(result.incomeTax).toBe(0)
    expect(result.bituachLeumi).toBe(0)
    expect(result.effectiveRate).toBe(0)
  })
})

// ─── Israeli tax calculation ───────────────────────────────────────────────

describe('estimateTax() — Israel gross → net', () => {
  it('calculates income tax for low salary (10% bracket)', () => {
    const src = makeSource({ amount: 7_000, taxCreditPoints: 0 })
    const result = estimateTax(src)
    // 7000 * 10% = 700
    expect(result.incomeTax).toBeCloseTo(700, 0)
  })

  it('deducts tax credit points correctly', () => {
    const src = makeSource({ amount: 10_000, taxCreditPoints: 2.25 })
    const resultWith = estimateTax(src)
    const resultWithout = estimateTax({ ...src, taxCreditPoints: 0 })
    // With credits should have lower income tax
    expect(resultWith.incomeTax).toBeLessThan(resultWithout.incomeTax)
    // Difference should be 2.25 * 242 = 544.5
    expect(resultWithout.incomeTax - resultWith.incomeTax).toBeCloseTo(544.5, 0)
  })

  it('calculates Bituach Leumi correctly below threshold', () => {
    const src = makeSource({ amount: 5_000 })
    const result = estimateTax(src)
    // 5000 < 7522, so: 5000 * 3.5% = 175
    expect(result.bituachLeumi).toBeCloseTo(175, 0)
  })

  it('calculates Bituach Leumi correctly above threshold', () => {
    const src = makeSource({ amount: 20_000 })
    const result = estimateTax(src)
    // 7522 * 3.5% + (20000 - 7522) * 12%
    const expected = 7_522 * 0.035 + (20_000 - 7_522) * 0.12
    expect(result.bituachLeumi).toBeCloseTo(expected, 0)
  })

  it('caps Bituach Leumi at IL_BL_CAP (49,030)', () => {
    const srcAtCap  = makeSource({ amount: 49_030 })
    const srcAbove  = makeSource({ amount: 80_000 })
    expect(estimateTax(srcAtCap).bituachLeumi).toBeCloseTo(
      estimateTax(srcAbove).bituachLeumi, 0
    )
  })

  it('calculates health tax correctly', () => {
    const src = makeSource({ amount: 5_000 })
    const result = estimateTax(src)
    // 5000 < 7522, so: 5000 * 3.1% = 155
    expect(result.healthTax).toBeCloseTo(155, 0)
  })

  it('insuredSalaryRatio reduces BL and HT', () => {
    const full = makeSource({ amount: 20_000, insuredSalaryRatio: 100 })
    const half = makeSource({ amount: 20_000, insuredSalaryRatio: 50 })
    expect(estimateTax(full).bituachLeumi).toBeGreaterThan(estimateTax(half).bituachLeumi)
    expect(estimateTax(full).healthTax).toBeGreaterThan(estimateTax(half).healthTax)
  })

  it('net is never negative', () => {
    const src = makeSource({ amount: 100, taxCreditPoints: 0, useContributions: true, pensionEmployee: 100 })
    const result = estimateTax(src)
    expect(result.netMonthly).toBeGreaterThanOrEqual(0)
  })

  it('includes pension deduction when useContributions is true', () => {
    const without = makeSource({ useContributions: false })
    const with_   = makeSource({ useContributions: true, pensionEmployee: 6 })
    const diff = estimateTax(without).netMonthly - estimateTax(with_).netMonthly
    expect(diff).toBeCloseTo(20_000 * 0.06, 0) // 1200
  })
})

// ─── Foreign countries ─────────────────────────────────────────────────────

describe('estimateTax() — foreign countries', () => {
  it('applies US brackets', () => {
    const src = makeSource({ country: 'US', amount: 5_000 })
    const result = estimateTax(src)
    // Annual = 60,000 → spans 10% and 12% brackets
    expect(result.incomeTax).toBeGreaterThan(0)
    expect(result.bituachLeumi).toBe(0) // no BL for US
    expect(result.healthTax).toBe(0)
  })

  it('applies UK personal allowance (0% under 12,570/year)', () => {
    const src = makeSource({ country: 'UK', amount: 900 }) // 10,800/year < 12,570
    const result = estimateTax(src)
    expect(result.incomeTax).toBe(0)
  })
})

// ─── Employer contributions (informational) ────────────────────────────────

describe('estimateTax() — employer contributions', () => {
  it('calculates employer costs', () => {
    const src = makeSource({
      pensionEmployer: 6.5,
      educationFundEmployer: 7.5,
      severanceEmployer: 8.33,
    })
    const result = estimateTax(src)
    expect(result.pensionEmployer).toBeCloseTo(20_000 * 0.065, 0)
    expect(result.educationFundEmployer).toBeCloseTo(20_000 * 0.075, 0)
    expect(result.severanceEmployer).toBeCloseTo(20_000 * 0.0833, 0)
    expect(result.totalEmployerContrib).toBeCloseTo(
      result.pensionEmployer + result.educationFundEmployer + result.severanceEmployer, 0
    )
  })
})

// ─── getNetMonthly() ──────────────────────────────────────────────────────

describe('getNetMonthly()', () => {
  it('returns the net monthly from estimateTax', () => {
    const src = makeSource()
    expect(getNetMonthly(src)).toBe(estimateTax(src).netMonthly)
  })

  it('handles yearly period by dividing by 12', () => {
    const monthly = makeSource({ amount: 20_000, period: 'monthly' })
    const yearly  = makeSource({ amount: 240_000, period: 'yearly' })
    expect(getNetMonthly(monthly)).toBeCloseTo(getNetMonthly(yearly), 0)
  })
})
