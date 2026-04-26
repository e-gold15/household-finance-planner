# System Architecture

## Overview

The Household Finance Planner is a **local-first single-page application (SPA)**. All data is stored on the user's device first, synced to the cloud second. The app works fully offline; the cloud is a sync layer, not a dependency.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI framework** | React | 18 | Component tree, state, rendering |
| **Language** | TypeScript | 5.x | Type safety across the entire codebase |
| **Build tool** | Vite | 5.x | Dev server, bundler, environment variables |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS; HSL design tokens |
| **Component library** | shadcn/ui | — | Accessible primitives (Dialog, Badge, Button, etc.) |
| **Charts** | Recharts | 2.x | FCF trend chart, category breakdowns |
| **Testing** | Vitest + Testing Library | — | 300 unit tests; jsdom environment |
| **Database** | Supabase (PostgreSQL) | — | Cloud sync and invite coordination |
| **Hosting** | Vercel | — | Auto-deploy on push to `main` |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                      │
│                                                             │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   AuthContext   │     │       FinanceContext         │   │
│  │                 │     │                             │   │
│  │  - user         │     │  - data (FinanceData)       │   │
│  │  - household    │     │  - setData()                │   │
│  │  - signIn()     │     │  - addExpense()             │   │
│  │  - signOut()    │     │  - snapshotMonth()          │   │
│  └────────┬────────┘     │  - addGoal()  ...           │   │
│           │               └──────────┬──────────────────┘   │
│           │                          │                       │
│  ┌────────▼────────┐       ┌─────────▼──────────────────┐  │
│  │   localStorage  │       │        localStorage         │  │
│  │                 │       │                             │  │
│  │  hf-users       │       │  hf-data-{householdId}      │  │
│  │  hf-households  │       │  (FinanceData JSON blob)    │  │
│  │  hf-session     │       │                             │  │
│  └────────┬────────┘       └─────────┬───────────────────┘  │
│           │                          │                       │
└───────────┼──────────────────────────┼───────────────────────┘
            │                          │
            ▼                          ▼
   ┌──────────────────┐      ┌──────────────────────┐
   │    Supabase DB   │      │     Supabase DB      │
   │                  │      │                      │
   │  households      │      │  household_finance   │
   │  memberships     │      │  (data jsonb)        │
   │  household_invites│     │  updated_at          │
   │  user_profiles   │      │                      │
   └──────────────────┘      └──────────────────────┘
         Auth coordination          Finance sync
       (cross-device lookup)     (debounced, 1.5s)
```

---

## Data Flow

### User Action → Storage

Every user action follows this path:

```
1. User performs action (e.g. adds an expense)
         │
         ▼
2. Component calls FinanceContext method (e.g. addExpense())
         │
         ▼
3. setData() is called inside FinanceContext
         │
         ├─► localStorage.setItem(...)  ← immediate, synchronous
         │
         └─► setTimeout(pushCloudFinanceData, 1500ms)  ← debounced async
```

**localStorage write is synchronous and immediate.** The UI re-renders from local state — there is no waiting for the cloud. The cloud push happens 1.5 seconds after the last write, in the background.

### App Load → Data Display

```
1. AuthProvider mounts
   └── Reads hf-session from localStorage
   └── If expired → sign out
   └── If valid → restore user and household

2. FinanceProvider mounts (keyed to household.id)
   └── load() from localStorage → immediate render

3. useEffect fires (async)
   └── fetchCloudFinanceData() from Supabase
   └── mergeFinanceData(local, cloud)
   └── repairSnapshotTotals(merged)
   └── setDataState(repaired) → re-render with merged data
```

If Supabase is unreachable (offline, rate-limited, misconfigured), step 3 silently fails and the app continues working with local data.

---

## Key Design Decisions

### 1. Local-first data

Finance data is stored in `localStorage` as the primary store. The app works fully offline with no cloud dependency. Supabase is the sync layer, not the source of truth during a session.

**Why:** Financial data must be immediately accessible without latency. Waiting for a network round trip on every read would make the app feel sluggish.

### 2. Cloud sync is best-effort

If Supabase is unavailable, the app degrades gracefully: local data is used, writes queue in memory, and sync resumes when connectivity returns. No error dialogs are shown unless explicitly helpful.

**Why:** Household finances are high-stakes. Blocking the user from viewing or editing their data because of a backend outage is unacceptable.

### 3. Local auth, cloud coordination

Authentication (sign-in, session management, password hashing) is done entirely in the browser using `localStorage` and Web Crypto. Supabase is used only to coordinate which household a Google user belongs to — not to authenticate them.

**Why:** Avoids vendor lock-in for auth. The app can run without Supabase for a single-device, email-only user. Supabase Auth is explicitly not used.

### 4. No server-side code

The app is a pure client SPA. All Supabase access is done from the browser using the public anon key. There is no API server, no serverless functions, and no backend deployment to manage.

**Why:** Simplicity of deployment. The entire app is static files served by Vercel.

### 5. TypeScript everywhere

All files are TypeScript. `any` is prohibited. New context methods must be typed in their interface. `npm run build` (not just `tsc --noEmit`) is run before every commit.

**Why:** The finance domain involves monetary calculations. Type errors in amounts or statuses have real-world consequences. TypeScript catches an entire class of bugs at compile time.

---

## Security Model

### Supabase RLS

Supabase Row Level Security (RLS) is enabled on all tables, but the policies use `allow_all` for the anon role. This is intentional:

- **Why allow_all?** Auth is done client-side, not at the database layer. The database cannot verify the user's identity because there is no Supabase Auth session.
- **Mitigation:** Financial data is scoped by `household_id`. A malicious actor who knows a `household_id` could read or write that household's data. This is an accepted risk for a household-scale private app. A future version may add server-side JWT verification.

### Anon key exposure

The `VITE_SUPABASE_ANON_KEY` is a public key by design — it is safe to embed in client-side code. The Supabase project's security relies on RLS policies, not on keeping the anon key secret.

The `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS) is **never** used in this app and must never appear in any source file.

---

## Module Dependency Graph

```
src/main.tsx
  └── src/App.tsx
        ├── src/context/AuthContext.tsx
        │     ├── src/lib/localAuth.ts
        │     ├── src/lib/googleAuth.ts
        │     └── src/lib/cloudInvites.ts
        │
        └── src/context/FinanceContext.tsx
              ├── src/lib/cloudFinance.ts
              │     └── src/lib/supabase.ts
              ├── src/lib/savingsEngine.ts
              ├── src/lib/taxEstimation.ts
              └── src/lib/categories.ts
```

Components (`src/components/*.tsx`) import only from contexts via `useAuth()` and `useFinance()`. They never import from `src/lib/*` directly.

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| App load (cold) | ~800ms | Vite bundle + localStorage read |
| Data read (any tab) | <1ms | Synchronous localStorage |
| Data write (any action) | <1ms | Synchronous localStorage write |
| Cloud sync (push) | 200–800ms | Debounced 1.5s after last write |
| Cloud load on mount | 300–1500ms | Single Supabase SELECT |
| Allocation engine | <5ms | Synchronous, in-memory |
| AI Explain (Goals) | 1–4s | Claude Haiku API round trip |

---

## Environments

| Environment | URL | Deploy trigger |
|-------------|-----|---------------|
| Production | https://household-finance-planner.com | Push to `main` branch |
| Preview | Auto-generated Vercel URL | Push to any other branch |
| Local dev | http://localhost:5173 | `npm run dev` |
