/**
 * v4.3 — Savings account owner (spec: docs/v4/spec-v4.3-savings-owner.md).
 *
 * Data contract: the only model change is the optional `SavingsAccount.ownerMemberId`
 * (absent = Joint). It travels inside the account (accounts = additive mergeById,
 * unchanged), every account writer keeps it, and setting it never changes
 * accounts.length.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Expense, FinanceData, HouseholdMember, SavingsAccount } from '@/types'
import {
  JOINT_OWNER,
  filterAccountsByOwner,
  getAccountOwnerId,
  normalizeOwnerFilter,
  showOwnerUi,
  withOwner,
} from '@/lib/savingsOwner'
import { mergeFinanceData } from '@/lib/cloudFinance'
import { applyMonthlyContributions } from '@/lib/contributionEngine'
import { AccountDialog } from '@/components/savings/AccountDialog'
import { FinanceProvider, useFinance } from '@/context/FinanceContext'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabaseConfigured: false,
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}))
vi.mock('@/lib/cloudFinance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cloudFinance')>()
  return {
    ...actual,
    fetchCloudFinanceData: vi.fn(async () => null),
    pushCloudFinanceData: vi.fn(async () => {}),
  }
})

afterEach(() => cleanup())

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EILON: HouseholdMember = { id: 'm1', name: 'Eilon', sources: [] }
const SIVAN: HouseholdMember = { id: 'm2', name: 'Sivan', sources: [] }
const MEMBERS = [EILON, SIVAN]

function makeAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'a1',
    name: 'Pension',
    type: 'pension',
    balance: 1000,
    liquidity: 'locked',
    annualReturnPercent: 4,
    monthlyContribution: 500,
    ...overrides,
  }
}

function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    members: MEMBERS,
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

const eilonPension = makeAccount({ id: 'a1', ownerMemberId: 'm1' })
const sivanFund = makeAccount({ id: 'a2', name: 'Study fund', ownerMemberId: 'm2' })
const jointChecking = makeAccount({ id: 'a3', name: 'Checking', liquidity: 'immediate' })
const ghost = makeAccount({ id: 'a4', name: 'Old', ownerMemberId: 'deleted-member' })
const ALL = [eilonPension, sivanFund, jointChecking, ghost]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('getAccountOwnerId()', () => {
  it('returns the member id when it matches a member', () => {
    expect(getAccountOwnerId(eilonPension, MEMBERS)).toBe('m1')
  })
  it('absent owner → joint', () => {
    expect(getAccountOwnerId(jointChecking, MEMBERS)).toBe(JOINT_OWNER)
  })
  it('ghost member id → joint (display only)', () => {
    expect(getAccountOwnerId(ghost, MEMBERS)).toBe(JOINT_OWNER)
    expect(ghost.ownerMemberId).toBe('deleted-member')
  })
})

describe('withOwner()', () => {
  it('sets the owner and keeps every other field', () => {
    const a = makeAccount({ autoIncrementLog: [{ month: '2026-09', amount: 500 }], deductedFromSalary: true })
    const r = withOwner(a, 'm2')
    expect(r).toEqual({ ...a, ownerMemberId: 'm2' })
  })
  it('joint removes the field entirely', () => {
    const r = withOwner(eilonPension, JOINT_OWNER)
    expect('ownerMemberId' in r).toBe(false)
    const { ownerMemberId: _o, ...rest } = eilonPension
    expect(r).toEqual(rest)
  })
  it('never mutates the input', () => {
    const a = makeAccount({ ownerMemberId: 'm1' })
    withOwner(a, JOINT_OWNER)
    expect(a.ownerMemberId).toBe('m1')
  })
})

describe('showOwnerUi()', () => {
  it('needs 2+ members', () => {
    expect(showOwnerUi([])).toBe(false)
    expect(showOwnerUi([EILON])).toBe(false)
    expect(showOwnerUi(MEMBERS)).toBe(true)
  })
})

describe('filterAccountsByOwner()', () => {
  it('all returns every account (same reference)', () => {
    expect(filterAccountsByOwner(ALL, MEMBERS, 'all')).toBe(ALL)
  })
  it('member filter returns only that member’s accounts', () => {
    expect(filterAccountsByOwner(ALL, MEMBERS, 'm1').map((a) => a.id)).toEqual(['a1'])
    expect(filterAccountsByOwner(ALL, MEMBERS, 'm2').map((a) => a.id)).toEqual(['a2'])
  })
  it('joint includes unowned and ghost-owned accounts', () => {
    expect(filterAccountsByOwner(ALL, MEMBERS, JOINT_OWNER).map((a) => a.id)).toEqual(['a3', 'a4'])
  })
  it('partitions are complete — no account lost or double-counted', () => {
    const parts = ['m1', 'm2', JOINT_OWNER].flatMap((f) => filterAccountsByOwner(ALL, MEMBERS, f))
    expect(parts).toHaveLength(ALL.length)
    expect(new Set(parts.map((a) => a.id))).toEqual(new Set(ALL.map((a) => a.id)))
  })
  it('a filter for a removed member falls back to all', () => {
    expect(normalizeOwnerFilter('m9', MEMBERS)).toBe('all')
    expect(filterAccountsByOwner(ALL, MEMBERS, 'm9')).toBe(ALL)
  })
  it('empty accounts → empty', () => {
    expect(filterAccountsByOwner([], MEMBERS, 'm1')).toEqual([])
  })
})

// ─── Merge (🔴 Data Safety Protocol) ──────────────────────────────────────────

describe('mergeFinanceData keeps ownerMemberId', () => {
  it('empty cloud — local accounts survive with owners', () => {
    const local = makeData({ accounts: ALL })
    const merged = mergeFinanceData(makeData({ accounts: [] }), local)
    expect(merged.accounts).toHaveLength(ALL.length)
    expect(merged.accounts.find((a) => a.id === 'a1')!.ownerMemberId).toBe('m1')
  })
  it('empty local — cloud owners adopted in full', () => {
    const merged = mergeFinanceData(makeData({ accounts: ALL }), makeData({ accounts: [] }))
    expect(merged.accounts).toHaveLength(ALL.length)
    expect(merged.accounts.find((a) => a.id === 'a2')!.ownerMemberId).toBe('m2')
  })
  it('diverged — A+B local, B+C cloud → A+B+C, cloud wins on B', () => {
    const local = makeData({ accounts: [eilonPension, withOwner(sivanFund, JOINT_OWNER)] })
    const cloud = makeData({ accounts: [sivanFund, jointChecking] })
    const merged = mergeFinanceData(cloud, local)
    expect(merged.accounts.map((a) => a.id).sort()).toEqual(['a1', 'a2', 'a3'])
    expect(merged.accounts.length).toBeGreaterThanOrEqual(Math.max(local.accounts.length, cloud.accounts.length))
    expect(merged.accounts.find((a) => a.id === 'a1')!.ownerMemberId).toBe('m1')
    expect(merged.accounts.find((a) => a.id === 'a2')!.ownerMemberId).toBe('m2')
  })
})

// ─── Other account writers keep the owner ─────────────────────────────────────

describe('applyMonthlyContributions keeps ownerMemberId', () => {
  it('auto-increment preserves the owner', () => {
    const acct = makeAccount({ ownerMemberId: 'm1', lastAutoIncrementMonth: '2026-09' })
    const linked: Expense = {
      id: 'e1', name: 'Pension', amount: 500, category: 'savings', recurring: true,
      period: 'monthly', expenseType: 'fixed', linkedAccountId: 'a1',
    }
    const r = applyMonthlyContributions(makeData({ accounts: [acct], expenses: [linked] }), '2026-10')
    expect(r.accounts[0].balance).toBe(1500)
    expect(r.accounts[0].ownerMemberId).toBe('m1')
  })
})

describe('FinanceProvider account writers keep ownerMemberId', () => {
  const HH = 'hh-qa-v43'
  let api: ReturnType<typeof useFinance> | null = null
  function Probe() {
    api = useFinance()
    return null
  }

  afterEach(() => {
    api = null
    localStorage.clear()
  })

  async function mountWith(data: FinanceData) {
    localStorage.setItem(`hf-data-${HH}`, JSON.stringify(data))
    render(
      <FinanceProvider householdId={HH}>
        <Probe />
      </FinanceProvider>,
    )
    await act(async () => {})
  }

  const acct = (id: string) => api!.data.accounts.find((a) => a.id === id)!

  it('transfer, linked-expense sync and updateAccount keep owners; counts unchanged', async () => {
    await mountWith(makeData({ accounts: [eilonPension, sivanFund, jointChecking] }))
    const count = api!.data.accounts.length

    await act(async () => api!.transferBetweenAccounts('a1', 'a2', 100))
    expect(acct('a1').ownerMemberId).toBe('m1')
    expect(acct('a2').ownerMemberId).toBe('m2')

    await act(async () =>
      api!.addExpense({ name: 'Pension', amount: 700, category: 'savings', recurring: true, period: 'monthly', linkedAccountId: 'a1' }),
    )
    expect(acct('a1').monthlyContribution).toBe(700)
    expect(acct('a1').ownerMemberId).toBe('m1')

    await act(async () => api!.updateAccount(withOwner(acct('a3'), 'm2')))
    expect(acct('a3').ownerMemberId).toBe('m2')
    expect(api!.data.accounts).toHaveLength(count)
  })
})

// ─── AccountDialog ────────────────────────────────────────────────────────────

describe('AccountDialog owner field', () => {
  const saveButton = () => screen.getByRole('button', { name: 'Save' })

  it('hidden with fewer than 2 members; edit keeps the stored owner', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} existing={eilonPension} onSave={onSave} members={[EILON]} currency="ILS" locale="he-IL" lang="en" />)
    expect(screen.queryByRole('radiogroup', { name: 'Belongs to' })).toBeNull()
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].ownerMemberId).toBe('m1')
  })

  it('new account defaults to Joint (no field saved)', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} onSave={onSave} members={MEMBERS} currency="ILS" locale="he-IL" lang="en" />)
    expect(screen.getByRole('radio', { name: 'Joint' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(saveButton())
    expect('ownerMemberId' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('defaultOwner pre-selects a member', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} onSave={onSave} members={MEMBERS} defaultOwner="m2" currency="ILS" locale="he-IL" lang="en" />)
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].ownerMemberId).toBe('m2')
  })

  it('choosing a member sets the owner; other fields untouched', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} existing={jointChecking} onSave={onSave} members={MEMBERS} currency="ILS" locale="he-IL" lang="en" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Sivan' }))
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0]).toEqual({ ...jointChecking, deductedFromSalary: false, ownerMemberId: 'm2' })
  })

  it('switching back to Joint removes the field', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} existing={eilonPension} onSave={onSave} members={MEMBERS} currency="ILS" locale="he-IL" lang="en" />)
    expect(screen.getByRole('radio', { name: 'Eilon' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Joint' }))
    fireEvent.click(saveButton())
    expect('ownerMemberId' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('editing another field keeps the owner', () => {
    const onSave = vi.fn()
    render(<AccountDialog open onOpenChange={() => {}} existing={sivanFund} onSave={onSave} members={MEMBERS} currency="ILS" locale="he-IL" lang="en" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Study fund 2' } })
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Study fund 2', ownerMemberId: 'm2' })
  })
})
