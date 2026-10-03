import type { Goal, GoalPriority, GoalStatus } from '@/types'
import type { StatusTone } from '../ui/status-chip'

/** One status → tone mapping for every goal surface (chip, progress fill). */
export const GOAL_STATUS_TONE: Record<GoalStatus, StatusTone> = {
  realistic: 'success',
  tight: 'warning',
  unrealistic: 'danger',
  blocked: 'danger',
}

export const GOAL_PROGRESS_FILL: Record<GoalStatus, string> = {
  realistic: 'bg-success',
  tight: 'bg-warning',
  unrealistic: 'bg-danger',
  blocked: 'bg-danger',
}

export function goalStatusLabel(status: GoalStatus, lang: 'en' | 'he'): string {
  const labels: Record<GoalStatus, [string, string]> = {
    realistic: ['Realistic', 'ריאלי'],
    tight: ['Tight', 'הדוק'],
    unrealistic: ['Unrealistic', 'לא ריאלי'],
    blocked: ['Blocked', 'חסום'],
  }
  const [en, he] = labels[status]
  return lang === 'he' ? he : en
}

export function goalPriorityLabel(priority: GoalPriority, lang: 'en' | 'he'): string {
  const labels: Record<GoalPriority, [string, string]> = {
    high: ['High', 'גבוה'],
    medium: ['Medium', 'בינוני'],
    low: ['Low', 'נמוך'],
  }
  const [en, he] = labels[priority]
  return lang === 'he' ? he : en
}

export const PRIORITY_BADGE: Record<GoalPriority, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

export interface GoalProgress {
  used: number
  /** currentAmount − usedAmount */
  available: number
  /** targetAmount − usedAmount */
  effectiveTarget: number
  /** 0–100 (100 when the effective target is ≤ 0) */
  pct: number
  /** effectiveTarget − available (may be ≤ 0 when funded) */
  stillNeeded: number
}

/**
 * Progress maths shared by the allocation plan and goal cards.
 * Identical to the v3 inline computation (used amount reduces both sides).
 */
export function computeGoalProgress(goal: Pick<Goal, 'currentAmount' | 'targetAmount' | 'usedAmount'>): GoalProgress {
  const used = goal.usedAmount ?? 0
  const available = goal.currentAmount - used
  const effectiveTarget = goal.targetAmount - used
  const pct = Math.min(100, effectiveTarget > 0 ? (available / effectiveTarget) * 100 : 100)
  return { used, available, effectiveTarget, pct, stillNeeded: effectiveTarget - available }
}
