/**
 * v4.1 — Mark a goal as done (spec: docs/v4/spec-v4.1-goal-done-and-nav.md).
 *
 * Data contract: the only model change is the optional `Goal.completedAt`.
 * Marking done / reopening never changes goals.length or any other field,
 * mergeFinanceData carries `completedAt` inside the goal object, and every
 * edit path keeps it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { FinanceData, Goal } from '@/types'
import {
  activeGoals,
  completedGoals,
  isGoalDone,
  markGoalDone,
  moveStepsPastHidden,
  reopenGoal,
} from '@/lib/goals'
import { mergeFinanceData } from '@/lib/cloudFinance'
import { allocateGoals } from '@/lib/savingsEngine'
import { buildInsights, computeMonthlyPlan } from '@/lib/insights'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    name: 'Vacation',
    targetAmount: 10000,
    currentAmount: 4000,
    usedAmount: 500,
    deadline: '2030-01-01',
    priority: 'high',
    notes: 'Greece',
    useLiquidSavings: true,
    ...overrides,
  }
}

const DONE_AT = '2026-09-15T10:00:00.000Z'

function makeData(goals: Goal[], overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    members: [],
    expenses: [],
    accounts: [],
    goals,
    history: [],
    emergencyBufferMonths: 3,
    currency: 'ILS',
    locale: 'he-IL',
    darkMode: false,
    language: 'en',
    categoryBudgets: {},
    ...overrides,
  }
}

// ─── Mock FinanceContext (for the render tests) ───────────────────────────────

const { finance } = vi.hoisted(() => ({
  finance: {
    data: null as unknown as FinanceData,
    updateGoal: vi.fn(),
    addGoal: vi.fn(),
    deleteGoal: vi.fn(),
    moveGoal: vi.fn(),
    setData: vi.fn(),
    fundGoalFromSavings: vi.fn(),
  },
}))

vi.mock('@/context/FinanceContext', () => ({
  useFinance: () => finance,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { Goals } from '@/components/Goals'
import { GoalDialog } from '@/components/goals/GoalDialog'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  finance.updateGoal.mockReset()
  finance.moveGoal.mockReset()
  finance.deleteGoal.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('isGoalDone() / activeGoals() / completedGoals()', () => {
  it('treats a goal without completedAt (legacy data) as active', () => {
    expect(isGoalDone(makeGoal())).toBe(false)
  })

  it('treats a goal with completedAt as done', () => {
    expect(isGoalDone(makeGoal({ completedAt: DONE_AT }))).toBe(true)
  })

  it('treats an empty-string completedAt as active', () => {
    expect(isGoalDone(makeGoal({ completedAt: '' }))).toBe(false)
  })

  it('splits goals in stored order without mutating the input', () => {
    const goals = [
      makeGoal({ id: 'a' }),
      makeGoal({ id: 'b', completedAt: DONE_AT }),
      makeGoal({ id: 'c' }),
    ]
    const copy = structuredClone(goals)
    expect(activeGoals(goals).map((g) => g.id)).toEqual(['a', 'c'])
    expect(completedGoals(goals).map((g) => g.id)).toEqual(['b'])
    expect(goals).toEqual(copy)
  })

  it('returns empty arrays for no goals', () => {
    expect(activeGoals([])).toEqual([])
    expect(completedGoals([])).toEqual([])
  })
})

describe('markGoalDone() / reopenGoal()', () => {
  it('mark done sets only completedAt — every other field deep-equal', () => {
    const goal = makeGoal()
    const done = markGoalDone(goal, new Date(DONE_AT))
    expect(done.completedAt).toBe(DONE_AT)
    const { completedAt: _c, ...rest } = done
    expect(rest).toEqual(goal)
    expect(goal.completedAt).toBeUndefined() // input untouched
  })

  it('reopen removes completedAt and keeps every other field deep-equal', () => {
    const goal = makeGoal()
    const reopened = reopenGoal(markGoalDone(goal, new Date(DONE_AT)))
    expect('completedAt' in reopened).toBe(false)
    expect(reopened).toEqual(goal)
  })

  it('mark done / reopen via updateGoal-style map keeps goals.length identical', () => {
    const goals = [makeGoal({ id: 'a' }), makeGoal({ id: 'b' }), makeGoal({ id: 'c' })]
    const apply = (list: Goal[], g: Goal) => list.map((x) => (x.id === g.id ? g : x))

    const afterDone = apply(goals, markGoalDone(goals[1], new Date(DONE_AT)))
    expect(afterDone).toHaveLength(goals.length)
    expect(afterDone[0]).toEqual(goals[0])
    expect(afterDone[2]).toEqual(goals[2])

    const afterReopen = apply(afterDone, reopenGoal(afterDone[1]))
    expect(afterReopen).toHaveLength(goals.length)
    expect(afterReopen).toEqual(goals)
  })

  it('marking done moves no money (currentAmount / usedAmount unchanged)', () => {
    const goal = makeGoal({ currentAmount: 12000, usedAmount: 1000 })
    const done = markGoalDone(goal)
    expect(done.currentAmount).toBe(12000)
    expect(done.usedAmount).toBe(1000)
  })
})

describe('moveStepsPastHidden()', () => {
  const goals = [
    makeGoal({ id: 'a' }),
    makeGoal({ id: 'x', completedAt: DONE_AT }),
    makeGoal({ id: 'y', completedAt: DONE_AT }),
    makeGoal({ id: 'b' }),
  ]
  it('skips hidden done goals moving up', () => {
    expect(moveStepsPastHidden(goals, 'b', 'up')).toBe(3)
  })
  it('skips hidden done goals moving down', () => {
    expect(moveStepsPastHidden(goals, 'a', 'down')).toBe(3)
  })
  it('returns 1 for adjacent active goals', () => {
    expect(moveStepsPastHidden([makeGoal({ id: 'a' }), makeGoal({ id: 'b' })], 'a', 'down')).toBe(1)
  })
  it('returns 0 when there is no active neighbour or the id is unknown', () => {
    expect(moveStepsPastHidden(goals, 'a', 'up')).toBe(0)
    expect(moveStepsPastHidden(goals, 'b', 'down')).toBe(0)
    expect(moveStepsPastHidden(goals, 'nope', 'up')).toBe(0)
  })
})

// ─── Sync: mergeFinanceData keeps completedAt ─────────────────────────────────

describe('mergeFinanceData() — completedAt round-trip', () => {
  it('keeps completedAt on a cloud-only done goal', () => {
    const cloud = makeData([makeGoal({ id: 'c', completedAt: DONE_AT })])
    const local = makeData([makeGoal({ id: 'l' })])
    const merged = mergeFinanceData(cloud, local)
    expect(merged.goals).toHaveLength(2)
    expect(merged.goals.find((g) => g.id === 'c')?.completedAt).toBe(DONE_AT)
    expect(merged.goals.find((g) => g.id === 'l')?.completedAt).toBeUndefined()
  })

  it('keeps completedAt on a local-only done goal', () => {
    const cloud = makeData([makeGoal({ id: 'c' })])
    const local = makeData([makeGoal({ id: 'l', completedAt: DONE_AT })])
    const merged = mergeFinanceData(cloud, local)
    expect(merged.goals).toHaveLength(2)
    expect(merged.goals.find((g) => g.id === 'l')?.completedAt).toBe(DONE_AT)
  })

  it('on ID conflict the cloud goal wins — done on cloud syncs to this device as done', () => {
    const cloud = makeData([makeGoal({ id: 'g1', completedAt: DONE_AT })])
    const local = makeData([makeGoal({ id: 'g1' })])
    const merged = mergeFinanceData(cloud, local)
    expect(merged.goals).toHaveLength(1)
    expect(merged.goals[0].completedAt).toBe(DONE_AT)
    expect(merged.goals[0]).toEqual(cloud.goals[0])
  })

  it('never reduces goals length (diverged: local A+B, cloud B+C with B done)', () => {
    const cloud = makeData([makeGoal({ id: 'B', completedAt: DONE_AT }), makeGoal({ id: 'C' })])
    const local = makeData([makeGoal({ id: 'A', completedAt: DONE_AT }), makeGoal({ id: 'B' })])
    const merged = mergeFinanceData(cloud, local)
    expect(merged.goals.length).toBeGreaterThanOrEqual(Math.max(cloud.goals.length, local.goals.length))
    expect(merged.goals.map((g) => g.id).sort()).toEqual(['A', 'B', 'C'])
    expect(merged.goals.find((g) => g.id === 'A')?.completedAt).toBe(DONE_AT)
    expect(merged.goals.find((g) => g.id === 'B')?.completedAt).toBe(DONE_AT)
  })

  it('empty cloud keeps local done goals intact', () => {
    const local = makeData([makeGoal({ id: 'A', completedAt: DONE_AT })])
    const merged = mergeFinanceData(makeData([]), local)
    expect(merged.goals).toEqual(local.goals)
  })

  it('empty local adopts cloud done goals in full', () => {
    const cloud = makeData([makeGoal({ id: 'A', completedAt: DONE_AT }), makeGoal({ id: 'B' })])
    const merged = mergeFinanceData(cloud, makeData([]))
    expect(merged.goals).toEqual(cloud.goals)
  })
})

// ─── Exclusion from allocation / Home donut / insights ────────────────────────

describe('done goals are excluded from allocation and Home goal data', () => {
  const goals = [
    makeGoal({ id: 'active', name: 'Car' }),
    makeGoal({ id: 'done', name: 'Vacation', completedAt: DONE_AT }),
  ]

  it('allocation input built from activeGoals contains no done goal', () => {
    const allocations = allocateGoals({
      goals: activeGoals(goals),
      monthlySurplus: 5000,
      accounts: [],
      emergencyBufferMonths: 3,
      monthlyExpenses: 1000,
    })
    expect(allocations.map((a) => a.id)).toEqual(['active'])
  })

  it('Home donut data (allocations of active goals) is empty when every goal is done', () => {
    const allDone = goals.map((g) => markGoalDone(g, new Date(DONE_AT)))
    const allocations = allocateGoals({
      goals: activeGoals(allDone),
      monthlySurplus: 5000,
      accounts: [],
      emergencyBufferMonths: 3,
      monthlyExpenses: 1000,
    })
    expect(allocations).toEqual([])
  })

  it('surplus insight does not count done goals as a destination', () => {
    const today = new Date(2026, 9, 3)
    const snapshot = {
      id: 's1',
      label: 'September 2026',
      date: new Date(2026, 8, 30).toISOString(),
      totalIncome: 20000,
      totalExpenses: 10000,
      totalSavings: 0,
      freeCashFlow: 10000,
    }
    const onlyDone = makeData([makeGoal({ completedAt: DONE_AT })], { history: [snapshot] as FinanceData['history'] })
    const withActive = makeData([makeGoal()], { history: [snapshot] as FinanceData['history'] })
    const ids = (d: FinanceData) => buildInsights(d, computeMonthlyPlan(d, today), today).map((i) => i.id)
    expect(ids(withActive)).toContain('surplus')
    expect(ids(onlyDone)).not.toContain('surplus')
  })
})

// ─── Render: edit path keeps completedAt ──────────────────────────────────────

describe('GoalDialog — editing a done goal keeps completedAt', () => {
  it('saves { ...stored, edits } with completedAt preserved', () => {
    const stored = makeGoal({ completedAt: DONE_AT })
    const onSave = vi.fn()
    render(
      <GoalDialog open onOpenChange={() => {}} existing={stored} onSave={onSave} currency="ILS" locale="he-IL" lang="en" />
    )
    fireEvent.change(screen.getByLabelText('Goal Name'), { target: { value: 'Vacation 2027' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Goal
    expect(saved.completedAt).toBe(DONE_AT)
    expect(saved.name).toBe('Vacation 2027')
    expect(saved).toEqual({ ...stored, name: 'Vacation 2027' })
  })

  it('editing an active goal does not add completedAt', () => {
    const stored = makeGoal()
    const onSave = vi.fn()
    render(
      <GoalDialog open onOpenChange={() => {}} existing={stored} onSave={onSave} currency="ILS" locale="he-IL" lang="en" />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0][0]).toEqual(stored)
  })
})

// ─── Render: Goals tab ────────────────────────────────────────────────────────

describe('Goals tab — active list and Completed section', () => {
  const active = makeGoal({ id: 'a', name: 'Car', currentAmount: 10000, targetAmount: 10000 })
  const done = makeGoal({ id: 'd', name: 'Vacation', completedAt: DONE_AT })

  beforeEach(() => {
    finance.data = makeData([active, done])
  })

  it('shows only active goals as cards and a collapsed Completed (1) section', () => {
    render(<Goals />)
    expect(screen.getAllByText('Car').length).toBeGreaterThan(0)
    // The done goal gets no active card / ⋯ menu of its own in the active list
    expect(screen.queryByRole('button', { name: 'Actions for Vacation' })).toBeNull()
    const toggle = screen.getByRole('button', { name: /Completed\s*\(1\)/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // Collapsed: the done goal row is hidden from the accessibility tree
    expect(screen.queryByRole('button', { name: 'Actions for Vacation' })).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    const item = within(panel as HTMLElement).getByRole('listitem')
    expect(within(item).getByText('Vacation')).toBeTruthy()
    expect(within(item).getByRole('button', { name: 'Actions for Vacation' })).toBeTruthy()
  })

  it('the inline "Mark as done" button (goal at 100%) calls updateGoal with the stored goal + completedAt only', () => {
    render(<Goals />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Car as done' }))
    expect(finance.updateGoal).toHaveBeenCalledTimes(1)
    const arg = finance.updateGoal.mock.calls[0][0] as Goal
    expect(typeof arg.completedAt).toBe('string')
    const { completedAt: _c, ...rest } = arg
    expect(rest).toEqual(active) // stored goal — no allocation fields leak in
  })

  it('does not show the inline button for a goal below 100%', () => {
    finance.data = makeData([makeGoal({ id: 'a', name: 'Car', currentAmount: 10, targetAmount: 10000 })])
    render(<Goals />)
    expect(screen.queryByRole('button', { name: 'Mark Car as done' })).toBeNull()
  })

  it('shows no Completed section when nothing is done', () => {
    finance.data = makeData([active])
    render(<Goals />)
    expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull()
  })
})
