# Household Finance Planner · מתכנן פיננסי ביתי

A modern, privacy-first household finance web app built for Israeli families (with multi-country support). All data lives in the browser — no cloud, no subscriptions.

---

## Features at a glance

| Area | What it does |
|------|-------------|
| **Auth** | Local email + password, SHA-256 hashed, per-user data isolation |
| **Income** | Multi-member, multi-source, full Israeli tax engine (gross → net) |
| **Expenses** | Categorised, recurring vs one-time, monthly normalisation |
| **Savings** | Accounts by type and liquidity, contribution tracking |
| **Goals** | Priority-ordered, smart allocation engine, gap analysis |
| **History** | Monthly snapshots, trend line chart |
| **i18n** | Full EN ↔ עב RTL toggle |
| **Persistence** | `localStorage` per user, JSON export / import |

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

No environment variables required — everything runs locally.

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

---

## Project structure

```
src/
├── lib/
│   ├── utils.ts            # cn(), t(), formatCurrency(), generateId()
│   ├── localAuth.ts        # SHA-256 auth, session management
│   ├── taxEstimation.ts    # IL + multi-country tax engine
│   └── savingsEngine.ts    # Smart goal allocation
├── context/
│   ├── AuthContext.tsx     # Auth state
│   └── FinanceContext.tsx  # Per-user financial state + localStorage
├── types/index.ts          # All TypeScript interfaces
├── components/
│   ├── ui/                 # Primitive components (button, card, dialog…)
│   ├── Header.tsx
│   ├── Overview.tsx
│   ├── Income.tsx
│   ├── Expenses.tsx
│   ├── Savings.tsx
│   ├── Goals.tsx
│   └── History.tsx
├── pages/
│   └── AuthPage.tsx
├── App.tsx
├── main.tsx
└── index.css               # HSL design tokens
```

---

## Data storage

Each user's data is isolated:

| Key | Contents |
|-----|----------|
| `hf-accounts` | Array of user accounts (hashed passwords) |
| `hf-session` | ID of the currently logged-in user |
| `hf-data-{userId}` | Full financial data for that user |

Export your data at any time via **Settings → Export JSON**. Import it back on any device.

---

## Israeli tax engine

Supports the full monthly calculation chain:

1. Progressive income tax (7 brackets)
2. Tax credit points deduction (₪242/point/month)
3. Bituach Leumi on insured salary (capped at ₪49,030)
4. Health Tax on insured salary (capped at ₪49,030)
5. Employee pension + education fund contributions
6. Employer cost summary (informational)

Other countries (US, UK, DE, FR, CA) use simplified annual bracket estimates.

---

## Internationalisation

Every user-facing string is wrapped in `t(en, he, lang)`. Switching to Hebrew flips the root `dir` to `rtl` and mirrors all layouts, icons, and chart axes.

---

## Future roadmap (not yet built)

- Cloud sync (Supabase or equivalent)
- Google Sign-In
- Mobile PWA / offline mode
- Bank statement CSV import
- Multi-currency conversion
- Couple / shared household mode
