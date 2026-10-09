/**
 * v4.0 Home — pure, derived insights (PRD §2.E).
 *
 * Everything in this file is a pure function of `FinanceData` plus an injected
 * `today: Date`. Nothing here reads or writes storage, and nothing is persisted.
 */
import { getNetForMonth, getNetMonthly, toYearMonth } from '@/lib/taxEstimation'
import { CATEGORY_META } from '@/lib/categories'
import { activeGoals } from '@/lib/goals'
import type {
  Expense,
  ExpenseCategory,
  FinanceData,
  Insight,
  MonthSnapshot,
  MonthlyPlan,
  PaceStatus,
} from '@/types'

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Monthly-equivalent amount of an expense (yearly bills are smoothed ÷ 12). */
export function monthlyAmount(e: Pick<Expense, 'amount' | 'period'>): number {
  return e.period === 'yearly' ? e.amount / 12 : e.amount
}

export interface LegacyTotals {
  totalIncome: number
  totalExpenses: number
  totalContributions: number
  freeCashFlow: number
}

/**
 * The exact KPI arithmetic the Overview tab has used since v2.x, in the same
 * evaluation order (so results are bit-identical to the legacy FCF).
 */
export function computeLegacyTotals(data: Pick<FinanceData, 'members' | 'expenses' | 'accounts'>): LegacyTotals {
  const totalIncome = data.members.reduce(
    (sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0),
    0
  )
  const totalExpenses = data.expenses.reduce((s, e) => s + monthlyAmount(e), 0)
  // Accounts whose contribution is already captured by a linked savings expense
  // (or deducted from gross salary) must not be counted again.
  const linkedIds = new Set(
    data.expenses
      .filter((e) => e.linkedAccountId && e.category === 'savings')
      .map((e) => e.linkedAccountId as string)
  )
  const totalContributions = data.accounts
    .filter((a) => !linkedIds.has(a.id) && !a.deductedFromSalary)
    .reduce((s, a) => s + a.monthlyContribution, 0)
  const freeCashFlow = totalIncome - totalExpenses - totalContributions
  return { totalIncome, totalExpenses, totalContributions, freeCashFlow }
}

/** Number of days in the month containing `today` (local time). */
export function daysInMonthOf(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
}

/** Pace tolerance: spending more than this many points ahead of the calendar is "ahead". */
export const PACE_AHEAD_THRESHOLD = 10

// ─── Hero: "Left to spend this month" ────────────────────────────────────────

export function computeMonthlyPlan(
  data: Pick<FinanceData, 'members' | 'expenses' | 'accounts'>,
  today: Date
): MonthlyPlan {
  const legacy = computeLegacyTotals(data)
  const plannedIncome = legacy.totalIncome
  // v4.2 — this month's actual net (per source) replaces the planned net.
  // Identical to plannedIncome when no actual is set for the month of `today`.
  const yearMonth = toYearMonth(today)
  const hasActuals = data.members.some((m) => m.sources.some((s) => s.monthActual?.month === yearMonth))
  const income = hasActuals
    ? data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetForMonth(src, yearMonth), 0), 0)
    : plannedIncome
  // Anything that isn't explicitly 'variable' is fixed (undefined = fixed, legacy data).
  const fixed = data.expenses
    .filter((e) => e.expenseType !== 'variable')
    .reduce((s, e) => s + monthlyAmount(e), 0)
  const variableSpent = data.expenses
    .filter((e) => e.expenseType === 'variable')
    .reduce((s, e) => s + monthlyAmount(e), 0)
  const savingsContrib = legacy.totalContributions
  const spendable = income - fixed - savingsContrib
  // ≡ spendable − variableSpent (fixed + variableSpent = totalExpenses). Taken
  // from the legacy expression so it is bit-identical to the old FCF KPI.
  // With actuals the income delta is added on top, so the result is still
  // bit-identical to the legacy FCF whenever no actual is set.
  const leftToSpend = hasActuals ? legacy.freeCashFlow + (income - plannedIncome) : legacy.freeCashFlow

  const daysInMonth = daysInMonthOf(today)
  const dayOfMonth = today.getDate()
  const daysLeft = daysInMonth - dayOfMonth + 1
  const elapsedPct = ((dayOfMonth - 1) / daysInMonth) * 100
  const spentPct = spendable > 0 ? (variableSpent / spendable) * 100 : null
  const dailyAllowance = leftToSpend > 0 ? leftToSpend / daysLeft : 0

  let status: PaceStatus
  if (income <= 0) status = 'no-income'
  else if (leftToSpend < 0 || spendable <= 0) status = 'over'
  else if (spentPct !== null && spentPct > elapsedPct + PACE_AHEAD_THRESHOLD) status = 'ahead'
  else status = 'on-track'

  return {
    income,
    plannedIncome,
    fixed,
    variableSpent,
    savingsContrib,
    spendable,
    leftToSpend,
    daysInMonth,
    dayOfMonth,
    daysLeft,
    elapsedPct,
    spentPct,
    dailyAllowance,
    status,
  }
}

// ─── Surplus (moved verbatim from SurplusBanner v3.1) ────────────────────────

/** Remaining, unallocated surplus of a snapshot. */
export function remainingSurplus(s: Pick<MonthSnapshot, 'freeCashFlow' | 'surplusAllocated'>): number {
  return s.freeCashFlow - (s.surplusAllocated ?? 0)
}

/**
 * Most-recent past-month (strictly before the month of `today`) non-stub
 * snapshot with a positive remaining surplus that the user has not dismissed.
 * Same rule as the v3.x SurplusBanner.
 */
export function findActionableSurplus(history: MonthSnapshot[], today: Date): MonthSnapshot | null {
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const candidates = history.filter((h) => {
    if (h.totalIncome === 0) return false // stub
    if (h.surplusActioned) return false // permanently dismissed
    if (remainingSurplus(h) <= 0) return false // fully allocated
    const d = new Date(h.date)
    return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonth)
  })
  return candidates.length > 0 ? candidates[candidates.length - 1] : null
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

/** Monthly-equivalent spend per category over ALL live expenses (Budget Health definition). */
export function spentByCategory(expenses: Expense[]): Partial<Record<ExpenseCategory, number>> {
  const map: Partial<Record<ExpenseCategory, number>> = {}
  for (const e of expenses) {
    map[e.category] = (map[e.category] ?? 0) + monthlyAmount(e)
  }
  return map
}

export interface BudgetHealth {
  under: number
  warning: number
  over: number
  none: number
  worstCategory: ExpenseCategory | null
  worstPct: number
}

/** Same counting rules as the v2.9 Budget Health gauge. Null when no budgets are set. */
export function computeBudgetHealth(data: Pick<FinanceData, 'categoryBudgets' | 'expenses'>): BudgetHealth | null {
  const budgets = data.categoryBudgets
  if (Object.keys(budgets).length === 0) return null
  const spent = spentByCategory(data.expenses)

  let under = 0, warning = 0, over = 0, none = 0
  let worstCategory: ExpenseCategory | null = null
  let worstPct = 0

  for (const [cat, budget] of Object.entries(budgets) as [ExpenseCategory, number | undefined][]) {
    if (!budget) { none++; continue }
    const pct = ((spent[cat] ?? 0) / budget) * 100
    if (pct > 100) {
      over++
      if (pct > worstPct) { worstPct = pct; worstCategory = cat }
    } else if (pct >= 80) {
      warning++
    } else {
      under++
    }
  }
  for (const cat of Object.keys(spent) as ExpenseCategory[]) {
    if (!(cat in budgets)) none++
  }
  return { under, warning, over, none, worstCategory, worstPct }
}

// ─── Upcoming yearly bills (same rule as v2.9, with injected today) ──────────

export interface UpcomingBill {
  expense: Expense
  dueDate: Date
  daysUntil: number
  /** 0-based month index of the due date. */
  month: number
}

export function getUpcomingBills(expenses: Expense[], today: Date): UpcomingBill[] {
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const sixMonthsLater = new Date(today)
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  return expenses
    .filter((e) => e.period === 'yearly' && e.dueMonth != null)
    .map((e) => {
      const dm = e.dueMonth as number
      const year = dm >= currentMonth ? currentYear : currentYear + 1
      const dueDate = new Date(year, dm - 1, 1)
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { expense: e, dueDate, daysUntil, month: dm - 1 }
    })
    .filter((b) => b.dueDate <= sixMonthsLater && b.daysUntil >= 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

// ─── Month-over-month trend (same rule as v2.9) ──────────────────────────────

export function computeMomTrend(history: MonthSnapshot[]): { incomePct: number | null; expensesPct: number | null } | null {
  const nonStubs = history.filter((h) => h.totalIncome > 0)
  if (nonStubs.length < 2) return null
  const prev = nonStubs[nonStubs.length - 2]
  const curr = nonStubs[nonStubs.length - 1]
  const incomePct = prev.totalIncome > 0 ? ((curr.totalIncome - prev.totalIncome) / prev.totalIncome) * 100 : null
  const expensesPct = prev.totalExpenses > 0 ? ((curr.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100 : null
  return { incomePct, expensesPct }
}

// ─── Briefing ────────────────────────────────────────────────────────────────

/**
 * The snapshot whose briefing Home shows: the current-month auto snapshot when
 * it is not a stub (that is where "Generate briefing" saves), otherwise the
 * latest non-stub snapshot by date.
 */
export function findBriefingSnapshot(history: MonthSnapshot[]): MonthSnapshot | null {
  const nonStubs = history.filter((h) => h.totalIncome > 0)
  const auto = nonStubs.find((h) => h.autoSnapshot === true)
  if (auto) return auto
  if (nonStubs.length === 0) return null
  return nonStubs.reduce((latest, h) => (new Date(h.date).getTime() >= new Date(latest.date).getTime() ? h : latest))
}

// ─── Insight cards ───────────────────────────────────────────────────────────

export const MAX_INSIGHTS = 3

export function buildInsights(data: FinanceData, plan: MonthlyPlan, today: Date): Insight[] {
  const out: Insight[] = []

  // 1 — deficit
  if (plan.status === 'over') {
    out.push({
      id: 'deficit',
      tone: 'danger',
      priority: 1,
      amount: Math.max(0, -plan.leftToSpend),
      structural: plan.spendable <= 0,
    })
  }

  // 2 — surplus (exact SurplusBanner rule: actionable snapshot AND somewhere to put it)
  const surplus = findActionableSurplus(data.history, today)
  if (surplus && (activeGoals(data.goals).length > 0 || data.accounts.length > 0)) {
    out.push({
      id: 'surplus',
      tone: 'success',
      priority: 2,
      snapshotId: surplus.id,
      snapshotLabel: surplus.label,
      snapshotDate: surplus.date,
      amount: remainingSurplus(surplus),
    })
  }

  // 3 — over budget (spent > budget > 0)
  const spent = spentByCategory(data.expenses)
  const overList = (Object.entries(data.categoryBudgets) as [ExpenseCategory, number | undefined][])
    .filter(([cat, budget]) => budget !== undefined && budget > 0 && (spent[cat] ?? 0) > budget)
    .map(([cat, budget]) => ({ category: cat, spent: spent[cat] ?? 0, budget: budget as number }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
  if (overList.length > 0) {
    out.push({
      id: 'over-budget',
      tone: 'warning',
      priority: 3,
      categories: overList.map((o) => o.category),
      worst: overList[0],
    })
  }

  // 4 — yearly bill due this month or next
  const thisMonth = today.getMonth() + 1
  const nextMonth = (thisMonth % 12) + 1
  const bills = data.expenses
    .filter((e) => e.period === 'yearly' && (e.dueMonth === thisMonth || e.dueMonth === nextMonth))
    .map((e) => ({
      expenseId: e.id,
      name: e.name,
      amount: e.amount,
      dueMonth: e.dueMonth as number,
      thisMonth: e.dueMonth === thisMonth,
    }))
    .sort((a, b) => Number(b.thisMonth) - Number(a.thisMonth))
  if (bills.length > 0) {
    out.push({ id: 'bill-due', tone: 'info', priority: 4, bills })
  }

  // 5 — pace ahead (status is single-valued, so this never co-occurs with deficit)
  if (plan.status === 'ahead' && plan.spentPct !== null) {
    out.push({ id: 'pace-ahead', tone: 'warning', priority: 5, spentPct: plan.spentPct, elapsedPct: plan.elapsedPct })
  }

  // 6 — briefing available
  const briefingSnap = findBriefingSnapshot(data.history)
  if (briefingSnap?.aiBriefing) {
    out.push({
      id: 'briefing',
      tone: 'neutral',
      priority: 6,
      snapshotId: briefingSnap.id,
      score: briefingSnap.aiBriefing.score,
      headline: briefingSnap.aiBriefing.headline,
    })
  }

  return out.sort((a, b) => a.priority - b.priority).slice(0, MAX_INSIGHTS)
}

// ─── Expense donut ───────────────────────────────────────────────────────────

export const DONUT_MAX_SLICES = 6
export const DONUT_GROUP_THRESHOLD_PCT = 4

export interface DonutSlice {
  /** Category key, or 'other' for the grouped bucket. */
  key: ExpenseCategory
  /** True when this slice is the "Other" group of small categories (+ the 'other' category). */
  grouped: boolean
  /** Categories folded into this slice. */
  categories: ExpenseCategory[]
  value: number
  /** 0–100 share of total. */
  pct: number
  color: string
}

export interface DonutData {
  total: number
  slices: DonutSlice[]
}

/**
 * Monthly spend by category, sorted descending, with stable colours from
 * CATEGORY_META. When there are more than 6 slices, those under 4% (and the
 * 'other' category itself) are grouped into one "Other" slice at the end.
 */
export function buildExpenseDonut(expenses: Expense[]): DonutData {
  const spent = spentByCategory(expenses)
  const entries = (Object.entries(spent) as [ExpenseCategory, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const total = entries.reduce((s, [, v]) => s + v, 0)
  if (total <= 0) return { total: 0, slices: [] }

  const toSlice = (cat: ExpenseCategory, value: number): DonutSlice => ({
    key: cat,
    grouped: false,
    categories: [cat],
    value,
    pct: (value / total) * 100,
    color: (CATEGORY_META[cat] ?? CATEGORY_META.other).color,
  })

  if (entries.length <= DONUT_MAX_SLICES) {
    return { total, slices: entries.map(([c, v]) => toSlice(c, v)) }
  }

  const keep: DonutSlice[] = []
  const folded: [ExpenseCategory, number][] = []
  for (const [cat, value] of entries) {
    if (cat === 'other' || (value / total) * 100 < DONUT_GROUP_THRESHOLD_PCT) folded.push([cat, value])
    else keep.push(toSlice(cat, value))
  }
  // Grouping a single real slice gains nothing — show it as itself.
  if (folded.length === 1) {
    const [cat, value] = folded[0]
    const all = [...keep, toSlice(cat, value)].sort((a, b) => b.value - a.value)
    return { total, slices: all }
  }
  if (folded.length === 0) return { total, slices: keep }
  const otherValue = folded.reduce((s, [, v]) => s + v, 0)
  keep.push({
    key: 'other',
    grouped: true,
    categories: folded.map(([c]) => c),
    value: otherValue,
    pct: (otherValue / total) * 100,
    color: CATEGORY_META.other.color,
  })
  return { total, slices: keep }
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardingState {
  /** True when the checklist should replace the hero (no income AND no expenses). */
  show: boolean
  hasIncome: boolean
  hasExpense: boolean
  hasGoal: boolean
}

export function getOnboardingState(data: Pick<FinanceData, 'members' | 'expenses' | 'goals'>, income: number): OnboardingState {
  const hasIncome = income > 0
  const hasExpense = data.expenses.length > 0
  const hasGoal = data.goals.length > 0
  return { show: !hasIncome && !hasExpense, hasIncome, hasExpense, hasGoal }
}

// ─── 12-month savings projection (same compounding as v2.9 28.4) ─────────────

export interface SavingsProjection {
  /** Index 0 = today, 1…months = projected month-end totals (rounded). */
  points: { month: number; balance: number }[]
  projected: number
  /** Balance-weighted average annual return %. */
  weightedReturn: number
}

export function computeSavingsProjection(
  accounts: FinanceData['accounts'],
  months = 12
): SavingsProjection | null {
  if (accounts.length === 0) return null
  const balances = accounts.map((a) => a.balance)
  const sum = () => balances.reduce((s, b) => s + b, 0)
  const points = [{ month: 0, balance: Math.round(sum()) }]
  for (let m = 1; m <= months; m++) {
    accounts.forEach((acc, i) => {
      balances[i] = balances[i] * (1 + acc.annualReturnPercent / 100 / 12) + acc.monthlyContribution
    })
    points.push({ month: m, balance: Math.round(sum()) })
  }
  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0)
  const weightedReturn = totalAssets > 0
    ? accounts.reduce((s, a) => s + a.balance * a.annualReturnPercent, 0) / totalAssets
    : 0
  return { points, projected: points[months].balance, weightedReturn }
}
