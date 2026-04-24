import React, { createContext, useContext, useState, useCallback } from 'react'
import type { FinanceData, HouseholdMember, Expense, SavingsAccount, Goal, MonthSnapshot } from '@/types'
import { generateId } from '@/lib/utils'
import { getNetMonthly } from '@/lib/taxEstimation'

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

interface FinanceContextType {
  data: FinanceData
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

export function FinanceProvider({ children, householdId }: { children: React.ReactNode; householdId: string }) {
  const [data, setDataState] = useState<FinanceData>(() => load(householdId))

  const setData = useCallback((updater: (prev: FinanceData) => FinanceData) => {
    setDataState((prev) => {
      const next = updater(prev)
      save(householdId, next)
      return next
    })
  }, [householdId])

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
      data, setData,
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
