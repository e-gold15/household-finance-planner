# Household & Invitations

---

## Overview

The household model lets multiple users share a budget. One user is the **owner**; others are **members**. Owners can invite new members via two methods:

| Method | How it works | Use-case |
|--------|-------------|----------|
| **Email invite** | Targeted — one invite per email address | Invite a known partner |
| **Shareable link** | Reusable — anyone with the link can join | Share to a group chat |

Both methods produce a cryptographically random token. The token travels in the URL (`?inv=<64-char-hex>`), is never stored plain, and is validated by looking up its SHA-256 hash in Supabase.

---

## Roles

| Role | Permissions |
|------|------------|
| `owner` | Create invites, revoke invites, rename household, remove members |
| `member` | View household, view members — cannot invite or revoke |

Role is stored in `household_memberships.role` in Supabase and mirrored in the local `Household.memberships` array.

---

## URL Parameters

| Param | Version | Description |
|-------|---------|-------------|
| `?inv=<token>` | v2.1 | 64-char hex raw token (new system) |
| `?invite=<id>` | v1 legacy | Plain invite ID (backward compat, kept working) |

`main.tsx` detects both on load, stores them in `localStorage` under their respective keys, then strips them from the URL with `history.replaceState`. This ensures tokens aren't visible in the browser bar after authentication.

---

## Token Security

```
Owner creates invite
  → generateInviteToken()          // crypto.getRandomValues, 32 bytes → 64-char hex
  → hashInviteToken(token)         // SHA-256 via crypto.subtle
  → store token_hash in DB         // raw token NEVER touches the DB
  → embed raw token in URL         // ?inv=<raw_token>

Guest opens URL
  → main.tsx stores raw token in localStorage (hf-pending-inv-token)
  → URL is cleaned (no token in browser bar)
  → Guest signs in / signs up

afterAuth() runs
  → reads hf-pending-inv-token
  → hashInviteToken(token)         // hash it again
  → query DB WHERE token_hash = ?  // look up by hash
  → validate: status=pending, not expired, not revoked
  → email method → mark 'accepted' (one-time)
  → link method  → leave 'pending' (multi-use)
  → syncMembership() → guest is now in the household
```

Raw tokens are:
- Generated with `crypto.getRandomValues` (never `Math.random`)
- Never logged to console
- Never stored in the database
- Only present in the URL and `hf-pending-inv-token` key briefly

---

## `src/lib/cloudInvites.ts`

All Supabase operations. Every function silently no-ops if `supabaseConfigured` is false.

### Household sync

```typescript
syncHousehold(id, name, createdBy): Promise<void>
renameCloudHousehold(id, name): Promise<void>
getCloudHousehold(id): Promise<CloudHousehold | null>
```

### Membership sync

```typescript
syncMembership(householdId, userId, role): Promise<void>
removeCloudMembership(householdId, userId): Promise<void>
```

### Token utilities (v2.1)

```typescript
// Generate 32 cryptographically random bytes → 64-char hex string
generateInviteToken(): string

// SHA-256 hash of a raw token string → 64-char hex
hashInviteToken(token: string): Promise<string>
```

### v2.1 Invite functions

```typescript
// Create a new invite — returns CreatedHouseholdInvite with raw token
createHouseholdInvite(
  householdId: string,
  createdBy: string,
  method: InviteMethod,   // 'email' | 'link'
  email?: string          // required for method='email'
): Promise<CreatedHouseholdInvite>

// Get all active (pending + non-expired) invites for a household
getHouseholdInvites(householdId: string): Promise<HouseholdInvite[]>

// Revoke an invite by its ID
revokeHouseholdInvite(inviteId: string): Promise<void>

// Accept an invite using the raw URL token
acceptHouseholdInvite(
  token: string,
  userId: string
): Promise<{ householdId, householdName } | { error }>
```

### Legacy invite functions (v1 — kept for backward compat)

```typescript
createCloudInvitation(email, householdId, invitedBy): Promise<CloudInvitation>
getCloudPendingInvites(householdId): Promise<CloudInvitation[]>
cancelCloudInvitation(inviteId): Promise<void>
acceptCloudInvitation(inviteId, userId): Promise<{ householdId, householdName } | { error }>
```

---

## Invite Lifecycle

### Email invite (`method = 'email'`)

```
created (pending) → accepted (one-time)
                  → expired  (after 7 days)
                  → revoked  (owner cancels)
```

Creating a new invite for the same email in the same household automatically expires the previous one.

### Link invite (`method = 'link'`)

```
created (pending) → stays pending after each acceptance (multi-use)
                  → expired  (after 7 days)
                  → revoked  (owner cancels or regenerates)
```

Only one active link invite per household at a time. Creating a new link invite automatically revokes the previous one.

---

## UI — `src/components/HouseholdSettings.tsx`

The `HouseholdSettings` component renders:

1. **Household name** — with inline rename (owner only)
2. **Members list** — avatar, name, role badge, remove button (owner only)
3. **Invite button** — shows a badge with pending invite count

Clicking Invite opens `InviteModal` — a two-tab dialog:

### Email tab

- Email input + Send button
- Pending email invites list: avatar initial, email, expiry countdown, Revoke button
- Empty state when no pending invites

### Link tab

- **No active link**: empty state + Generate button
- **Active link (just created)**: URL in read-only input + Copy button + Regenerate + Revoke + expiry
- **Active link (previous session)**: "Active link" card + Regenerate + Revoke (token not in memory after reload — regenerate to get a new copyable URL)

The raw token is held in component state (`liveToken`) for the current session only. On page reload the token is gone (it was never stored), so the owner must regenerate to get a new copyable URL.

---

## Types

```typescript
// types/index.ts

type InviteMethod = 'email' | 'link'
type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

interface HouseholdInvite {
  id: string
  household_id: string
  invited_email: string | null  // null for 'link' method invites
  method: InviteMethod
  status: InviteStatus
  expires_at: string
  created_by: string
  created_at: string
}

// Returned only by createHouseholdInvite() — contains raw token for URL embedding
interface CreatedHouseholdInvite extends HouseholdInvite {
  token: string   // embed in URL as ?inv=<token> — DO NOT log or store
}

interface Household {
  id: string
  name: string
  createdBy: string
  memberships: HouseholdMembership[]
  createdAt: string
}

interface HouseholdMembership {
  userId: string
  role: 'owner' | 'member'
  joinedAt: string
}
```

---

## Supabase Tables

See [database.md](./database.md) for the full schema.

The relevant tables are:
- `households`
- `household_memberships`
- `household_invites` (v2.1 — token-based)
- `invitations` (v1 legacy)
