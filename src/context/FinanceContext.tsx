import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { FinanceData, HouseholdMember, Expense, SavingsAccount, Goal, MonthSnapshot } from '@/types'
import { generateId } from '@/lib/utils'
import { getNetMonthly } from '@/lib/taxEstimation'
import { fetchCloudFinanceData, pushCloudFinanceData, mergeFinanceData } from '@/lib/cloudFinance'
import { supabaseConfigured } from '@/lib/supabase'

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
}

function storageKey(householdId: string) { return `hf-data-${householdId}` }

function load(householdId: string): FinanceData {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (raw) return { ...defaultData, ...JSON.parse(raw) }
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
  exportData: () => void
  importData: (json: string) => void
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
          const merged  = mergeFinanceData(cloudData, current)
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
    setData((d) => ({ ...d, expenses: [...d.expenses, { ...expense, id: generateId() }] }))

  const updateExpense = (expense: Expense) =>
    setData((d) => ({ ...d, expenses: d.expenses.map((e) => (e.id === expense.id ? expense : e)) }))

  const deleteExpense = (id: string) =>
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }))

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
      const snapshot: MonthSnapshot = {
        id: generateId(), label,
        date: new Date().toISOString(),
        totalIncome, totalExpenses, totalSavings,
        freeCashFlow: totalIncome - totalExpenses - totalSavings,
      }
      return { ...d, history: [...d.history, snapshot] }
    })

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'household-finance.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (json: string) => {
    const parsed = JSON.parse(json)
    setData(() => ({ ...defaultData, ...parsed }))
  }

  return (
    <FinanceContext.Provider value={{
      data, isLoading, setData,
      addMember, updateMember, deleteMember,
      addExpense, updateExpense, deleteExpense,
      addAccount, updateAccount, deleteAccount,
      addGoal, updateGoal, deleteGoal, moveGoal,
      snapshotMonth, exportData, importData,
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
