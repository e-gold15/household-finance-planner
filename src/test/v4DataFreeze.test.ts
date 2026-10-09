/**
 * v4.0 Data Freeze (PRD §0 / §4 Wave 3A).
 *
 * The v4 redesign must not change the stored data model or the sync layer.
 * These tests pin:
 *   1. The FinanceData key set (via DEMO_FINANCE_DATA) to the exact v3.x list.
 *   2. mergeFinanceData behaviour on fixed fixtures — empty-cloud, empty-local,
 *      diverged devices, and "array lengths never decrease" for all 5 arrays.
 *   3. computeMonthlyPlan().leftToSpend ≡ legacy FCF (both the shared helper
 *      and an independent re-implementation of the v3.x Overview arithmetic).
 *   4. buildQuickAddExpense emits only keys that exist on Expense /
 *      HistoricalExpense and rejects invalid amounts.
 *   5. FinanceContext.tsx and cloudFinance.ts are byte-identical to `main`.
 */

import { describe, it, expect } from 'vitest'
import type { Expense, FinanceData, HistoricalExpense, Goal, HouseholdMember, MonthSnapshot, SavingsAccount } from '@/types'
import { DEMO_FINANCE_DATA } from '@/lib/demoData'
import { mergeFinanceData } from '@/lib/cloudFinance'
import { computeLegacyTotals, computeMonthlyPlan } from '@/lib/insights'
import { getNetMonthly } from '@/lib/taxEstimation'
import { buildQuickAddExpense } from '@/lib/quickAdd'

// ─── Frozen key lists ──────────────────────────────────────────────────────────

const V3_FINANCE_DATA_KEYS = [
  'members',
  'expenses',
  'accounts',
  'goals',
  'history',
  'emergencyBufferMonths',
  'currency',
  'locale',
  'darkMode',
  'language',
  'categoryBudgets',
] as const

const V3_EXPENSE_KEYS = [
  'id',
  'name',
  'amount',
  'category',
  'recurring',
  'period',
  'expenseType',
  'dueMonth',
  'linkedAccountId',
  'createdAt',
] as const

const V3_HISTORICAL_EXPENSE_KEYS = ['id', 'name', 'amount', 'category', 'note'] as const

// Compile-time exhaustiveness: the lists above must match the TS types exactly.
// If a field is added to / removed from the type, `npm run build` fails here.
type Exhaustive<T, K extends readonly PropertyKey[]> =
  [Exclude<keyof T, K[number]>] extends [never]
    ? [Exclude<K[number], keyof T>] extends [never] ? true : false
    : false
const _financeKeysExact: Exhaustive<FinanceData, typeof V3_FINANCE_DATA_KEYS> = true
const _expenseKeysExact: Exhaustive<Expense, typeof V3_EXPENSE_KEYS> = true
const _histExpenseKeysExact: Exhaustive<HistoricalExpense, typeof V3_HISTORICAL_EXPENSE_KEYS> = true
void _financeKeysExact
void _expenseKeysExact
void _histExpenseKeysExact

const ARRAY_FIELDS = ['expenses', 'accounts', 'goals', 'members', 'history'] as const
type ArrayField = (typeof ARRAY_FIELDS)[number]

// ─── Fixtures (deterministic — no Math.random / Date.now) ─────────────────────

function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    members: [],
    expenses: [],
    accounts: [],
    goals: [],
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

const expense = (id: string, amount = 100): Expense => ({
  id, name: `Expense ${id}`, amount, category: 'food', recurring: true, period: 'monthly',
})
const account = (id: string, balance = 1000): SavingsAccount => ({
  id, name: `Account ${id}`, type: 'savings', balance, liquidity: 'immediate',
  annualReturnPercent: 3, monthlyContribution: 0,
})
const goal = (id: string, currentAmount = 0): Goal => ({
  id, name: `Goal ${id}`, targetAmount: 10000, currentAmount, deadline: '2030-01-01',
  priority: 'medium', notes: '', useLiquidSavings: false,
})
const member = (id: string, name = `Member ${id}`): HouseholdMember => ({ id, name, sources: [] })
const snapshot = (id: string, fcf = 500): MonthSnapshot => ({
  id, label: `Snapshot ${id}`, date: '2026-01-01T00:00:00.000Z',
  totalIncome: 1000, totalExpenses: 400, totalSavings: 100, freeCashFlow: fcf,
})

const MAKERS: Record<ArrayField, (id: string) => { id: string }> = {
  expenses: (id) => expense(id),
  accounts: (id) => account(id),
  goals: (id) => goal(id),
  members: (id) => member(id),
  history: (id) => snapshot(id),
}

/** A FinanceData whose 5 array fields each contain items `${field}-${suffix}` for every suffix. */
function dataWithItems(suffixes: string[], overrides: Partial<FinanceData> = {}): FinanceData {
  const d = makeData(overrides)
  for (const f of ARRAY_FIELDS) {
    ;(d as unknown as Record<ArrayField, unknown[]>)[f] = suffixes.map((s) => MAKERS[f](`${f}-${s}`))
  }
  return d
}

function ids(d: FinanceData, f: ArrayField): string[] {
  return (d[f] as Array<{ id: string }>).map((x) => x.id).sort()
}

// ─── 1. FinanceData key set ───────────────────────────────────────────────────

describe('v4 data freeze — FinanceData shape', () => {
  it('DEMO_FINANCE_DATA has exactly the v3.x FinanceData key set', () => {
    expect(Object.keys(DEMO_FINANCE_DATA).sort()).toEqual([...V3_FINANCE_DATA_KEYS].sort())
  })

  it('every array field of DEMO_FINANCE_DATA is an array and categoryBudgets is an object', () => {
    for (const f of ARRAY_FIELDS) expect(Array.isArray(DEMO_FINANCE_DATA[f])).toBe(true)
    expect(typeof DEMO_FINANCE_DATA.categoryBudgets).toBe('object')
    expect(Array.isArray(DEMO_FINANCE_DATA.categoryBudgets)).toBe(false)
  })

  it('demo expenses only use keys that exist on the v3.x Expense type', () => {
    const allowed = new Set<string>(V3_EXPENSE_KEYS)
    for (const e of DEMO_FINANCE_DATA.expenses) {
      for (const k of Object.keys(e)) expect(allowed.has(k), `unexpected Expense key "${k}"`).toBe(true)
    }
  })
})

// ─── 2. mergeFinanceData ──────────────────────────────────────────────────────

describe('v4 data freeze — mergeFinanceData()', () => {
  it('empty cloud keeps every local item for all 5 array fields', () => {
    const local = dataWithItems(['a', 'b'], { categoryBudgets: { food: 2000 } })
    const merged = mergeFinanceData(makeData(), local)
    for (const f of ARRAY_FIELDS) expect(ids(merged, f)).toEqual(ids(local, f))
    expect(merged.categoryBudgets).toEqual({ food: 2000 })
  })

  it('empty local (fresh device) adopts every cloud item for all 5 array fields', () => {
    const cloud = dataWithItems(['x', 'y', 'z'], { categoryBudgets: { housing: 6000 }, currency: 'USD' })
    const merged = mergeFinanceData(cloud, makeData())
    for (const f of ARRAY_FIELDS) expect(ids(merged, f)).toEqual(ids(cloud, f))
    expect(merged.categoryBudgets).toEqual({ housing: 6000 })
    expect(merged.currency).toBe('USD')
  })

  it('diverged devices: local A+B, cloud B+C → A+B+C for all 5 array fields', () => {
    const local = dataWithItems(['A', 'B'])
    const cloud = dataWithItems(['B', 'C'])
    const merged = mergeFinanceData(cloud, local)
    for (const f of ARRAY_FIELDS) {
      expect(ids(merged, f)).toEqual([`${f}-A`, `${f}-B`, `${f}-C`])
    }
  })

  it('merged array lengths are ≥ max(cloud, local) for every array field and fixture', () => {
    const fixtures: Array<[string[], string[]]> = [
      [[], []],
      [['a'], []],
      [[], ['a']],
      [['a', 'b'], ['b', 'c']],
      [['a', 'b', 'c', 'd'], ['a']],
      [['a'], ['a', 'b', 'c', 'd', 'e']],
      [['a', 'b'], ['c', 'd']],
    ]
    for (const [cloudIds, localIds] of fixtures) {
      const cloud = dataWithItems(cloudIds)
      const local = dataWithItems(localIds)
      const merged = mergeFinanceData(cloud, local)
      for (const f of ARRAY_FIELDS) {
        expect(merged[f].length).toBeGreaterThanOrEqual(Math.max(cloud[f].length, local[f].length))
        expect(merged[f].length).toBe(new Set([...cloudIds, ...localIds]).size)
      }
    }
  })

  it('cloud wins on an ID conflict without dropping the item', () => {
    const local = makeData({ expenses: [expense('e1', 100)], goals: [goal('g1', 5)] })
    const cloud = makeData({ expenses: [expense('e1', 999)], goals: [goal('g1', 50)] })
    const merged = mergeFinanceData(cloud, local)
    expect(merged.expenses).toHaveLength(1)
    expect(merged.expenses[0].amount).toBe(999)
    expect(merged.goals[0].currentAmount).toBe(50)
  })

  it('categoryBudgets is a union (cloud wins on the same key); darkMode/language are local-wins', () => {
    const local = makeData({ categoryBudgets: { food: 1000, leisure: 300 }, darkMode: true, language: 'he' })
    const cloud = makeData({ categoryBudgets: { food: 1500, housing: 5000 }, darkMode: false, language: 'en' })
    const merged = mergeFinanceData(cloud, local)
    expect(merged.categoryBudgets).toEqual({ food: 1500, leisure: 300, housing: 5000 })
    expect(merged.darkMode).toBe(true)
    expect(merged.language).toBe('he')
  })

  it('merging demo data with itself is lossless and output keeps the v3.x key set', () => {
    const merged = mergeFinanceData(DEMO_FINANCE_DATA, DEMO_FINANCE_DATA)
    expect(Object.keys(merged).sort()).toEqual([...V3_FINANCE_DATA_KEYS].sort())
    for (const f of ARRAY_FIELDS) expect(merged[f]).toEqual(DEMO_FINANCE_DATA[f])
    expect(merged.categoryBudgets).toEqual(DEMO_FINANCE_DATA.categoryBudgets)
  })

  it('does not mutate its inputs', () => {
    const local = dataWithItems(['A', 'B'])
    const cloud = dataWithItems(['B', 'C'])
    const localCopy = JSON.parse(JSON.stringify(local))
    const cloudCopy = JSON.parse(JSON.stringify(cloud))
    mergeFinanceData(cloud, local)
    expect(local).toEqual(localCopy)
    expect(cloud).toEqual(cloudCopy)
  })
})

// ─── 3. Hero number ≡ legacy FCF ──────────────────────────────────────────────

/** Independent copy of the v3.x Overview.tsx FCF arithmetic (main branch). */
function v3OverviewFcf(data: FinanceData): number {
  const totalIncome = data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0)
  const linkedIds = new Set(
    data.expenses.filter((e) => e.linkedAccountId && e.category === 'savings').map((e) => e.linkedAccountId as string)
  )
  const totalContributions = data.accounts
    .filter((a) => !linkedIds.has(a.id) && !a.deductedFromSalary)
    .reduce((s, a) => s + a.monthlyContribution, 0)
  return totalIncome - totalExpenses - totalContributions
}

describe('v4 data freeze — computeMonthlyPlan() ≡ legacy FCF', () => {
  const TODAY = new Date(2026, 9, 15) // 15 Oct 2026, local time

  it('leftToSpend equals computeLegacyTotals().freeCashFlow on demo data', () => {
    const plan = computeMonthlyPlan(DEMO_FINANCE_DATA, TODAY)
    expect(plan.leftToSpend).toBe(computeLegacyTotals(DEMO_FINANCE_DATA).freeCashFlow)
  })

  it('leftToSpend equals an independent copy of the v3.x Overview FCF on demo data', () => {
    const plan = computeMonthlyPlan(DEMO_FINANCE_DATA, TODAY)
    expect(plan.leftToSpend).toBe(v3OverviewFcf(DEMO_FINANCE_DATA))
  })

  it('is independent of the date (same FCF on day 1 and the last day)', () => {
    const a = computeMonthlyPlan(DEMO_FINANCE_DATA, new Date(2026, 1, 1))
    const b = computeMonthlyPlan(DEMO_FINANCE_DATA, new Date(2026, 1, 28))
    expect(a.leftToSpend).toBe(b.leftToSpend)
  })

  it('income/fixed/variable/contrib decomposition sums back to leftToSpend', () => {
    const plan = computeMonthlyPlan(DEMO_FINANCE_DATA, TODAY)
    expect(plan.income - plan.fixed - plan.variableSpent - plan.savingsContrib).toBeCloseTo(plan.leftToSpend, 6)
  })

  it('does not mutate the demo data', () => {
    const before = JSON.stringify(DEMO_FINANCE_DATA)
    computeMonthlyPlan(DEMO_FINANCE_DATA, TODAY)
    computeLegacyTotals(DEMO_FINANCE_DATA)
    expect(JSON.stringify(DEMO_FINANCE_DATA)).toBe(before)
  })
})

// ─── 4. Quick Add payload ─────────────────────────────────────────────────────

describe('v4 data freeze — buildQuickAddExpense()', () => {
  const NOW = new Date(2026, 9, 3, 12, 0, 0) // 3 Oct 2026

  it('current-month payload only contains keys that exist on Expense', () => {
    const p = buildQuickAddExpense({ amount: 42, category: 'food', when: 'current', lang: 'en', now: NOW })
    expect(p).not.toBeNull()
    if (!p || p.kind !== 'current') throw new Error('expected current payload')
    const allowed = new Set<string>(V3_EXPENSE_KEYS)
    for (const k of Object.keys(p.expense)) expect(allowed.has(k), `unexpected key "${k}"`).toBe(true)
    expect('id' in p.expense).toBe(false) // the context generates the id
    for (const v of Object.values(p.expense)) expect(v).not.toBeUndefined()
  })

  it('past-month payload item only contains keys that exist on HistoricalExpense', () => {
    const p = buildQuickAddExpense({
      amount: 80, category: 'health', when: 'past', pastYear: 2026, pastMonth: 9, lang: 'he', now: NOW,
    })
    expect(p).not.toBeNull()
    if (!p || p.kind !== 'past') throw new Error('expected past payload')
    const allowed = new Set<string>(V3_HISTORICAL_EXPENSE_KEYS)
    for (const k of Object.keys(p.item)) expect(allowed.has(k), `unexpected key "${k}"`).toBe(true)
    expect(Object.keys(p).sort()).toEqual(['item', 'kind', 'month', 'year'])
  })

  it.each([
    ['null', null],
    ['zero', 0],
    ['negative', -5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('returns null for an invalid amount (%s)', (_label, amount) => {
    expect(buildQuickAddExpense({ amount, category: 'food', when: 'current', lang: 'en', now: NOW })).toBeNull()
    expect(
      buildQuickAddExpense({ amount, category: 'food', when: 'past', pastYear: 2026, pastMonth: 9, lang: 'en', now: NOW })
    ).toBeNull()
  })

  it('returns null without a category', () => {
    expect(buildQuickAddExpense({ amount: 10, category: null, when: 'current', lang: 'en', now: NOW })).toBeNull()
  })
})

// ─── 5. Sync layer is byte-identical to main ──────────────────────────────────

interface FsLike { readFileSync(p: string, enc: 'utf8'): string }
interface ChildProcessLike {
  execSync(cmd: string, opts: { cwd: string; encoding: 'utf8'; stdio: readonly ['ignore', 'pipe', 'ignore']; maxBuffer: number }): string
}
interface PathLike { resolve(...p: string[]): string }

// Node built-ins are imported through a variable specifier so the app's
// tsconfig (which deliberately has no @types/node) still type-checks.
async function loadNode(): Promise<{ fs: FsLike; cp: ChildProcessLike; path: PathLike } | null> {
  try {
    const fsId = 'node:fs'
    const cpId = 'node:child_process'
    const pathId = 'node:path'
    const [fs, cp, path] = await Promise.all([import(/* @vite-ignore */ fsId), import(/* @vite-ignore */ cpId), import(/* @vite-ignore */ pathId)])
    return { fs: fs as FsLike, cp: cp as ChildProcessLike, path: path as PathLike }
  } catch {
    return null
  }
}

const FROZEN_FILES = ['src/context/FinanceContext.tsx', 'src/lib/cloudFinance.ts'] as const

describe('v4 data freeze — sync layer unchanged vs main', () => {
  it.each(FROZEN_FILES)('%s is identical to main', async (file) => {
    const node = await loadNode()
    if (!node) {
      console.warn(`[v4DataFreeze] node built-ins unavailable — skipping ${file}`)
      return
    }
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 } as const
    let root: string
    let mainContent: string
    try {
      root = node.cp.execSync('git rev-parse --show-toplevel', { ...opts, cwd: '.' }).trim()
      mainContent = node.cp.execSync(`git show main:${file}`, { ...opts, cwd: root })
    } catch {
      console.warn(`[v4DataFreeze] git or the main branch is unavailable — skipping ${file}`)
      return
    }
    const current = node.fs.readFileSync(node.path.resolve(root, file), 'utf8')
    if (current === mainContent) return
    // v4.2 (spec-v4.2-this-month-actual-income.md) — the ONLY allowed change in
    // FinanceContext is how snapshot builders compute totalIncome (this month's
    // actuals). Every added/removed line must match one of these patterns; any
    // other change (sync, merge, push, pull, realtime) still fails here.
    // Order-preserving: drop allowed lines from both sides, then the rest must be
    // identical line by line (a reorder of sync steps would still fail).
    const allowed = ALLOWED_DIFF_LINES[file] ?? []
    const norm = (text: string) =>
      text.split('\n').map((l) => l.trim()).filter((l) => l && !allowed.some((re) => re.test(l)))
    expect(norm(current), `${file} differs from main outside the allowed lines`).toEqual(norm(mainContent))
  })
})

/** Allowed added/removed lines per frozen file (trimmed). Empty = byte-identical required. */
const ALLOWED_DIFF_LINES: Record<string, RegExp[]> = {
  'src/context/FinanceContext.tsx': [
    /^import \{ getNetMonthly \} from '@\/lib\/taxEstimation'$/,
    /^import \{ toYearMonth \} from '@\/lib\/taxEstimation'$/,
    /^import \{ householdIncomeForMonth \} from '@\/lib\/monthActual'$/,
    /^const totalIncome\s+= d\.members\.reduce\(\(s, m\) => s \+ m\.sources\.reduce\(\(ss, src\) => ss \+ getNetMonthly\(src\), 0\), 0\)$/,
    /^const totalIncome\s+= householdIncomeForMonth\(d\.members, (toYearMonth\((new Date\(\)|now)\)|`\$\{prevYear\}-\$\{String\(prevMonth\)\.padStart\(2, '0'\)\}`)\)\.actual$/,
    /^\/\/ v4\.2 — this month's actuals \(if any\) replace the planned net for the current month\.$/,
  ],
}
