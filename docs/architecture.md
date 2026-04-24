# Architecture Overview

## Project Structure

```
household-finance-planner/
│
├── index.html                  # Entry HTML — GIS <script> tag lives here
├── vite.config.ts              # Vite + Vitest config + @/ path alias
├── tsconfig.json               # TypeScript strict config + vitest/globals
├── tailwind.config.js
├── supabase/
│   └── migration.sql           # Run once to create all Supabase tables
│
├── docs/                       # Per-feature developer documentation
│
└── src/
    ├── main.tsx                # Entry — captures ?inv= and ?invite= URL params
    ├── App.tsx                 # Root: AuthProvider → AppOrAuth → FinanceProvider
    ├── index.css               # HSL design tokens + Tailwind base styles
    │
    ├── types/
    │   └── index.ts            # All TypeScript interfaces (finance + auth + invites)
    │
    ├── lib/
    │   ├── utils.ts            # cn, t, formatCurrency, generateId, monthsUntil
    │   ├── localAuth.ts        # Local user/household/invite CRUD, session, migration
    │   ├── googleAuth.ts       # Google Identity Services — init, renderButton, JWT decode
    │   ├── cloudInvites.ts     # Supabase — household sync, memberships, invitations v1+v2
    │   ├── supabase.ts         # Supabase client (reads env vars)
    │   ├── taxEstimation.ts    # IL + foreign tax engine
    │   └── savingsEngine.ts    # Goal allocation engine
    │
    ├── context/
    │   ├── AuthContext.tsx     # Auth state + household + invite management (useAuth)
    │   └── FinanceContext.tsx  # Finance data state + localStorage CRUD (useFinance)
    │
    ├── pages/
    │   └── AuthPage.tsx        # Sign-in / sign-up UI (Google primary, email accordion)
    │
    ├── components/
    │   ├── ui/                 # shadcn/ui primitive components
    │   ├── Header.tsx          # Logo, nav tabs, user chip, household chip
    │   ├── HouseholdSettings.tsx  # Members list + invite modal (two-tab)
    │   ├── Overview.tsx
    │   ├── Income.tsx
    │   ├── Expenses.tsx
    │   ├── Savings.tsx
    │   ├── Goals.tsx
    │   └── History.tsx
    │
    └── test/
        ├── setup.ts               # localStorage mock + crypto mock
        ├── utils.test.ts
        ├── taxEstimation.test.ts
        ├── savingsEngine.test.ts
        ├── localAuth.test.ts
        └── cloudInvites.test.ts
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│  ┌──────────────────┐     ┌───────────────────────────────┐ │
│  │   AuthContext    │     │       FinanceContext           │ │
│  │                  │     │  (key={household.id})          │ │
│  │  user            │     │  data: FinanceData             │ │
│  │  household       │     │  setData → localStorage.write  │ │
│  │  householdInvites│     └───────────────────────────────┘ │
│  └────────┬─────────┘                   │                   │
│           │                             │                   │
│  ┌────────▼─────────────────────────────▼─────────────────┐ │
│  │                   localStorage                          │ │
│  │  hf-users          hf-households      hf-session        │ │
│  │  hf-invitations    hf-pending-invite  hf-pending-inv-token│
│  │  hf-data-{householdId}                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Supabase (cloud — invite sync only)        │ │
│  │  households   household_memberships   invitations        │ │
│  │  household_invites (v2.1 — token-based)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Finance data is always local
`FinanceContext` reads and writes `localStorage` only. No financial data ever goes to Supabase. This is a hard privacy guarantee, not a future plan.

### 2. Cloud is invite-only
Supabase stores only the metadata needed for cross-device invite acceptance: households, memberships, and invite rows. Financial data never touches the wire.

### 3. Session holds both IDs
`hf-session = { userId, householdId }`. Both are required because a user can leave their default household to join a shared one — the two IDs can diverge after invite acceptance.

### 4. FinanceProvider key trick
```tsx
<FinanceProvider key={household.id} householdId={household.id}>
```
Changing the `key` forces React to fully unmount and remount the provider, loading fresh `hf-data-{householdId}` from localStorage. No manual reset logic needed.

### 5. GIS `renderButton()` over `prompt()`
Google's `renderButton()` opens a standard popup window and works in all browsers. The older `prompt()` / One-Tap is suppressed by most modern browsers and many browser extensions and is used only as a last-resort fallback.

### 6. Tokens hashed before storage (v2.1)
Raw invite tokens are generated client-side with `crypto.getRandomValues`, immediately hashed with `SHA-256`, and only the hash is sent to Supabase. The raw token travels only in the URL. It is never logged.
