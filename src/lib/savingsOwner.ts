import type { HouseholdMember, SavingsAccount } from '@/types'

/**
 * v4.3 — savings account owner (spec: docs/v4/spec-v4.3-savings-owner.md).
 *
 * `SavingsAccount.ownerMemberId` holds a HouseholdMember.id. Absent = Joint.
 * An id that no longer matches a member (member deleted) is treated as Joint
 * for display and filtering, but is never rewritten here.
 */

export const JOINT_OWNER = 'joint'

/** 'all' (no filter), 'joint', or a member id. */
export type OwnerFilter = 'all' | typeof JOINT_OWNER | string

/** Owner choices are only shown when there is more than one member. */
export function showOwnerUi(members: HouseholdMember[]): boolean {
  return members.length >= 2
}

/** The effective owner: a live member id, or 'joint'. */
export function getAccountOwnerId(account: SavingsAccount, members: HouseholdMember[]): string {
  const id = account.ownerMemberId
  return id && members.some((m) => m.id === id) ? id : JOINT_OWNER
}

/** Returns the account with its owner set; 'joint' removes the field. Never mutates. */
export function withOwner(account: SavingsAccount, ownerId: string): SavingsAccount {
  const { ownerMemberId: _old, ...rest } = account
  return ownerId === JOINT_OWNER ? rest : { ...rest, ownerMemberId: ownerId }
}

/** A filter pointing at a member that no longer exists falls back to 'all'. */
export function normalizeOwnerFilter(filter: OwnerFilter, members: HouseholdMember[]): OwnerFilter {
  if (filter === 'all' || filter === JOINT_OWNER) return filter
  return members.some((m) => m.id === filter) ? filter : 'all'
}

export function filterAccountsByOwner(
  accounts: SavingsAccount[],
  members: HouseholdMember[],
  filter: OwnerFilter,
): SavingsAccount[] {
  const f = normalizeOwnerFilter(filter, members)
  if (f === 'all') return accounts
  return accounts.filter((a) => getAccountOwnerId(a, members) === f)
}
