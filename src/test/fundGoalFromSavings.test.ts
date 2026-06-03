/**
 * Tests for the fundGoalFromSavings method (FinanceContext).
 *
 * The method atomically:
 *   1. Increases goal.currentAmount by `amount` (finds goal by goalId)
 *   2. Decreases account.balance by `amount`, clamped to 0 via Math.max(0, balance - amount)
 *
 * All tests exercise the pure updater function directly — no React rendering required.
 */
import { describe, it, expect } from 'vitest'
import type { FinanceData, Goal, SavingsAccount } from '@/types'

// ─── Pure updater (mirrors the FinanceContext implementation) ─────────────────

function fundGoalFromSavings(
  data: FinanceData,
  goalId: string,
  accountId: string,
  amount: number,
): FinanceData {
  return {
    ...data,
    goals: data.goals.map((g) =>
      g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g,
    ),
    accounts: data.accounts.map((a) =>
      a.id === accountId
        ? { ...a, balance: Math.max(0, a.balance - amount) }
        : a,
    ),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal1',
    name: 'Emergency Fund',
    targetAmount: 50_000,
    currentAmount: 10_000,
    deadline: '2027-12-01',
    priority: 'high',
    notes: '',
    useLiquidSavings: false,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'acc1',
    name: 'Main Savings',
    type: 'savings',
    balance: 20_000,
    liquidity: 'immediate',
    annualReturnPercent: 3,
    monthlyContribution: 500,
    ...overrides,
  }
}

function makeData(
  goals: Goal[],
  accounts: SavingsAccount[],
): FinanceData {
  return {
    members: [],
    expenses: [],
    accounts,
    goals,
    history: [],
    emergencyBufferMonths: 3,
    currency: 'ILS',
    locale: 'he-IL',
    darkMode: false,
    language: 'en',
    categoryBudgets: {},
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fundGoalFromSavings()', () => {
  it('happy path — increases goal.currentAmount and decreases account.balance by the same amount', () => {
    const goal = makeGoal({ currentAmount: 10_000 })
    const account = makeAccount({ balance: 20_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 5_000)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    expect(updatedGoal.currentAmount).toBe(15_000)
    expect(updatedAccount.balance).toBe(15_000)
  })

  it('partial amount — transferring less than full balance works correctly', () => {
    const goal = makeGoal({ currentAmount: 0 })
    const account = makeAccount({ balance: 10_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 1_000)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    expect(updatedGoal.currentAmount).toBe(1_000)
    expect(updatedAccount.balance).toBe(9_000)
  })

  it('full balance — transferring exactly the account balance leaves account at 0', () => {
    const goal = makeGoal({ currentAmount: 5_000 })
    const account = makeAccount({ balance: 8_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 8_000)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    expect(updatedGoal.currentAmount).toBe(13_000)
    expect(updatedAccount.balance).toBe(0)
  })

  it('over-balance clamping — account clamps to 0, goal still receives the full amount', () => {
    const goal = makeGoal({ currentAmount: 2_000 })
    const account = makeAccount({ balance: 3_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 9_999)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    // balance never goes negative
    expect(updatedAccount.balance).toBe(0)
    // goal still gets the full requested amount
    expect(updatedGoal.currentAmount).toBe(11_999)
  })

  it('other goals unchanged — only the target goal is modified', () => {
    const goal1 = makeGoal({ id: 'goal1', name: 'Emergency Fund', currentAmount: 10_000 })
    const goal2 = makeGoal({ id: 'goal2', name: 'Vacation', currentAmount: 3_000 })
    const goal3 = makeGoal({ id: 'goal3', name: 'Car', currentAmount: 7_500 })
    const account = makeAccount({ balance: 20_000 })
    const data = makeData([goal1, goal2, goal3], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 2_000)

    expect(result.goals.find((g) => g.id === 'goal1')!.currentAmount).toBe(12_000)
    expect(result.goals.find((g) => g.id === 'goal2')!.currentAmount).toBe(3_000)
    expect(result.goals.find((g) => g.id === 'goal3')!.currentAmount).toBe(7_500)
  })

  it('other accounts unchanged — only the source account is modified', () => {
    const goal = makeGoal({ currentAmount: 0 })
    const acc1 = makeAccount({ id: 'acc1', name: 'Main Savings', balance: 20_000 })
    const acc2 = makeAccount({ id: 'acc2', name: 'Study Fund', balance: 15_000 })
    const acc3 = makeAccount({ id: 'acc3', name: 'Pension', balance: 50_000 })
    const data = makeData([goal], [acc1, acc2, acc3])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 4_000)

    expect(result.accounts.find((a) => a.id === 'acc1')!.balance).toBe(16_000)
    expect(result.accounts.find((a) => a.id === 'acc2')!.balance).toBe(15_000)
    expect(result.accounts.find((a) => a.id === 'acc3')!.balance).toBe(50_000)
  })

  it('goal at 100%+ — currentAmount can exceed targetAmount (no cap applied)', () => {
    const goal = makeGoal({ targetAmount: 10_000, currentAmount: 9_500 })
    const account = makeAccount({ balance: 5_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 1_000)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    // 9500 + 1000 = 10500, which exceeds targetAmount of 10000 — allowed
    expect(updatedGoal.currentAmount).toBe(10_500)
    expect(updatedGoal.currentAmount).toBeGreaterThan(updatedGoal.targetAmount)
  })

  it('zero amount — both values remain unchanged (no-op)', () => {
    const goal = makeGoal({ currentAmount: 10_000 })
    const account = makeAccount({ balance: 20_000 })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 0)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    expect(updatedGoal.currentAmount).toBe(10_000)
    expect(updatedAccount.balance).toBe(20_000)
  })

  it('does not mutate the original data object', () => {
    const goal = makeGoal({ currentAmount: 5_000 })
    const account = makeAccount({ balance: 10_000 })
    const data = makeData([goal], [account])

    const originalGoalAmount: number = data.goals[0].currentAmount
    const originalBalance: number = data.accounts[0].balance

    fundGoalFromSavings(data, 'goal1', 'acc1', 2_000)

    expect(data.goals[0].currentAmount).toBe(originalGoalAmount)
    expect(data.accounts[0].balance).toBe(originalBalance)
  })

  it('unrelated fields on goal and account are preserved', () => {
    const goal = makeGoal({
      currentAmount: 1_000,
      notes: 'keep me',
      priority: 'low',
      useLiquidSavings: true,
    })
    const account = makeAccount({
      balance: 5_000,
      monthlyContribution: 750,
      annualReturnPercent: 5,
      lastAutoIncrementMonth: '2026-05',
    })
    const data = makeData([goal], [account])

    const result = fundGoalFromSavings(data, 'goal1', 'acc1', 500)

    const updatedGoal = result.goals.find((g) => g.id === 'goal1')!
    const updatedAccount = result.accounts.find((a) => a.id === 'acc1')!

    expect(updatedGoal.notes).toBe('keep me')
    expect(updatedGoal.priority).toBe('low')
    expect(updatedGoal.useLiquidSavings).toBe(true)
    expect(updatedAccount.monthlyContribution).toBe(750)
    expect(updatedAccount.annualReturnPercent).toBe(5)
    expect(updatedAccount.lastAutoIncrementMonth).toBe('2026-05')
  })
})
