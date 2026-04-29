/**
 * CSV export utilities for Household Finance Planner.
 * Pure functions — no DOM, no React.
 */

import type { MonthSnapshot } from '@/types'
import { EXPENSE_CATEGORIES } from '@/lib/categories'

/**
 * Escapes a single CSV cell value.
 * - Numbers are written as-is (no quotes)
 * - Strings containing commas, double-quotes, or newlines are wrapped in double quotes
 * - Internal double quotes are doubled
 * - undefined / null → empty string
 */
export function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') return String(value)
  const s = String(value)
  // If it contains special chars, wrap in double quotes and double any internal quotes
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/** Build a single CSV row from an array of cell values */
function csvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsv).join(',')
}

/** Returns a localized month name + year string using Intl */
function localizedMonth(period: string, language: 'en' | 'he'): string {
  // period is "YYYY-MM"
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  const locale = language === 'he' ? 'he-IL' : 'en-US'
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

/**
 * Generates both summary and detailed CSV exports for the given snapshots.
 *
 * @param snapshots - Already filtered to desired date range, in any order
 * @param currency  - Currency code (e.g. "ILS")
 * @param language  - 'en' | 'he'
 * @returns Object with `summary` and `detail` strings, both UTF-8 with BOM prefix
 */
export function generateCsvExports(
  snapshots: MonthSnapshot[],
  currency: string,
  language: 'en' | 'he'
): { summary: string; detail: string } {
  // Sort chronologically for both exports
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // ── Summary CSV ──────────────────────────────────────────────────────────────

  const categoryKeys = EXPENSE_CATEGORIES.map((c) => c.value)

  // Header — always English per spec
  const summaryHeader = csvRow([
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

  const summaryRows = sorted.map((snap) => {
    // Period = snap.date (which is an ISO date string) → extract YYYY-MM
    const period = snap.date.slice(0, 7)
    const month = localizedMonth(period, language)
    const notes = snap.totalIncome === 0 && snap.totalExpenses > 0 ? 'stub' : ''

    const categoryCells = categoryKeys.map((key) => {
      const val = snap.categoryActuals?.[key as keyof typeof snap.categoryActuals]
      return val != null ? val : ''
    })

    return csvRow([
      period,
      month,
      snap.totalIncome,
      snap.totalExpenses,
      snap.totalSavings,
      snap.freeCashFlow,
      currency,
      ...categoryCells,
      notes,
    ])
  })

  const summaryContent = [summaryHeader, ...summaryRows].join('\r\n')
  const summary = '\uFEFF' + summaryContent

  // ── Detail CSV ───────────────────────────────────────────────────────────────

  const detailHeader = csvRow([
    'Period',
    'Month',
    'Type',
    'Member / Name',
    'Category',
    'Amount',
    'Note',
    'Currency',
  ])

  const detailRows: string[] = []

  for (const snap of sorted) {
    const period = snap.date.slice(0, 7)
    const month = localizedMonth(period, language)

    const incomes = snap.historicalIncomes ?? []
    const expenses = snap.historicalExpenses ?? []

    if (incomes.length === 0 && expenses.length === 0) {
      // Blank separator row with period + month + currency filled
      detailRows.push(csvRow([period, month, '', '', '', '', '', currency]))
      continue
    }

    // Blank separator row before this month's data
    detailRows.push(csvRow([period, month, '', '', '', '', '', currency]))

    // Income items sorted by amount desc
    const sortedIncomes = [...incomes].sort((a, b) => b.amount - a.amount)
    for (const item of sortedIncomes) {
      detailRows.push(csvRow([
        period,
        month,
        'Income',
        item.memberName,
        '',
        item.amount,
        item.note ?? '',
        currency,
      ]))
    }

    // Expense items sorted by amount desc
    const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount)
    for (const item of sortedExpenses) {
      detailRows.push(csvRow([
        period,
        month,
        'Expense',
        item.name,
        item.category,
        item.amount,
        item.note ?? '',
        currency,
      ]))
    }
  }

  const detailContent = [detailHeader, ...detailRows].join('\r\n')
  const detail = '\uFEFF' + detailContent

  return { summary, detail }
}
