/**
 * Tests for the `usedAmount` calculations on the Goal interface (v3.3).
 *
 * These are pure logic tests that mirror the derivations in Goals.tsx:
 *   const usedAmt   = goal.usedAmount ?? 0
 *   const available = goal.currentAmount - usedAmt
 *   const pct       = Math.min(100, goal.targetAmount > 0 ? (available / goal.targetAmount) * 100 : 0)
 *   const stillNeeded = goal.targetAmount - available   // show only when > 0
 *
 * And the form-level validation rule:
 *   usedAmount > currentAmount → error (invalid — cannot spend more than saved)
 */
import { describe, it, expect } from 'vitest'
import type { Goal } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-test',
    name: 'Test Goal',
    targetAmount: 10_000,
    currentAmount: 5_000,
    deadline: '2027-01-01',
    priority: 'medium',
    notes: '',
    useLiquidSavings: false,
    ...overrides,
  }
}

/** Mirrors the derivation block in Goals.tsx (goal card view). */
function derive(goal: Goal) {
  const usedAmt: number = goal.usedAmount ?? 0
  const available: number = goal.currentAmount - usedAmt
  const pct: number = Math.min(
    100,
    goal.targetAmount > 0 ? (available / goal.targetAmount) * 100 : 0,
  )
  const stillNeeded: number = goal.targetAmount - available
  return { usedAmt, available, pct, stillNeeded }
}

/** Mirrors the allocation-table derivation (goalAvailable, same logic). */
function deriveAllocation(goal: Goal) {
  const goalUsed: number = goal.usedAmount ?? 0
  const goalAvailable: number = goal.currentAmount - goalUsed
  const pct: number = Math.min(
    100,
    goal.targetAmount > 0 ? (goalAvailable / goal.targetAmount) * 100 : 0,
  )
  return { goalUsed, goalAvailable, pct }
}

/** Mirrors the form validation in Goals.tsx. */
function validateUsedAmount(usedAmount: number | undefined, currentAmount: number): boolean {
  return (usedAmount ?? 0) > currentAmount
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('goal usedAmount — derived values', () => {
  // ── Case 1: No usedAmount field ──────────────────────────────────────────

  it('available equals currentAmount when usedAmount is absent', () => {
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 10_000 })
    const { available } = derive(goal)
    expect(available).toBe(5_000)
  })

  it('usedAmt defaults to 0 when usedAmount is absent', () => {
    const goal = makeGoal()
    const { usedAmt } = derive(goal)
    expect(usedAmt).toBe(0)
  })

  it('pct is based on currentAmount when usedAmount is absent', () => {
    // currentAmount=5000, targetAmount=10000 → 50%
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 10_000 })
    const { pct } = derive(goal)
    expect(pct).toBe(50)
  })

  // ── Case 2: usedAmount explicitly set to 0 ───────────────────────────────

  it('available equals currentAmount when usedAmount is 0', () => {
    const goal = makeGoal({ currentAmount: 8_000, targetAmount: 20_000, usedAmount: 0 })
    const { available } = derive(goal)
    expect(available).toBe(8_000)
  })

  it('pct is identical whether usedAmount is 0 or absent', () => {
    const withAbsent = makeGoal({ currentAmount: 6_000, targetAmount: 12_000 })
    const withZero   = makeGoal({ currentAmount: 6_000, targetAmount: 12_000, usedAmount: 0 })
    expect(derive(withAbsent).pct).toBe(derive(withZero).pct)
  })

  // ── Case 3: Partial use ──────────────────────────────────────────────────

  it('available is currentAmount minus usedAmount when partially used', () => {
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 20_000, usedAmount: 3_000 })
    const { available } = derive(goal)
    expect(available).toBe(7_000)
  })

  it('pct is (available / targetAmount) * 100 when partially used', () => {
    // available=7000, targetAmount=20000 → 35%
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 20_000, usedAmount: 3_000 })
    const { pct } = derive(goal)
    expect(pct).toBe(35)
  })

  it('stillNeeded is targetAmount minus available when partially used', () => {
    // targetAmount=20000, available=7000 → stillNeeded=13000
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 20_000, usedAmount: 3_000 })
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBe(13_000)
  })

  it('stillNeeded is positive, so the "still needed" label should be shown', () => {
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 20_000, usedAmount: 3_000 })
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBeGreaterThan(0)
  })

  // ── Case 4: Full use (usedAmount = currentAmount) ────────────────────────

  it('available is 0 when usedAmount equals currentAmount', () => {
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 10_000, usedAmount: 5_000 })
    const { available } = derive(goal)
    expect(available).toBe(0)
  })

  it('pct is 0 when usedAmount equals currentAmount', () => {
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 10_000, usedAmount: 5_000 })
    const { pct } = derive(goal)
    expect(pct).toBe(0)
  })

  it('stillNeeded equals targetAmount when usedAmount equals currentAmount', () => {
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 10_000, usedAmount: 5_000 })
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBe(10_000)
  })

  // ── Case 5: pct capped at 100 ────────────────────────────────────────────

  it('pct is capped at 100 when available exceeds targetAmount', () => {
    // currentAmount=15000, usedAmount=0, targetAmount=10000 → would be 150%, capped to 100
    const goal = makeGoal({ currentAmount: 15_000, targetAmount: 10_000, usedAmount: 0 })
    const { pct } = derive(goal)
    expect(pct).toBe(100)
  })

  it('pct is capped at 100 even after partial use if available still exceeds target', () => {
    // currentAmount=20000, usedAmount=2000, available=18000, targetAmount=10000 → still >100%, capped
    const goal = makeGoal({ currentAmount: 20_000, targetAmount: 10_000, usedAmount: 2_000 })
    const { pct } = derive(goal)
    expect(pct).toBe(100)
  })

  it('pct is exactly 100 when available equals targetAmount', () => {
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 10_000, usedAmount: 0 })
    const { pct } = derive(goal)
    expect(pct).toBe(100)
  })

  // ── Case 6: stillNeeded positive → show label ────────────────────────────

  it('stillNeeded is positive when available is less than targetAmount', () => {
    const goal = makeGoal({ currentAmount: 3_000, targetAmount: 10_000, usedAmount: 500 })
    // available=2500, stillNeeded=7500
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBeGreaterThan(0)
    expect(stillNeeded).toBe(7_500)
  })

  // ── Case 7: stillNeeded zero/negative → do NOT show label ────────────────

  it('stillNeeded is 0 when available equals targetAmount exactly', () => {
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 10_000, usedAmount: 0 })
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBe(0)
    // The component renders stillNeeded only when > 0, so 0 means hidden
    expect(stillNeeded > 0).toBe(false)
  })

  it('stillNeeded is negative when available exceeds targetAmount', () => {
    const goal = makeGoal({ currentAmount: 12_000, targetAmount: 10_000, usedAmount: 0 })
    const { stillNeeded } = derive(goal)
    expect(stillNeeded).toBeLessThan(0)
    // The component renders stillNeeded only when > 0, so negative means hidden
    expect(stillNeeded > 0).toBe(false)
  })

  it('stillNeeded display guard: not shown when goal is exactly funded', () => {
    const goal = makeGoal({ currentAmount: 10_000, targetAmount: 10_000, usedAmount: 0 })
    const { stillNeeded } = derive(goal)
    const shouldShow = stillNeeded > 0
    expect(shouldShow).toBe(false)
  })

  it('stillNeeded display guard: not shown when goal is overfunded', () => {
    const goal = makeGoal({ currentAmount: 15_000, targetAmount: 10_000, usedAmount: 0 })
    const { stillNeeded } = derive(goal)
    const shouldShow = stillNeeded > 0
    expect(shouldShow).toBe(false)
  })
})

// ─── Validation tests ─────────────────────────────────────────────────────────

describe('goal usedAmount — form validation', () => {
  // ── Case 8: usedAmount cannot exceed currentAmount ───────────────────────

  it('validation passes when usedAmount is less than currentAmount', () => {
    const isError = validateUsedAmount(3_000, 5_000)
    expect(isError).toBe(false)
  })

  it('validation passes when usedAmount equals currentAmount', () => {
    const isError = validateUsedAmount(5_000, 5_000)
    expect(isError).toBe(false)
  })

  it('validation fails when usedAmount exceeds currentAmount', () => {
    const isError = validateUsedAmount(6_000, 5_000)
    expect(isError).toBe(true)
  })

  it('validation passes when usedAmount is 0 and currentAmount is 0', () => {
    const isError = validateUsedAmount(0, 0)
    expect(isError).toBe(false)
  })

  it('validation fails when usedAmount is positive but currentAmount is 0', () => {
    const isError = validateUsedAmount(1, 0)
    expect(isError).toBe(true)
  })

  it('validation passes when usedAmount is absent (treated as 0)', () => {
    const isError = validateUsedAmount(undefined, 5_000)
    expect(isError).toBe(false)
  })

  it('validation passes when usedAmount is absent and currentAmount is 0', () => {
    const isError = validateUsedAmount(undefined, 0)
    expect(isError).toBe(false)
  })
})

// ─── Allocation-table derivation (goalAvailable alias) ───────────────────────

describe('goal usedAmount — allocation table derivation', () => {
  it('goalAvailable equals currentAmount when usedAmount is absent', () => {
    const goal = makeGoal({ currentAmount: 8_000, targetAmount: 16_000 })
    const { goalAvailable } = deriveAllocation(goal)
    expect(goalAvailable).toBe(8_000)
  })

  it('goalAvailable equals currentAmount minus usedAmount when set', () => {
    const goal = makeGoal({ currentAmount: 8_000, targetAmount: 16_000, usedAmount: 2_000 })
    const { goalAvailable } = deriveAllocation(goal)
    expect(goalAvailable).toBe(6_000)
  })

  it('goalUsed is 0 when usedAmount is absent', () => {
    const goal = makeGoal()
    const { goalUsed } = deriveAllocation(goal)
    expect(goalUsed).toBe(0)
  })

  it('allocation pct is capped at 100 when goalAvailable exceeds targetAmount', () => {
    const goal = makeGoal({ currentAmount: 20_000, targetAmount: 10_000, usedAmount: 0 })
    const { pct } = deriveAllocation(goal)
    expect(pct).toBe(100)
  })

  it('allocation pct is 0 when targetAmount is 0 (guard against division by zero)', () => {
    const goal = makeGoal({ currentAmount: 5_000, targetAmount: 0, usedAmount: 0 })
    const { pct } = deriveAllocation(goal)
    expect(pct).toBe(0)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('goal usedAmount — edge cases', () => {
  it('pct is 0 when targetAmount is 0 (no division by zero)', () => {
    const goal = makeGoal({ currentAmount: 0, targetAmount: 0, usedAmount: 0 })
    const { pct } = derive(goal)
    expect(pct).toBe(0)
  })

  it('available is 0 when both currentAmount and usedAmount are 0', () => {
    const goal = makeGoal({ currentAmount: 0, targetAmount: 10_000, usedAmount: 0 })
    const { available } = derive(goal)
    expect(available).toBe(0)
  })

  it('pct is 0 when currentAmount is 0 and usedAmount is absent', () => {
    const goal = makeGoal({ currentAmount: 0, targetAmount: 10_000 })
    const { pct } = derive(goal)
    expect(pct).toBe(0)
  })

  it('derived values are consistent between card view and allocation table', () => {
    // Both code paths must yield the same available and pct
    const goal = makeGoal({ currentAmount: 7_500, targetAmount: 15_000, usedAmount: 2_500 })
    const card  = derive(goal)
    const alloc = deriveAllocation(goal)
    expect(card.available).toBe(alloc.goalAvailable)
    expect(card.pct).toBe(alloc.pct)
  })

  it('backward-compatible: legacy goal object without usedAmount field behaves correctly', () => {
    // Simulate a goal stored before usedAmount was added (field is absent, not 0)
    const legacyGoal = {
      id: 'legacy-1',
      name: 'Old Goal',
      targetAmount: 20_000,
      currentAmount: 10_000,
      deadline: '2027-06-01',
      priority: 'high' as const,
      notes: '',
      useLiquidSavings: false,
      // usedAmount intentionally omitted
    } as Goal

    const { usedAmt, available, pct } = derive(legacyGoal)
    expect(usedAmt).toBe(0)
    expect(available).toBe(10_000)
    expect(pct).toBe(50)
  })
})
