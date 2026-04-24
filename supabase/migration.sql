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
