/**
 * Tests for the End-of-Month Surplus Action feature (v3.0).
 *
 * Covers:
 * - Snapshot detection logic (which snapshot triggers the banner)
 * - markSurplusActioned behavior
 * - Goal top-up amount logic
 * - Savings deposit amount logic
 * - Edge cases: stubs, no surplus, already actioned, current-month snapshots
 */
import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, Goal, SavingsAccount } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal1',
    name: 'Emergency Fund',
    targetAmount: 50_000,
    currentAmount: 30_000,
    deadline: '2026-12-01',
    priority: 'high',
    notes: '',
    useLiquidSavings: false,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'acc1',
    name: 'Savings Account',
    type: 'savings',
    balance: 20_000,
    liquidity: 'immediate',
    annualReturnPercent: 3,
    monthlyContribution: 0,
    ...overrides,
  }
}

// ─── Pure detection logic (mirrors SurplusBanner.tsx) ────────────────────────
function detectActionableSnapshot(
  history: MonthSnapshot[],
  today: Date,
): MonthSnapshot | null {
  const currentMonth = today.getMonth()
  const currentYear  = today.getFullYear()

  const candidates = history.filter((h) => {
    if (h.totalIncome === 0) return false   // stub
    if (h.freeCashFlow <= 0) return false   // no surplus
    if (h.surplusActioned)   return false   // already handled
    const d = new Date(h.date)
    return d.getFullYear() < currentYear ||
      (d.getFullYear() === currentYear && d.getMonth() < currentMonth)
  })

  return candidates.length > 0 ? candidates[candidates.length - 1] : null
}

// ─── Pure: markSurplusActioned logic ─────────────────────────────────────────
function markSurplusActioned(
  history: MonthSnapshot[],
  snapshotId: string,
): MonthSnapshot[] {
  return history.map((h) =>
    h.id === snapshotId ? { ...h, surplusActioned: true } : h
  )
}

// ─── Pure: top-up goal ────────────────────────────────────────────────────────
function applyGoalTopUp(goal: Goal, amount: number): Goal {
  return { ...goal, currentAmount: goal.currentAmount + amount }
}

// ─── Pure: deposit to account ─────────────────────────────────────────────────
function applyAccountDeposit(account: SavingsAccount, amount: number): SavingsAccount {
  return { ...account, balance: account.balance + amount }
}

// ─────────────────────────────────────────────────────────────────────────────
const TODAY = new Date(2025, 3, 15) // April 15 2025

// ── detectActionableSnapshot ──────────────────────────────────────────────────
describe('detectActionableSnapshot()', () => {
  it('returns null for empty history', () => {
    expect(detectActionableSnapshot([], TODAY)).toBeNull()
  })

  it('returns null when only current-month snapshot exists', () => {
    const snap = makeSnapshot({ date: '2025-04-01T00:00:00.000Z', label: 'April 2025' })
    expect(detectActionableSnapshot([snap], TODAY)).toBeNull()
  })

  it('returns null when snapshot is from future month', () => {
    const snap = makeSnapshot({ date: '2025-05-01T00:00:00.000Z', label: 'May 2025' })
    expect(detectActionableSnapshot([snap], TODAY)).toBeNull()
  })

  it('returns past-month snapshot with positive FCF', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z', freeCashFlow: 2_000 })
    expect(detectActionableSnapshot([snap], TODAY)).toEqual(snap)
  })

  it('returns null when FCF is zero', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z', freeCashFlow: 0 })
    expect(detectActionableSnapshot([snap], TODAY)).toBeNull()
  })

  it('returns null when FCF is negative', () => {
    const snap = makeSnapshot({ date: '2025-03-01T00:00:00.000Z', freeCashFlow: -500 })
    expect(detectActionableSnapshot([snap], TODAY)).toBeNull()
  })

  it('skips stub snapshots (totalIncome === 0)', () => {
    const stub = makeSnapshot({
      date: '2025-03-01T00:00:00.000Z',
      totalIncome: 0,
      freeCashFlow: 2_000,
    })
    expect(detectActionableSnapshot([stub], TODAY)).toBeNull()
  })

  it('skips already-actioned snapshots', () => {
    const snap = makeSnapshot({
      date: '2025-03-01T00:00:00.000Z',
      freeCashFlow: 2_000,
      surplusActioned: true,
    })
    expect(detectActionableSnapshot([snap], TODAY)).toBeNull()
  })

  it('returns the most recent eligible snapshot when multiple exist', () => {
    const older = makeSnapshot({ id: 'jan', date: '2025-01-01T00:00:00.000Z', freeCashFlow: 1_000 })
    const newer = makeSnapshot({ id: 'mar', date: '2025-03-01T00:00:00.000Z', freeCashFlow: 2_000 })
    const result = detectActionableSnapshot([older, newer], TODAY)
    expect(result!.id).toBe('mar')
  })

  it('ignores actioned snapshots and returns older eligible one', () => {
    const actioned = makeSnapshot({ id: 'mar', date: '2025-03-01T00:00:00.000Z', freeCashFlow: 2_000, surplusActioned: true })
    const eligible = makeSnapshot({ id: 'feb', date: '2025-02-01T00:00:00.000Z', freeCashFlow: 1_500 })
    const result = detectActionableSnapshot([eligible, actioned], TODAY)
    expect(result!.id).toBe('feb')
  })

  it('returns null when all past snapshots are actioned', () => {
    const history = [
      makeSnapshot({ id: 'jan', date: '2025-01-01T00:00:00.000Z', freeCashFlow: 1_000, surplusActioned: true }),
      makeSnapshot({ id: 'feb', date: '2025-02-01T00:00:00.000Z', freeCashFlow: 500,   surplusActioned: true }),
    ]
    expect(detectActionableSnapshot(history, TODAY)).toBeNull()
  })

  it('handles cross-year: Dec 2024 is a past month relative to April 2025', () => {
    const snap = makeSnapshot({ id: 'dec24', date: '2024-12-01T00:00:00.000Z', freeCashFlow: 3_000 })
    expect(detectActionableSnapshot([snap], TODAY)).toEqual(snap)
  })
})

// ── markSurplusActioned ───────────────────────────────────────────────────────
describe('markSurplusActioned()', () => {
  it('sets surplusActioned=true on the target snapshot', () => {
    const history = [makeSnapshot({ id: 'snap1' })]
    const result = markSurplusActioned(history, 'snap1')
    expect(result[0].surplusActioned).toBe(true)
  })

  it('does not mutate other snapshots', () => {
    const history = [
      makeSnapshot({ id: 'snap1' }),
      makeSnapshot({ id: 'snap2', label: 'Feb 2025' }),
    ]
    const result = markSurplusActioned(history, 'snap1')
    expect(result[1].surplusActioned).toBeUndefined()
  })

  it('is idempotent — calling twice has same result', () => {
    const history = [makeSnapshot({ id: 'snap1' })]
    const once  = markSurplusActioned(history, 'snap1')
    const twice = markSurplusActioned(once, 'snap1')
    expect(twice[0].surplusActioned).toBe(true)
  })

  it('no-ops when snapshotId not found', () => {
    const history = [makeSnapshot({ id: 'snap1' })]
    const result = markSurplusActioned(history, 'nonexistent')
    expect(result[0].surplusActioned).toBeUndefined()
  })
})

// ── applyGoalTopUp ────────────────────────────────────────────────────────────
describe('applyGoalTopUp()', () => {
  it('increments currentAmount by the given amount', () => {
    const goal = makeGoal({ currentAmount: 30_000 })
    const result = applyGoalTopUp(goal, 2_000)
    expect(result.currentAmount).toBe(32_000)
  })

  it('does not mutate the original goal', () => {
    const goal = makeGoal({ currentAmount: 30_000 })
    applyGoalTopUp(goal, 1_000)
    expect(goal.currentAmount).toBe(30_000)
  })

  it('can push currentAmount past targetAmount (over-funding allowed)', () => {
    const goal = makeGoal({ currentAmount: 48_000, targetAmount: 50_000 })
    const result = applyGoalTopUp(goal, 5_000)
    expect(result.currentAmount).toBe(53_000)
  })

  it('preserves all other goal fields', () => {
    const goal = makeGoal({ name: 'My Goal', priority: 'low' })
    const result = applyGoalTopUp(goal, 500)
    expect(result.name).toBe('My Goal')
    expect(result.priority).toBe('low')
  })
})

// ── applyAccountDeposit ───────────────────────────────────────────────────────
describe('applyAccountDeposit()', () => {
  it('increments balance by the given amount', () => {
    const account = makeAccount({ balance: 20_000 })
    const result = applyAccountDeposit(account, 2_000)
    expect(result.balance).toBe(22_000)
  })

  it('does not mutate the original account', () => {
    const account = makeAccount({ balance: 20_000 })
    applyAccountDeposit(account, 1_000)
    expect(account.balance).toBe(20_000)
  })

  it('preserves all other account fields', () => {
    const account = makeAccount({ name: 'Emergency', annualReturnPercent: 4.5 })
    const result = applyAccountDeposit(account, 500)
    expect(result.name).toBe('Emergency')
    expect(result.annualReturnPercent).toBe(4.5)
  })

  it('works with fractional amounts', () => {
    const account = makeAccount({ balance: 10_000 })
    const result = applyAccountDeposit(account, 0.5)
    expect(result.balance).toBeCloseTo(10_000.5)
  })
})
