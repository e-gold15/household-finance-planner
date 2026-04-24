import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { LocalUser, Household, Invitation } from '@/types'
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
} from '@/lib/cloudInvites'
import type { CloudInvitation } from '@/lib/cloudInvites'

interface AuthContextType {
  user: LocalUser | null
  household: Household | null
  /** Pending invitations loaded from the cloud */
  pendingInvites: CloudInvitation[]
  /** Sign up with email + password. Returns error string or null on success. */
  signUpEmail: (email: string, password: string, name: string) => Promise<string | null>
  /** Sign in with email + password. Returns error string or null on success. */
  signInEmail: (email: string, password: string) => Promise<string | null>
  /** Trigger Google One-Tap / popup. */
  signInWithGoogle: () => void
  signOut: () => void
  /** Invite a member by email (owner only). Returns error string or null. */
  inviteMember: (email: string) => Promise<string | null>
  /** Cancel a pending invite by its ID. */
  cancelInvite: (inviteId: string) => Promise<void>
  /** Refresh pending invites from the cloud. */
  refreshInvites: () => Promise<void>
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
    if (household) loadPendingInvites(household.id)
    else setPendingInvites([])
  }, [household?.id])

  const loadPendingInvites = async (householdId: string) => {
    const invites = await getCloudPendingInvites(householdId)
    setPendingInvites(invites)
  }

  // ── GIS init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initGoogleAuth(handleGoogleProfile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Shared post-auth handler ──────────────────────────────────────────────
  async function afterAuth(authedUser: LocalUser, authedHousehold: Household) {
    // Sync household + membership to cloud
    await syncHousehold(authedHousehold.id, authedHousehold.name, authedHousehold.createdBy)
    const role = authedHousehold.memberships.find((m) => m.userId === authedUser.id)?.role ?? 'member'
    await syncMembership(authedHousehold.id, authedUser.id, role)

    // Check for a pending invite token (stored by main.tsx from ?invite= URL param)
    const inviteId = localStorage.getItem(PENDING_INVITE_KEY)
    if (inviteId) {
      localStorage.removeItem(PENDING_INVITE_KEY)
      const result = await acceptCloudInvitation(inviteId, authedUser.id)
      if ('householdId' in result) {
        // Update user's householdId in localStorage and rebuild household object
        const updatedUser = { ...authedUser, householdId: result.householdId }
        upsertUserPublic(updatedUser)
        // Build a minimal local household record for the shared household
        const sharedHousehold: Household = {
          id: result.householdId,
          name: result.householdName,
          createdBy: '',
          memberships: [{ userId: authedUser.id, role: 'member', joinedAt: new Date().toISOString() }],
          createdAt: new Date().toISOString(),
        }
        upsertHouseholdPublic(sharedHousehold)
        persistSession({ userId: updatedUser.id, householdId: result.householdId })
        setUser(updatedUser)
        setHousehold(sharedHousehold)
        return
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
  }

  // ── Invite management ─────────────────────────────────────────────────────
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
    if (household) await loadPendingInvites(household.id)
  }, [household?.id])

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
      pendingInvites,
      signUpEmail: handleSignUpEmail,
      signInEmail: handleSignInEmail,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      inviteMember: handleInviteMember,
      cancelInvite: handleCancelInvite,
      refreshInvites: handleRefreshInvites,
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
