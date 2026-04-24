# Household Finance Planner · מתכנן פיננסי ביתי

A modern, privacy-first household finance web app built for Israeli families (with multi-country support). Financial data lives in the browser — no subscriptions, no data selling. Household membership and invite links are synced via Supabase so partners can join from any device.

**Live app:** https://household-finance-planner.vercel.app

---

## Features at a glance

| Area | What it does |
|------|-------------|
| **Auth** | Google Sign-In (primary) + local email/password, per-user isolation |
| **Household** | Shared household model — invite partners via a link, cross-device |
| **Income** | Multi-member, multi-source, full Israeli tax engine (gross → net) |
| **Expenses** | Categorised, recurring vs one-time, monthly normalisation |
| **Savings** | Accounts by type and liquidity, contribution tracking |
| **Goals** | Priority-ordered, smart allocation engine, gap analysis |
| **History** | Monthly snapshots, trend line chart |
| **i18n** | Full EN ↔ עב RTL toggle |
| **Persistence** | `localStorage` per household, JSON export / import |
| **Tests** | 75 unit tests (Vitest) — tax engine, savings engine, auth, utils |

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev                         # http://localhost:5173
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_GOOGLE_CLIENT_ID` | Optional | OAuth 2.0 client ID for Google Sign-In |

Without `VITE_GOOGLE_CLIENT_ID`, the Google button is shown but disabled — email auth still works.

---

## Running tests

```bash
npm test                 # run all 75 tests once
npm run test:watch       # re-run on file change (dev mode)
npm run test:coverage    # with V8 coverage report
```

Test files live in `src/test/`:
- `utils.test.ts` — formatting, translation, ID generation
- `taxEstimation.test.ts` — IL tax brackets, BL/Health Tax caps, foreign countries
- `savingsEngine.test.ts` — goal allocation, realistic/blocked status, liquid savings
- `localAuth.test.ts` — sign-up, sign-in, sessions, invitations, migration

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS (semantic HSL tokens) |
| Components | shadcn/ui + Radix UI primitives |
| Charts | Recharts |
| Icons | lucide-react |
| Toasts | sonner |
| State | React Context + localStorage |
| Cloud (invites only) | Supabase (PostgreSQL) |
| Testing | Vitest + @testing-library/react |
| Hosting | Vercel |

---

## Project structure

```
src/
├── lib/
│   ├── utils.ts            # cn(), t(), formatCurrency(), generateId()
│   ├── localAuth.ts        # Local SHA-256 auth, household model, invitations
│   ├── googleAuth.ts       # Google Identity Services (GIS) integration
│   ├── cloudInvites.ts     # Supabase cloud invite + household sync
│   ├── taxEstimation.ts    # IL + multi-country tax engine
│   └── savingsEngine.ts    # Smart goal allocation engine
├── context/
│   ├── AuthContext.tsx     # Auth + household state (Google, email, invites)
│   └── FinanceContext.tsx  # Per-household financial state + localStorage
├── types/index.ts          # All TypeScript interfaces
├── components/
│   ├── ui/                 # Primitive components (button, card, dialog…)
│   ├── Header.tsx          # Logo, nav, user chip, household chip, settings
│   ├── HouseholdSettings.tsx # Members list, invite management
│   ├── Overview.tsx
│   ├── Income.tsx
│   ├── Expenses.tsx
│   ├── Savings.tsx
│   ├── Goals.tsx
│   └── History.tsx
├── pages/
│   └── AuthPage.tsx        # Google primary CTA + email accordion
├── test/
│   ├── setup.ts
│   ├── utils.test.ts
│   ├── taxEstimation.test.ts
│   ├── savingsEngine.test.ts
│   └── localAuth.test.ts
├── App.tsx
├── main.tsx                # ?invite= URL param detection
└── index.css               # HSL design tokens
supabase/
└── migration.sql           # Run once in Supabase SQL Editor
```

---

## Data storage

### What stays local (localStorage)

| Key | Contents |
|-----|----------|
| `hf-users` | `LocalUser[]` — hashed passwords, Google profiles |
| `hf-households` | `Household[]` — names, memberships |
| `hf-invitations` | `Invitation[]` — local invite cache |
| `hf-session` | `AppSession` — `{ userId, householdId }` |
| `hf-data-{householdId}` | Full `FinanceData` for that household |

### What goes to Supabase (cloud)

| Table | Contents | Why cloud? |
|-------|----------|------------|
| `households` | Name, creator, timestamps | Needed for invite acceptance on other devices |
| `household_memberships` | User ↔ household roles | Cross-device membership sync |
| `invitations` | Email, status, expiry, token | Invite links must be redeemable from any device |

Financial data (income, expenses, savings, goals, history) **never** leaves the browser.

---

## Household & invites flow

1. Sign up → private household created automatically
2. Open household settings (👥 icon in header) → **Invite**
3. Enter partner's email → invite created in Supabase
4. Copy the invite link → share it with your partner
5. Partner opens the link → `?invite=ID` stored → they sign up / sign in
6. Partner is automatically added to your household

---

## Israeli tax engine

Monthly calculation chain:

1. Progressive income tax (7 brackets, up to 47%)
2. Tax credit points deduction (₪242/point/month)
3. Bituach Leumi on insured salary (capped at ₪49,030)
4. Health Tax on insured salary (capped at ₪49,030)
5. Employee pension + education fund contributions
6. Employer cost summary (informational)

Other countries (US, UK, DE, FR, CA) use simplified annual bracket estimates.

---

## Deployment (Vercel)

1. Push to GitHub — Vercel auto-deploys on every push to `main`
2. Set environment variables in **Vercel → Settings → Environment Variables**
3. Run `supabase/migration.sql` once in your Supabase SQL Editor

---

## Internationalisation

Every user-facing string is wrapped in `t(en, he, lang)`. Switching to Hebrew flips the root `dir` to `rtl` and mirrors all layouts, icons, and chart axes.

---

## Future roadmap

- Cloud sync of financial data (opt-in)
- Mobile PWA / offline mode
- Bank statement CSV import
- Multi-currency conversion
- Recurring expense reminders
- Shared budget view (both partners see combined data in real time)
