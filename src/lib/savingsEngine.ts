import type { Goal, GoalAllocation, GoalStatus, SavingsAccount } from '@/types'
import { monthsUntil } from './utils'

interface EngineInput {
  goals: Goal[]
  monthlySurplus: number
  accounts: SavingsAccount[]
  emergencyBufferMonths: number
  monthlyExpenses: number
}

function liquidBalance(accounts: SavingsAccount[]): number {
  return accounts
    .filter((a) => a.liquidity === 'immediate' || a.liquidity === 'short')
    .reduce((s, a) => s + a.balance, 0)
}

export function allocateGoals(input: EngineInput): GoalAllocation[] {
  const { goals, monthlySurplus, accounts, emergencyBufferMonths, monthlyExpenses } = input

  const emergencyBuffer = emergencyBufferMonths * monthlyExpenses
  const liquidAvail = Math.max(0, liquidBalance(accounts) - emergencyBuffer)

  let remainingSurplus = monthlySurplus
  const allocations: GoalAllocation[] = []

  for (const goal of goals) {
    const months = monthsUntil(goal.deadline)
    const needed = Math.max(0, goal.targetAmount - goal.currentAmount)
    const liquidHelp = goal.useLiquidSavings ? Math.min(liquidAvail, needed) : 0
    const stillNeeded = needed - liquidHelp

    let monthlyRecommended = 0
    let status: GoalStatus = 'blocked'
    let gap = 0

    if (stillNeeded <= 0) {
      status = 'realistic'
      monthlyRecommended = 0
    } else if (months === 0) {
      status = 'blocked'
      gap = stillNeeded
      monthlyRecommended = stillNeeded
    } else {
      monthlyRecommended = stillNeeded / months

      if (monthlyRecommended <= remainingSurplus) {
        if (monthlyRecommended <= remainingSurplus * 0.5 || months >= 24) {
          status = 'realistic'
        } else {
          status = 'tight'
        }
        remainingSurplus -= monthlyRecommended
      } else {
        const feasible = remainingSurplus
        gap = monthlyRecommended - feasible
        status = feasible > 0 ? 'unrealistic' : 'blocked'
        monthlyRecommended = monthlyRecommended
        remainingSurplus = 0
      }
    }

    const monthsNeeded = monthlyRecommended > 0 ? Math.ceil(stillNeeded / monthlyRecommended) : 0

    allocations.push({
      ...goal,
      status,
      monthlyRecommended,
      monthsNeeded,
      gap,
    })
  }

  return allocations
}

export function autoAllocateSavings(
  goals: GoalAllocation[],
  freeCashFlow: number,
): GoalAllocation[] {
  const priorityOrder: Record<GoalAllocation['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  // Build an index to restore original order
  const withIndex = goals.map((g, i) => ({ goal: g, originalIndex: i }))

  // Group by priority tier
  const tiers: Array<Array<{ goal: GoalAllocation; originalIndex: number }>> = [[], [], []]
  for (const item of withIndex) {
    tiers[priorityOrder[item.goal.priority]].push(item)
  }

  // Allocate per tier
  const result: Array<{ goal: GoalAllocation; originalIndex: number }> = []
  let remainingFCF = Math.max(0, freeCashFlow)

  for (const tier of tiers) {
    if (tier.length === 0) continue
    const tierSum = tier.reduce((s, { goal }) => s + goal.monthlyRecommended, 0)

    for (const { goal, originalIndex } of tier) {
      let allocated: number
      if (remainingFCF >= tierSum) {
        allocated = goal.monthlyRecommended
      } else if (tierSum > 0) {
        allocated = (goal.monthlyRecommended / tierSum) * remainingFCF
      } else {
        allocated = 0
      }

      let status: GoalStatus
      if (allocated >= goal.monthlyRecommended) {
        status = goal.status
      } else if (allocated > 0) {
        status = 'tight'
      } else {
        status = 'blocked'
      }

      result.push({
        goal: { ...goal, monthlyAllocated: allocated, status },
        originalIndex,
      })
    }

    // Subtract the tier's actual draw from remaining FCF
    const tierDraw = Math.min(tierSum, remainingFCF)
    remainingFCF = Math.max(0, remainingFCF - tierDraw)
  }

  // Restore original order
  result.sort((a, b) => a.originalIndex - b.originalIndex)
  return result.map(({ goal }) => goal)
}
