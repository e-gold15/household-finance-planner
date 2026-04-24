import React, { createContext, useContext, useEffect, useState } from 'react'
import type { LocalUser, Household, Invitation } from '@/types'
import {
  getSession, persistSession, clearSession,
  signUpEmail as localSignUpEmail,
  signInEmail as localSignInEmail,
  signInWithGoogle as localSignInWithGoogle,
  migrateIfNeeded,
  getHouseholdById,
  getUserById,
  createInvitation,
  cancelInvitation,
  getPendingInvites,
  getHouseholdMembers,
  acceptInvitation,
  PENDING_INVITE_KEY,
} from '@/lib/localAuth'
import { initGoogleAuth, promptGoogleSignIn } from '@/lib/googleAuth'
import type { GoogleProfile } from '@/lib/googleAuth'

interface AuthContextType {
  user: LocalUser | null
  household: Household | null
  /** Sign up with email + password. Returns error string or null on success. */
  signUpEmail: (email: string, password: string, name: string) => Promise<string | null>
  /** Sign in with email + password. Returns error string or null on success. */
  signInEmail: (email: string, password: string) => Promise<string | null>
  /** Trigger Google One-Tap / popup. The callback from GIS drives the state update. */
  signInWithGoogle: () => void
  signOut: () => void
  /** Invite a member by email — owner only */
  inviteMember: (email: string) => Invitation | { error: string }
  cancelInvite: (inviteId: string) => void
  getPendingInvites: () => Invitation[]
  getMembers: () => LocalUser[]
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)

  // Migrate old hf-accounts data once on mount
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

  // Init Google Identity Services — GIS will call our callback when sign-in succeeds
  useEffect(() => {
    initGoogleAuth(handleGoogleProfile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGoogleProfile(profile: GoogleProfile) {
    const result = localSignInWithGoogle(profile)
    setUser(result.user)
    setHousehold(result.household)
    // Check if there's a pending invite to accept
    checkPendingInvite(result.user)
  }

  function checkPendingInvite(authedUser: LocalUser) {
    const inviteId = localStorage.getItem(PENDING_INVITE_KEY)
    if (!inviteId) return
    localStorage.removeItem(PENDING_INVITE_KEY)
    const result = acceptInvitation(inviteId, authedUser.id)
    if ('household' in result) {
      const updatedUser = getUserById(authedUser.id)
      if (updatedUser) setUser(updatedUser)
      setHousehold(result.household)
      persistSession({ userId: authedUser.id, householdId: result.household.id })
    }
  }

  const handleSignUpEmail = async (email: string, password: string, name: string) => {
    const result = await localSignUpEmail(email, password, name)
    if ('error' in result) return result.error
    setUser(result.user)
    setHousehold(result.household)
    checkPendingInvite(result.user)
    return null
  }

  const handleSignInEmail = async (email: string, password: string) => {
    const result = await localSignInEmail(email, password)
    if ('error' in result) return result.error
    setUser(result.user)
    setHousehold(result.household)
    checkPendingInvite(result.user)
    return null
  }

  const handleSignInWithGoogle = () => {
    // The actual sign-in result is handled asynchronously by handleGoogleProfile via GIS callback
    promptGoogleSignIn().then((reason) => {
      if (reason !== 'ok') {
        console.warn('[Auth] Google Sign-In not shown:', reason)
      }
    })
  }

  const handleSignOut = () => {
    clearSession()
    setUser(null)
    setHousehold(null)
  }

  const handleInviteMember = (email: string): Invitation | { error: string } => {
    if (!user || !household) return { error: 'Not signed in.' }
    const isOwner = household.memberships.find((m) => m.userId === user.id)?.role === 'owner'
    if (!isOwner) return { error: 'Only the household owner can invite members.' }
    return createInvitation(email, household.id, user.id)
  }

  const handleCancelInvite = (inviteId: string) => {
    cancelInvitation(inviteId)
  }

  const handleGetPendingInvites = (): Invitation[] => {
    if (!household) return []
    return getPendingInvites(household.id)
  }

  const handleGetMembers = (): LocalUser[] => {
    if (!household) return []
    return getHouseholdMembers(household)
  }

  return (
    <AuthContext.Provider value={{
      user,
      household,
      signUpEmail: handleSignUpEmail,
      signInEmail: handleSignInEmail,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      inviteMember: handleInviteMember,
      cancelInvite: handleCancelInvite,
      getPendingInvites: handleGetPendingInvites,
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
