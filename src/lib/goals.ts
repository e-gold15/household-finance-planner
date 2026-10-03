import type { Goal } from '@/types'

/**
 * v4.1 — a goal is "done" when the user marked it complete (`completedAt` set).
 * Goals without `completedAt` (all legacy goals) are active.
 */
export function isGoalDone(goal: Pick<Goal, 'completedAt'>): boolean {
  return !!goal.completedAt
}

/** Active (not done) goals, in their stored order. Never mutates the input. */
export function activeGoals<T extends Pick<Goal, 'completedAt'>>(goals: readonly T[]): T[] {
  return goals.filter((g) => !isGoalDone(g))
}

/** Done goals, in their stored order. Never mutates the input. */
export function completedGoals<T extends Pick<Goal, 'completedAt'>>(goals: readonly T[]): T[] {
  return goals.filter(isGoalDone)
}

/** Copy of the stored goal marked as done. Only `completedAt` changes. */
export function markGoalDone(goal: Goal, now: Date = new Date()): Goal {
  return { ...goal, completedAt: now.toISOString() }
}

/** Copy of the stored goal with `completedAt` removed. Every other field is kept as-is. */
export function reopenGoal(goal: Goal): Goal {
  const { completedAt: _completedAt, ...rest } = goal
  return rest
}

/**
 * Number of single-step `moveGoal` swaps needed to move an active goal past its
 * adjacent active neighbour, skipping over hidden done goals in the stored array.
 * Returns 0 when there is no active neighbour in that direction.
 */
export function moveStepsPastHidden(goals: readonly Goal[], id: string, direction: 'up' | 'down'): number {
  const idx = goals.findIndex((g) => g.id === id)
  if (idx === -1) return 0
  if (direction === 'up') {
    for (let i = idx - 1; i >= 0; i--) if (!isGoalDone(goals[i])) return idx - i
  } else {
    for (let i = idx + 1; i < goals.length; i++) if (!isGoalDone(goals[i])) return i - idx
  }
  return 0
}
