-- ─── Household Finance Planner — Supabase Schema ─────────────────────────────
-- Only invitation + household metadata lives here.
-- All financial data stays in the browser (localStorage).
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ── Households ────────────────────────────────────────────────────────────────
create table if not exists public.households (
  id          text primary key,
  name        text        not null,
  created_by  text        not null,
  created_at  timestamptz not null default now()
);

-- ── Household memberships ─────────────────────────────────────────────────────
create table if not exists public.household_memberships (
  household_id  text        not null references public.households(id) on delete cascade,
  user_id       text        not null,
  role          text        not null default 'member' check (role in ('owner','member')),
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ── Invitations ───────────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id            text        primary key,
  email         text        not null,
  household_id  text        not null references public.households(id) on delete cascade,
  invited_by    text        not null,
  status        text        not null default 'pending' check (status in ('pending','accepted','expired')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists invitations_household_id_idx on public.invitations(household_id);
create index if not exists invitations_status_idx       on public.invitations(status);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Auth is handled locally (SHA-256 + Google GIS), so we allow all via anon key.
alter table public.households             enable row level security;
alter table public.household_memberships  enable row level security;
alter table public.invitations            enable row level security;

drop policy if exists "allow_all" on public.households;
drop policy if exists "allow_all" on public.household_memberships;
drop policy if exists "allow_all" on public.invitations;

create policy "allow_all" on public.households            for all using (true) with check (true);
create policy "allow_all" on public.household_memberships for all using (true) with check (true);
create policy "allow_all" on public.invitations           for all using (true) with check (true);

-- ── v2.1 — Household Invites (token-based, method-aware) ─────────────────────
-- Replaces the simple `invitations` table with a more robust schema:
--   • Raw token NEVER stored — only its SHA-256 hash (token_hash).
--   • method: 'email' (targeted, one-time) | 'link' (reusable until revoked).
--   • status: 'pending' | 'accepted' | 'expired' | 'revoked'.
--   • Link invites stay 'pending' after each acceptance (multi-use).

create table if not exists public.household_invites (
  id            text        primary key,
  household_id  text        not null references public.households(id) on delete cascade,
  invited_email text,                          -- NULL for method='link'
  token_hash    text        not null unique,    -- SHA-256(raw_token); raw token is never stored
  method        text        not null check (method in ('email', 'link')),
  status        text        not null default 'pending'
                            check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    timestamptz not null,
  created_by    text        not null,
  created_at    timestamptz not null default now()
);

create index if not exists household_invites_household_id_idx on public.household_invites(household_id);
create index if not exists household_invites_token_hash_idx   on public.household_invites(token_hash);
create index if not exists household_invites_status_idx       on public.household_invites(status);

alter table public.household_invites enable row level security;

drop policy if exists "allow_all" on public.household_invites;
create policy "allow_all" on public.household_invites for all using (true) with check (true);

-- ── Household finance data (shared cloud store for multi-member access) ────────
-- Stores the full FinanceData JSON blob per household.
-- Every member can read and write — last write wins (client debounces at 1.5 s).
-- localStorage remains the primary store; this table is the sync / hand-off layer.
-- When a new member joins they pull this row so they start with real household data
-- instead of an empty slate.  Dark-mode and language prefs are NOT synced — those
-- are per-device and are restored from localStorage after the cloud merge.

create table if not exists public.household_finance (
  household_id  text        primary key references public.households(id) on delete cascade,
  data          jsonb       not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.household_finance enable row level security;

drop policy if exists "allow_all" on public.household_finance;
create policy "allow_all" on public.household_finance for all using (true) with check (true);

-- ── User profiles (public info synced on every login) ─────────────────────────
-- Stores the public-facing info for every user so that household members can
-- see each other's name / avatar even across devices.
-- Sensitive fields (passwordHash) are NEVER written here — only public info.

create table if not exists public.user_profiles (
  id          text        primary key,
  name        text        not null,
  email       text        not null,
  avatar      text,
  updated_at  timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "allow_all" on public.user_profiles;
create policy "allow_all" on public.user_profiles for all using (true) with check (true);
