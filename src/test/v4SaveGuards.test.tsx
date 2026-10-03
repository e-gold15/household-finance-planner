/**
 * v4.0 data-safety save guards (Code Review B1 / M1).
 *
 * B1 — Quick Add must never write while FinanceContext.isLoading is true (the
 *      first cloud pull has not completed). A write in that window schedules a
 *      debounced push of near-empty local data that could overwrite the cloud row.
 * M1 — AccountDialog must block Save when a non-empty numeric field fails to
 *      parse (a typo must never silently zero a stored balance), while an empty
 *      field still saves as 0 (v3 behaviour).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { FinanceData } from '@/types'

// ─── Mock FinanceContext ──────────────────────────────────────────────────────

const { finance } = vi.hoisted(() => ({
  finance: {
    isLoading: false,
    addExpense: vi.fn(),
    addExpenseToMonth: vi.fn(),
  },
}))

const BASE_DATA: FinanceData = {
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

vi.mock('@/context/FinanceContext', () => ({
  useFinance: () => ({
    data: BASE_DATA,
    setData: vi.fn(),
    isLoading: finance.isLoading,
    addExpense: finance.addExpense,
    addExpenseToMonth: finance.addExpenseToMonth,
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { QuickAddSheet } from '@/components/quick-add/QuickAddSheet'
import { AccountDialog } from '@/components/savings/AccountDialog'

// jsdom gaps used by Radix primitives
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  finance.isLoading = false
  finance.addExpense.mockReset()
  finance.addExpenseToMonth.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillQuickAdd(amount: string) {
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } })
  const chips = screen.getAllByRole('radio')
  // first category chip (no chip is preselected)
  fireEvent.click(chips[0])
}

function saveButton() {
  return screen.getByRole('button', { name: 'Save' })
}

// ─── B1: Quick Add while loading ──────────────────────────────────────────────

describe('QuickAddSheet — isLoading guard (B1)', () => {
  it('does not call addExpense when isLoading=true, even with a valid amount and category', () => {
    finance.isLoading = true
    render(<QuickAddSheet open onOpenChange={() => {}} />)
    fillQuickAdd('120')
    act(() => {
      fireEvent.click(saveButton())
    })
    // Also try the form submit path (Enter key)
    const form = screen.getByLabelText('Amount').closest('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    expect(finance.addExpense).not.toHaveBeenCalled()
    expect(finance.addExpenseToMonth).not.toHaveBeenCalled()
  })

  it('does not call addExpenseToMonth for a past-month entry when isLoading=true', () => {
    finance.isLoading = true
    render(<QuickAddSheet open onOpenChange={() => {}} />)
    fillQuickAdd('80')
    fireEvent.click(screen.getByRole('radio', { name: /Earlier month/ }))
    act(() => {
      fireEvent.submit(screen.getByLabelText('Amount').closest('form') as HTMLFormElement)
    })
    expect(finance.addExpense).not.toHaveBeenCalled()
    expect(finance.addExpenseToMonth).not.toHaveBeenCalled()
  })

  it('calls addExpense exactly once when isLoading=false', () => {
    const onOpenChange = vi.fn()
    render(<QuickAddSheet open onOpenChange={onOpenChange} />)
    fillQuickAdd('120')
    act(() => {
      fireEvent.click(saveButton())
    })
    expect(finance.addExpense).toHaveBeenCalledTimes(1)
    expect(finance.addExpense.mock.calls[0][0]).toMatchObject({ amount: 120, period: 'monthly', expenseType: 'variable' })
    expect(finance.addExpenseToMonth).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls addExpenseToMonth for a past-month entry when isLoading=false', () => {
    render(<QuickAddSheet open onOpenChange={() => {}} />)
    fillQuickAdd('80')
    fireEvent.click(screen.getByRole('radio', { name: /Earlier month/ }))
    act(() => {
      fireEvent.submit(screen.getByLabelText('Amount').closest('form') as HTMLFormElement)
    })
    expect(finance.addExpenseToMonth).toHaveBeenCalledTimes(1)
    const [year, month, item] = finance.addExpenseToMonth.mock.calls[0]
    expect(typeof year).toBe('number')
    expect(month).toBeGreaterThanOrEqual(1)
    expect(month).toBeLessThanOrEqual(12)
    expect(item).toMatchObject({ amount: 80 })
    expect(finance.addExpense).not.toHaveBeenCalled()
  })

  it('Save stays disabled with no amount', () => {
    render(<QuickAddSheet open onOpenChange={() => {}} />)
    fireEvent.click(screen.getAllByRole('radio')[0])
    expect(saveButton()).toBeDisabled()
  })
})

// ─── M1: AccountDialog invalid numeric input ──────────────────────────────────

describe('AccountDialog — invalid number guard (M1)', () => {
  function renderDialog(onSave = vi.fn()) {
    render(
      <AccountDialog open onOpenChange={() => {}} onSave={onSave} currency="ILS" locale="he-IL" lang="en" />
    )
    return onSave
  }

  it('balance "1.2.3" disables Save, shows an error, and never calls onSave', () => {
    const onSave = renderDialog()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Emergency' } })
    fireEvent.change(screen.getByLabelText('Current Balance'), { target: { value: '1.2.3' } })
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid number')
    fireEvent.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('an invalid annual return also blocks Save', () => {
    const onSave = renderDialog()
    fireEvent.change(screen.getByLabelText('Annual Return %'), { target: { value: '3..5' } })
    expect(saveButton()).toBeDisabled()
    fireEvent.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('empty balance saves as 0 (not NaN, not blocked)', () => {
    const onSave = renderDialog()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Checking' } })
    expect(saveButton()).not.toBeDisabled()
    fireEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved.balance).toBe(0)
    expect(saved.annualReturnPercent).toBe(0)
    expect(saved.monthlyContribution).toBe(0)
  })

  it('a valid balance saves the parsed number', () => {
    const onSave = renderDialog()
    fireEvent.change(screen.getByLabelText('Current Balance'), { target: { value: '12,500.5' } })
    expect(saveButton()).not.toBeDisabled()
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].balance).toBe(12500.5)
  })

  it('correcting an invalid value re-enables Save', () => {
    const onSave = renderDialog()
    const balance = screen.getByLabelText('Current Balance')
    fireEvent.change(balance, { target: { value: '1.2.3' } })
    expect(saveButton()).toBeDisabled()
    fireEvent.change(balance, { target: { value: '1.23' } })
    expect(saveButton()).not.toBeDisabled()
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].balance).toBe(1.23)
  })
})
