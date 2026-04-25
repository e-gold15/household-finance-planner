import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { LocalUser, Household, HouseholdMembership, Invitation, InviteMethod, HouseholdInvite, CreatedHouseholdInvite } from '@/types'
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
  syncUserProfile,
  fetchHouseholdMemberProfiles,
  fetchHouseholdMembers,
  fetchUserMemberships,
  getCloudHousehold,
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

  // ── Shared: pull live member list from Supabase and update local state ───────
  // Called on boot and after every login so every device always sees the
  // current member list, not a stale local snapshot.
  async function refreshMembersFromCloud(householdId: string, currentHousehold: Household) {
    const cloudMembers = await fetchHouseholdMembers(householdId)
    if (!cloudMembers.length) return

    // Store each member's LocalUser record locally so getUserById() finds them
    cloudMembers.forEach((m) => {
      upsertUserPublic({
        id:           m.userId,
        name:         m.name,
        email:        m.email,
        avatar:       m.avatar,
        authProvider: 'email',
        householdId,
        createdAt:    m.joinedAt,
      })
    })

    // Rebuild memberships with correct roles from Supabase
    const memberships: HouseholdMembership[] = cloudMembers.map((m) => ({
      userId:   m.userId,
      role:     m.role,
      joinedAt: m.joinedAt,
    }))

    const updatedHousehold: Household = {
      ...currentHousehold,
      memberships,
      createdBy: cloudMembers.find((m) => m.role === 'owner')?.userId ?? currentHousehold.createdBy,
    }
    upsertHouseholdPublic(updatedHousehold)
    setHousehold(updatedHousehold)
  }

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
        // Refresh member list from cloud so the owner always sees new members
        // who joined since their last visit, without needing to log out/in.
        refreshMembersFromCloud(h.id, h)
      } else {
        clearSession()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  async function applyHouseholdJoin(
    authedUser: LocalUser,
    householdId: string,
    householdName: string,
    showWelcome: boolean = true
  ) {
    const updatedUser = { ...authedUser, householdId }
    upsertUserPublic(updatedUser)

    // Fetch all existing members' profiles from Supabase and store them
    // locally so getMembers() can find them on this device.
    const profiles = await fetchHouseholdMemberProfiles(householdId)
    const memberships: HouseholdMembership[] = profiles.map((p) => ({
      userId:   p.id,
      // All roles default to 'member' here; accurate roles are applied immediately
      // after by refreshMembersFromCloud() which overwrites with Supabase data.
      role:     'member' as const,
      joinedAt: new Date().toISOString(),
    }))

    // Ensure current user is always in the list
    if (!memberships.find((m) => m.userId === authedUser.id)) {
      memberships.push({ userId: authedUser.id, role: 'member', joinedAt: new Date().toISOString() })
    }

    // Store each member's LocalUser record locally so getUserById() works
    profiles.forEach((p) => {
      if (p.id !== authedUser.id) {
        upsertUserPublic({
          id:           p.id,
          name:         p.name,
          email:        p.email,
          avatar:       p.avatar,
          authProvider: 'google', // best guess — display only, not used for auth
          householdId,
          createdAt:    new Date().toISOString(),
        })
      }
    })

    const sharedHousehold: Household = {
      id: householdId,
      name: householdName,
      createdBy: profiles.find((p) => p.id !== authedUser.id)?.id ?? '',
      memberships,
      createdAt: new Date().toISOString(),
    }
    upsertHouseholdPublic(sharedHousehold)
    persistSession({ userId: updatedUser.id, householdId })
    setUser(updatedUser)
    setHousehold(sharedHousehold)
    // Signal to the UI that the user just joined — show welcome banner
    if (showWelcome) setJustJoined(true)
  }

  // ── Shared post-auth handler ──────────────────────────────────────────────
  async function afterAuth(authedUser: LocalUser, authedHousehold: Household) {
    // Sync household + membership to cloud
    await syncHousehold(authedHousehold.id, authedHousehold.name, authedHousehold.createdBy)
    const role = authedHousehold.memberships.find((m) => m.userId === authedUser.id)?.role ?? 'member'
    await syncMembership(authedHousehold.id, authedUser.id, role)

    // Sync this user's public profile so other household members can see them
    await syncUserProfile(authedUser)

    // Pull the live member list so this device always shows everyone in the household.
    // Awaited so it completes before the recovery check below — prevents a race where
    // a background refresh would clobber the recovered household in React state.
    await refreshMembersFromCloud(authedHousehold.id, authedHousehold)

    // ── Cloud household recovery ──────────────────────────────────────────────
    // On a fresh device (empty localStorage), a Google user gets a new empty
    // household created locally. Check Supabase to see if they already own one.
    // If a membership exists for a DIFFERENT household, switch to it silently.
    // Priority: 'owner' role > 'member' role; most-recently-joined if multiple.
    const allMemberships = await fetchUserMemberships(authedUser.id)
    const otherMemberships = allMemberships.filter(
      (m) => m.householdId !== authedHousehold.id
    )
    if (otherMemberships.length > 0) {
      // Prefer a household where user is owner; otherwise take most recently joined
      const target =
        otherMemberships.find((m) => m.role === 'owner') ??
        otherMemberships.sort((a, b) =>
          new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
        )[0]

      console.info(
        `[AuthContext] Cloud household recovery: switching from ${authedHousehold.id} to ${target.householdId}`
      )

      // Fetch the real household name FIRST — before touching anything — so that
      // if this call fails we can still proceed, and we haven't partially mutated state.
      const cloudH = await getCloudHousehold(target.householdId)

      // Remove the orphaned empty household's membership from Supabase.
      // Best-effort — if it fails the orphan lingers but recovery still completes.
      await removeCloudMembership(authedHousehold.id, authedUser.id)

      // Switch to the real household silently (no welcome banner — it's theirs).
      await applyHouseholdJoin(
        authedUser,
        target.householdId,
        cloudH?.name ?? 'Shared Household',
        false   // showWelcome = false — this is a recovery, not a new join
      )

      // Immediately correct member roles for the current session.
      // applyHouseholdJoin defaults all memberships to 'member'; this overwrites
      // with accurate roles from Supabase so the owner can invite/rename right away.
      const recoveredHousehold = getHouseholdById(target.householdId)
      if (recoveredHousehold) {
        await refreshMembersFromCloud(target.householdId, recoveredHousehold)
      }
      return
    }

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
