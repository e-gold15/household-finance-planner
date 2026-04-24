import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { LocalUser, Household, Invitation, InviteMethod, HouseholdInvite, CreatedHouseholdInvite } from '@/types'
import {
  getSession, persistSession, clearSession,
  signUpEmail as localSignUpEmail,
  signInEmail as localSignInEmail,
  signInWithGoogle as localSignInWithGoogle,
  migrateIfNeeded,
  getHouseholdById,
  getUserById,
  upsertUserPublic,
  upsertHouseholdPublic,
  PENDING_INVITE_KEY,
  PENDING_INV_TOKEN_KEY,
} from '@/lib/localAuth'
import { initGoogleAuth, promptGoogleSignIn } from '@/lib/googleAuth'
import type { GoogleProfile } from '@/lib/googleAuth'
import {
  syncHousehold,
  syncMembership,
  createCloudInvitation,
  cancelCloudInvitation,
  getCloudPendingInvites,
  acceptCloudInvitation,
  renameCloudHousehold,
  removeCloudMembership,
  createHouseholdInvite,
  getHouseholdInvites,
  revokeHouseholdInvite,
  acceptHouseholdInvite,
} from '@/lib/cloudInvites'
import type { CloudInvitation } from '@/lib/cloudInvites'

interface AuthContextType {
  user: LocalUser | null
  household: Household | null
  /**
   * True immediately after a user accepts an invite and joins a shared
   * household for the first time in this session. Used to show the
   * "welcome to household" banner explaining local data.
   * Call clearJustJoined() once the banner is dismissed.
   */
  justJoined: boolean
  clearJustJoined: () => void
  /** @deprecated Use householdInvites instead. Kept for backward compat. */
  pendingInvites: CloudInvitation[]
  /** v2.1 — token-based invites from household_invites table */
  householdInvites: HouseholdInvite[]
  /** Sign up with email + password. Returns error string or null on success. */
  signUpEmail: (email: string, password: string, name: string) => Promise<string | null>
  /** Sign in with email + password. Returns error string or null on success. */
  signInEmail: (email: string, password: string) => Promise<string | null>
  /** Trigger Google One-Tap / popup. */
  signInWithGoogle: () => void
  signOut: () => void
  /** @deprecated Use createInvite('email', email) instead. */
  inviteMember: (email: string) => Promise<string | null>
  /** Cancel a pending invite by its ID (legacy invitations table). */
  cancelInvite: (inviteId: string) => Promise<void>
  /** Refresh pending invites from the cloud (both tables). */
  refreshInvites: () => Promise<void>
  /**
   * v2.1 — Create a token-based invite.
   * Returns CreatedHouseholdInvite (contains raw token) on success,
   * or an error string on failure.
   */
  createInvite: (method: InviteMethod, email?: string) => Promise<CreatedHouseholdInvite | string>
  /** v2.1 — Revoke a household_invites row by its ID. */
  revokeInvite: (inviteId: string) => Promise<void>
  /** Rename the current household. */
  renameHousehold: (name: string) => Promise<void>
  /** Remove a member (owner only). Returns error string or null. */
  removeMember: (targetUserId: string) => Promise<string | null>
  getMembers: () => LocalUser[]
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                         = useState<LocalUser | null>(null)
  const [household, setHousehold]               = useState<Household | null>(null)
  const [pendingInvites, setPendingInvites]      = useState<CloudInvitation[]>([])
  const [householdInvites, setHouseholdInvites] = useState<HouseholdInvite[]>([])
  const [justJoined, setJustJoined]             = useState(false)

  // ── Boot: migrate + restore session ──────────────────────────────────────
  useEffect(() => {
    migrateIfNeeded()
    const session = getSession()
    if (session) {
      const u = getUserById(session.userId)
      const h = getHouseholdById(session.householdId)
      if (u && h) {
        setUser(u)
        setHousehold(h)
      } else {
        clearSession()
      }
    }
  }, [])

  // ── Load pending invites when household changes ───────────────────────────
  useEffect(() => {
    if (household) {
      loadPendingInvites(household.id)
      loadHouseholdInvites(household.id)
    } else {
      setPendingInvites([])
      setHouseholdInvites([])
    }
  }, [household?.id])

  const loadPendingInvites = async (householdId: string) => {
    const invites = await getCloudPendingInvites(householdId)
    setPendingInvites(invites)
  }

  const loadHouseholdInvites = async (householdId: string) => {
    const invites = await getHouseholdInvites(householdId)
    setHouseholdInvites(invites)
  }

  // ── GIS init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initGoogleAuth(handleGoogleProfile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Shared helper: move a user into a joined household ───────────────────
  function applyHouseholdJoin(authedUser: LocalUser, householdId: string, householdName: string) {
    const updatedUser = { ...authedUser, householdId }
    upsertUserPublic(updatedUser)
    const sharedHousehold: Household = {
      id: householdId,
      name: householdName,
      createdBy: '',
      memberships: [{ userId: authedUser.id, role: 'member', joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    }
    upsertHouseholdPublic(sharedHousehold)
    persistSession({ userId: updatedUser.id, householdId })
    setUser(updatedUser)
    setHousehold(sharedHousehold)
    // Signal to the UI that the user just joined — show welcome banner
    setJustJoined(true)
  }

  // ── Shared post-auth handler ──────────────────────────────────────────────
  async function afterAuth(authedUser: LocalUser, authedHousehold: Household) {
    // Sync household + membership to cloud
    await syncHousehold(authedHousehold.id, authedHousehold.name, authedHousehold.createdBy)
    const role = authedHousehold.memberships.find((m) => m.userId === authedUser.id)?.role ?? 'member'
    await syncMembership(authedHousehold.id, authedUser.id, role)

    // ── v2.1: Check for a pending raw token (?inv= captured by main.tsx) ───
    const invToken = localStorage.getItem(PENDING_INV_TOKEN_KEY)
    if (invToken) {
      localStorage.removeItem(PENDING_INV_TOKEN_KEY)
      const result = await acceptHouseholdInvite(invToken, authedUser.id)
      if ('householdId' in result) {
        return applyHouseholdJoin(authedUser, result.householdId, result.householdName)
      }
      // If the token is invalid, fall through and use the user's own household
    }

    // ── Legacy: Check for a pending invite ID (?invite= captured by main.tsx) ─
    const inviteId = localStorage.getItem(PENDING_INVITE_KEY)
    if (inviteId) {
      localStorage.removeItem(PENDING_INVITE_KEY)
      const result = await acceptCloudInvitation(inviteId, authedUser.id)
      if ('householdId' in result) {
        return applyHouseholdJoin(authedUser, result.householdId, result.householdName)
      }
    }

    setUser(authedUser)
    setHousehold(authedHousehold)
  }

  function handleGoogleProfile(profile: GoogleProfile) {
    const result = localSignInWithGoogle(profile)
    afterAuth(result.user, result.household)
  }

  // ── Auth methods ──────────────────────────────────────────────────────────
  const handleSignUpEmail = async (email: string, password: string, name: string) => {
    const result = await localSignUpEmail(email, password, name)
    if ('error' in result) return result.error
    await afterAuth(result.user, result.household)
    return null
  }

  const handleSignInEmail = async (email: string, password: string) => {
    const result = await localSignInEmail(email, password)
    if ('error' in result) return result.error
    await afterAuth(result.user, result.household)
    return null
  }

  const handleSignInWithGoogle = () => {
    promptGoogleSignIn().then((reason) => {
      if (reason !== 'ok') console.warn('[Auth] Google Sign-In not shown:', reason)
    })
  }

  const handleSignOut = () => {
    clearSession()
    setUser(null)
    setHousehold(null)
    setPendingInvites([])
    setHouseholdInvites([])
    setJustJoined(false)
  }

  // ── Invite management (legacy) ────────────────────────────────────────────
  const handleInviteMember = async (email: string): Promise<string | null> => {
    if (!user || !household) return 'Not signed in.'
    const isOwner = household.memberships.find((m) => m.userId === user.id)?.role === 'owner'
    if (!isOwner) return 'Only the household owner can invite members.'
    try {
      const inv = await createCloudInvitation(email, household.id, user.id)
      setPendingInvites((prev) => [inv, ...prev.filter((i) => i.email !== inv.email)])
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Failed to create invitation.'
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    await cancelCloudInvitation(inviteId)
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  const handleRefreshInvites = useCallback(async () => {
    if (household) {
      await loadPendingInvites(household.id)
      await loadHouseholdInvites(household.id)
    }
  }, [household?.id])

  // ── Invite management v2.1 ────────────────────────────────────────────────
  const handleCreateInvite = async (
    method: InviteMethod,
    email?: string
  ): Promise<CreatedHouseholdInvite | string> => {
    if (!user || !household) return 'Not signed in.'
    const isOwner = household.memberships.find((m) => m.userId === user.id)?.role === 'owner'
    if (!isOwner) return 'Only the household owner can invite members.'
    if (method === 'email' && !email?.trim()) return 'Email address is required.'
    try {
      const inv = await createHouseholdInvite(household.id, user.id, method, email)
      // Refresh list so the new invite appears (or replaces the old link invite)
      setHouseholdInvites((prev) => {
        const filtered = prev.filter((i) =>
          method === 'link' ? i.method !== 'link' : i.invited_email !== inv.invited_email
        )
        const { token: _t, ...rowWithoutToken } = inv
        return [rowWithoutToken, ...filtered]
      })
      return inv
    } catch (e) {
      return e instanceof Error ? e.message : 'Failed to create invite.'
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    await revokeHouseholdInvite(inviteId)
    setHouseholdInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  // ── Household management ──────────────────────────────────────────────────
  const handleRenameHousehold = async (name: string) => {
    if (!household) return
    const trimmed = name.trim()
    if (!trimmed) return
    await renameCloudHousehold(household.id, trimmed)
    const updated = { ...household, name: trimmed }
    upsertHouseholdPublic(updated)
    setHousehold(updated)
  }

  const handleRemoveMember = async (targetUserId: string): Promise<string | null> => {
    if (!user || !household) return 'Not signed in.'
    if (household.createdBy === targetUserId) return 'Cannot remove the household owner.'
    await removeCloudMembership(household.id, targetUserId)
    // Update local household memberships
    const updated = {
      ...household,
      memberships: household.memberships.filter((m) => m.userId !== targetUserId),
    }
    upsertHouseholdPublic(updated)
    setHousehold(updated)
    return null
  }

  const handleGetMembers = (): LocalUser[] => {
    if (!household) return []
    return household.memberships
      .map((m) => getUserById(m.userId))
      .filter((u): u is LocalUser => u !== null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      household,
      justJoined,
      clearJustJoined: () => setJustJoined(false),
      pendingInvites,
      householdInvites,
      signUpEmail: handleSignUpEmail,
      signInEmail: handleSignInEmail,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      inviteMember: handleInviteMember,
      cancelInvite: handleCancelInvite,
      refreshInvites: handleRefreshInvites,
      createInvite: handleCreateInvite,
      revokeInvite: handleRevokeInvite,
      renameHousehold: handleRenameHousehold,
      removeMember: handleRemoveMember,
      getMembers: handleGetMembers,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
