/**
 * Local authentication + household management.
 * All data lives in localStorage — no backend required.
 *
 * Storage keys:
 *   hf-users          Array<LocalUser>
 *   hf-households     Array<Household>
 *   hf-invitations    Array<Invitation>
 *   hf-session        JSON AppSession { userId, householdId }
 */

import type { LocalUser, Household, HouseholdMembership, Invitation, AppSession } from '@/types'
import { generateId } from './utils'

// ─── Re-export types for callers that import from here ────────────────────
export type { LocalUser, Household, HouseholdMembership, Invitation, AppSession }

// ─── Storage keys ─────────────────────────────────────────────────────────
const USERS_KEY       = 'hf-users'
const HOUSEHOLDS_KEY  = 'hf-households'
const INVITATIONS_KEY = 'hf-invitations'
const SESSION_KEY     = 'hf-session'
/** Legacy key from the old single-user auth system */
const LEGACY_ACCOUNTS_KEY = 'hf-accounts'
/** Key used to store a pending invite token before the user is signed in */
export const PENDING_INVITE_KEY = 'hf-pending-invite'

// ─── Generic localStorage helpers ─────────────────────────────────────────
function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ─── Password hashing ─────────────────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Migration: old hf-accounts → new hf-users / hf-households ────────────
export function migrateIfNeeded() {
  const legacy = localStorage.getItem(LEGACY_ACCOUNTS_KEY)
  if (!legacy) return
  try {
    const oldAccounts: Array<{
      id: string
      email: string
      displayName?: string
      name?: string
      passwordHash: string
      createdAt: string
    }> = JSON.parse(legacy)

    const existingUsers = load<LocalUser>(USERS_KEY)
    const existingHouseholds = load<Household>(HOUSEHOLDS_KEY)
    const existingIds = new Set(existingUsers.map((u) => u.id))

    for (const old of oldAccounts) {
      if (existingIds.has(old.id)) continue

      // Create a private household for each legacy user
      const householdId = generateId()
      const newUser: LocalUser = {
        id: old.id,
        name: old.displayName ?? old.name ?? old.email.split('@')[0],
        email: old.email,
        authProvider: 'email',
        householdId,
        createdAt: old.createdAt,
        passwordHash: old.passwordHash,
      }
      const household: Household = {
        id: householdId,
        name: `${newUser.name}'s Household`,
        createdBy: old.id,
        memberships: [{ userId: old.id, role: 'owner', joinedAt: old.createdAt }],
        createdAt: old.createdAt,
      }

      existingUsers.push(newUser)
      existingHouseholds.push(household)

      // Migrate finance data key: hf-data-{userId} stays as-is (household id will differ,
      // but FinanceContext accepts householdId; we copy under new key if needed)
      const financeData = localStorage.getItem(`hf-data-${old.id}`)
      if (financeData) {
        localStorage.setItem(`hf-data-${householdId}`, financeData)
      }
    }

    save(USERS_KEY, existingUsers)
    save(HOUSEHOLDS_KEY, existingHouseholds)

    // Remove legacy key so migration doesn't run again
    localStorage.removeItem(LEGACY_ACCOUNTS_KEY)
  } catch (e) {
    console.error('[localAuth] Migration failed', e)
  }
}

// ─── User CRUD ─────────────────────────────────────────────────────────────
function getUsers(): LocalUser[] { return load<LocalUser>(USERS_KEY) }
function saveUsers(users: LocalUser[]) { save(USERS_KEY, users) }

function upsertUser(user: LocalUser) {
  const users = getUsers()
  const idx = users.findIndex((u) => u.id === user.id)
  if (idx >= 0) users[idx] = user
  else users.push(user)
  saveUsers(users)
}

export function getUserById(id: string): LocalUser | null {
  return getUsers().find((u) => u.id === id) ?? null
}

/** Public alias so AuthContext can upsert a user without importing the private fn */
export function upsertUserPublic(user: LocalUser) { upsertUser(user) }

// ─── Household CRUD ────────────────────────────────────────────────────────
function getHouseholds(): Household[] { return load<Household>(HOUSEHOLDS_KEY) }
function saveHouseholds(h: Household[]) { save(HOUSEHOLDS_KEY, h) }

export function getHouseholdById(id: string): Household | null {
  return getHouseholds().find((h) => h.id === id) ?? null
}

function upsertHousehold(household: Household) {
  const all = getHouseholds()
  const idx = all.findIndex((h) => h.id === household.id)
  if (idx >= 0) all[idx] = household
  else all.push(household)
  saveHouseholds(all)
}

/** Public alias so AuthContext can upsert a household without importing the private fn */
export function upsertHouseholdPublic(household: Household) { upsertHousehold(household) }

function createHousehold(ownerUser: LocalUser): Household {
  const household: Household = {
    id: generateId(),
    name: `${ownerUser.name}'s Household`,
    createdBy: ownerUser.id,
    memberships: [{ userId: ownerUser.id, role: 'owner', joinedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  }
  upsertHousehold(household)
  return household
}

// ─── Session ───────────────────────────────────────────────────────────────
export function getSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Support legacy format (plain userId string)
    if (typeof parsed === 'string') {
      const user = getUserById(parsed)
      if (!user) return null
      return { userId: user.id, householdId: user.householdId }
    }
    return parsed as AppSession
  } catch { return null }
}

export function persistSession(session: AppSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ─── Email sign-up ─────────────────────────────────────────────────────────
export async function signUpEmail(
  email: string,
  password: string,
  name: string
): Promise<{ user: LocalUser; household: Household } | { error: string }> {
  const users = getUsers()
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return { error: 'An account with this email already exists.' }
  }

  const userId = generateId()
  const now    = new Date().toISOString()
  const user: LocalUser = {
    id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    authProvider: 'email',
    householdId: '', // will be set after household creation
    createdAt: now,
    passwordHash: await hashPassword(password),
  }
  const household = createHousehold(user)
  user.householdId = household.id
  upsertUser(user)

  const session: AppSession = { userId: user.id, householdId: household.id }
  persistSession(session)
  return { user, household }
}

// ─── Email sign-in ─────────────────────────────────────────────────────────
export async function signInEmail(
  email: string,
  password: string
): Promise<{ user: LocalUser; household: Household } | { error: string }> {
  const users = getUsers()
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) return { error: 'No account found with this email.' }
  if (!user.passwordHash) return { error: 'This account uses Google Sign-In.' }
  if (user.passwordHash !== await hashPassword(password)) return { error: 'Incorrect password.' }

  const household = getHouseholdById(user.householdId)
  if (!household) return { error: 'Household data is missing. Please contact support.' }

  persistSession({ userId: user.id, householdId: household.id })
  return { user, household }
}

// ─── Google sign-in / sign-up ──────────────────────────────────────────────
export function signInWithGoogle(profile: {
  sub: string
  email: string
  name: string
  picture?: string
}): { user: LocalUser; household: Household } {
  const users = getUsers()

  // Check for existing user by Google sub (preferred) or email
  let user = users.find((u) => u.id === `google-${profile.sub}`)
             ?? users.find((u) => u.email.toLowerCase() === profile.email.toLowerCase())

  if (user) {
    // Update name / avatar in case they changed on Google
    user = { ...user, name: profile.name, avatar: profile.picture, authProvider: 'google' }
    upsertUser(user)
    const household = getHouseholdById(user.householdId)!
    persistSession({ userId: user.id, householdId: user.householdId })
    return { user, household }
  }

  // New Google user
  const now    = new Date().toISOString()
  const newUser: LocalUser = {
    id: `google-${profile.sub}`,
    name: profile.name,
    email: profile.email.toLowerCase(),
    avatar: profile.picture,
    authProvider: 'google',
    householdId: '', // filled after household creation
    createdAt: now,
  }
  const household = createHousehold(newUser)
  newUser.householdId = household.id
  upsertUser(newUser)

  persistSession({ userId: newUser.id, householdId: household.id })
  return { user: newUser, household }
}

// ─── Invitation CRUD ───────────────────────────────────────────────────────
function getInvitations(): Invitation[] { return load<Invitation>(INVITATIONS_KEY) }
function saveInvitations(inv: Invitation[]) { save(INVITATIONS_KEY, inv) }

/** 7-day expiry */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createInvitation(
  email: string,
  householdId: string,
  invitedBy: string
): Invitation {
  const now = Date.now()
  const invitation: Invitation = {
    id: generateId(),
    email: email.trim().toLowerCase(),
    householdId,
    invitedBy,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
  }
  const all = getInvitations()
  // Cancel any existing pending invite for the same email+household
  const filtered = all.filter(
    (i) => !(i.email === invitation.email && i.householdId === householdId && i.status === 'pending')
  )
  saveInvitations([...filtered, invitation])
  return invitation
}

export function getPendingInvites(householdId: string): Invitation[] {
  const now = new Date().toISOString()
  return getInvitations().filter(
    (i) => i.householdId === householdId && i.status === 'pending' && i.expiresAt > now
  )
}

export function cancelInvitation(inviteId: string) {
  const all = getInvitations().map((i) =>
    i.id === inviteId ? { ...i, status: 'expired' as const } : i
  )
  saveInvitations(all)
}

/** Accept a pending invite — adds the user to the household */
export function acceptInvitation(inviteId: string, userId: string):
  { household: Household } | { error: string } {
  const invitations = getInvitations()
  const inv = invitations.find((i) => i.id === inviteId)
  if (!inv) return { error: 'Invitation not found.' }
  if (inv.status !== 'pending') return { error: 'This invitation has already been used or expired.' }
  if (new Date(inv.expiresAt) < new Date()) return { error: 'This invitation has expired.' }

  // Mark as accepted
  saveInvitations(invitations.map((i) => i.id === inviteId ? { ...i, status: 'accepted' as const } : i))

  // Add user to household
  const household = getHouseholdById(inv.householdId)
  if (!household) return { error: 'Household not found.' }

  const alreadyMember = household.memberships.some((m) => m.userId === userId)
  if (!alreadyMember) {
    household.memberships.push({ userId, role: 'member', joinedAt: new Date().toISOString() })
    upsertHousehold(household)
  }

  // Update user's householdId to point to the shared household
  const user = getUserById(userId)
  if (user) {
    upsertUser({ ...user, householdId: inv.householdId })
  }

  // Update session
  persistSession({ userId, householdId: inv.householdId })

  return { household }
}

/** Get all members of a household (resolved to LocalUser objects) */
export function getHouseholdMembers(household: Household): LocalUser[] {
  return household.memberships
    .map((m) => getUserById(m.userId))
    .filter((u): u is LocalUser => u !== null)
}

/** Rename a household */
export function renameHousehold(householdId: string, name: string) {
  const h = getHouseholdById(householdId)
  if (!h) return
  upsertHousehold({ ...h, name: name.trim() })
}

/** Remove a member from a household (owner only) */
export function removeMember(householdId: string, targetUserId: string):
  { household: Household } | { error: string } {
  const h = getHouseholdById(householdId)
  if (!h) return { error: 'Household not found.' }
  if (h.createdBy === targetUserId) return { error: 'Cannot remove the household owner.' }

  h.memberships = h.memberships.filter((m) => m.userId !== targetUserId)
  upsertHousehold(h)

  // Give the removed user a fresh private household
  const user = getUserById(targetUserId)
  if (user) {
    const newHousehold = createHousehold(user)
    upsertUser({ ...user, householdId: newHousehold.id })
  }

  return { household: h }
}
