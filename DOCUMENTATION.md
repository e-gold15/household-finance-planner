# Developer Documentation — Household Finance Planner

> This document is for developers working on or extending the codebase.
> For product decisions and UX specs, see `PRODUCT_DESIGN.md`.
> For a quick project overview, see `README.md`.

---

## Table of Contents

1. [Local Setup](#1-local-setup)
2. [Environment Variables](#2-environment-variables)
3. [Project Structure](#3-project-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Authentication System](#5-authentication-system)
6. [Household & Invites](#6-household--invites)
7. [Finance State](#7-finance-state)
8. [Tax Engine API](#8-tax-engine-api)
9. [Savings Allocation Engine API](#9-savings-allocation-engine-api)
10. [Utility Functions](#10-utility-functions)
11. [Supabase Schema](#11-supabase-schema)
12. [Testing](#12-testing)
13. [Adding a New Feature](#13-adding-a-new-feature)
14. [Deployment](#14-deployment)
15. [Known Limitations & Gotchas](#15-known-limitations--gotchas)

---

## 1. Local Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project (free tier is fine)
- (Optional) A Google Cloud OAuth client ID

### Steps

```bash
# 1. Clone the repo
git clone git@github.com:e-gold15/household-finance-planner.git
cd household-finance-planner

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL + anon key

# 4. Run Supabase migration (once)
# Paste supabase/migration.sql into your Supabase SQL Editor and run it

# 5. Start dev server
npm run dev   # → http://localhost:5173
```

### Useful scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production Vite build |
| `npm test` | Run all 75 unit tests once (Vitest) |
| `npm run test:watch` | Re-run tests on file save |
| `npm run test:coverage` | Tests + V8 coverage report |
| `npm run lint` | ESLint check |
| `npm run preview` | Serve the production build locally |

---

## 2. Environment Variables

All variables are prefixed with `VITE_` so Vite exposes them to the browser bundle.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **Yes** | Project URL from Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Anon/public key from Supabase → Settings → API |
| `VITE_GOOGLE_CLIENT_ID` | No | OAuth 2.0 client ID from Google Cloud Console |

> ⚠️ `.env.local` is gitignored. Never commit real credentials.

Without `VITE_GOOGLE_CLIENT_ID`, the Google button renders in a disabled/unconfigured state and email auth still works normally.

---

## 3. Project Structure

```
household-finance-planner/
│
├── index.html                  # Entry HTML — GIS script tag lives here
├── vite.config.ts              # Vite + Vitest config + path alias (@/)
├── tsconfig.json               # TypeScript config + Vitest globals
├── tailwind.config.js          # Tailwind config
├── postcss.config.js
│
├── supabase/
│   └── migration.sql           # Run once to create cloud tables
│
├── src/
│   ├── main.tsx                # Entry point — detects ?invite= param
│   ├── App.tsx                 # Root — AuthProvider > AppOrAuth > FinanceProvider
│   ├── index.css               # HSL design tokens + Tailwind base
│   ├── vite-env.d.ts           # Vite type shims
│   │
│   ├── types/
│   │   └── index.ts            # All TypeScript interfaces (auth + finance)
│   │
│   ├── lib/
│   │   ├── utils.ts            # cn, t, formatCurrency, generateId, monthsUntil
│   │   ├── localAuth.ts        # Local user/household/invite CRUD + session
│   │   ├── googleAuth.ts       # GIS integration — initGoogleAuth, renderGoogleButton
│   │   ├── cloudInvites.ts     # Supabase invite/household sync
│   │   ├── supabase.ts         # Supabase client (from env vars)
│   │   ├── taxEstimation.ts    # IL + foreign tax engine
│   │   └── savingsEngine.ts    # Goal allocation engine
│   │
│   ├── context/
│   │   ├── AuthContext.tsx     # Auth state + household + invite management
│   │   └── FinanceContext.tsx  # Finance data state + localStorage CRUD
│   │
│   ├── pages/
│   │   └── AuthPage.tsx        # Sign-in / sign-up UI
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitive components
│   │   ├── Header.tsx
│   │   ├── HouseholdSettings.tsx
│   │   ├── Overview.tsx
│   │   ├── Income.tsx
│   │   ├── Expenses.tsx
│   │   ├── Savings.tsx
│   │   ├── Goals.tsx
│   │   └── History.tsx
│   │
│   └── test/
│       ├── setup.ts            # Vitest setup — localStorage mock, crypto mock
│       ├── utils.test.ts
│       ├── taxEstimation.test.ts
│       ├── savingsEngine.test.ts
│       └── localAuth.test.ts
```

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  ┌────────────┐    ┌──────────────────────┐  │
│  │AuthContext │    │  FinanceContext       │  │
│  │            │    │  (per householdId)   │  │
│  │ user       │    │  data: FinanceData   │  │
│  │ household  │    │  setData → save()    │  │
│  │ invites    │    │      │               │  │
│  └─────┬──────┘    └──────┼───────────────┘  │
│        │                  │                  │
│  ┌─────▼──────────────────▼───────────────┐  │
│  │         localStorage                    │  │
│  │  hf-users  hf-households  hf-session   │  │
│  │  hf-data-{householdId}                 │  │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌─────────────────────────────────────────┐  │
│  │         Supabase (cloud)                │  │
│  │  households  memberships  invitations   │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Key design decisions:**

1. **Finance data stays local.** `FinanceContext` reads/writes `localStorage` only. Privacy first.

2. **Cloud is invite-only.** Supabase stores only the 3 tables needed for cross-device invite acceptance. No financial data ever goes to Supabase.

3. **Session is a JSON object.** `hf-session = { userId, householdId }`. Both are needed because a user can switch households (e.g., after accepting an invite).

4. **`FinanceProvider` key trick.** `<FinanceProvider key={household.id}>` — changing the key forces React to remount the provider, loading fresh data for the new household. No manual reset needed.

5. **GIS renderButton > prompt.** Google's `renderButton()` opens a proper popup and works in all browsers. The older `prompt()` / One-Tap is suppressed by many browsers and browser settings.

---

## 5. Authentication System

### `src/lib/localAuth.ts`

The core local auth module. All functions are synchronous except password hashing.

#### Key exports

```typescript
// Session
getSession(): AppSession | null
persistSession(session: AppSession): void
clearSession(): void

// Sign up / sign in
signUpEmail(email, password, name): Promise<{ user, household } | { error }>
signInEmail(email, password): Promise<{ user, household } | { error }>
signInWithGoogle(profile): { user, household }   // synchronous

// User lookup
getUserById(id): LocalUser | null
upsertUserPublic(user): void

// Household lookup
getHouseholdById(id): Household | null
upsertHouseholdPublic(household): void

// Invitations (local cache)
createInvitation(email, householdId, invitedBy): Invitation
getPendingInvites(householdId): Invitation[]
cancelInvitation(inviteId): void
acceptInvitation(inviteId, userId): { household } | { error }

// Migration
migrateIfNeeded(): void   // one-time, reads old hf-accounts
```

### `src/lib/googleAuth.ts`

Google Identity Services integration.

```typescript
// Call on app boot — pass your callback for successful sign-in
initGoogleAuth(onSuccess: (profile: GoogleProfile) => void): void

// Render Google's official button into a DOM element
renderGoogleButton(element: HTMLElement): void

// One-Tap prompt (fallback)
promptGoogleSignIn(): Promise<'ok' | string>

// Check if GIS is loaded + client ID is set
isGoogleAvailable(): boolean

// Decode a GIS credential JWT (no verification — GIS validates it)
decodeGoogleJWT(credential: string): GoogleProfile
```

#### `GoogleProfile` shape

```typescript
interface GoogleProfile {
  sub: string        // unique Google user ID
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}
```

### `src/context/AuthContext.tsx`

React context that wires everything together. Exposed via `useAuth()`.

```typescript
interface AuthContextType {
  user: LocalUser | null
  household: Household | null
  pendingInvites: CloudInvitation[]     // loaded async from Supabase
  signUpEmail(email, password, name): Promise<string | null>   // null = success
  signInEmail(email, password): Promise<string | null>
  signInWithGoogle(): void              // triggers GIS popup
  signOut(): void
  inviteMember(email): Promise<string | null>
  cancelInvite(inviteId): Promise<void>
  refreshInvites(): Promise<void>
  renameHousehold(name): Promise<void>
  removeMember(targetUserId): Promise<string | null>
  getMembers(): LocalUser[]
}
```

---

## 6. Household & Invites

### `src/lib/cloudInvites.ts`

All Supabase operations. Every function silently no-ops if `supabaseConfigured` is false (i.e., `.env.local` not set up).

```typescript
// Household sync
syncHousehold(id, name, createdBy): Promise<void>
renameCloudHousehold(id, name): Promise<void>
getCloudHousehold(id): Promise<CloudHousehold | null>

// Membership sync
syncMembership(householdId, userId, role): Promise<void>
removeCloudMembership(householdId, userId): Promise<void>

// Invitations
createCloudInvitation(email, householdId, invitedBy): Promise<CloudInvitation>
getCloudPendingInvites(householdId): Promise<CloudInvitation[]>
cancelCloudInvitation(inviteId): Promise<void>
acceptCloudInvitation(inviteId, userId): Promise<{ householdId, householdName } | { error }>
```

### Invite URL format

```
https://household-finance-planner.com?invite={invitationId}
```

`main.tsx` reads this param on load, stores `invitationId` in `localStorage` under `hf-pending-invite`, then strips the param from the URL. After the user authenticates, `AuthContext.afterAuth()` calls `acceptCloudInvitation` and switches the user to the shared household.

---

## 7. Finance State

### `src/context/FinanceContext.tsx`

```typescript
interface FinanceContextType {
  data: FinanceData
  setData(updater: (prev: FinanceData) => FinanceData): void

  // Members (income earners — finance domain, not auth)
  addMember(name): void
  updateMember(member): void
  deleteMember(id): void

  // Expenses
  addExpense(expense): void
  updateExpense(expense): void
  deleteExpense(id): void

  // Savings accounts
  addAccount(account): void
  updateAccount(account): void
  deleteAccount(id): void

  // Goals
  addGoal(goal): void
  updateGoal(goal): void
  deleteGoal(id): void
  moveGoal(id, 'up' | 'down'): void

  // History
  snapshotMonth(): void

  // Data portability
  exportData(): void    // downloads JSON
  importData(json): void
}
```

`FinanceProvider` accepts `householdId` as a prop and loads `hf-data-{householdId}` from localStorage. It uses `key={household.id}` in `App.tsx` to auto-remount when the household changes.

---

## 8. Tax Engine API

**File:** `src/lib/taxEstimation.ts`

### `estimateTax(source: IncomeSource): TaxBreakdown`

Computes the full tax breakdown for a single income source.

**Three paths:**
1. `useManualNet = true` → uses `manualNetOverride`, all deductions = 0
2. `isGross = false` → net = amount, no deductions
3. `isGross = true` → full calculation (IL brackets, BL, health tax, contributions)

```typescript
interface TaxBreakdown {
  grossMonthly: number
  incomeTax: number
  bituachLeumi: number
  healthTax: number
  pensionEmployee: number
  educationFundEmployee: number
  totalEmployeeContrib: number
  totalDeductions: number
  netMonthly: number
  effectiveRate: number        // (totalDeductions / gross) * 100
  isManual: boolean
  hasContributions: boolean
  // Employer — informational only
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
  totalEmployerContrib: number
}
```

### `getNetMonthly(source: IncomeSource): number`

Convenience wrapper — returns `estimateTax(source).netMonthly`.

### Legacy compatibility

Old data may have:
- `insuredRatio` (decimal 0–1) → auto-converted to `insuredSalaryRatio` (%)
- `pensionEmployeePercent` → falls back to `pensionEmployee`
- `period: 'yearly'` → amount divided by 12 before calculation

---

## 9. Savings Allocation Engine API

**File:** `src/lib/savingsEngine.ts`

### `allocateGoals(input: EngineInput): GoalAllocation[]`

```typescript
interface EngineInput {
  goals: Goal[]
  monthlySurplus: number         // income - expenses - contributions
  accounts: SavingsAccount[]
  emergencyBufferMonths: number
  monthlyExpenses: number
}

interface GoalAllocation extends Goal {
  status: 'realistic' | 'tight' | 'unrealistic' | 'blocked'
  monthlyRecommended: number
  monthsNeeded: number
  gap: number                    // monthly shortfall (0 if none)
}
```

Goals are processed in array order (user-defined priority via up/down arrows). Surplus is consumed sequentially — earlier goals have priority.

---

## 10. Utility Functions

**File:** `src/lib/utils.ts`

```typescript
// Tailwind class merging
cn(...inputs: ClassValue[]): string

// i18n string selector
t(en: string, he: string, lang: 'en' | 'he'): string

// Currency formatting with locale
formatCurrency(amount: number, currency: Currency, locale: Locale): string

// Percent formatting (1 decimal)
formatPercent(value: number): string

// Random ID (8 alphanumeric chars)
generateId(): string

// Months from now until a date (min 0)
monthsUntil(deadline: string): number
```

---

## 11. Supabase Schema

**File:** `supabase/migration.sql`

Run this **once** in Supabase Dashboard → SQL Editor.

### Tables

#### `households`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Generated by client (generateId()) |
| `name` | `text` | Household display name |
| `created_by` | `text` | userId of owner |
| `created_at` | `timestamptz` | Default: now() |

#### `household_memberships`
| Column | Type | Notes |
|--------|------|-------|
| `household_id` | `text` FK → households | Cascade delete |
| `user_id` | `text` | Local user ID |
| `role` | `text` | `'owner'` or `'member'` |
| `joined_at` | `timestamptz` | Default: now() |

PK: `(household_id, user_id)`

#### `invitations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Token in the invite URL |
| `email` | `text` | Invitee email |
| `household_id` | `text` FK → households | Cascade delete |
| `invited_by` | `text` | userId of inviter |
| `status` | `text` | `'pending'` \| `'accepted'` \| `'expired'` |
| `created_at` | `timestamptz` | |
| `expires_at` | `timestamptz` | 7 days after created_at |

### RLS Policy

All three tables have Row Level Security enabled with an `allow_all` policy (`using (true)`). This is intentional — auth is handled locally (SHA-256 + GIS), not via Supabase Auth. Only the anon key is used.

---

## 12. Testing

**Framework:** Vitest + @testing-library/react + jsdom

### Test setup (`src/test/setup.ts`)

- Mocks `localStorage` with a fresh in-memory store (reset before each test via `beforeEach`)
- Mocks `crypto.subtle.digest` with a deterministic fake (avoids async issues in jsdom)
- Imports `@testing-library/jest-dom` for DOM matchers

### Test files

| File | Coverage |
|------|----------|
| `utils.test.ts` | `cn`, `t`, `formatCurrency`, `formatPercent`, `generateId`, `monthsUntil` |
| `taxEstimation.test.ts` | Manual override, net-as-is, IL brackets, credit points, BL caps, health tax, insuredSalaryRatio, contributions, employer costs, foreign countries, getNetMonthly |
| `savingsEngine.test.ts` | Fully funded, realistic, unrealistic, blocked (deadline passed / no surplus), liquid savings, emergency buffer, locked accounts, multi-goal, edge cases |
| `localAuth.test.ts` | signUpEmail (success, duplicate, case-insensitive, hashing), signInEmail (success, wrong password, unknown email), sessions, getUserById/getHouseholdById, invitations CRUD, acceptInvitation, migration |

### Running tests

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage
```

### Writing a new test

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/lib/myModule'

describe('myFunction()', () => {
  it('does X when Y', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

localStorage is automatically cleared before each test by `setup.ts`.

---

## 13. Adding a New Feature

### New finance field (e.g., add `tags` to expenses)

1. Add `tags?: string[]` to `Expense` in `src/types/index.ts`
2. Update `addExpense` / `updateExpense` in `FinanceContext.tsx` if needed
3. Update the expense dialog in `Expenses.tsx`
4. Data is auto-persisted (FinanceContext writes on every `setData` call)
5. Old data without `tags` loads fine (optional field)

### New tab

1. Add entry to `TABS` array in `App.tsx`
2. Create `src/components/MyTab.tsx`
3. Add `{tab === 'mytab' && <MyTab />}` in `AppShell`

### New auth method

1. Add sign-in logic to `localAuth.ts`
2. Expose method from `AuthContext.tsx`
3. Add UI to `AuthPage.tsx`

### New i18n string

Always use `t(englishString, hebrewString, lang)` — never hardcode English in JSX.

```tsx
const lang = data.language  // from useFinance()
<p>{t('Monthly Total', 'סה"כ חודשי', lang)}</p>
```

---

## 14. Deployment

### Vercel (automatic)

Every push to `main` triggers a Vercel deployment automatically.

**Required env vars in Vercel → Settings → Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID` (optional)

### Google OAuth setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `https://household-finance-planner.com`
   - `http://localhost:5173`
5. Copy the Client ID → add to Vercel env vars as `VITE_GOOGLE_CLIENT_ID`
6. Redeploy

### Manual build

```bash
npm run build    # outputs to dist/
```

The `dist/` folder is a static site — host on any CDN (Vercel, Netlify, Cloudflare Pages).

### Git remote

```bash
git remote -v
# origin  git@github.com:e-gold15/household-finance-planner.git
```

SSH key is set up at `~/.ssh/id_ed25519`. `git push` works without credentials.

---

## 15. Known Limitations & Gotchas

### Finance data is not shared between devices

Two household members entering data on different devices will see different `FinanceData`. The household model currently groups users together for invite purposes, but financial data remains device-local. Each person enters their own data on their own device.

**Planned fix:** Optional cloud sync of `FinanceData` to Supabase (opt-in, privacy-preserving).

### localStorage size limit

Browsers enforce ~5 MB per origin. With large history snapshots this could be hit eventually.

**Mitigation:** History snapshots are manually triggered (not automatic), so the user controls the size.

### Google Sign-In requires the GIS script to load

`renderGoogleButton()` retries every 300 ms until `window.google?.accounts?.id` is available. If the script is blocked (ad blocker, strict CSP), the button shows a disabled fallback state and email auth still works.

### Supabase anon key is public

The anon key is in the browser bundle (as `VITE_` env vars always are). This is intentional — it's the public key, not the service role key. The only protected operation is RLS (which we open up intentionally since auth is local).

Never commit the `service_role` key. Never set `VITE_SUPABASE_SERVICE_ROLE_KEY`.

### SHA-256 password hashing

SHA-256 is a fast hash, not a password-specific hash (no bcrypt/argon2). This is acceptable for a local-only app where the hash never leaves the device, but not suitable for a server-side auth system.

### `crypto.randomUUID()` in tests

The test `setup.ts` mocks `crypto` with a fake `randomUUID`. If you need truly unique IDs in tests, be aware the mock is simple (`Math.random().toString(36).slice(2)`).

---

*Documentation version: 1.0 — April 2026*
