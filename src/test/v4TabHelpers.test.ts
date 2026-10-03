import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, SavingsAccount } from '@/types'
import {
  HISTORY_VISIBLE_COUNT,
  isCurrentMonthSnapshot,
  isStubSnapshot,
  snapshotMonthLabel,
  snapshotYearMonth,
  sortSnapshotsNewestFirst,
  splitVisibleSnapshots,
  trendChartSnapshots,
} from '@/components/history/historyUtils'
import { computeGoalProgress, goalPriorityLabel, goalStatusLabel, GOAL_STATUS_TONE } from '@/components/goals/goalMeta'
import { computeLastMonthBalance, isLiquid } from '@/components/savings/savingsMeta'

const snap = (overrides: Partial<MonthSnapshot> = {}): MonthSnapshot => ({
  id: 's1',
  label: 'March 2026',
  date: new Date(2026, 2, 1).toISOString(),
  totalIncome: 10000,
  totalExpenses: 6000,
  totalSavings: 1000,
  freeCashFlow: 3000,
  ...overrides,
})

const account = (overrides: Partial<SavingsAccount> = {}): SavingsAccount => ({
  id: 'a1',
  name: 'Emergency',
  type: 'savings',
  balance: 10000,
  liquidity: 'immediate',
  annualReturnPercent: 0,
  monthlyContribution: 0,
  ...overrides,
})

// ── History ──────────────────────────────────────────────────────────────────

describe('sortSnapshotsNewestFirst()', () => {
  it('orders by date descending without mutating the input', () => {
    const input = [
      snap({ id: 'jan', date: new Date(2026, 0, 1).toISOString() }),
      snap({ id: 'mar', date: new Date(2026, 2, 1).toISOString() }),
      snap({ id: 'feb', date: new Date(2026, 1, 1).toISOString() }),
    ]
    const result = sortSnapshotsNewestFirst(input)
    expect(result.map((s) => s.id)).toEqual(['mar', 'feb', 'jan'])
    expect(input.map((s) => s.id)).toEqual(['jan', 'mar', 'feb'])
  })

  it('returns an empty array for no history', () => {
    expect(sortSnapshotsNewestFirst([])).toEqual([])
  })
})

describe('splitVisibleSnapshots()', () => {
  const list = Array.from({ length: 10 }, (_, i) => i)

  it('shows the newest 6 and counts the rest as older', () => {
    const { visible, hiddenCount } = splitVisibleSnapshots(list, false)
    expect(HISTORY_VISIBLE_COUNT).toBe(6)
    expect(visible).toEqual([0, 1, 2, 3, 4, 5])
    expect(hiddenCount).toBe(4)
  })

  it('shows everything when showAll is set', () => {
    const { visible, hiddenCount } = splitVisibleSnapshots(list, true)
    expect(visible).toHaveLength(10)
    expect(hiddenCount).toBe(0)
  })

  it('never hides anything when the list fits', () => {
    const { visible, hiddenCount } = splitVisibleSnapshots([1, 2, 3], false)
    expect(visible).toEqual([1, 2, 3])
    expect(hiddenCount).toBe(0)
  })

  it('boundary: exactly the limit shows all, limit + 1 hides one', () => {
    expect(splitVisibleSnapshots(list.slice(0, 6), false).hiddenCount).toBe(0)
    expect(splitVisibleSnapshots(list.slice(0, 7), false).hiddenCount).toBe(1)
  })

  it('never drops items: visible + hidden === total', () => {
    for (let n = 0; n < 15; n++) {
      const items = Array.from({ length: n }, (_, i) => i)
      const { visible, hiddenCount } = splitVisibleSnapshots(items, false)
      expect(visible.length + hiddenCount).toBe(n)
    }
  })
})

describe('isStubSnapshot()', () => {
  it('is true when income is 0 and expenses are positive', () => {
    expect(isStubSnapshot(snap({ totalIncome: 0, totalExpenses: 500 }))).toBe(true)
  })
  it('is false for a normal snapshot or an empty one', () => {
    expect(isStubSnapshot(snap())).toBe(false)
    expect(isStubSnapshot(snap({ totalIncome: 0, totalExpenses: 0 }))).toBe(false)
  })
})

describe('isCurrentMonthSnapshot()', () => {
  const now = new Date(2026, 2, 15)
  it('matches the same calendar month', () => {
    expect(isCurrentMonthSnapshot({ date: new Date(2026, 2, 1).toISOString() }, now)).toBe(true)
  })
  it('rejects other months and years', () => {
    expect(isCurrentMonthSnapshot({ date: new Date(2026, 1, 28).toISOString() }, now)).toBe(false)
    expect(isCurrentMonthSnapshot({ date: new Date(2025, 2, 1).toISOString() }, now)).toBe(false)
  })
})

describe('snapshotYearMonth() / snapshotMonthLabel()', () => {
  it('reads the English label written by FinanceContext', () => {
    expect(snapshotYearMonth(snap({ label: 'December 2025' }))).toEqual({ year: 2025, month: 11 })
  })

  it('falls back to the date when the label is not a month', () => {
    const s = snap({ label: 'custom', date: new Date(2024, 6, 1).toISOString() })
    expect(snapshotYearMonth(s)).toEqual({ year: 2024, month: 6 })
  })

  it('returns null for an unparseable label and date', () => {
    expect(snapshotYearMonth(snap({ label: 'x', date: 'not-a-date' }))).toBeNull()
    expect(snapshotMonthLabel(snap({ label: 'x', date: 'not-a-date' }), 'en')).toBe('x')
  })

  it('formats in English and Hebrew', () => {
    expect(snapshotMonthLabel(snap({ label: 'March 2026' }), 'en')).toBe('March 2026')
    expect(snapshotMonthLabel(snap({ label: 'March 2026' }), 'he')).toContain('מרץ')
  })
})

describe('trendChartSnapshots()', () => {
  it('keeps snapshots with data, oldest first', () => {
    const result = trendChartSnapshots([
      snap({ id: 'b', date: new Date(2026, 1, 1).toISOString() }),
      snap({ id: 'empty', totalIncome: 0, totalExpenses: 0, date: new Date(2026, 0, 1).toISOString() }),
      snap({ id: 'a', date: new Date(2025, 11, 1).toISOString() }),
      snap({
        id: 'inc-only',
        totalIncome: 0,
        totalExpenses: 0,
        historicalIncomes: [{ id: 'i', memberName: 'Dana', amount: 100 }],
        date: new Date(2026, 2, 1).toISOString(),
      }),
    ])
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'inc-only'])
  })
})

// ── Goals ────────────────────────────────────────────────────────────────────

describe('computeGoalProgress()', () => {
  it('computes available / effective target with no used amount', () => {
    const p = computeGoalProgress({ currentAmount: 2500, targetAmount: 10000 })
    expect(p).toEqual({ used: 0, available: 2500, effectiveTarget: 10000, pct: 25, stillNeeded: 7500 })
  })

  it('reduces both sides by the used amount', () => {
    const p = computeGoalProgress({ currentAmount: 5000, targetAmount: 10000, usedAmount: 1000 })
    expect(p.available).toBe(4000)
    expect(p.effectiveTarget).toBe(9000)
    expect(p.stillNeeded).toBe(5000)
    expect(p.pct).toBeCloseTo(44.44, 1)
  })

  it('caps at 100% when over-funded', () => {
    expect(computeGoalProgress({ currentAmount: 12000, targetAmount: 10000 }).pct).toBe(100)
  })

  it('treats a zero target as complete', () => {
    expect(computeGoalProgress({ currentAmount: 0, targetAmount: 0 }).pct).toBe(100)
  })
})

describe('goal labels and tones', () => {
  it('maps every status to a tone and bilingual label', () => {
    expect(GOAL_STATUS_TONE.realistic).toBe('success')
    expect(GOAL_STATUS_TONE.tight).toBe('warning')
    expect(GOAL_STATUS_TONE.blocked).toBe('danger')
    expect(goalStatusLabel('tight', 'en')).toBe('Tight')
    expect(goalStatusLabel('tight', 'he')).toBe('הדוק')
    expect(goalPriorityLabel('high', 'he')).toBe('גבוה')
  })
})

// ── Savings ──────────────────────────────────────────────────────────────────

describe('computeLastMonthBalance()', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('subtracts this month’s auto-increments from the balance', () => {
    const a = account({ balance: 10000, autoIncrementLog: [{ month: '2026-02', amount: 500 }, { month: '2026-03', amount: 700 }] })
    expect(computeLastMonthBalance(a, now)).toBe(9300)
  })

  it('falls back to balance − monthlyContribution', () => {
    expect(computeLastMonthBalance(account({ balance: 10000, monthlyContribution: 1000 }), now)).toBe(9000)
  })

  it('returns null with no log and no contribution, or a non-positive result', () => {
    expect(computeLastMonthBalance(account(), now)).toBeNull()
    expect(computeLastMonthBalance(account({ balance: 500, monthlyContribution: 500 }), now)).toBeNull()
  })
})

describe('isLiquid()', () => {
  it('treats immediate and short as liquid', () => {
    expect(isLiquid(account({ liquidity: 'immediate' }))).toBe(true)
    expect(isLiquid(account({ liquidity: 'short' }))).toBe(true)
    expect(isLiquid(account({ liquidity: 'medium' }))).toBe(false)
    expect(isLiquid(account({ liquidity: 'locked' }))).toBe(false)
  })
})
