import { describe, it, expect, beforeEach } from 'vitest'
import {
  signUpEmail, signInEmail,
  getSession, persistSession, clearSession,
  getUserById, getHouseholdById,
  createInvitation, getPendingInvites, cancelInvitation, acceptInvitation,
  migrateIfNeeded,
} from '@/lib/localAuth'

// localStorage is reset before each test by setup.ts

// ─── signUpEmail ───────────────────────────────────────────────────────────

describe('signUpEmail()', () => {
  it('creates a new user and household', async () => {
    const result = await signUpEmail('alice@example.com', 'password123', 'Alice')
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.user.email).toBe('alice@example.com')
    expect(result.user.name).toBe('Alice')
    expect(result.user.authProvider).toBe('email')
    expect(result.household.createdBy).toBe(result.user.id)
    expect(result.household.memberships[0].role).toBe('owner')
  })

  it('creates a personal household named after the user', async () => {
    const result = await signUpEmail('bob@example.com', 'pass', 'Bob')
    if ('error' in result) throw new Error(result.error)
    expect(result.household.name).toContain('Bob')
  })

  it('persists session after sign-up', async () => {
    await signUpEmail('carol@example.com', 'pass', 'Carol')
    const session = getSession()
    expect(session).not.toBeNull()
    expect(session!.userId).toBeTruthy()
    expect(session!.householdId).toBeTruthy()
  })

  it('rejects duplicate email', async () => {
    await signUpEmail('alice@example.com', 'pass1', 'Alice 1')
    const result = await signUpEmail('alice@example.com', 'pass2', 'Alice 2')
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/already exists/i)
  })

  it('is case-insensitive for email', async () => {
    await signUpEmail('Alice@Example.com', 'pass', 'Alice')
    const result = await signUpEmail('alice@example.com', 'pass', 'Alice 2')
    expect('error' in result).toBe(true)
  })

  it('stores passwordHash not plain password', async () => {
    const result = await signUpEmail('secure@test.com', 'mypassword', 'Test')
    if ('error' in result) throw new Error(result.error)
    expect(result.user.passwordHash).toBeTruthy()
    expect(result.user.passwordHash).not.toBe('mypassword')
  })
})

// ─── signInEmail ───────────────────────────────────────────────────────────

describe('signInEmail()', () => {
  beforeEach(async () => {
    await signUpEmail('user@example.com', 'correctpass', 'User')
    clearSession()
  })

  it('signs in with correct credentials', async () => {
    const result = await signInEmail('user@example.com', 'correctpass')
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.user.email).toBe('user@example.com')
  })

  it('rejects wrong password', async () => {
    const result = await signInEmail('user@example.com', 'wrongpass')
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/incorrect/i)
  })

  it('rejects unknown email', async () => {
    const result = await signInEmail('nobody@example.com', 'pass')
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/no account/i)
  })

  it('persists session after sign-in', async () => {
    await signInEmail('user@example.com', 'correctpass')
    const session = getSession()
    expect(session).not.toBeNull()
  })
})

// ─── Session management ────────────────────────────────────────────────────

describe('Session management', () => {
  it('getSession() returns null when no session', () => {
    expect(getSession()).toBeNull()
  })

  it('persistSession + getSession round-trip', async () => {
    const result = await signUpEmail('x@x.com', 'p', 'X')
    if ('error' in result) throw new Error(result.error)
    clearSession()
    persistSession({ userId: result.user.id, householdId: result.household.id })
    const session = getSession()
    expect(session?.userId).toBe(result.user.id)
    expect(session?.householdId).toBe(result.household.id)
  })

  it('clearSession() removes the session', async () => {
    await signUpEmail('y@y.com', 'p', 'Y')
    clearSession()
    expect(getSession()).toBeNull()
  })
})

// ─── getUserById / getHouseholdById ───────────────────────────────────────

describe('getUserById()', () => {
  it('returns null for unknown id', () => {
    expect(getUserById('nonexistent')).toBeNull()
  })

  it('returns user after sign-up', async () => {
    const result = await signUpEmail('a@b.com', 'p', 'A')
    if ('error' in result) throw new Error(result.error)
    const user = getUserById(result.user.id)
    expect(user?.email).toBe('a@b.com')
  })
})

describe('getHouseholdById()', () => {
  it('returns null for unknown id', () => {
    expect(getHouseholdById('nonexistent')).toBeNull()
  })

  it('returns household after sign-up', async () => {
    const result = await signUpEmail('h@h.com', 'p', 'H')
    if ('error' in result) throw new Error(result.error)
    const household = getHouseholdById(result.household.id)
    expect(household?.id).toBe(result.household.id)
  })
})

// ─── Invitations ──────────────────────────────────────────────────────────

describe('Invitations', () => {
  let householdId: string
  let userId: string

  beforeEach(async () => {
    const result = await signUpEmail('owner@test.com', 'pass', 'Owner')
    if ('error' in result) throw new Error(result.error)
    householdId = result.household.id
    userId = result.user.id
  })

  it('creates a pending invitation', () => {
    const inv = createInvitation('guest@test.com', householdId, userId)
    expect(inv.email).toBe('guest@test.com')
    expect(inv.status).toBe('pending')
    expect(inv.householdId).toBe(householdId)
  })

  it('getPendingInvites() returns pending invitations', () => {
    createInvitation('a@test.com', householdId, userId)
    createInvitation('b@test.com', householdId, userId)
    const pending = getPendingInvites(householdId)
    expect(pending).toHaveLength(2)
  })

  it('cancelInvitation() marks invite as expired', () => {
    const inv = createInvitation('c@test.com', householdId, userId)
    cancelInvitation(inv.id)
    const pending = getPendingInvites(householdId)
    expect(pending.find((i) => i.id === inv.id)).toBeUndefined()
  })

  it('re-inviting same email cancels previous invite', () => {
    createInvitation('dup@test.com', householdId, userId)
    createInvitation('dup@test.com', householdId, userId)
    const pending = getPendingInvites(householdId)
    expect(pending.filter((i) => i.email === 'dup@test.com')).toHaveLength(1)
  })

  it('acceptInvitation() adds user to household', async () => {
    const guestResult = await signUpEmail('guest2@test.com', 'pass', 'Guest')
    if ('error' in guestResult) throw new Error(guestResult.error)

    const inv = createInvitation('guest2@test.com', householdId, userId)
    const result = acceptInvitation(inv.id, guestResult.user.id)

    expect('error' in result).toBe(false)
    if ('error' in result) return

    // Guest should now be in the owner's household
    const household = getHouseholdById(householdId)
    expect(household?.memberships.some((m) => m.userId === guestResult.user.id)).toBe(true)
  })

  it('acceptInvitation() rejects already-used invite', async () => {
    const guestResult = await signUpEmail('guest3@test.com', 'pass', 'Guest3')
    if ('error' in guestResult) throw new Error(guestResult.error)

    const inv = createInvitation('guest3@test.com', householdId, userId)
    acceptInvitation(inv.id, guestResult.user.id)
    const result = acceptInvitation(inv.id, guestResult.user.id)

    expect('error' in result).toBe(true)
  })
})

// ─── Migration ────────────────────────────────────────────────────────────

describe('migrateIfNeeded()', () => {
  it('migrates legacy hf-accounts to new format', () => {
    const legacyUser = {
      id: 'legacy-123',
      email: 'legacy@test.com',
      displayName: 'Legacy User',
      passwordHash: 'fakehash',
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem('hf-accounts', JSON.stringify([legacyUser]))

    migrateIfNeeded()

    const user = getUserById('legacy-123')
    expect(user).not.toBeNull()
    expect(user?.name).toBe('Legacy User')
    expect(user?.email).toBe('legacy@test.com')
    expect(user?.householdId).toBeTruthy()
  })

  it('removes hf-accounts key after migration', () => {
    localStorage.setItem('hf-accounts', JSON.stringify([]))
    migrateIfNeeded()
    expect(localStorage.getItem('hf-accounts')).toBeNull()
  })

  it('does not run if hf-accounts is absent', () => {
    // Should not throw
    expect(() => migrateIfNeeded()).not.toThrow()
  })
})
