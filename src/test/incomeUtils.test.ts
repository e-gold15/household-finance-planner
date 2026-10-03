import { describe, it, expect } from 'vitest'
import {
  clampPastMonth,
  computeTaxableGross,
  computeTotalGross,
  monthName,
  numericFieldText,
  parseNumericField,
  previousMonth,
  selectableMonths,
  selectableYears,
  sourceTypeLabel,
  DEFAULT_PAYSLIP_COMPONENTS,
} from '@/components/income/incomeUtils'

describe('parseNumericField()', () => {
  it('parses plain and grouped numbers', () => {
    expect(parseNumericField('1234', 0)).toBe(1234)
    expect(parseNumericField('1,234.5', 0)).toBe(1234.5)
    expect(parseNumericField('2.25', 0)).toBe(2.25)
  })

  it('returns the fallback for empty input (never NaN)', () => {
    expect(parseNumericField('', 0)).toBe(0)
    expect(parseNumericField('', undefined)).toBeUndefined()
    expect(parseNumericField('   ', 0)).toBe(0)
  })

  it('returns the fallback for invalid input', () => {
    expect(parseNumericField('.', 0)).toBe(0)
    expect(parseNumericField('1.2.3', 0)).toBe(0)
    expect(parseNumericField('abc', undefined)).toBeUndefined()
    expect(Number.isNaN(parseNumericField('1.2.3', 0))).toBe(false)
  })

  it('rejects negatives unless allowed', () => {
    expect(parseNumericField('-50', 0)).toBe(0)
    expect(parseNumericField('-50', 0, true)).toBe(-50)
  })
})

describe('numericFieldText()', () => {
  it('stringifies numbers', () => {
    expect(numericFieldText(6.5)).toBe('6.5')
    expect(numericFieldText(0)).toBe('0')
  })

  it('shows 0 as empty when zeroAsEmpty is set', () => {
    expect(numericFieldText(0, true)).toBe('')
    expect(numericFieldText(10, true)).toBe('10')
  })

  it('returns empty for undefined / NaN', () => {
    expect(numericFieldText(undefined)).toBe('')
    expect(numericFieldText(Number.NaN)).toBe('')
  })

  it('round-trips through parseNumericField', () => {
    for (const v of [0, 1, 2.25, 18200, 8.33]) {
      expect(parseNumericField(numericFieldText(v), 0)).toBe(v)
    }
  })
})

describe('payslip gross helpers', () => {
  const comp = { base: 10000, overtime125: 1000, overtime150: 500, otherTaxable: 200, imputedIncome: 300, nonTaxableReimbursements: 400 }

  it('computeTaxableGross() sums taxable components only', () => {
    expect(computeTaxableGross(comp)).toBe(12000)
  })

  it('computeTotalGross() adds non-taxable reimbursements', () => {
    expect(computeTotalGross(comp)).toBe(12400)
  })

  it('empty components give 0', () => {
    expect(computeTaxableGross(DEFAULT_PAYSLIP_COMPONENTS)).toBe(0)
    expect(computeTotalGross(DEFAULT_PAYSLIP_COMPONENTS)).toBe(0)
  })
})

describe('past-month picker helpers', () => {
  const may2026 = new Date(2026, 4, 15)
  const jan2026 = new Date(2026, 0, 10)

  it('previousMonth() returns the prior month and handles January', () => {
    expect(previousMonth(may2026)).toEqual({ month: 4, year: 2026 })
    expect(previousMonth(jan2026)).toEqual({ month: 12, year: 2025 })
  })

  it('selectableMonths() only allows months before the current one this year', () => {
    expect(selectableMonths(2026, may2026)).toEqual([1, 2, 3, 4])
    expect(selectableMonths(2025, may2026)).toHaveLength(12)
    expect(selectableMonths(2027, may2026)).toEqual([])
    expect(selectableMonths(2026, jan2026)).toEqual([])
  })

  it('clampPastMonth() clamps to the previous month when switching to the current year', () => {
    expect(clampPastMonth(2026, 9, may2026)).toBe(4)
    expect(clampPastMonth(2026, 5, may2026)).toBe(4)
    expect(clampPastMonth(2026, 3, may2026)).toBe(3)
    expect(clampPastMonth(2025, 11, may2026)).toBe(11)
    expect(clampPastMonth(2026, 6, jan2026)).toBe(12)
  })

  it('selectableYears() lists the last 3 years, newest first', () => {
    expect(selectableYears(may2026)).toEqual([2026, 2025, 2024])
  })
})

describe('labels', () => {
  it('monthName() localises and returns empty for out-of-range', () => {
    expect(monthName(1, 'en')).toBe('January')
    expect(monthName(12, 'he')).toBe('דצמבר')
    expect(monthName(13, 'en')).toBe('')
  })

  it('sourceTypeLabel() defaults to salary', () => {
    expect(sourceTypeLabel('rental', 'en')).toBe('Rental')
    expect(sourceTypeLabel(undefined, 'he')).toBe('משכורת')
  })
})
