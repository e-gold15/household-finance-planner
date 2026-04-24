import { describe, it, expect } from 'vitest'
import { allocateGoals } from '@/lib/savingsEngine'
import type { Goal, SavingsAccount } from '@/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Test Goal',
    targetAmount: 100_000,
    currentAmount: 0,
    deadline: futureDate(24),
    priority: 'high',
    notes: '',
    useLiquidSavings: false,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Savings',
    type: 'savings',
    balance: 50_000,
    liquidity: 'immediate',
    annualReturnPercent: 3,
    monthlyContribution: 1_000,
    ...overrides,
  }
}

/** Returns an ISO date string N months from now */
function futureDate(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

// ─── Already funded ────────────────────────────────────────────────────────

describe('allocateGoals() — fully funded', () => {
  it('marks a goal as realistic when currentAmount >= targetAmount', () => {
    const goal = makeGoal({ targetAmount: 10_000, currentAmount: 10_000 })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 5_000,
      accounts: [],
      emergencyBufferMonths: 3,
      monthlyExpenses: 5_000,
    })
    expect(result.status).toBe('realistic')
    expect(result.monthlyRecommended).toBe(0)
    expect(result.gap).toBe(0)
  })
})

// ─── Realistic allocation ──────────────────────────────────────────────────

describe('allocateGoals() — realistic', () => {
  it('marks goal realistic when surplus covers monthly requirement', () => {
    const goal = makeGoal({ targetAmount: 24_000, currentAmount: 0, deadline: futureDate(24) })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 2_000,
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    // 24000 / 24 = 1000/month needed, surplus is 2000 — realistic
    expect(result.monthlyRecommended).toBeCloseTo(1_000, 0)
    expect(result.status).toBe('realistic')
    expect(result.gap).toBe(0)
  })
})

// ─── Unrealistic allocation ────────────────────────────────────────────────

describe('allocateGoals() — unrealistic', () => {
  it('marks goal unrealistic when surplus is insufficient', () => {
    const goal = makeGoal({ targetAmount: 120_000, currentAmount: 0, deadline: futureDate(12) })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 5_000, // needs 10,000/month but only 5,000 available
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(result.status).toBe('unrealistic')
    expect(result.gap).toBeGreaterThan(0)
  })
})

// ─── Blocked ───────────────────────────────────────────────────────────────

describe('allocateGoals() — blocked', () => {
  it('marks goal blocked when deadline has passed', () => {
    const goal = makeGoal({ deadline: '2000-01-01', targetAmount: 10_000, currentAmount: 0 })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 10_000,
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(result.status).toBe('blocked')
  })

  it('marks goal blocked when no surplus left', () => {
    const goal1 = makeGoal({ targetAmount: 60_000, deadline: futureDate(12), name: 'G1' })
    const goal2 = makeGoal({ targetAmount: 60_000, deadline: futureDate(12), name: 'G2' })
    const results = allocateGoals({
      goals: [goal1, goal2],
      monthlySurplus: 5_000, // exactly covers goal1, nothing left for goal2
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(results[1].status).toBe('blocked')
  })
})

// ─── Liquid savings ────────────────────────────────────────────────────────

describe('allocateGoals() — liquid savings', () => {
  it('uses liquid savings to reduce monthly requirement', () => {
    const goal = makeGoal({ targetAmount: 50_000, currentAmount: 0, useLiquidSavings: true })
    const account = makeAccount({ balance: 50_000, liquidity: 'immediate' })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 0,
      accounts: [account],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    // Liquid savings fully covers the goal
    expect(result.status).toBe('realistic')
    expect(result.monthlyRecommended).toBe(0)
  })

  it('does not use locked accounts as liquid', () => {
    const goal = makeGoal({ targetAmount: 50_000, useLiquidSavings: true })
    const account = makeAccount({ balance: 100_000, liquidity: 'locked' })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 500,
      accounts: [account],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    // Locked account should not be used — goal needs monthly contributions
    expect(result.monthlyRecommended).toBeGreaterThan(0)
  })

  it('respects emergency buffer before using liquid savings', () => {
    const goal = makeGoal({ targetAmount: 50_000, useLiquidSavings: true })
    const account = makeAccount({ balance: 50_000, liquidity: 'immediate' })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 0,
      accounts: [account],
      emergencyBufferMonths: 6,
      monthlyExpenses: 10_000, // buffer = 60,000 > 50,000 balance → no liquid help
    })
    // Emergency buffer (60k) > account balance (50k) → no liquid savings available
    expect(result.monthlyRecommended).toBeGreaterThan(0)
  })
})

// ─── Multiple goals ────────────────────────────────────────────────────────

describe('allocateGoals() — multiple goals', () => {
  it('allocates surplus across multiple goals in order', () => {
    const g1 = makeGoal({ name: 'G1', targetAmount: 12_000, deadline: futureDate(12) })
    const g2 = makeGoal({ name: 'G2', targetAmount: 12_000, deadline: futureDate(12) })
    const results = allocateGoals({
      goals: [g1, g2],
      monthlySurplus: 3_000,
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(results).toHaveLength(2)
    // Both goals need 1000/month, total 2000 < 3000 surplus
    expect(results[0].status).toBe('realistic')
    expect(results[1].status).toBe('realistic')
  })

  it('returns correct number of allocations', () => {
    const goals = [makeGoal(), makeGoal(), makeGoal()]
    const results = allocateGoals({
      goals,
      monthlySurplus: 10_000,
      accounts: [],
      emergencyBufferMonths: 3,
      monthlyExpenses: 3_000,
    })
    expect(results).toHaveLength(3)
  })

  it('preserves goal data in allocation result', () => {
    const goal = makeGoal({ name: 'My Goal', targetAmount: 50_000, notes: 'For vacation' })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 5_000,
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(result.name).toBe('My Goal')
    expect(result.targetAmount).toBe(50_000)
    expect(result.notes).toBe('For vacation')
  })
})

// ─── Edge cases ────────────────────────────────────────────────────────────

describe('allocateGoals() — edge cases', () => {
  it('handles empty goals list', () => {
    const results = allocateGoals({
      goals: [],
      monthlySurplus: 5_000,
      accounts: [],
      emergencyBufferMonths: 3,
      monthlyExpenses: 1_000,
    })
    expect(results).toHaveLength(0)
  })

  it('handles zero monthly surplus', () => {
    const goal = makeGoal({ targetAmount: 10_000 })
    const [result] = allocateGoals({
      goals: [goal],
      monthlySurplus: 0,
      accounts: [],
      emergencyBufferMonths: 0,
      monthlyExpenses: 0,
    })
    expect(result.status).toBe('blocked')
  })
})
