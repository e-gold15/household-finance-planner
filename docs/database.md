# Database — Supabase Schema

**File:** `supabase/migration.sql`

Run the full file **once** in Supabase Dashboard → SQL Editor → New query → Run.

Only household metadata and invite tokens live in Supabase. **Financial data never leaves the browser.**

---

## Tables

### `households`

Stores household metadata for cross-device lookup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Client-generated via `generateId()` |
| `name` | `text NOT NULL` | Display name |
| `created_by` | `text NOT NULL` | `userId` of the household owner |
| `created_at` | `timestamptz` | Default: `now()` |

---

### `household_memberships`

Links users to households with a role.

| Column | Type | Notes |
|--------|------|-------|
| `household_id` | `text` FK → `households.id` | Cascade delete |
| `user_id` | `text NOT NULL` | Local user ID |
| `role` | `text NOT NULL` | `'owner'` or `'member'` |
| `joined_at` | `timestamptz` | Default: `now()` |

Primary key: `(household_id, user_id)`

---

### `invitations` (v1 — legacy)

Simple invite rows where the invite ID was the token in the URL.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Also used as the URL token (`?invite=<id>`) |
| `email` | `text NOT NULL` | Invitee email |
| `household_id` | `text` FK → `households.id` | Cascade delete |
| `invited_by` | `text NOT NULL` | `userId` of inviter |
| `status` | `text NOT NULL` | `'pending'` \| `'accepted'` \| `'expired'` |
| `created_at` | `timestamptz` | Default: `now()` |
| `expires_at` | `timestamptz NOT NULL` | 7 days after creation |

> Kept for backward compatibility. New invites use `household_invites`.

---

### `household_invites` (v2.1 — current)

Secure token-based invites. Raw tokens are never stored — only their SHA-256 hash.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Client-generated via `generateId()` |
| `household_id` | `text` FK → `households.id` | Cascade delete |
| `invited_email` | `text` | Null for `method='link'` invites |
| `token_hash` | `text NOT NULL UNIQUE` | SHA-256 of the raw token |
| `method` | `text NOT NULL` | `'email'` \| `'link'` |
| `status` | `text NOT NULL` | `'pending'` \| `'accepted'` \| `'expired'` \| `'revoked'` |
| `expires_at` | `timestamptz NOT NULL` | 7 days after creation |
| `created_by` | `text NOT NULL` | `userId` of inviter |
| `created_at` | `timestamptz` | Default: `now()` |

**Indexes:** `household_id`, `token_hash`, `status`

---

## Row Level Security

All tables have RLS enabled with a single `allow_all` policy:

```sql
create policy "allow_all" on public.<table>
  for all using (true) with check (true);
```

This is intentional — the app uses local auth (SHA-256 + Google GIS), not Supabase Auth. The anon key is the only credential used. Security comes from:
- Token hashing (`household_invites.token_hash`)
- 7-day expiry on all invites
- Client-side ownership checks (owner-only guards in `AuthContext`)

> Never use `supabaseConfigured` guard bypass. Never expose the service role key.

---

## Running the Migration

```sql
-- Full migration.sql contents must be run as one query.
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- Expected result: "Success. No rows returned"
```

The migration uses `create table if not exists` and `drop policy if exists` — safe to run multiple times if needed.

---

## localStorage Keys

Financial data and user data never go to Supabase. They live here:

| Key | Contents |
|-----|----------|
| `hf-users` | `LocalUser[]` — all registered users |
| `hf-households` | `Household[]` — household metadata + memberships |
| `hf-invitations` | `Invitation[]` — legacy local invite cache |
| `hf-session` | `AppSession` — `{ userId, householdId }` |
| `hf-data-{householdId}` | `FinanceData` for that household |
| `hf-pending-invite` | Legacy invite ID captured from `?invite=` |
| `hf-pending-inv-token` | v2.1 raw token captured from `?inv=` |
