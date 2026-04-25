/**
 * Cloud-based household + invitation operations via Supabase.
 * Only metadata (household names, memberships, invite tokens) goes to the cloud.
 * All financial data stays in localStorage.
 */

import { supabase, supabaseConfigured } from './supabase'
import { generateId } from './utils'
import type { LocalUser, InviteMethod, HouseholdInvite, CreatedHouseholdInvite } from '@/types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CloudHousehold {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface CloudMembership {
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface CloudInvitation {
  id: string
  email: string
  household_id: string
  invited_by: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  expires_at: string
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ─── Household sync ────────────────────────────────────────────────────────

/** Push a newly created household to Supabase. Silently no-ops if not configured. */
export async function syncHousehold(id: string, name: string, createdBy: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('households')
    .upsert({ id, name, created_by: createdBy }, { onConflict: 'id' })
}

/** Rename a household in the cloud. */
export async function renameCloudHousehold(id: string, name: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase.from('households').update({ name }).eq('id', id)
}

/** Fetch a household from the cloud by ID. */
export async function getCloudHousehold(id: string): Promise<CloudHousehold | null> {
  if (!supabaseConfigured) return null
  const { data } = await supabase.from('households').select('*').eq('id', id).single()
  return data ?? null
}

// ─── Membership sync ───────────────────────────────────────────────────────

/** Upsert a membership record in the cloud. */
export async function syncMembership(
  householdId: string,
  userId: string,
  role: 'owner' | 'member'
): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('household_memberships')
    .upsert({ household_id: householdId, user_id: userId, role }, { onConflict: 'household_id,user_id' })
}

/** Remove a membership from the cloud. */
export async function removeCloudMembership(householdId: string, userId: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('household_memberships')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
}

// ─── Invitations ───────────────────────────────────────────────────────────

/** Create an invitation in the cloud. Returns the invitation or throws. */
export async function createCloudInvitation(
  email: string,
  householdId: string,
  invitedBy: string
): Promise<CloudInvitation> {
  if (!supabaseConfigured) throw new Error('Cloud invites require Supabase to be configured.')

  const now = Date.now()
  const invitation: CloudInvitation = {
    id: generateId(),
    email: email.trim().toLowerCase(),
    household_id: householdId,
    invited_by: invitedBy,
    status: 'pending',
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + INVITE_TTL_MS).toISOString(),
  }

  // Expire any existing pending invite for the same email + household
  await supabase
    .from('invitations')
    .update({ status: 'expired' })
    .eq('email', invitation.email)
    .eq('household_id', householdId)
    .eq('status', 'pending')

  const { error } = await supabase.from('invitations').insert(invitation)
  if (error) throw error
  return invitation
}

/** Get all pending (non-expired) invitations for a household. */
export async function getCloudPendingInvites(householdId: string): Promise<CloudInvitation[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase
    .from('invitations')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return data ?? []
}

/** Cancel (expire) an invitation. */
export async function cancelCloudInvitation(inviteId: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase.from('invitations').update({ status: 'expired' }).eq('id', inviteId)
}

/** Look up a single invitation by its ID (for the accept flow). */
export async function getCloudInvitation(inviteId: string): Promise<CloudInvitation | null> {
  if (!supabaseConfigured) return null
  const { data } = await supabase.from('invitations').select('*').eq('id', inviteId).single()
  return data ?? null
}

/**
 * Accept an invitation.
 * - Marks it accepted in the cloud
 * - Upserts a membership row
 * - Returns the household id + name so the caller can update localStorage
 */
export async function acceptCloudInvitation(
  inviteId: string,
  userId: string
): Promise<{ householdId: string; householdName: string } | { error: string }> {
  if (!supabaseConfigured) return { error: 'Cloud invites not configured.' }

  const inv = await getCloudInvitation(inviteId)
  if (!inv) return { error: 'Invitation not found.' }
  if (inv.status !== 'pending') return { error: 'This invitation has already been used or expired.' }
  if (new Date(inv.expires_at) < new Date()) return { error: 'This invitation has expired.' }

  // Mark accepted
  await supabase.from('invitations').update({ status: 'accepted' }).eq('id', inviteId)

  // Add membership
  await syncMembership(inv.household_id, userId, 'member')

  // Get household name
  const household = await getCloudHousehold(inv.household_id)
  return {
    householdId: inv.household_id,
    householdName: household?.name ?? 'Shared Household',
  }
}

// ─── v2.1 Token-based invites (household_invites table) ────────────────────

const INVITE_V2_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Generate a 32-byte cryptographically random token.
 * Returns 64 hex characters. Uses crypto.getRandomValues — NOT Math.random().
 */
export function generateInviteToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a raw invite token for DB storage.
 * Raw tokens are NEVER stored — only their SHA-256 hash.
 */
export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a new household invite.
 *
 * - method='email': targeted invite for a specific address, one-time use.
 * - method='link': reusable link (multi-use) until revoked or expired.
 *
 * Returns a CreatedHouseholdInvite with the raw `token` to embed in the URL.
 * The token is NOT logged and NOT stored. Only the hash goes to the DB.
 *
 * For email invites, any previous pending invite for the same address is expired.
 * For link invites, any previous pending link invite for the household is revoked.
 */
export async function createHouseholdInvite(
  householdId: string,
  createdBy: string,
  method: InviteMethod,
  email?: string
): Promise<CreatedHouseholdInvite> {
  if (!supabaseConfigured) throw new Error('Cloud invites require Supabase to be configured.')

  const token     = generateInviteToken()
  const tokenHash = await hashInviteToken(token)
  const now       = Date.now()

  const row = {
    id:            generateId(),
    household_id:  householdId,
    invited_email: email ? email.trim().toLowerCase() : null,
    token_hash:    tokenHash,
    method,
    status:        'pending' as const,
    expires_at:    new Date(now + INVITE_V2_TTL_MS).toISOString(),
    created_by:    createdBy,
    created_at:    new Date(now).toISOString(),
  }

  // Expire any previous invite for the same email (email method)
  if (method === 'email' && email) {
    await supabase
      .from('household_invites')
      .update({ status: 'expired' })
      .eq('household_id', householdId)
      .eq('invited_email', email.trim().toLowerCase())
      .eq('status', 'pending')
  }

  // Revoke any previous active link invite (only one active link per household)
  if (method === 'link') {
    await supabase
      .from('household_invites')
      .update({ status: 'revoked' })
      .eq('household_id', householdId)
      .eq('method', 'link')
      .eq('status', 'pending')
  }

  const { error } = await supabase.from('household_invites').insert(row)
  if (error) throw error

  // Return the row with the raw token — caller must not log this
  return { ...row, token }
}

/**
 * Get all active (pending + non-expired) invites for a household.
 * Sorted by creation date descending.
 */
export async function getHouseholdInvites(householdId: string): Promise<HouseholdInvite[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase
    .from('household_invites')
    .select('id, household_id, invited_email, method, status, expires_at, created_by, created_at')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return (data ?? []) as HouseholdInvite[]
}

/** Revoke an invite by its ID. */
export async function revokeHouseholdInvite(inviteId: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('household_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
}

/**
 * Accept an invite using the raw token from the URL.
 *
 * - Hashes the token, queries DB for matching hash.
 * - Rejects expired or revoked tokens.
 * - Email invites: marked 'accepted' (one-time).
 * - Link invites: remain 'pending' (multi-use).
 * - Adds the user as a household member.
 * - Returns { householdId, householdName } on success or { error } on failure.
 */
export async function acceptHouseholdInvite(
  token: string,
  userId: string
): Promise<{ householdId: string; householdName: string } | { error: string }> {
  if (!supabaseConfigured) return { error: 'Cloud invites not configured.' }

  const tokenHash = await hashInviteToken(token)

  const { data: row } = await supabase
    .from('household_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .single()

  if (!row)                         return { error: 'Invite link not found or already used.' }
  if (row.status === 'revoked')     return { error: 'This invite link has been revoked.' }
  if (row.status === 'expired')     return { error: 'This invite link has expired.' }
  if (row.status === 'accepted')    return { error: 'This invite link has already been used.' }
  if (new Date(row.expires_at) < new Date()) return { error: 'This invite link has expired.' }

  // Email invites are one-time — mark accepted; link invites are reusable — leave as pending
  if (row.method === 'email') {
    await supabase
      .from('household_invites')
      .update({ status: 'accepted' })
      .eq('id', row.id)
  }

  await syncMembership(row.household_id, userId, 'member')

  const household = await getCloudHousehold(row.household_id)
  return {
    householdId:   row.household_id,
    householdName: household?.name ?? 'Shared Household',
  }
}

// ─── User profiles ─────────────────────────────────────────────────────────
// Public user info (name, email, avatar) is pushed to Supabase on every login
// so that all household members can see each other across devices.
// Sensitive fields (passwordHash) are never included.

/**
 * Push the current user's public profile to Supabase.
 * Called once in afterAuth() so the record is always fresh.
 * Silent no-op when Supabase is not configured.
 */
export async function syncUserProfile(user: LocalUser): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('user_profiles')
    .upsert(
      {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        avatar:     user.avatar ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
}

/**
 * Fetch the public profiles of every member of a household.
 * Joins household_memberships → user_profiles to return only members of
 * the given household.
 * Returns [] when Supabase is not configured or on any error.
 */
export async function fetchHouseholdMemberProfiles(
  householdId: string
): Promise<Pick<LocalUser, 'id' | 'name' | 'email' | 'avatar'>[]> {
  if (!supabaseConfigured) return []
  try {
    // Fetch all user_ids in this household, then their profiles
    const { data: memberships } = await supabase
      .from('household_memberships')
      .select('user_id')
      .eq('household_id', householdId)

    if (!memberships?.length) return []

    const userIds = memberships.map((m: { user_id: string }) => m.user_id)

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, email, avatar')
      .in('id', userIds)

    return (profiles ?? []) as Pick<LocalUser, 'id' | 'name' | 'email' | 'avatar'>[]
  } catch {
    return []
  }
}
