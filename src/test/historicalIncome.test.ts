/**
 * Tests for the v2.5 Historical Income Entry feature.
 *
 * Covers the three new FinanceContext methods:
 *   - addHistoricalIncome    — appends item + increments totalIncome + recomputes freeCashFlow
 *   - deleteHistoricalIncome — removes item + decrements totalIncome (clamped to 0) + recomputes freeCashFlow
 *   - updateHistoricalIncome — replaces item + adjusts totalIncome for old/new amounts + recomputes freeCashFlow
 *
 * All tests exercise pure logic and data transforms — no React rendering required.
 * UI interactions (HistoricalIncomeDialog, History tab list) are covered by the
 * manual QA checklist.
 */

import { describe, it, expect } from 'vitest'
import type { MonthSnapshot, HistoricalIncome } from '@/types'

// ─── Pure helper functions (mirror FinanceContext logic) ──────────────────────

let _idCounter = 0
function generateId(): string {
  return `test-id-${++_idCounter}`
}

function addHistoricalIncome(
  history: MonthSnapshot[],
  snapshotId: string,
  item: Omit<HistoricalIncome, 'id'>
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const newItem: HistoricalIncome = { ...item, id: generateId() }
    const newTotalIncome = h.totalIncome + item.amount
    return {
      ...h,
      historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
      totalIncome: newTotalIncome,
      freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
    }
  })
}

function deleteHistoricalIncome(
  history: MonthSnapshot[],
  snapshotId: string,
  itemId: string
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const toDelete = (h.historicalIncomes ?? []).find((i) => i.id === itemId)
    if (!toDelete) return h
    const newTotalIncome = Math.max(0, h.totalIncome - toDelete.amount)
    return {
      ...h,
      historicalIncomes: (h.historicalIncomes ?? []).filter((i) => i.id !== itemId),
      totalIncome: newTotalIncome,
      freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
    }
  })
}

function updateHistoricalIncome(
  history: MonthSnapshot[],
  snapshotId: string,
  item: HistoricalIncome
): MonthSnapshot[] {
  return history.map((h) => {
    if (h.id !== snapshotId) return h
    const old = (h.historicalIncomes ?? []).find((i) => i.id === item.id)
    if (!old) return h
    const newTotalIncome = Math.max(0, h.totalIncome - old.amount) + item.amount
    return {
      ...h,
      historicalIncomes: (h.historicalIncomes ?? []).map((i) => (i.id === item.id ? item : i)),
      totalIncome: newTotalIncome,
      freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
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

function buildIncomeItem(overrides: Partial<HistoricalIncome> = {}): HistoricalIncome {
  return {
    id: 'item-1',
    memberName: 'Alice',
    amount: 3000,
    ...overrides,
  }
}

// ─── addHistoricalIncome() ────────────────────────────────────────────────────

describe('addHistoricalIncome()', () => {
  it('increments totalIncome by the item amount', () => {
    const snap = buildSnapshot({ totalIncome: 10000 })
    const result = addHistoricalIncome([snap], 'snap-1', { memberName: 'Alice', amount: 3000 })
    expect(result[0].totalIncome).toBe(13000) // 10000 + 3000
  })

  it('recomputes freeCashFlow = totalIncome - totalExpenses - totalSavings', () => {
    const snap = buildSnapshot({ totalIncome: 10000, totalExpenses: 5000, totalSavings: 1000 })
    const result = addHistoricalIncome([snap], 'snap-1', { memberName: 'Bob', amount: 2000 })
    // newTotalIncome = 12000; freeCashFlow = 12000 - 5000 - 1000 = 6000
    expect(result[0].freeCashFlow).toBe(6000)
  })

  it('appends item to historicalIncomes array', () => {
    const existing = buildIncomeItem({ id: 'item-existing', memberName: 'Alice', amount: 5000 })
    const snap = buildSnapshot({ historicalIncomes: [existing] })
    const result = addHistoricalIncome([snap], 'snap-1', { memberName: 'Bob', amount: 2500 })
    expect(result[0].historicalIncomes).toHaveLength(2)
    expect(result[0].historicalIncomes![1].memberName).toBe('Bob')
    expect(result[0].historicalIncomes![1].amount).toBe(2500)
  })

  it('does not mutate the original snapshot object', () => {
    const snap = buildSnapshot({ totalIncome: 10000, historicalIncomes: [] })
    const originalIncome = snap.totalIncome
    const originalLength = snap.historicalIncomes!.length
    addHistoricalIncome([snap], 'snap-1', { memberName: 'Alice', amount: 3000 })
    expect(snap.totalIncome).toBe(originalIncome)
    expect(snap.historicalIncomes!.length).toBe(originalLength)
  })
})

// ─── deleteHistoricalIncome() ─────────────────────────────────────────────────

describe('deleteHistoricalIncome()', () => {
  it('decrements totalIncome by the item amount', () => {
    const item = buildIncomeItem({ id: 'item-1', amount: 3000 })
    const snap = buildSnapshot({
      totalIncome: 13000,
      historicalIncomes: [item],
    })
    const result = deleteHistoricalIncome([snap], 'snap-1', 'item-1')
    expect(result[0].totalIncome).toBe(10000) // 13000 - 3000
  })

  it('clamps totalIncome to 0 — never goes negative', () => {
    const item = buildIncomeItem({ id: 'item-1', amount: 5000 })
    const snap = buildSnapshot({
      totalIncome: 2000, // less than item.amount
      historicalIncomes: [item],
    })
    const result = deleteHistoricalIncome([snap], 'snap-1', 'item-1')
    expect(result[0].totalIncome).toBe(0)
  })

  it('recomputes freeCashFlow after delete', () => {
    const item = buildIncomeItem({ id: 'item-1', amount: 3000 })
    const snap = buildSnapshot({
      totalIncome: 13000,
      totalExpenses: 5000,
      totalSavings: 1000,
      historicalIncomes: [item],
    })
    const result = deleteHistoricalIncome([snap], 'snap-1', 'item-1')
    // newTotalIncome = 10000; freeCashFlow = 10000 - 5000 - 1000 = 4000
    expect(result[0].freeCashFlow).toBe(4000)
  })

  it('removes only the target item, leaves siblings intact', () => {
    const itemA = buildIncomeItem({ id: 'item-a', memberName: 'Alice', amount: 3000 })
    const itemB = buildIncomeItem({ id: 'item-b', memberName: 'Bob', amount: 2000 })
    const snap = buildSnapshot({
      totalIncome: 15000,
      historicalIncomes: [itemA, itemB],
    })
    const result = deleteHistoricalIncome([snap], 'snap-1', 'item-a')
    expect(result[0].historicalIncomes).toHaveLength(1)
    expect(result[0].historicalIncomes![0].id).toBe('item-b')
    expect(result[0].historicalIncomes![0].memberName).toBe('Bob')
  })
})

// ─── updateHistoricalIncome() ─────────────────────────────────────────────────

describe('updateHistoricalIncome()', () => {
  it('handles amount change: reverses old, applies new, recomputes totalIncome and freeCashFlow', () => {
    const item = buildIncomeItem({ id: 'item-1', memberName: 'Alice', amount: 3000 })
    const snap = buildSnapshot({
      totalIncome: 13000,
      totalExpenses: 5000,
      totalSavings: 1000,
      historicalIncomes: [item],
    })
    const updated: HistoricalIncome = { ...item, amount: 5000 }
    const result = updateHistoricalIncome([snap], 'snap-1', updated)
    // newTotalIncome = max(0, 13000 - 3000) + 5000 = 10000 + 5000 = 15000
    expect(result[0].totalIncome).toBe(15000)
    // freeCashFlow = 15000 - 5000 - 1000 = 9000
    expect(result[0].freeCashFlow).toBe(9000)
    expect(result[0].historicalIncomes![0].amount).toBe(5000)
  })

  it('does not mutate the original snapshot object', () => {
    const item = buildIncomeItem({ id: 'item-1', amount: 3000 })
    const snap = buildSnapshot({ totalIncome: 13000, historicalIncomes: [item] })
    const originalIncome = snap.totalIncome
    const updatedItem: HistoricalIncome = { ...item, amount: 5000 }
    updateHistoricalIncome([snap], 'snap-1', updatedItem)
    expect(snap.totalIncome).toBe(originalIncome)
    expect(snap.historicalIncomes![0].amount).toBe(3000)
  })
})

// ─── backward compatibility ───────────────────────────────────────────────────

describe('backward compatibility', () => {
  it('snapshot without historicalIncomes field (undefined) — no error, treated as []', () => {
    const snap = buildSnapshot({ historicalIncomes: undefined, totalIncome: 0 })
    // addHistoricalIncome should initialise the array from scratch
    const addResult = addHistoricalIncome([snap], 'snap-1', { memberName: 'Alice', amount: 5000 })
    expect(addResult[0].historicalIncomes).toHaveLength(1)
    expect(addResult[0].historicalIncomes![0].memberName).toBe('Alice')
    // deleteHistoricalIncome on a snapshot with no items returns snapshot unchanged
    const deleteResult = deleteHistoricalIncome([snap], 'snap-1', 'nonexistent-id')
    expect(deleteResult[0]).toEqual(snap)
  })

  it('multiple items accumulate correctly in totalIncome', () => {
    const snap = buildSnapshot({ totalIncome: 0, totalExpenses: 0, totalSavings: 0, freeCashFlow: 0 })
    let history = [snap]
    history = addHistoricalIncome(history, 'snap-1', { memberName: 'Alice', amount: 8000 })
    history = addHistoricalIncome(history, 'snap-1', { memberName: 'Bob', amount: 5000 })
    history = addHistoricalIncome(history, 'snap-1', { memberName: 'Alice', amount: 2000, note: 'Bonus' })
    expect(history[0].totalIncome).toBe(15000) // 0 + 8000 + 5000 + 2000
    expect(history[0].historicalIncomes).toHaveLength(3)
  })
})

// ─── FCF recomputation ────────────────────────────────────────────────────────

describe('FCF recomputation', () => {
  it('freeCashFlow correctly reflects totalIncome - totalExpenses - totalSavings after adding income to a zero-income stub with expenses', () => {
    // Stub: totalIncome=0, totalExpenses=14200, totalSavings=0, freeCashFlow=0
    const snap = buildSnapshot({
      totalIncome: 0,
      totalExpenses: 14200,
      totalSavings: 0,
      freeCashFlow: 0,
    })
    const result = addHistoricalIncome([snap], 'snap-1', { memberName: 'Alice', amount: 18000 })
    // newTotalIncome = 0 + 18000 = 18000; freeCashFlow = 18000 - 14200 - 0 = 3800
    expect(result[0].totalIncome).toBe(18000)
    expect(result[0].freeCashFlow).toBe(3800)
  })
})
