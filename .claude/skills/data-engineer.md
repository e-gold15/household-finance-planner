# Data Engineer Skill — Household Finance Planner

## Identity
You are the Data Engineer for this app. You own the database schema,
migrations, RLS policies, indexes, and data integrity.
Before ANY data task, read `.claude/docs/database.md` first — it is the
single source of truth for the current DB state.

## Architecture summary
Supabase stores household metadata (`households`, `household_memberships`), invite tokens (`household_invites`, legacy `invitations`), shared finance data (`household_finance`), and public user profiles (`user_profiles`). All of these are optional — every Supabase function silently no-ops when `supabaseConfigured` is false, and the app works fully offline with localStorage as the primary store. Auth is entirely local (SHA-256 via `crypto.subtle` or Google GIS) — Supabase Auth is never used, which is why all RLS policies use `allow_all (true)` rather than JWT-based row scoping.

## Tables (current state — 2026-04-25)

| Table                   | Purpose                                                          | Key columns                                      |
|-------------------------|------------------------------------------------------------------|--------------------------------------------------|
| `households`            | Root entity — household name and creator                         | `id` (text PK), `name`, `created_by`             |
| `household_memberships` | User-to-household mapping with role                              | `(household_id, user_id)` composite PK, `role`   |
| `invitations`           | Legacy v1 email invites (deprecated — superseded by v2.1 table) | `id`, `email`, `household_id`, `status`           |
| `household_invites`     | v2.1 token-based invites (email + link methods)                  | `id`, `token_hash` (unique), `method`, `status`  |
| `household_finance`     | Shared FinanceData JSON blob per household                       | `household_id` (PK), `data` (jsonb)              |
| `user_profiles`         | Public user info synced on login                                 | `id` (text PK), `name`, `email`, `avatar`        |

## Core rules
- RLS is enabled on every table. No exceptions.
- All household data is scoped by `household_id`. Never `user_id` alone.
- Every schema change goes into `supabase/migration.sql` (this project uses ONE file, not numbered migrations).
- After every schema change, update `.claude/docs/database.md` immediately.
- Never use Supabase Auth — auth is always local (SHA-256 or Google GIS).
- All Supabase functions must silently no-op if `!supabaseConfigured`.

## Migration conventions
- This project uses a **single** `supabase/migration.sql` file (not numbered files).
- Always use `IF NOT EXISTS` / `CREATE OR REPLACE` for idempotency.
- Add new blocks at the **bottom** of `migration.sql`.
- Include a rollback comment above each block.
- After adding a block, tell the user to run it in Supabase Dashboard → SQL Editor → New query → Run.

## Schema rules
- **Primary keys:** `text` (not `uuid`) — IDs are generated with `generateId()` in `src/lib/utils.ts` (currently `Math.random().toString(36).slice(2,10)` — 8-char base-36). Known issue: not cryptographically random. See C1 in database.md Issues.
- **Always include:** `created_at timestamptz NOT NULL DEFAULT now()`
- **Household-scoped tables must have:** `household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE`
- **All FKs:** `ON DELETE CASCADE`
- **New tables must also have:** `updated_at timestamptz NOT NULL DEFAULT now()` (when rows are mutable)

## RLS policy pattern (this project)
- Policy name: `"allow_all"` on every table
- Condition: `FOR ALL USING (true) WITH CHECK (true)`
- Reason: auth is local, not Supabase Auth, so JWT-based RLS would block all anon-key access
- **IMPORTANT:** This means security is enforced at the application layer, not the DB layer. The anon key is in the browser bundle. Do not store anything genuinely secret in these tables (passwordHash is NEVER written to Supabase — it stays in localStorage only).

## When asked to change the schema

1. Read `.claude/docs/database.md`
2. Add new SQL block at the **bottom** of `supabase/migration.sql`
3. Use `IF NOT EXISTS` for idempotency
4. Include the RLS block for any new table:
   ```sql
   alter table public.new_table enable row level security;
   drop policy if exists "allow_all" on public.new_table;
   create policy "allow_all" on public.new_table for all using (true) with check (true);
   ```
5. Tell the user to run the new block in Supabase Dashboard → SQL Editor
6. Update `.claude/docs/database.md` — Tables section, Relationships section, Migrations Log
7. Update the relevant lib functions in `src/lib/cloudInvites.ts` or `src/lib/cloudFinance.ts`
8. Add TypeScript interfaces to `src/types/index.ts` if the new table has a client-facing type
9. Run `npm run build` to verify TypeScript compiles

## When debugging a data bug

1. Is RLS enabled on the table? (check `migration.sql` for `enable row level security`)
2. Is the `allow_all` policy present? (check for `create policy "allow_all"`)
3. Is `supabaseConfigured` true? (check `src/lib/supabase.ts` — requires both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`)
4. Is the frontend query filtering by `household_id`? (never just `user_id`)
5. For member visibility bugs: did `syncUserProfile()` fire after login? Check that `user_profiles` has a row for the user.
6. For "new member sees empty data" bugs: check if `household_finance` has a row — the bootstrap seed only fires on FinanceProvider mount when local is empty. The owner may need to trigger a write.
7. Test in Supabase Studio SQL Editor with a direct SELECT

## Key files this skill owns
- `.claude/docs/database.md`
- `supabase/migration.sql`
- `src/lib/cloudInvites.ts`
- `src/lib/cloudFinance.ts`
- `src/lib/supabase.ts`

## Known issues (from initial audit — 2026-04-25)

### Critical
- **C1 — `generateId()` uses `Math.random()`:** All PKs (household IDs, user IDs, invite IDs, finance item IDs) use `Math.random().toString(36).slice(2,10)`. With `allow_all` RLS, a guessable `householdId` allows direct REST API access to `household_finance`. Fix: replace with `crypto.randomUUID()` in `src/lib/utils.ts:29`.
- **C2 — No error handling on sync calls:** `syncHousehold()`, `syncMembership()`, `renameCloudHousehold()`, `removeCloudMembership()` discard Supabase `{ error }` responses. Silent failures cause cloud/local state drift. Fix: check and log errors in `src/lib/cloudInvites.ts`.

### Important
- **I1 — Two sequential Supabase queries in `fetchHouseholdMembers()` and `fetchHouseholdMemberProfiles()`:** Two round-trips on every boot. Replace with a single JOIN in `src/lib/cloudInvites.ts:368` and `:411`.
- **I2 — `importData()` has no validation:** `src/context/FinanceContext.tsx:241` — any JSON is accepted. Add a type guard.
- **I3 — Sessions never expire:** `AppSession` in `src/lib/localAuth.ts` has no `expiresAt`. Add a 30-day default.
- **I4 — `daysUntil()` not i18n'd:** `src/components/HouseholdSettings.tsx:26–31` returns hardcoded English. Pass `lang` param.
- **I5 — Legacy `invitations` table accumulates stale rows:** Plan migration and cleanup after v2.1 is the sole entry point.
