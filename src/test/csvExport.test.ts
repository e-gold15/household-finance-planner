/**
 * Tests for src/lib/csvExport.ts (v3.2 CSV export feature).
 *
 * Covers:
 * - escapeCsv: plain strings, commas, quotes, newlines, numbers, null/undefined/empty
 * - generateCsvExports summary CSV: header, rows, stubs, negative FCF, sorting, i18n
 * - generateCsvExports detail CSV: income rows, expense rows, ordering, separators
 * - BOM prefix on both outputs
 * - Exact header row content
 */
import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, HistoricalIncome, HistoricalExpense } from '../types'
import { escapeCsv, generateCsvExports } from '../lib/csvExport'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<MonthSnapshot> = {}): MonthSnapshot {
  return {
    id: 'snap1',
    label: 'March 2025',
    date: '2025-03-01T00:00:00.000Z',
    totalIncome: 10_000,
    totalExpenses: 7_000,
    totalSavings: 1_000,
    freeCashFlow: 2_000,
    ...overrides,
  }
}

function makeIncome(overrides: Partial<HistoricalIncome> = {}): HistoricalIncome {
  return {
    id: 'inc1',
    memberName: 'Alice',
    amount: 5_000,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<HistoricalExpense> = {}): HistoricalExpense {
  return {
    id: 'exp1',
    name: 'Dentist',
    amount: 800,
    category: 'health',
    ...overrides,
  }
}

// ─── Parses the summary CSV into an array of row arrays (skips the BOM) ───────
function parseCsv(csv: string): string[][] {
  // Strip BOM if present
  const text = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  // Normalize line endings and filter empty lines
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean).map((line) => {
    // Split on commas that are not inside quotes
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current)
    return cells
  })
}

// ─────────────────────────────────────────────────────────────────────────────

describe('escapeCsv()', () => {
  it('returns a plain string as-is without quotes', () => {
    expect(escapeCsv('hello')).toBe('hello')
  })

  it('wraps a string containing a comma in double quotes', () => {
    expect(escapeCsv('hello, world')).toBe('"hello, world"')
  })

  it('doubles internal double-quotes and wraps in double quotes', () => {
    expect(escapeCsv('He said "hi"')).toBe('"He said ""hi"""')
  })

  it('wraps a string containing a newline in double quotes', () => {
    const result = escapeCsv('line1\nline2')
    expect(result).toBe('"line1\nline2"')
  })

  it('converts a number to its string representation without quotes', () => {
    expect(escapeCsv(12345)).toBe('12345')
  })

  it('converts zero to "0" without quotes', () => {
    expect(escapeCsv(0)).toBe('0')
  })

  it('converts a negative number to its string representation without quotes', () => {
    expect(escapeCsv(-3200)).toBe('-3200')
  })

  it('returns empty string for undefined', () => {
    expect(escapeCsv(undefined)).toBe('')
  })

  it('returns empty string for null', () => {
    expect(escapeCsv(null)).toBe('')
  })

  it('returns empty string for empty string input', () => {
    expect(escapeCsv('')).toBe('')
  })

  it('handles a string with both a comma and a double quote', () => {
    expect(escapeCsv('say "yes", please')).toBe('"say ""yes"", please"')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('generateCsvExports() — BOM', () => {
  it('summary string starts with UTF-8 BOM', () => {
    const { summary } = generateCsvExports([], 'ILS', 'en')
    expect(summary.startsWith('\uFEFF')).toBe(true)
  })

  it('detail string starts with UTF-8 BOM', () => {
    const { detail } = generateCsvExports([], 'ILS', 'en')
    expect(detail.startsWith('\uFEFF')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('generateCsvExports() — header rows', () => {
  it('summary header is exactly the expected columns', () => {
    const { summary } = generateCsvExports([], 'ILS', 'en')
    const rows = parseCsv(summary)
    expect(rows[0]).toEqual([
      'Period',
      'Month',
      'Total Income',
      'Total Expenses',
      'Total Savings',
      'Free Cash Flow',
      'Currency',
      'Housing',
      'Food',
      'Transport',
      'Education',
      'Leisure',
      'Health',
      'Utilities',
      'Clothing',
      'Insurance',
      'Savings (category)',
      'Other',
      'Notes',
    ])
  })

  it('detail header is exactly the expected columns', () => {
    const { detail } = generateCsvExports([], 'ILS', 'en')
    const rows = parseCsv(detail)
    expect(rows[0]).toEqual([
      'Period',
      'Month',
      'Type',
      'Member / Name',
      'Category',
      'Amount',
      'Note',
      'Currency',
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('generateCsvExports() — summary CSV', () => {
  it('empty snapshot array produces only the header row', () => {
    const { summary } = generateCsvExports([], 'ILS', 'en')
    const rows = parseCsv(summary)
    expect(rows).toHaveLength(1) // header only
  })

  it('single snapshot produces header + one data row', () => {
    const snap = makeSnapshot()
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    expect(rows).toHaveLength(2)
  })

  it('data row contains correct Period value (YYYY-MM)', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z' })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    const periodIdx: number = 0
    expect(rows[1][periodIdx]).toBe('2025-03')
  })

  it('data row contains English month name when language = "en"', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z' })
    const { summary } = generateCsvExports([snap], 'en', 'en')
    const rows = parseCsv(summary)
    const monthIdx: number = 1
    expect(rows[1][monthIdx].toLowerCase()).toContain('march')
  })

  it('data row contains Hebrew month name when language = "he"', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z' })
    const { summary } = generateCsvExports([snap], 'ILS', 'he')
    const rows = parseCsv(summary)
    const monthIdx: number = 1
    // March in Hebrew is "מרץ" — just verify it's non-empty and not "March"
    expect(rows[1][monthIdx]).not.toBe('')
    expect(rows[1][monthIdx].toLowerCase()).not.toContain('march')
  })

  it('data row contains correct totalIncome, totalExpenses, totalSavings, FCF', () => {
    const snap = makeSnapshot({
      totalIncome: 10_000,
      totalExpenses: 7_000,
      totalSavings: 1_000,
      freeCashFlow: 2_000,
    })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    const row = rows[1]
    // Columns: Period(0) Month(1) TotalIncome(2) TotalExpenses(3) TotalSavings(4) FCF(5) Currency(6)
    expect(row[2]).toBe('10000')
    expect(row[3]).toBe('7000')
    expect(row[4]).toBe('1000')
    expect(row[5]).toBe('2000')
  })

  it('currency column contains the passed currency string', () => {
    const snap = makeSnapshot()
    const { summary } = generateCsvExports([snap], 'USD', 'en')
    const rows = parseCsv(summary)
    const currencyIdx: number = 6
    expect(rows[1][currencyIdx]).toBe('USD')
  })

  it('negative FCF is exported as a negative number', () => {
    const snap = makeSnapshot({ freeCashFlow: -3_200 })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    const fcfIdx: number = 5
    expect(rows[1][fcfIdx]).toBe('-3200')
  })

  it('categoryActuals values appear in their matching category columns', () => {
    const snap = makeSnapshot({
      categoryActuals: {
        housing: 3_500,
        food: 1_200,
      },
    })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    // Header: ...Currency(6) Housing(7) Food(8) Transport(9)...
    expect(rows[1][7]).toBe('3500')
    expect(rows[1][8]).toBe('1200')
  })

  it('categories missing from categoryActuals are blank', () => {
    const snap = makeSnapshot({
      categoryActuals: { housing: 3_500 }, // only housing set
    })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    // Transport column (index 9) should be blank since it's not in categoryActuals
    expect(rows[1][9]).toBe('')
  })

  it('snapshot with undefined categoryActuals has all category columns blank', () => {
    const snap = makeSnapshot({ categoryActuals: undefined })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    // Category columns: indices 7–17 (11 categories)
    for (let i: number = 7; i <= 17; i++) {
      expect(rows[1][i]).toBe('')
    }
  })

  it('stub snapshot has Notes = "stub"', () => {
    const snap = makeSnapshot({ totalIncome: 0, freeCashFlow: 0 })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    const notesIdx: number = 18
    expect(rows[1][notesIdx]).toBe('stub')
  })

  it('non-stub snapshot has Notes = ""', () => {
    const snap = makeSnapshot({ totalIncome: 10_000 })
    const { summary } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(summary)
    const notesIdx: number = 18
    expect(rows[1][notesIdx]).toBe('')
  })

  it('multiple snapshots are sorted by period ascending', () => {
    const march = makeSnapshot({ id: 'mar', date: '2025-03-01T00:00:00.000Z', label: 'March 2025' })
    const jan   = makeSnapshot({ id: 'jan', date: '2025-01-01T00:00:00.000Z', label: 'January 2025' })
    const feb   = makeSnapshot({ id: 'feb', date: '2025-02-01T00:00:00.000Z', label: 'February 2025' })
    // Pass in unsorted order
    const { summary } = generateCsvExports([march, jan, feb], 'ILS', 'en')
    const rows = parseCsv(summary)
    // Rows: header, jan, feb, march
    expect(rows[1][0]).toBe('2025-01')
    expect(rows[2][0]).toBe('2025-02')
    expect(rows[3][0]).toBe('2025-03')
  })

  it('cross-year snapshots are ordered correctly (2024 before 2025)', () => {
    const dec2024 = makeSnapshot({ id: 'dec24', date: '2024-12-01T00:00:00.000Z', label: 'December 2024' })
    const jan2025 = makeSnapshot({ id: 'jan25', date: '2025-01-01T00:00:00.000Z', label: 'January 2025' })
    const { summary } = generateCsvExports([jan2025, dec2024], 'ILS', 'en')
    const rows = parseCsv(summary)
    expect(rows[1][0]).toBe('2024-12')
    expect(rows[2][0]).toBe('2025-01')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('generateCsvExports() — detail CSV', () => {
  it('empty snapshot array produces only the header row in detail', () => {
    const { detail } = generateCsvExports([], 'ILS', 'en')
    const rows = parseCsv(detail)
    expect(rows).toHaveLength(1) // header only
  })

  it('snapshot with no historicalIncomes and no historicalExpenses produces one separator row', () => {
    const snap = makeSnapshot({ historicalIncomes: undefined, historicalExpenses: undefined })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    // header + separator = 2 rows
    expect(rows).toHaveLength(2)
    const sep = rows[1]
    // Period and Month are present, the rest are empty
    expect(sep[0]).toBe('2025-03')
    expect(sep[2]).toBe('')  // Type blank
    expect(sep[3]).toBe('')  // Member/Name blank
  })

  it('income row has Type="Income", memberName in Member/Name, blank Category', () => {
    const income = makeIncome({ memberName: 'Alice', amount: 5_000, note: 'Salary' })
    const snap = makeSnapshot({ historicalIncomes: [income] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    // header(0), separator(1) or income row(1) — income rows come first within month
    const dataRows = rows.slice(1)
    const incomeRow = dataRows.find((r) => r[2] === 'Income')
    expect(incomeRow).toBeDefined()
    expect(incomeRow![3]).toBe('Alice')   // Member / Name
    expect(incomeRow![4]).toBe('')        // Category blank
    expect(incomeRow![5]).toBe('5000')    // Amount
    expect(incomeRow![6]).toBe('Salary')  // Note
  })

  it('expense row has Type="Expense", name in Member/Name, category filled', () => {
    const expense = makeExpense({ name: 'Dentist', amount: 800, category: 'health', note: 'Checkup' })
    const snap = makeSnapshot({ historicalExpenses: [expense] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const expenseRow = rows.slice(1).find((r) => r[2] === 'Expense')
    expect(expenseRow).toBeDefined()
    expect(expenseRow![3]).toBe('Dentist')  // Member / Name
    expect(expenseRow![4]).toBe('health')   // Category
    expect(expenseRow![5]).toBe('800')      // Amount
    expect(expenseRow![6]).toBe('Checkup')  // Note
  })

  it('income rows appear before expense rows within the same month', () => {
    const income = makeIncome({ memberName: 'Alice', amount: 5_000 })
    const expense = makeExpense({ name: 'Dentist', amount: 800, category: 'health' })
    const snap = makeSnapshot({ historicalIncomes: [income], historicalExpenses: [expense] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const dataRows = rows.slice(1) // skip header
    const incomeIdx = dataRows.findIndex((r) => r[2] === 'Income')
    const expenseIdx = dataRows.findIndex((r) => r[2] === 'Expense')
    expect(incomeIdx).toBeGreaterThanOrEqual(0)
    expect(expenseIdx).toBeGreaterThanOrEqual(0)
    expect(incomeIdx).toBeLessThan(expenseIdx)
  })

  it('income rows within a month are sorted by amount descending', () => {
    const inc1 = makeIncome({ id: 'i1', memberName: 'Alice', amount: 3_000 })
    const inc2 = makeIncome({ id: 'i2', memberName: 'Bob', amount: 8_000 })
    const inc3 = makeIncome({ id: 'i3', memberName: 'Carol', amount: 5_500 })
    const snap = makeSnapshot({ historicalIncomes: [inc1, inc2, inc3] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const incomeRows = rows.slice(1).filter((r) => r[2] === 'Income')
    expect(Number(incomeRows[0][5])).toBe(8_000)
    expect(Number(incomeRows[1][5])).toBe(5_500)
    expect(Number(incomeRows[2][5])).toBe(3_000)
  })

  it('expense rows within a month are sorted by amount descending', () => {
    const exp1 = makeExpense({ id: 'e1', name: 'Groceries', amount: 1_200, category: 'food' })
    const exp2 = makeExpense({ id: 'e2', name: 'Rent', amount: 4_000, category: 'housing' })
    const exp3 = makeExpense({ id: 'e3', name: 'Gym', amount: 150, category: 'health' })
    const snap = makeSnapshot({ historicalExpenses: [exp1, exp2, exp3] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const expenseRows = rows.slice(1).filter((r) => r[2] === 'Expense')
    expect(Number(expenseRows[0][5])).toBe(4_000)
    expect(Number(expenseRows[1][5])).toBe(1_200)
    expect(Number(expenseRows[2][5])).toBe(150)
  })

  it('a blank separator row is emitted between months', () => {
    const snap1 = makeSnapshot({ id: 's1', date: '2025-02-01T00:00:00.000Z', label: 'February 2025' })
    const snap2 = makeSnapshot({ id: 's2', date: '2025-03-01T00:00:00.000Z', label: 'March 2025' })
    const { detail } = generateCsvExports([snap1, snap2], 'ILS', 'en')
    const rows = parseCsv(detail)
    // We expect at least one row that has Period of 2025-02 and Type blank (separator)
    const seps = rows.slice(1).filter((r) => r[0] === '2025-02' && r[2] === '')
    expect(seps.length).toBeGreaterThanOrEqual(1)
  })

  it('currency column is present on every non-header row', () => {
    const income = makeIncome({ memberName: 'Alice', amount: 5_000 })
    const expense = makeExpense({ name: 'Dentist', amount: 800, category: 'health' })
    const snap = makeSnapshot({ historicalIncomes: [income], historicalExpenses: [expense] })
    const { detail } = generateCsvExports([snap], 'EUR', 'en')
    const rows = parseCsv(detail)
    const currencyIdx: number = 7
    // All non-header rows should have currency
    rows.slice(1).forEach((row) => {
      expect(row[currencyIdx]).toBe('EUR')
    })
  })

  it('note is empty string when not provided on income', () => {
    const income = makeIncome({ memberName: 'Alice', amount: 5_000, note: undefined })
    const snap = makeSnapshot({ historicalIncomes: [income] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const incomeRow = rows.slice(1).find((r) => r[2] === 'Income')
    expect(incomeRow).toBeDefined()
    expect(incomeRow![6]).toBe('')
  })

  it('note is empty string when not provided on expense', () => {
    const expense = makeExpense({ name: 'Dentist', amount: 800, category: 'health', note: undefined })
    const snap = makeSnapshot({ historicalExpenses: [expense] })
    const { detail } = generateCsvExports([snap], 'ILS', 'en')
    const rows = parseCsv(detail)
    const expenseRow = rows.slice(1).find((r) => r[2] === 'Expense')
    expect(expenseRow).toBeDefined()
    expect(expenseRow![6]).toBe('')
  })

  it('multiple snapshots: detail rows appear in ascending period order', () => {
    const march = makeSnapshot({ id: 'mar', date: '2025-03-01T00:00:00.000Z', label: 'March 2025',
      historicalIncomes: [makeIncome({ id: 'i-mar', memberName: 'Alice', amount: 5_000 })] })
    const jan   = makeSnapshot({ id: 'jan', date: '2025-01-01T00:00:00.000Z', label: 'January 2025',
      historicalIncomes: [makeIncome({ id: 'i-jan', memberName: 'Bob', amount: 6_000 })] })
    const { detail } = generateCsvExports([march, jan], 'ILS', 'en')
    const rows = parseCsv(detail)
    // First month block (after header) should be January (2025-01)
    const firstDataRow = rows[1]
    expect(firstDataRow[0]).toBe('2025-01')
  })
})
