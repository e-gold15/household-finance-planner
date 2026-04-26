import { describe, it, expect } from 'vitest'
import { autoAllocateSavings } from '@/lib/savingsEngine'
import type { GoalAllocation } from '@/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<GoalAllocation>): GoalAllocation {
  return {
    id: 'g1',
    name: 'Goal',
    targetAmount: 10_000,
    currentAmount: 0,
    deadline: '2027-01-01',
    priority: 'medium',
    notes: '',
    useLiquidSavings: false,
    status: 'realistic',
    monthlyRecommended: 500,
    monthsNeeded: 20,
    gap: 0,
    ...overrides,
  }
}

// ─── Fully funded ──────────────────────────────────────────────────────────

describe('autoAllocateSavings() — all goals fully funded', () => {
  it('gives each goal its full monthlyRecommended when FCF covers all', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 300 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 200 }),
      makeGoal({ id: 'g3', priority: 'low', monthlyRecommended: 100 }),
    ]
    const result = autoAllocateSavings(goals, 1_000)

    expect(result[0].monthlyAllocated).toBe(300)
    expect(result[1].monthlyAllocated).toBe(200)
    expect(result[2].monthlyAllocated).toBe(100)
  })

  it('keeps original status when each goal is fully allocated', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 400, status: 'realistic' }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 200, status: 'tight' }),
    ]
    const result = autoAllocateSavings(goals, 1_000)

    expect(result[0].status).toBe('realistic')
    expect(result[1].status).toBe('tight')
  })
})

// ─── FCF = 0 ───────────────────────────────────────────────────────────────

describe('autoAllocateSavings() — zero FCF', () => {
  it('sets monthlyAllocated = 0 for all goals when FCF is 0', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 500 }),
      makeGoal({ id: 'g2', priority: 'low', monthlyRecommended: 200 }),
    ]
    const result = autoAllocateSavings(goals, 0)

    expect(result[0].monthlyAllocated).toBe(0)
    expect(result[1].monthlyAllocated).toBe(0)
  })

  it('sets status = blocked for all goals when FCF is 0', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 500 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 300 }),
    ]
    const result = autoAllocateSavings(goals, 0)

    expect(result[0].status).toBe('blocked')
    expect(result[1].status).toBe('blocked')
  })
})

// ─── High fully funded, medium partially funded ────────────────────────────

describe('autoAllocateSavings() — high funded, medium pro-rated', () => {
  it('fully funds high tier then pro-rates medium when FCF is insufficient for medium', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 400 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 600 }),
      makeGoal({ id: 'g3', priority: 'medium', monthlyRecommended: 400 }),
    ]
    // FCF = 700 → 400 consumed by high → 300 left for medium (600+400=1000 needed)
    // g2 gets 300 * (600/1000) = 180, g3 gets 300 * (400/1000) = 120
    const result = autoAllocateSavings(goals, 700)

    expect(result[0].monthlyAllocated).toBe(400) // high fully funded
    expect(result[1].monthlyAllocated).toBeCloseTo(180, 1)
    expect(result[2].monthlyAllocated).toBeCloseTo(120, 1)
  })

  it('sets status=tight on partially funded medium goals', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 400 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 600 }),
    ]
    const result = autoAllocateSavings(goals, 700) // 300 left for medium after high

    expect(result[1].status).toBe('tight')
  })
})

// ─── High tier insufficient ────────────────────────────────────────────────

describe('autoAllocateSavings() — high tier insufficient', () => {
  it('pro-rates high goals and blocks medium + low when FCF cannot cover high tier', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 800 }),
      makeGoal({ id: 'g2', priority: 'high', monthlyRecommended: 400 }),
      makeGoal({ id: 'g3', priority: 'medium', monthlyRecommended: 300 }),
      makeGoal({ id: 'g4', priority: 'low', monthlyRecommended: 200 }),
    ]
    // FCF = 600 → high tier needs 1200 → pro-rate: g1=400, g2=200 → nothing left
    const result = autoAllocateSavings(goals, 600)

    expect(result[0].monthlyAllocated).toBeCloseTo(400, 1)
    expect(result[1].monthlyAllocated).toBeCloseTo(200, 1)
    expect(result[2].monthlyAllocated).toBe(0)
    expect(result[3].monthlyAllocated).toBe(0)
    expect(result[2].status).toBe('blocked')
    expect(result[3].status).toBe('blocked')
  })
})

// ─── Only medium goals ─────────────────────────────────────────────────────

describe('autoAllocateSavings() — only medium goals', () => {
  it('fully funds all medium goals when FCF covers them', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'medium', monthlyRecommended: 300 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 200 }),
    ]
    const result = autoAllocateSavings(goals, 600)

    expect(result[0].monthlyAllocated).toBe(300)
    expect(result[1].monthlyAllocated).toBe(200)
  })

  it('blocks all medium goals when FCF is insufficient for any', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'medium', monthlyRecommended: 500 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 500 }),
    ]
    const result = autoAllocateSavings(goals, 0)

    expect(result[0].status).toBe('blocked')
    expect(result[1].status).toBe('blocked')
  })
})

// ─── Pro-rating within a tier ──────────────────────────────────────────────

describe('autoAllocateSavings() — pro-rating within a tier', () => {
  it('pro-rates proportionally: A needs 1000, B needs 500, FCF=750 → A gets 500, B gets 250', () => {
    const goals = [
      makeGoal({ id: 'gA', priority: 'medium', monthlyRecommended: 1_000 }),
      makeGoal({ id: 'gB', priority: 'medium', monthlyRecommended: 500 }),
    ]
    const result = autoAllocateSavings(goals, 750)

    expect(result[0].monthlyAllocated).toBeCloseTo(500, 5)
    expect(result[1].monthlyAllocated).toBeCloseTo(250, 5)
  })
})

// ─── Status derivation ─────────────────────────────────────────────────────

describe('autoAllocateSavings() — status derivation', () => {
  it('sets status=tight when partially allocated (> 0 but < monthlyRecommended)', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 1_000 }),
    ]
    const result = autoAllocateSavings(goals, 500)

    expect(result[0].monthlyAllocated).toBeCloseTo(500, 5)
    expect(result[0].status).toBe('tight')
  })

  it('sets status=blocked when monthlyAllocated is 0', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'low', monthlyRecommended: 500 }),
    ]
    const result = autoAllocateSavings(goals, 0)

    expect(result[0].monthlyAllocated).toBe(0)
    expect(result[0].status).toBe('blocked')
  })
})

// ─── Output order ──────────────────────────────────────────────────────────

describe('autoAllocateSavings() — output order', () => {
  it('preserves input order — high goal listed second still appears second', () => {
    const goals = [
      makeGoal({ id: 'low-first', priority: 'low', monthlyRecommended: 100 }),
      makeGoal({ id: 'high-second', priority: 'high', monthlyRecommended: 300 }),
    ]
    const result = autoAllocateSavings(goals, 1_000)

    expect(result[0].id).toBe('low-first')
    expect(result[1].id).toBe('high-second')
  })

  it('funds high before low regardless of input order but keeps output order unchanged', () => {
    // Input order: low, medium, high — high still funded first by priority
    const goals = [
      makeGoal({ id: 'low', priority: 'low', monthlyRecommended: 200 }),
      makeGoal({ id: 'med', priority: 'medium', monthlyRecommended: 300 }),
      makeGoal({ id: 'high', priority: 'high', monthlyRecommended: 400 }),
    ]
    // FCF = 500: enough for high (400) + 100 left → medium gets 100 (tight), low gets 0 (blocked)
    const result = autoAllocateSavings(goals, 500)

    // Output positions match input
    expect(result[0].id).toBe('low')
    expect(result[1].id).toBe('med')
    expect(result[2].id).toBe('high')

    // But allocation respects priority order
    expect(result[2].monthlyAllocated).toBe(400)  // high fully funded
    expect(result[1].monthlyAllocated).toBeCloseTo(100, 5) // medium gets remainder
    expect(result[0].monthlyAllocated).toBe(0)    // low blocked
  })
})

// ─── FCF exactly covers high + medium ─────────────────────────────────────

describe('autoAllocateSavings() — FCF exactly covers high + medium', () => {
  it('fully funds high and medium, blocks low when FCF exactly covers first two tiers', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 300 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 200 }),
      makeGoal({ id: 'g3', priority: 'low', monthlyRecommended: 150 }),
    ]
    const result = autoAllocateSavings(goals, 500) // exactly 300 + 200

    expect(result[0].monthlyAllocated).toBe(300)
    expect(result[1].monthlyAllocated).toBe(200)
    expect(result[2].monthlyAllocated).toBe(0)
    expect(result[2].status).toBe('blocked')
  })
})

// ─── Edge cases ────────────────────────────────────────────────────────────

describe('autoAllocateSavings() — edge cases', () => {
  it('returns empty array when goals array is empty', () => {
    const result = autoAllocateSavings([], 5_000)
    expect(result).toHaveLength(0)
  })

  it('fully funds a single goal and preserves its original status', () => {
    const goal = makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 500, status: 'realistic' })
    const [result] = autoAllocateSavings([goal], 1_000)

    expect(result.monthlyAllocated).toBe(500)
    expect(result.status).toBe('realistic')
  })

  it('treats negative FCF as 0 — all goals blocked', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 500 }),
      makeGoal({ id: 'g2', priority: 'medium', monthlyRecommended: 300 }),
    ]
    const result = autoAllocateSavings(goals, -500)

    expect(result[0].monthlyAllocated).toBe(0)
    expect(result[1].monthlyAllocated).toBe(0)
    expect(result[0].status).toBe('blocked')
    expect(result[1].status).toBe('blocked')
  })

  it('does not mutate the input array or its elements', () => {
    const goals = [
      makeGoal({ id: 'g1', priority: 'high', monthlyRecommended: 400, status: 'realistic' }),
      makeGoal({ id: 'g2', priority: 'low', monthlyRecommended: 200, status: 'tight' }),
    ]
    const originalLength = goals.length
    const originalG1Status = goals[0].status
    const originalG2Status = goals[1].status

    autoAllocateSavings(goals, 300)

    expect(goals).toHaveLength(originalLength)
    expect(goals[0].status).toBe(originalG1Status)
    expect(goals[1].status).toBe(originalG2Status)
    // monthlyAllocated should not have been written back to input objects
    expect((goals[0] as GoalAllocation & { monthlyAllocated?: number }).monthlyAllocated).toBeUndefined()
  })
})
