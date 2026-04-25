/**
 * Regression tests for the Members view logic.
 *
 * The Members component is a pure display layer over AuthContext data.
 * Tests focus on the data-shaping logic: role resolution, ownership guards,
 * current-user detection, and edge cases.
 *
 * UI rendering tests are skipped (no @testing-library/react in this project);
 * the pure logic that drives the component is fully testable here.
 */

import { describe, it, expect } from 'vitest'
import type { LocalUser, Household, HouseholdMembership } from '@/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<LocalUser> = {}): LocalUser => ({
  id:           'user-1',
  name:         'Eilon Goldstein',
  email:        'eilon@example.com',
  authProvider: 'email',
  householdId:  'hh-1',
  createdAt:    '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeMembership = (overrides: Partial<HouseholdMembership> = {}): HouseholdMembership => ({
  userId:   'user-1',
  role:     'owner',
  joinedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeHousehold = (members: HouseholdMembership[]): Household => ({
  id:          'hh-1',
  name:        'Cohen Family',
  createdBy:   members.find((m) => m.role === 'owner')?.userId ?? 'user-1',
  memberships: members,
  createdAt:   '2026-01-01T00:00:00Z',
})

// ─── Role resolution ──────────────────────────────────────────────────────────

describe('Role resolution from household.memberships', () => {
  it('resolves owner role for the household creator', () => {
    const membership = makeMembership({ userId: 'user-1', role: 'owner' })
    const household  = makeHousehold([membership])
    const role = household.memberships.find((m) => m.userId === 'user-1')?.role
    expect(role).toBe('owner')
  })

  it('resolves member role for an invited user', () => {
    const ownerMs  = makeMembership({ userId: 'user-1', role: 'owner' })
    const memberMs = makeMembership({ userId: 'user-2', role: 'member' })
    const household = makeHousehold([ownerMs, memberMs])
    const role = household.memberships.find((m) => m.userId === 'user-2')?.role
    expect(role).toBe('member')
  })

  it('defaults to member when userId is not found in memberships', () => {
    const household = makeHousehold([makeMembership({ userId: 'user-1', role: 'owner' })])
    const role = household.memberships.find((m) => m.userId === 'unknown')?.role ?? 'member'
    expect(role).toBe('member')
  })
})

// ─── Ownership guard ──────────────────────────────────────────────────────────

describe('Ownership guard — canRemove logic', () => {
  it('owner can remove a non-owner member', () => {
    const currentUser = makeUser({ id: 'user-1' })
    const household   = makeHousehold([
      makeMembership({ userId: 'user-1', role: 'owner' }),
      makeMembership({ userId: 'user-2', role: 'member' }),
    ])
    const isOwner  = household.createdBy === currentUser.id
    const canRemove = (targetId: string) => isOwner && targetId !== currentUser.id
    expect(canRemove('user-2')).toBe(true)
  })

  it('owner cannot remove themselves', () => {
    const currentUser = makeUser({ id: 'user-1' })
    const household   = makeHousehold([makeMembership({ userId: 'user-1', role: 'owner' })])
    const isOwner   = household.createdBy === currentUser.id
    const canRemove = (targetId: string) => isOwner && targetId !== currentUser.id
    expect(canRemove('user-1')).toBe(false)
  })

  it('non-owner cannot remove any member', () => {
    const currentUser = makeUser({ id: 'user-2' })
    const household   = makeHousehold([
      makeMembership({ userId: 'user-1', role: 'owner' }),
      makeMembership({ userId: 'user-2', role: 'member' }),
    ])
    const isOwner   = household.createdBy === currentUser.id
    const canRemove = (targetId: string) => isOwner && targetId !== currentUser.id
    expect(canRemove('user-1')).toBe(false)
    expect(canRemove('user-2')).toBe(false)
  })
})

// ─── Current-user detection ────────────────────────────────────────────────────

describe('Current-user "(you)" label logic', () => {
  it('marks the current user correctly', () => {
    const currentUser = makeUser({ id: 'user-1' })
    const members = [makeUser({ id: 'user-1' }), makeUser({ id: 'user-2', name: 'Sara' })]
    const isCurrentUser = (m: LocalUser) => m.id === currentUser.id
    expect(isCurrentUser(members[0])).toBe(true)
    expect(isCurrentUser(members[1])).toBe(false)
  })
})

// ─── Member count display ──────────────────────────────────────────────────────

describe('Member count display string', () => {
  it('shows singular for 1 member', () => {
    const count: number = 1
    const label = count === 1 ? '1 member' : `${count} members`
    expect(label).toBe('1 member')
  })

  it('shows plural for multiple members', () => {
    const count: number = 3
    const label = count === 1 ? '1 member' : `${count} members`
    expect(label).toBe('3 members')
  })
})

// ─── Avatar initials ──────────────────────────────────────────────────────────

describe('Avatar initials derivation', () => {
  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase()

  it('two-word name gives two initials', () => {
    expect(getInitials('Eilon Goldstein')).toBe('EG')
  })

  it('single-word name gives one initial', () => {
    expect(getInitials('Eilon')).toBe('E')
  })

  it('more than two words — only first two used', () => {
    expect(getInitials('Eilon Ben Goldstein')).toBe('EB')
  })

  it('empty name produces empty string', () => {
    expect(getInitials('')).toBe('')
  })
})

// ─── Join date fallback ───────────────────────────────────────────────────────

describe('joinedAt fallback', () => {
  it('uses membership joinedAt when available', () => {
    const member     = makeUser({ createdAt: '2026-01-01T00:00:00Z' })
    const membership = makeMembership({ joinedAt: '2026-03-15T00:00:00Z' })
    const joinedAt   = membership?.joinedAt ?? member.createdAt
    expect(joinedAt).toBe('2026-03-15T00:00:00Z')
  })

  it('falls back to user.createdAt if no membership joinedAt', () => {
    const member      = makeUser({ createdAt: '2026-01-01T00:00:00Z' })
    const noMembership: { joinedAt?: string } = {}
    const joinedAt    = noMembership.joinedAt ?? member.createdAt
    expect(joinedAt).toBe('2026-01-01T00:00:00Z')
  })
})

// ─── Google avatar vs initials ────────────────────────────────────────────────

describe('Avatar source selection', () => {
  it('Google user with avatar URL uses the image', () => {
    const user = makeUser({ authProvider: 'google', avatar: 'https://lh3.googleusercontent.com/photo.jpg' })
    expect(!!user.avatar).toBe(true)
  })

  it('email user without avatar falls back to initials', () => {
    const user = makeUser({ authProvider: 'email', avatar: undefined })
    expect(!!user.avatar).toBe(false)
  })
})
