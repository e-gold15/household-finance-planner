import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { FinanceData, HouseholdMember, Expense, SavingsAccount, Goal, MonthSnapshot, ExpenseCategory, HistoricalExpense, HistoricalIncome } from '@/types'
import { generateId } from '@/lib/utils'
import { getNetMonthly } from '@/lib/taxEstimation'
import { fetchCloudFinanceData, pushCloudFinanceData, mergeFinanceData } from '@/lib/cloudFinance'
import { supabaseConfigured } from '@/lib/supabase'

const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

const defaultData: FinanceData = {
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
}

function storageKey(householdId: string) { return `hf-data-${householdId}` }

/** Repair snapshots whose totalExpenses diverged from categoryActuals (v2.3–v2.5 bug). Idempotent. */
function repairSnapshotTotals(data: FinanceData): FinanceData {
  const repairedHistory = data.history.map((snap) => {
    if (!snap.categoryActuals) return snap
    const derived = Object.values(snap.categoryActuals).reduce((s, v) => s + v, 0)
    if (derived === snap.totalExpenses) return snap   // already correct — no-op
    return {
      ...snap,
      totalExpenses: derived,
      freeCashFlow: snap.totalIncome - derived - snap.totalSavings,
    }
  })
  return { ...data, history: repairedHistory }
}

function load(householdId: string): FinanceData {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (raw) {
      const parsed: FinanceData = { ...defaultData, ...JSON.parse(raw) }
      return repairSnapshotTotals(parsed)
    }
  } catch {}
  return defaultData
}

function save(householdId: string, data: FinanceData) {
  localStorage.setItem(storageKey(householdId), JSON.stringify(data))
}

/** True when localStorage has nothing beyond the defaults — i.e. a brand-new member on this device. */
function isLocalEmpty(data: FinanceData): boolean {
  return (
    data.members.length === 0 &&
    data.expenses.length === 0 &&
    data.accounts.length === 0 &&
    data.goals.length === 0 &&
    data.history.length === 0
  )
}

interface FinanceContextType {
  data: FinanceData
  /**
   * True while the initial cloud fetch is in-flight for a new member whose local
   * cache is empty.  Components should render a skeleton/spinner instead of an
   * empty-state UI while this is true.
   */
  isLoading: boolean
  setData: (updater: (prev: FinanceData) => FinanceData) => void
  addMember: (name: string) => void
  updateMember: (member: HouseholdMember) => void
  deleteMember: (id: string) => void
  addExpense: (expense: Omit<Expense, 'id'>) => void
  updateExpense: (expense: Expense) => void
  deleteExpense: (id: string) => void
  addAccount: (account: Omit<SavingsAccount, 'id'>) => void
  updateAccount: (account: SavingsAccount) => void
  deleteAccount: (id: string) => void
  addGoal: (goal: Omit<Goal, 'id'>) => void
  updateGoal: (goal: Goal) => void
  deleteGoal: (id: string) => void
  moveGoal: (id: string, direction: 'up' | 'down') => void
  snapshotMonth: () => void
  snapshotPreviousMonth: () => void
  exportData: () => void
  importData: (json: string) => void
  /** Set or clear the monthly budget limit for a category. Pass undefined to remove the limit. */
  updateCategoryBudget: (category: ExpenseCategory, budget: number | undefined) => void
  /** Record what was actually spent per category in a past snapshot. */
  updateSnapshotActuals: (snapshotId: string, actuals: Partial<Record<ExpenseCategory, number>>) => void
  addHistoricalExpense: (snapshotId: string, item: Omit<HistoricalExpense, 'id'>) => void
  deleteHistoricalExpense: (snapshotId: string, itemId: string) => void
  updateHistoricalExpense: (snapshotId: string, item: HistoricalExpense) => void
  addExpenseToMonth: (year: number, month: number, item: Omit<HistoricalExpense, 'id'>) => void
  addHistoricalIncome:    (snapshotId: string, item: Omit<HistoricalIncome, 'id'>) => void
  deleteHistoricalIncome: (snapshotId: string, itemId: string) => void
  updateHistoricalIncome: (snapshotId: string, item: HistoricalIncome) => void
  addIncomeToMonth: (year: number, month: number, item: Omit<HistoricalIncome, 'id'>) => void
  /** Mark the end-of-month surplus for a snapshot as actioned — hides the banner permanently. */
  markSurplusActioned: (snapshotId: string) => void
  /**
   * Record a surplus allocation on a snapshot: deducts amount from freeCashFlow,
   * appends the allocation entry, and sets surplusActioned=true atomically.
   */
  recordSurplusAllocation: (
    snapshotId: string,
    allocation: { amount: number; type: 'savings' | 'goal'; destinationId: string; destinationName: string }
  ) => void
}

const FinanceContext = createContext<FinanceContextType | null>(null)

// Cloud push debounce interval — short enough to feel live, long enough not to spam Supabase.
const CLOUD_PUSH_DEBOUNCE_MS = 1500

export function FinanceProvider({ children, householdId }: { children: React.ReactNode; householdId: string }) {
  const initialLocal = load(householdId)

  // Show the loading spinner only when Supabase is configured AND local has no data.
  // Existing users (non-empty local) see their data instantly; the cloud fetch patches
  // silently in the background.
  const [data, setDataState]     = useState<FinanceData>(initialLocal)
  const [isLoading, setIsLoading] = useState(supabaseConfigured && isLocalEmpty(initialLocal))

  // Ref tracks whether the user has written anything since mount.
  // If true, the background cloud fetch must NOT overwrite their edits.
  const hasLocalEditRef  = useRef(false)
  const pushTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cloud sync: fetch on mount ─────────────────────────────────────────────
  //
  // Three possible outcomes after the cloud fetch resolves:
  //
  //   A) Cloud has data + user hasn't edited yet
  //      → Merge cloud data into local (new-member scenario: gets shared data)
  //
  //   B) Cloud has no data + local has data
  //      → Seed the cloud immediately (owner scenario: bootstraps sharing for the
  //        first time, or after the household_finance table was added)
  //
  //   C) Cloud has no data + local is empty
  //      → Genuine new household with no data yet; just clear the loading state
  //
  // The guard `!hasLocalEditRef.current` in case A prevents the cloud from
  // overwriting an edit the user made before the network request came back.
  useEffect(() => {
    let cancelled = false
    hasLocalEditRef.current = false   // reset on household switch

    fetchCloudFinanceData(householdId).then((cloudData) => {
      if (cancelled) return

      if (cloudData) {
        // Case A: cloud has data — merge into local, but only if the user
        // hasn't already started editing (race-condition guard).
        if (!hasLocalEditRef.current) {
          const current = load(householdId)
          const merged  = repairSnapshotTotals(mergeFinanceData(cloudData, current))
          save(householdId, merged)
          setDataState(merged)
        }
      } else {
        // Case B: no cloud row yet — if local has data, seed the cloud now so
        // that any household member who joins will immediately see it.
        const current = load(householdId)
        if (!isLocalEmpty(current)) {
          pushCloudFinanceData(householdId, current) // immediate (no debounce)
        }
        // Case C falls through here: cloud empty + local empty → nothing to do.
      }

      setIsLoading(false)
    }).catch(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  // ── Writes: localStorage immediately, cloud debounced ─────────────────────
  const setData = useCallback((updater: (prev: FinanceData) => FinanceData) => {
    setDataState((prev) => {
      const next = updater(prev)
      save(householdId, next)

      // Mark that the user has made a local edit — the background cloud fetch
      // must not overwrite this if it resolves after this write.
      hasLocalEditRef.current = true

      // Debounce cloud push — cancel the previous timer and schedule a new one.
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
      pushTimerRef.current = setTimeout(() => {
        pushCloudFinanceData(householdId, next)
      }, CLOUD_PUSH_DEBOUNCE_MS)

      return next
    })
  }, [householdId])

  // Cleanup pending push timer on unmount / household switch.
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    }
  }, [householdId])

  // ── Domain helpers ─────────────────────────────────────────────────────────

  const addMember = (name: string) =>
    setData((d) => ({ ...d, members: [...d.members, { id: generateId(), name, sources: [] }] }))

  const updateMember = (member: HouseholdMember) =>
    setData((d) => ({ ...d, members: d.members.map((m) => (m.id === member.id ? member : m)) }))

  const deleteMember = (id: string) =>
    setData((d) => ({ ...d, members: d.members.filter((m) => m.id !== id) }))

  const addExpense = (expense: Omit<Expense, 'id'>) =>
    setData((d) => {
      const newExpense: Expense = { ...expense, id: generateId() }
      const newExpenses = [...d.expenses, newExpense]

      // Sync monthlyContribution on the linked account (atomic update)
      if (newExpense.linkedAccountId && newExpense.category === 'savings') {
        const monthly = newExpense.period === 'yearly' ? newExpense.amount / 12 : newExpense.amount
        const newAccounts = d.accounts.map((a) =>
          a.id === newExpense.linkedAccountId ? { ...a, monthlyContribution: monthly } : a
        )
        return { ...d, expenses: newExpenses, accounts: newAccounts }
      }

      return { ...d, expenses: newExpenses }
    })

  const updateExpense = (expense: Expense) =>
    setData((d) => {
      const oldExpense = d.expenses.find((e) => e.id === expense.id)
      const newExpenses = d.expenses.map((e) => (e.id === expense.id ? expense : e))

      // Determine if account sync is needed
      const oldLinkedId = oldExpense?.linkedAccountId
      const newLinkedId = expense.linkedAccountId
      const accountChanged = oldLinkedId !== newLinkedId
      const categoryChangedFromSavings = oldExpense?.category === 'savings' && expense.category !== 'savings'

      let newAccounts = d.accounts

      // Reset old account's contribution if:
      //   - old expense had a linked account, AND
      //   - (the linked account changed, OR the category changed away from savings)
      if (oldLinkedId && (accountChanged || categoryChangedFromSavings)) {
        newAccounts = newAccounts.map((a) =>
          a.id === oldLinkedId ? { ...a, monthlyContribution: 0 } : a
        )
      }

      // Set new account's contribution if new expense is still savings-linked
      if (newLinkedId && expense.category === 'savings') {
        const monthly = expense.period === 'yearly' ? expense.amount / 12 : expense.amount
        newAccounts = newAccounts.map((a) =>
          a.id === newLinkedId ? { ...a, monthlyContribution: monthly } : a
        )
      }

      return { ...d, expenses: newExpenses, accounts: newAccounts }
    })

  const deleteExpense = (id: string) =>
    setData((d) => {
      const toDelete = d.expenses.find((e) => e.id === id)
      const newExpenses = d.expenses.filter((e) => e.id !== id)

      // Reset contribution on the linked account when a savings expense is deleted
      if (toDelete?.linkedAccountId && toDelete.category === 'savings') {
        const newAccounts = d.accounts.map((a) =>
          a.id === toDelete.linkedAccountId ? { ...a, monthlyContribution: 0 } : a
        )
        return { ...d, expenses: newExpenses, accounts: newAccounts }
      }

      return { ...d, expenses: newExpenses }
    })

  const addAccount = (account: Omit<SavingsAccount, 'id'>) =>
    setData((d) => ({ ...d, accounts: [...d.accounts, { ...account, id: generateId() }] }))

  const updateAccount = (account: SavingsAccount) =>
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === account.id ? account : a)) }))

  const deleteAccount = (id: string) =>
    setData((d) => ({ ...d, accounts: d.accounts.filter((a) => a.id !== id) }))

  const addGoal = (goal: Omit<Goal, 'id'>) =>
    setData((d) => ({ ...d, goals: [...d.goals, { ...goal, id: generateId() }] }))

  const updateGoal = (goal: Goal) =>
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === goal.id ? goal : g)) }))

  const deleteGoal = (id: string) =>
    setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }))

  const moveGoal = (id: string, direction: 'up' | 'down') =>
    setData((d) => {
      const goals = [...d.goals]
      const idx  = goals.findIndex((g) => g.id === id)
      const swap = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= goals.length) return d
      ;[goals[idx], goals[swap]] = [goals[swap], goals[idx]]
      return { ...d, goals }
    })

  const snapshotMonth = () =>
    setData((d) => {
      const totalIncome   = d.members.reduce((s, m) => s + m.sources.reduce((ss, src) => ss + getNetMonthly(src), 0), 0)
      const totalExpenses = d.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0)
      const totalSavings  = d.accounts.reduce((s, a) => s + a.monthlyContribution, 0)
      const label         = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      // Pre-populate category actuals with planned amounts at snapshot time.
      // Users can edit these retroactively in the History tab after the month ends.
      const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
      d.expenses.forEach((e) => {
        const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
        categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
      })

      const snapshot: MonthSnapshot = {
        id: generateId(), label,
        date: new Date().toISOString(),
        totalIncome, totalExpenses, totalSavings,
        freeCashFlow: totalIncome - totalExpenses - totalSavings,
        categoryActuals,
      }
      return { ...d, history: [...d.history, snapshot] }
    })

  const snapshotPreviousMonth = () =>
    setData((d) => {
      const now = new Date()
      // getMonth() is 0-indexed; previous month is 1-indexed
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
      const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

      // Don't create a duplicate if one already exists for that month/year
      const alreadyExists = d.history.some((s) => {
        const sd = new Date(s.date)
        return sd.getFullYear() === prevYear && sd.getMonth() + 1 === prevMonth
      })
      if (alreadyExists) return d

      const prevDate = new Date(prevYear, prevMonth - 1, 1)
      const label = prevDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      const totalIncome   = d.members.reduce((s, m) => s + m.sources.reduce((ss, src) => ss + getNetMonthly(src), 0), 0)
      const totalExpenses = d.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0)
      const totalSavings  = d.accounts.reduce((s, a) => s + a.monthlyContribution, 0)

      const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
      d.expenses.forEach((e) => {
        const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
        categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
      })

      const snapshot: MonthSnapshot = {
        id: `snap-${prevYear}-${prevMonth}`,
        label,
        date: prevDate.toISOString(),
        totalIncome,
        totalExpenses,
        totalSavings,
        freeCashFlow: totalIncome - totalExpenses - totalSavings,
        categoryActuals,
      }
      return { ...d, history: [...d.history, snapshot] }
    })

  const updateCategoryBudget = (category: ExpenseCategory, budget: number | undefined) =>
    setData((d) => {
      const next = { ...d.categoryBudgets }
      if (budget === undefined || budget <= 0) delete next[category]
      else next[category] = budget
      return { ...d, categoryBudgets: next }
    })

  const updateSnapshotActuals = (snapshotId: string, actuals: Partial<Record<ExpenseCategory, number>>) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => h.id === snapshotId ? { ...h, categoryActuals: actuals } : h),
    }))

  const addHistoricalExpense = (snapshotId: string, item: Omit<HistoricalExpense, 'id'>) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const newItem: HistoricalExpense = { ...item, id: generateId() }
        const prevActuals = h.categoryActuals ?? {}
        const newActuals = {
          ...prevActuals,
          [item.category]: (prevActuals[item.category] ?? 0) + item.amount,
        }
        const newTotalExpenses = Object.values(newActuals).reduce((s, v) => s + v, 0)
        return {
          ...h,
          historicalExpenses: [...(h.historicalExpenses ?? []), newItem],
          categoryActuals: newActuals,
          totalExpenses: newTotalExpenses,
          freeCashFlow: h.totalIncome - newTotalExpenses - h.totalSavings,
        }
      }),
    }))

  const deleteHistoricalExpense = (snapshotId: string, itemId: string) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const toDelete = (h.historicalExpenses ?? []).find((e) => e.id === itemId)
        if (!toDelete) return h
        const prevActuals = h.categoryActuals ?? {}
        const newActuals = {
          ...prevActuals,
          [toDelete.category]: Math.max(0, (prevActuals[toDelete.category] ?? 0) - toDelete.amount),
        }
        const newTotalExpenses = Object.values(newActuals).reduce((s, v) => s + v, 0)
        return {
          ...h,
          historicalExpenses: (h.historicalExpenses ?? []).filter((e) => e.id !== itemId),
          categoryActuals: newActuals,
          totalExpenses: newTotalExpenses,
          freeCashFlow: h.totalIncome - newTotalExpenses - h.totalSavings,
        }
      }),
    }))

  const updateHistoricalExpense = (snapshotId: string, item: HistoricalExpense) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const old = (h.historicalExpenses ?? []).find((e) => e.id === item.id)
        if (!old) return h
        const newActuals = { ...(h.categoryActuals ?? {}) }
        newActuals[old.category] = Math.max(0, (newActuals[old.category] ?? 0) - old.amount)
        newActuals[item.category] = (newActuals[item.category] ?? 0) + item.amount
        const newTotalExpenses = Object.values(newActuals).reduce((s, v) => s + v, 0)
        return {
          ...h,
          historicalExpenses: (h.historicalExpenses ?? []).map((e) => e.id === item.id ? item : e),
          categoryActuals: newActuals,
          totalExpenses: newTotalExpenses,
          freeCashFlow: h.totalIncome - newTotalExpenses - h.totalSavings,
        }
      }),
    }))

  const addHistoricalIncome = (snapshotId: string, item: Omit<HistoricalIncome, 'id'>) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const newItem: HistoricalIncome = { ...item, id: generateId() }
        const newTotalIncome = h.totalIncome + item.amount
        return {
          ...h,
          historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
          totalIncome:  newTotalIncome,
          freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
        }
      }),
    }))

  const deleteHistoricalIncome = (snapshotId: string, itemId: string) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const toDelete = (h.historicalIncomes ?? []).find((i) => i.id === itemId)
        if (!toDelete) return h
        const newTotalIncome = Math.max(0, h.totalIncome - toDelete.amount)
        return {
          ...h,
          historicalIncomes: (h.historicalIncomes ?? []).filter((i) => i.id !== itemId),
          totalIncome:  newTotalIncome,
          freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
        }
      }),
    }))

  const updateHistoricalIncome = (snapshotId: string, item: HistoricalIncome) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.id !== snapshotId) return h
        const old = (h.historicalIncomes ?? []).find((i) => i.id === item.id)
        if (!old) return h
        const newTotalIncome = Math.max(0, h.totalIncome - old.amount) + item.amount
        return {
          ...h,
          historicalIncomes: (h.historicalIncomes ?? []).map((i) => i.id === item.id ? item : i),
          totalIncome:  newTotalIncome,
          freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
        }
      }),
    }))

  const addExpenseToMonth = (year: number, month: number, item: Omit<HistoricalExpense, 'id'>) =>
    setData((d) => {
      const newItem: HistoricalExpense = { ...item, id: generateId() }
      const label = `${MONTH_NAMES_EN[month - 1]} ${year}`
      const targetDate = new Date(year, month - 1, 1).toISOString()

      const existingIdx = d.history.findIndex((h) => {
        const hDate = new Date(h.date)
        return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
      })

      if (existingIdx !== -1) {
        return {
          ...d,
          history: d.history.map((h, i) => {
            if (i !== existingIdx) return h
            const prevActuals = h.categoryActuals ?? {}
            return {
              ...h,
              historicalExpenses: [...(h.historicalExpenses ?? []), newItem],
              categoryActuals: {
                ...prevActuals,
                [item.category]: (prevActuals[item.category] ?? 0) + item.amount,
              },
            }
          }),
        }
      } else {
        // Pre-populate stub with fixed recurring expenses (rent, insurance, etc.)
        // Variable expenses are excluded — they differ month to month.
        const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
        let fixedTotal = 0
        d.expenses
          .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
          .forEach((e) => {
            const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
            categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
            fixedTotal += monthly
          })
        // Stack the manually-entered one-off item on top
        categoryActuals[item.category] = (categoryActuals[item.category] ?? 0) + item.amount

        const stub: MonthSnapshot = {
          id: generateId(),
          label,
          date: targetDate,
          totalIncome: 0,           // unknown — income is not tracked for retroactive stubs
          totalExpenses: fixedTotal + item.amount,
          totalSavings: 0,          // unknown
          freeCashFlow: 0,          // unknown — not computed to avoid misleading negative display
          categoryActuals,
          historicalExpenses: [newItem],
        }
        return { ...d, history: [...d.history, stub] }
      }
    })

  const addIncomeToMonth = (year: number, month: number, item: Omit<HistoricalIncome, 'id'>) =>
    setData((d) => {
      const newItem: HistoricalIncome = { ...item, id: generateId() }
      const label = `${MONTH_NAMES_EN[month - 1]} ${year}`
      const targetDate = new Date(year, month - 1, 1).toISOString()

      const existingIdx = d.history.findIndex((h) => {
        const hDate = new Date(h.date)
        return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
      })

      if (existingIdx !== -1) {
        const h = d.history[existingIdx]
        const newTotalIncome = h.totalIncome + newItem.amount
        const updated = {
          ...h,
          totalIncome: newTotalIncome,
          freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
          historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
        }
        const newHistory = [...d.history]
        newHistory[existingIdx] = updated
        return { ...d, history: newHistory }
      } else {
        // Build stub — pre-populate fixed recurring expenses (v2.4.1 pattern)
        const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
        let fixedTotal = 0
        d.expenses
          .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
          .forEach((e) => {
            const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
            categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
            fixedTotal += monthly
          })
        const stub: MonthSnapshot = {
          id: generateId(),
          label,
          date: targetDate,
          totalIncome: newItem.amount,
          totalExpenses: fixedTotal,
          totalSavings: 0,
          freeCashFlow: newItem.amount - fixedTotal,
          categoryActuals,
          historicalIncomes: [newItem],
        }
        return { ...d, history: [...d.history, stub] }
      }
    })

  const markSurplusActioned = (snapshotId: string) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) =>
        h.id === snapshotId ? { ...h, surplusActioned: true } : h
      ),
    }))

  const recordSurplusAllocation = (
    snapshotId: string,
    allocation: { amount: number; type: 'savings' | 'goal'; destinationId: string; destinationName: string }
  ) =>
    setData((d) => ({
      ...d,
      history: d.history.map((h) =>
        h.id === snapshotId
          ? {
              ...h,
              freeCashFlow: h.freeCashFlow - allocation.amount,
              surplusActioned: true,
              surplusAllocations: [
                ...(h.surplusAllocations ?? []),
                allocation,
              ],
            }
          : h
      ),
    }))

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'household-finance.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (json: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON — the file could not be parsed.')
    }

    // Basic type guard: must be a non-null object, not an array
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Invalid file format — expected a household finance JSON object.')
    }

    const obj = parsed as Record<string, unknown>

    // Validate critical array fields — if present, they must actually be arrays
    const arrayFields = ['members', 'expenses', 'accounts', 'goals', 'history'] as const
    for (const field of arrayFields) {
      if (field in obj && !Array.isArray(obj[field])) {
        throw new Error(`Invalid file format — "${field}" must be an array.`)
      }
    }

    setData(() => ({ ...defaultData, ...obj }))
  }

  return (
    <FinanceContext.Provider value={{
      data, isLoading, setData,
      addMember, updateMember, deleteMember,
      addExpense, updateExpense, deleteExpense,
      addAccount, updateAccount, deleteAccount,
      addGoal, updateGoal, deleteGoal, moveGoal,
      snapshotMonth, snapshotPreviousMonth, exportData, importData,
      updateCategoryBudget, updateSnapshotActuals,
      addHistoricalExpense, deleteHistoricalExpense, updateHistoricalExpense,
      addExpenseToMonth,
      addHistoricalIncome, deleteHistoricalIncome, updateHistoricalIncome,
      addIncomeToMonth,
      markSurplusActioned,
      recordSurplusAllocation,
    }}>
      {children}
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
