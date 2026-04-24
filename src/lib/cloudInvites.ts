/**
 * Cloud-based household + invitation operations via Supabase.
 * Only metadata (household names, memberships, invite tokens) goes to the cloud.
 * All financial data stays in localStorage.
 */

import { supabase, supabaseConfigured } from './supabase'
import { generateId } from './utils'

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
