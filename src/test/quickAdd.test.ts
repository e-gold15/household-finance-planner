import { describe, it, expect } from 'vitest'
import {
  rankQuickAddCategories,
  buildQuickAddExpense,
  isValidQuickAddAmount,
  defaultPastMonth,
  pastMonthOptions,
  pastYearOptions,
  clampPastMonth,
  isSelectablePastMonth,
  categoryLabel,
  monthName,
} from '@/lib/quickAdd'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { parseMoneyInput } from '@/lib/moneyInput'
import type { Expense, ExpenseCategory } from '@/types'

const NOW = new Date(2026, 9, 3, 12, 0, 0) // 3 Oct 2026
const ORDER = EXPENSE_CATEGORIES.map((c) => c.value)

function exp(category: ExpenseCategory, createdAt?: string): Pick<Expense, 'category' | 'createdAt'> {
  return { category, createdAt }
}

const ranked = (expenses: Array<Pick<Expense, 'category' | 'createdAt'>>) =>
  rankQuickAddCategories(expenses, EXPENSE_CATEGORIES).map((c) => c.value)

// ─── rankQuickAddCategories ──────────────────────────────────────────────────

describe('rankQuickAddCategories()', () => {
  it('returns EXPENSE_CATEGORIES order for an empty list', () => {
    expect(ranked([])).toEqual(ORDER)
  })

  it('always returns all 12 categories exactly once', () => {
    const result = ranked([exp('food', '2026-10-01T10:00:00Z'), exp('leisure', '2026-10-02T10:00:00Z')])
    expect(result).toHaveLength(12)
    expect(new Set(result).size).toBe(12)
  })

  it('puts the 3 most recent categories first, newest first', () => {
    const result = ranked([
      exp('housing', '2026-01-01T00:00:00Z'),
      exp('food', '2026-10-01T00:00:00Z'),
      exp('leisure', '2026-10-03T00:00:00Z'),
      exp('health', '2026-10-02T00:00:00Z'),
    ])
    expect(result.slice(0, 3)).toEqual(['leisure', 'health', 'food'])
    // the rest keep the canonical order (housing is not among the 3 most recent)
    expect(result.slice(3)).toEqual(ORDER.filter((c) => !['leisure', 'health', 'food'].includes(c)))
  })

  it('de-duplicates categories among the 3 most recent expenses', () => {
    const result = ranked([
      exp('food', '2026-10-03T00:00:00Z'),
      exp('food', '2026-10-02T00:00:00Z'),
      exp('transport', '2026-10-01T00:00:00Z'),
      exp('health', '2026-09-01T00:00:00Z'), // 4th most recent — not promoted
    ])
    expect(result.slice(0, 2)).toEqual(['food', 'transport'])
    expect(result[2]).toBe('housing') // canonical order resumes
    expect(result.filter((c) => c === 'food')).toHaveLength(1)
  })

  it('ignores expenses without a valid createdAt', () => {
    const result = ranked([exp('work'), exp('clothing', 'not-a-date'), exp('health', '2026-10-01T00:00:00Z')])
    expect(result[0]).toBe('health')
    expect(result.slice(1)).toEqual(ORDER.filter((c) => c !== 'health'))
  })

  it('breaks createdAt ties by later array position first', () => {
    const ts = '2026-10-01T00:00:00Z'
    expect(ranked([exp('food', ts), exp('work', ts)]).slice(0, 2)).toEqual(['work', 'food'])
  })

  it('ignores categories not present in allCategories', () => {
    const subset = EXPENSE_CATEGORIES.filter((c) => c.value !== 'food')
    const result = rankQuickAddCategories([exp('food', '2026-10-01T00:00:00Z')], subset).map((c) => c.value)
    expect(result).not.toContain('food')
    expect(result).toEqual(subset.map((c) => c.value))
  })

  it('does not mutate its inputs', () => {
    const list = [exp('food', '2026-10-01T00:00:00Z'), exp('work', '2026-10-02T00:00:00Z')]
    const copy = JSON.parse(JSON.stringify(list))
    rankQuickAddCategories(list, EXPENSE_CATEGORIES)
    expect(list).toEqual(copy)
    expect(EXPENSE_CATEGORIES.map((c) => c.value)).toEqual(ORDER)
  })
})

// ─── buildQuickAddExpense — current month ────────────────────────────────────

describe('buildQuickAddExpense() — this month', () => {
  it('builds the same variable-monthly payload ExpenseDialog creates', () => {
    const result = buildQuickAddExpense({
      amount: 42.5, category: 'food', name: 'Groceries', when: 'current', lang: 'en', now: NOW,
    })
    expect(result).toEqual({
      kind: 'current',
      expense: {
        name: 'Groceries',
        amount: 42.5,
        category: 'food',
        recurring: true,
        period: 'monthly',
        expenseType: 'variable',
        createdAt: NOW.toISOString(),
      },
    })
  })

  it('has exactly the expected keys — no id, dueMonth or linkedAccountId', () => {
    const result = buildQuickAddExpense({ amount: 10, category: 'savings', when: 'current', lang: 'en', now: NOW })
    expect(result?.kind).toBe('current')
    if (result?.kind !== 'current') return
    expect(Object.keys(result.expense).sort()).toEqual(
      ['amount', 'category', 'createdAt', 'expenseType', 'name', 'period', 'recurring'].sort()
    )
  })

  it('defaults a blank name to the localised category label', () => {
    const en = buildQuickAddExpense({ amount: 5, category: 'food', name: '   ', when: 'current', lang: 'en', now: NOW })
    const he = buildQuickAddExpense({ amount: 5, category: 'food', when: 'current', lang: 'he', now: NOW })
    expect(en?.kind === 'current' && en.expense.name).toBe('Food')
    expect(he?.kind === 'current' && he.expense.name).toBe('מזון')
  })

  it('trims the provided name', () => {
    const r = buildQuickAddExpense({ amount: 5, category: 'food', name: '  Coffee ', when: 'current', lang: 'en', now: NOW })
    expect(r?.kind === 'current' && r.expense.name).toBe('Coffee')
  })

  it('returns null when no category is chosen', () => {
    expect(buildQuickAddExpense({ amount: 5, category: null, when: 'current', lang: 'en', now: NOW })).toBeNull()
  })
})

// ─── buildQuickAddExpense — invalid amounts ──────────────────────────────────

describe('buildQuickAddExpense() — invalid amount never produces 0', () => {
  const bad: Array<number | null> = [null, 0, -0, -5, Number.NaN, Number.POSITIVE_INFINITY]
  for (const amount of bad) {
    it(`returns null for amount ${String(amount)}`, () => {
      expect(buildQuickAddExpense({ amount, category: 'food', when: 'current', lang: 'en', now: NOW })).toBeNull()
      expect(
        buildQuickAddExpense({ amount, category: 'food', when: 'past', pastYear: 2026, pastMonth: 9, lang: 'en', now: NOW })
      ).toBeNull()
    })
  }

  it('unparseable typed input ("", "abc", "1.2.3") is rejected end to end', () => {
    for (const raw of ['', 'abc', '1.2.3', '.', '0', '0.00']) {
      const amount = parseMoneyInput(raw, { allowNegative: false })
      expect(buildQuickAddExpense({ amount, category: 'food', when: 'current', lang: 'en', now: NOW })).toBeNull()
    }
  })

  it('isValidQuickAddAmount accepts only finite > 0', () => {
    expect(isValidQuickAddAmount(0.01)).toBe(true)
    expect(isValidQuickAddAmount(0)).toBe(false)
    expect(isValidQuickAddAmount(null)).toBe(false)
    expect(isValidQuickAddAmount(undefined)).toBe(false)
  })
})

// ─── buildQuickAddExpense — past month routing ───────────────────────────────

describe('buildQuickAddExpense() — past month routing', () => {
  it('routes to addExpenseToMonth arguments with { name, amount, category }', () => {
    const r = buildQuickAddExpense({
      amount: 120, category: 'health', name: 'Dentist', when: 'past', pastYear: 2026, pastMonth: 9, lang: 'en', now: NOW,
    })
    expect(r).toEqual({ kind: 'past', year: 2026, month: 9, item: { name: 'Dentist', amount: 120, category: 'health' } })
  })

  it('past item has no recurring/period/expenseType/createdAt fields', () => {
    const r = buildQuickAddExpense({ amount: 1, category: 'food', when: 'past', pastYear: 2025, pastMonth: 12, lang: 'he', now: NOW })
    expect(r?.kind).toBe('past')
    if (r?.kind !== 'past') return
    expect(Object.keys(r.item).sort()).toEqual(['amount', 'category', 'name'])
    expect(r.item.name).toBe('מזון')
  })

  it('rejects the current month, future months and years outside the 3-year range', () => {
    const base = { amount: 10, category: 'food' as const, when: 'past' as const, lang: 'en' as const, now: NOW }
    expect(buildQuickAddExpense({ ...base, pastYear: 2026, pastMonth: 10 })).toBeNull() // current month
    expect(buildQuickAddExpense({ ...base, pastYear: 2026, pastMonth: 11 })).toBeNull() // future
    expect(buildQuickAddExpense({ ...base, pastYear: 2027, pastMonth: 1 })).toBeNull()
    expect(buildQuickAddExpense({ ...base, pastYear: 2023, pastMonth: 5 })).toBeNull() // > 3 years
    expect(buildQuickAddExpense({ ...base, pastYear: 2024, pastMonth: 1 })).not.toBeNull()
    expect(buildQuickAddExpense({ ...base, pastYear: 2026, pastMonth: 0 })).toBeNull()
    expect(buildQuickAddExpense({ ...base })).toBeNull() // missing year/month
  })

  it('handles the January year boundary', () => {
    const jan = new Date(2027, 0, 15)
    const r = buildQuickAddExpense({ amount: 3, category: 'food', when: 'past', pastYear: 2026, pastMonth: 12, lang: 'en', now: jan })
    expect(r).toEqual({ kind: 'past', year: 2026, month: 12, item: { name: 'Food', amount: 3, category: 'food' } })
  })
})

// ─── Past-month picker helpers ───────────────────────────────────────────────

describe('past-month picker helpers', () => {
  it('defaultPastMonth is the previous month, crossing the year boundary in January', () => {
    expect(defaultPastMonth(NOW)).toEqual({ year: 2026, month: 9 })
    expect(defaultPastMonth(new Date(2027, 0, 5))).toEqual({ year: 2026, month: 12 })
  })

  it('pastYearOptions lists the current year and 2 back', () => {
    expect(pastYearOptions(NOW)).toEqual([2026, 2025, 2024])
  })

  it('pastMonthOptions excludes the current and future months in the current year', () => {
    expect(pastMonthOptions(2026, NOW)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(pastMonthOptions(2025, NOW)).toHaveLength(12)
    expect(pastMonthOptions(2027, NOW)).toEqual([])
    expect(pastMonthOptions(2027, new Date(2027, 0, 1))).toEqual([])
  })

  it('clampPastMonth clamps an invalid month when switching to the current year', () => {
    expect(clampPastMonth(2026, 11, NOW)).toBe(9)
    expect(clampPastMonth(2026, 10, NOW)).toBe(9)
    expect(clampPastMonth(2026, 4, NOW)).toBe(4)
    expect(clampPastMonth(2025, 11, NOW)).toBe(11)
  })

  it('isSelectablePastMonth mirrors the picker options', () => {
    expect(isSelectablePastMonth(2026, 9, NOW)).toBe(true)
    expect(isSelectablePastMonth(2026, 10, NOW)).toBe(false)
    expect(isSelectablePastMonth(2026, 9.5, NOW)).toBe(false)
  })

  it('labels are localised', () => {
    expect(monthName(9, 'en')).toBe('September')
    expect(monthName(9, 'he')).toBe('ספטמבר')
    expect(monthName(13, 'en')).toBe('')
    expect(categoryLabel('transport', 'he')).toBe('תחבורה')
  })
})
