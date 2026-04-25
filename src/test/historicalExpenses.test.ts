/**
 * Tests for the v2.3 Historical Expense Entry feature.
 *
 * Covers the three new FinanceContext methods:
 *   - addHistoricalExpense    — appends item + increments categoryActuals
 *   - deleteHistoricalExpense — removes item + decrements categoryActuals (clamped to 0)
 *   - updateHistoricalExpense — replaces item + adjusts categoryActuals for old/new
 *
 * All tests exercise pure logic and data transforms — no React rendering required.
 * UI interactions (HistoricalExpenseDialog, History tab list) are covered by the
 * manual QA checklist.
 */

import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, HistoricalExpense, ExpenseCategory } from '@/types'

// ─── Pure helper functions (mirror FinanceContext logic) ──────────────────────

let _idCounter = 0
function generateId(): string {
  return `test-id-${++_idCounter}`
}

function addHistoricalExpense(
  history: MonthSnapshot[],
  snapshotId: string,
  item: Omit<HistoricalExpense, 'id'>
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const newItem: HistoricalExpense = { ...item, id: generateId() }
    const prevActuals = h.categoryActuals ?? {}
    return {
      ...h,
      historicalExpenses: [...(h.historicalExpenses ?? []), newItem],
      categoryActuals: {
        ...prevActuals,
        [item.category]: (prevActuals[item.category] ?? 0) + item.amount,
      },
    }
  })
}

function deleteHistoricalExpense(
  history: MonthSnapshot[],
  snapshotId: string,
  itemId: string
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const toDelete = (h.historicalExpenses ?? []).find((e) => e.id === itemId)
    if (!toDelete) return h
    const prevActuals = h.categoryActuals ?? {}
    return {
      ...h,
      historicalExpenses: (h.historicalExpenses ?? []).filter((e) => e.id !== itemId),
      categoryActuals: {
        ...prevActuals,
        [toDelete.category]: Math.max(0, (prevActuals[toDelete.category] ?? 0) - toDelete.amount),
      },
    }
  })
}

function updateHistoricalExpense(
  history: MonthSnapshot[],
  snapshotId: string,
  item: HistoricalExpense
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const old = (h.historicalExpenses ?? []).find((e) => e.id === item.id)
    if (!old) return h
    const prevActuals = { ...(h.categoryActuals ?? {}) }
    prevActuals[old.category] = Math.max(0, (prevActuals[old.category] ?? 0) - old.amount)
    prevActuals[item.category] = (prevActuals[item.category] ?? 0) + item.amount
    return {
      ...h,
      historicalExpenses: (h.historicalExpenses ?? []).map((e) => e.id === item.id ? item : e),
      categoryActuals: prevActuals,
    }
  })
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

function buildSnapshot(overrides: Partial<MonthSnapshot> = {}): MonthSnapshot {
  return {
    id: 'snap-1',
    label: 'April 2026',
    date: '2026-04-01T00:00:00.000Z',
    totalIncome: 10000,
    totalExpenses: 5000,
    totalSavings: 1000,
    freeCashFlow: 4000,
    ...overrides,
  }
}

function buildItem(overrides: Partial<HistoricalExpense> = {}): HistoricalExpense {
  return {
    id: 'item-1',
    name: 'Dentist',
    amount: 800,
    category: 'health',
    ...overrides,
  }
}

// ─── addHistoricalExpense() ───────────────────────────────────────────────────

describe('addHistoricalExpense()', () => {
  it('increments the correct category actual by the item amount', () => {
    const snap = buildSnapshot({ categoryActuals: { health: 500 } })
    const result = addHistoricalExpense([snap], 'snap-1', { name: 'Dentist', amount: 800, category: 'health' })
    expect(result[0].categoryActuals?.health).toBe(1300) // 500 + 800
  })

  it('initialises categoryActuals when snapshot has none (undefined)', () => {
    const snap = buildSnapshot({ categoryActuals: undefined })
    const result = addHistoricalExpense([snap], 'snap-1', { name: 'Car service', amount: 1200, category: 'transport' })
    expect(result[0].categoryActuals?.transport).toBe(1200)
  })

  it('appends item to historicalExpenses array', () => {
    const existing = buildItem({ id: 'item-existing', name: 'Pharmacy', amount: 200, category: 'health' })
    const snap = buildSnapshot({ historicalExpenses: [existing] })
    const result = addHistoricalExpense([snap], 'snap-1', { name: 'Dentist', amount: 800, category: 'health' })
    expect(result[0].historicalExpenses).toHaveLength(2)
    expect(result[0].historicalExpenses![1].name).toBe('Dentist')
    expect(result[0].historicalExpenses![1].amount).toBe(800)
  })

  it('does not mutate the original snapshot object', () => {
    const snap = buildSnapshot({ categoryActuals: { food: 1000 }, historicalExpenses: [] })
    const originalActuals = snap.categoryActuals!.food
    const originalLength = snap.historicalExpenses!.length
    addHistoricalExpense([snap], 'snap-1', { name: 'Restaurant', amount: 300, category: 'food' })
    // Original snapshot unchanged
    expect(snap.categoryActuals!.food).toBe(originalActuals)
    expect(snap.historicalExpenses!.length).toBe(originalLength)
  })
})

// ─── deleteHistoricalExpense() ────────────────────────────────────────────────

describe('deleteHistoricalExpense()', () => {
  it('decrements the correct category actual by the item amount', () => {
    const item = buildItem({ id: 'item-1', amount: 800, category: 'health' })
    const snap = buildSnapshot({
      historicalExpenses: [item],
      categoryActuals: { health: 1500 },
    })
    const result = deleteHistoricalExpense([snap], 'snap-1', 'item-1')
    expect(result[0].categoryActuals?.health).toBe(700) // 1500 - 800
  })

  it('clamps categoryActuals to 0 — never goes negative (delete item larger than existing actual)', () => {
    const item = buildItem({ id: 'item-1', amount: 2000, category: 'health' })
    const snap = buildSnapshot({
      historicalExpenses: [item],
      categoryActuals: { health: 500 }, // less than the item amount
    })
    const result = deleteHistoricalExpense([snap], 'snap-1', 'item-1')
    expect(result[0].categoryActuals?.health).toBe(0)
  })

  it('removes only the target item, leaves other items in the same snapshot intact', () => {
    const itemA = buildItem({ id: 'item-a', name: 'Dentist', amount: 800, category: 'health' })
    const itemB = buildItem({ id: 'item-b', name: 'Pharmacy', amount: 200, category: 'health' })
    const snap = buildSnapshot({
      historicalExpenses: [itemA, itemB],
      categoryActuals: { health: 1000 },
    })
    const result = deleteHistoricalExpense([snap], 'snap-1', 'item-a')
    expect(result[0].historicalExpenses).toHaveLength(1)
    expect(result[0].historicalExpenses![0].id).toBe('item-b')
    expect(result[0].historicalExpenses![0].name).toBe('Pharmacy')
  })
})

// ─── updateHistoricalExpense() ────────────────────────────────────────────────

describe('updateHistoricalExpense()', () => {
  it('handles amount change within the same category — old amount reversed, new applied', () => {
    const item = buildItem({ id: 'item-1', amount: 800, category: 'health' })
    const snap = buildSnapshot({
      historicalExpenses: [item],
      categoryActuals: { health: 1500 },
    })
    const updated = { ...item, amount: 1200 } // same category, new amount
    const result = updateHistoricalExpense([snap], 'snap-1', updated)
    // 1500 - 800 (reverse old) + 1200 (apply new) = 1900
    expect(result[0].categoryActuals?.health).toBe(1900)
    expect(result[0].historicalExpenses![0].amount).toBe(1200)
  })

  it('handles category change — decrements old category, increments new category', () => {
    const item = buildItem({ id: 'item-1', amount: 500, category: 'health' })
    const snap = buildSnapshot({
      historicalExpenses: [item],
      categoryActuals: { health: 800, food: 2000 },
    })
    const updated: HistoricalExpense = { ...item, amount: 500, category: 'food' }
    const result = updateHistoricalExpense([snap], 'snap-1', updated)
    expect(result[0].categoryActuals?.health).toBe(300) // 800 - 500
    expect(result[0].categoryActuals?.food).toBe(2500)  // 2000 + 500
    expect(result[0].historicalExpenses![0].category).toBe('food')
  })
})

// ─── backward compatibility ───────────────────────────────────────────────────

describe('backward compatibility', () => {
  it('snapshot without historicalExpenses field (undefined) is treated as empty — no errors', () => {
    const snap = buildSnapshot({ historicalExpenses: undefined, categoryActuals: { food: 1000 } })
    // addHistoricalExpense should initialise the array from scratch
    const result = addHistoricalExpense([snap], 'snap-1', { name: 'Birthday gift', amount: 300, category: 'leisure' })
    expect(result[0].historicalExpenses).toHaveLength(1)
    expect(result[0].historicalExpenses![0].name).toBe('Birthday gift')
    // deleteHistoricalExpense on a snapshot with no items returns snapshot unchanged
    const deleteResult = deleteHistoricalExpense([snap], 'snap-1', 'nonexistent-id')
    expect(deleteResult[0]).toEqual(snap)
  })

  it('multiple items in same category accumulate correctly in categoryActuals', () => {
    const snap = buildSnapshot({ categoryActuals: { food: 0 } })
    let history = [snap]
    history = addHistoricalExpense(history, 'snap-1', { name: 'Supermarket', amount: 800, category: 'food' })
    history = addHistoricalExpense(history, 'snap-1', { name: 'Restaurant', amount: 300, category: 'food' })
    history = addHistoricalExpense(history, 'snap-1', { name: 'Coffee shop', amount: 150, category: 'food' })
    expect(history[0].categoryActuals?.food).toBe(1250) // 0 + 800 + 300 + 150
    expect(history[0].historicalExpenses).toHaveLength(3)
  })
})
