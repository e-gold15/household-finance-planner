# Household Finance Planner — Full Product Design Document

> **Audience:** designers, engineers, and product stakeholders.
> This document is the single source of truth for every feature, screen, interaction, and design decision in the app.
> **Version:** 2.0 — April 2026

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Design System](#4-design-system)
5. [Authentication & Household Model](#5-authentication--household-model)
6. [Header & Global Navigation](#6-header--global-navigation)
7. [Overview Tab](#7-overview-tab)
8. [Income Tab](#8-income-tab)
9. [Expenses Tab](#9-expenses-tab)
10. [Savings Tab](#10-savings-tab)
11. [Goals Tab](#11-goals-tab)
12. [History Tab](#12-history-tab)
13. [Settings Panel](#13-settings-panel)
14. [Household Settings](#14-household-settings)
15. [Data Model](#15-data-model)
16. [Tax Engine](#16-tax-engine)
17. [Smart Allocation Engine](#17-smart-allocation-engine)
18. [Internationalisation & RTL](#18-internationalisation--rtl)
19. [Persistence & Data Flow](#19-persistence--data-flow)
20. [Accessibility](#20-accessibility)
21. [Responsiveness](#21-responsiveness)

---

## 1. Product Vision

**Problem:** Israeli households lack a free, private tool that accurately calculates take-home pay (accounting for Bituach Leumi, health tax, pension, and progressive income tax) and connects it to a realistic savings and goal plan — while supporting real multi-person household collaboration.

**Solution:** A web app that:
- Computes real net income from gross salary using the Israeli (and multi-country) tax system
- Tracks expenses with category grouping and monthly normalisation
- Models savings accounts with liquidity tiers and expected returns
- Allocates surplus cash toward user-defined financial goals intelligently
- Supports household collaboration via invite links (cross-device, via Supabase)
- Keeps all financial data local — no cloud, no data selling

**Core promise:** _"Enter your gross salary. Know your real financial picture in five minutes."_

---

## 2. User Personas

### Primary — The Israeli Dual-Income Couple
- Age 30–45, salaried employees (hi-tech / public sector)
- Both earn gross salaries; confused by pay slips
- Have a mortgage, kids, pension fund, study fund
- Want to know: "How much can we actually save each month?"
- Use case: User A invites User B via a link; both enter their own data

### Secondary — The Freelancer / Self-Employed
- Variable monthly income, no employer contributions
- Needs to estimate quarterly tax liability
- Uses manual net override + goal tracking

### Tertiary — The Expat / Multi-Country Household
- One partner earns in ILS, one in USD or EUR
- Needs multi-currency display and simplified foreign tax brackets

---

## 3. Information Architecture

```
App (root)
│
├── Auth Gate
│   ├── Continue with Google    ← primary CTA
│   └── Continue with Email     ← accordion: Sign In / Create Account
│
└── Main App (authenticated)
    │
    ├── Header (global, sticky)
    │   ├── Logo + App name
    │   ├── Language toggle (EN / עב)
    │   ├── Dark mode toggle
    │   ├── User chip (avatar + name + household name)
    │   ├── Household icon → Household Settings dialog
    │   ├── Sign Out button
    │   └── Settings gear → Settings dialog
    │
    ├── Tab bar (6 tabs)
    │
    ├── Overview
    ├── Income
    ├── Expenses
    ├── Savings
    ├── Goals
    └── History
```

**Navigation pattern:** Single-page tab bar (no routing). Active tab is highlighted; all tabs are always accessible. On mobile, labels hide and only icons show.

---

## 4. Design System

### 4.1 Colour Palette

All colours are defined as HSL semantic tokens in `src/index.css`.

| Token | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| `--primary` | `162 63% 41%` (teal) | `162 63% 45%` | Buttons, active states, KPI values |
| `--background` | `160 20% 97%` | `162 25% 8%` | Page background |
| `--card` | `0 0% 100%` | `162 25% 11%` | Card surfaces |
| `--muted` | `162 15% 94%` | `162 20% 16%` | Subtle backgrounds |
| `--muted-foreground` | `162 20% 45%` | `162 15% 55%` | Secondary labels |
| `--destructive` | `0 72% 51%` | `0 62% 50%` | Errors, delete |
| `--border` | `162 20% 88%` | `162 20% 20%` | Borders |

**Status colours:**
- Realistic → emerald (`text-emerald-600`)
- Tight → amber (`text-amber-600`)
- Unrealistic / Blocked → destructive

### 4.2 Typography

- **Font family:** System sans-serif stack
- **Headings:** `font-bold tracking-tight`
- **Body:** `text-sm` (14 px)
- **Numbers:** `font-semibold tabular-nums`
- **Labels:** `text-xs text-muted-foreground`

### 4.3 Spacing & Layout

- Container: `max-w-4xl mx-auto px-4`
- Section spacing: `space-y-4` between cards
- Card padding: `p-6`
- Grid: `grid-cols-2` on mobile → `grid-cols-4` on md

### 4.4 Component Library

Built on **shadcn/ui** + **Radix UI** primitives.

| Component | Purpose |
|-----------|---------|
| Button | 6 variants: default, destructive, outline, secondary, ghost, link |
| Card | `Card`, `CardHeader`, `CardTitle`, `CardContent` |
| Dialog | Modal with overlay, close button, focus trap |
| Badge | 6 variants including `warning` (amber) |
| Input | Standard text input with focus ring |
| Select | Radix dropdown |
| Slider | Range slider for emergency buffer |
| Progress | Goal progress bar |
| Switch | Toggle with full-row label |

---

## 5. Authentication & Household Model

### 5.1 Overview

Two-layer auth system:
- **Local layer** — user accounts, sessions, password hashing (SHA-256 via Web Crypto API)
- **Cloud layer** — household metadata + invitations only (Supabase), so invite links work across devices

Financial data **never** leaves the browser.

### 5.2 Auth Providers

| Provider | How it works |
|----------|-------------|
| Google Sign-In | GIS `renderButton()` — renders Google's official button, opens a popup, returns an ID token. No backend required. |
| Email + Password | SHA-256 password hash stored in `hf-users` localStorage key. Never plain-text. |

### 5.3 Household Model

Every user belongs to exactly one household at a time:

```
User A (owner)
  └── Household "Cohen Family"
        ├── User A (owner)
        └── User B (member) ← joined via invite link
```

- **Owner** — can rename household, invite members, remove members, cancel invites
- **Member** — can view household name and members list, cannot manage

When a new user signs up, a private household is created automatically. They become the owner.

### 5.4 Auth Page Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         [Wallet icon — teal]            │
│    Household Finance Planner            │
│         מתכנן פיננסי ביתי               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [G]  Continue with Google      │    │  ← Google's official button (primary)
│  └─────────────────────────────────┘    │
│                                         │
│              ── or ──                   │
│                                         │
│  Continue with Email  ▼                 │  ← accordion toggle
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Sign In  │  Create Account     │    │  ← tabs (only when expanded)
│  ├─────────────────────────────────┤    │
│  │  [Form fields + Submit]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  All data stored locally on device      │
└─────────────────────────────────────────┘
```

### 5.5 Invite Flow

```
Owner                              Invitee
─────                              ───────
1. Open Household Settings
2. Click Invite → enter email
3. Invite created in Supabase
4. Copy invite link
5. Share link (copy / mailto)
                                   6. Open link → ?invite=ID stored
                                   7. Sign up or sign in
                                   8. Invite accepted in Supabase
                                   9. Joins owner's household
                                  10. Finance data starts empty (local)
```

Invitations expire after **7 days**. Re-inviting the same email cancels the previous invite.

### 5.6 Storage Keys

**localStorage (local):**

| Key | Contents |
|-----|----------|
| `hf-users` | `LocalUser[]` — credentials, Google profile |
| `hf-households` | `Household[]` — names, memberships |
| `hf-invitations` | `Invitation[]` — local cache |
| `hf-session` | `AppSession` — `{ userId, householdId }` |
| `hf-data-{householdId}` | Full `FinanceData` |

**Supabase (cloud, invite sync only):**

| Table | Contents |
|-------|----------|
| `households` | id, name, created_by, created_at |
| `household_memberships` | household_id, user_id, role, joined_at |
| `invitations` | id, email, household_id, status, expires_at |

### 5.7 Legacy Migration

On first load after upgrading from v1, `migrateIfNeeded()` runs once:
- Reads old `hf-accounts` key
- Creates `LocalUser` + personal `Household` for each account
- Copies finance data to new `hf-data-{householdId}` key
- Removes `hf-accounts` so migration doesn't run again

---

## 6. Header & Global Navigation

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [🔵 Wallet]  Household Finance Planner   [עב] [🌙] [A ▾ 👥 →] [⚙] │
└─────────────────────────────────────────────────────────────────┘
```

- Sticky (`position: sticky; top: 0; z-index: 40`)
- `bg-card/80 backdrop-blur-sm` — frosted glass
- Height: `h-14` (56 px)

### 6.2 User + Household Chip

```
[Avatar]  Name          ← Google photo or initial
          Household     ← household name in smaller text below
[👥]  [→]              ← household settings | sign out
```

- Google users: shows their profile photo
- Email users: shows first initial in teal circle
- Household name shown in 10px muted text below display name
- `👥` icon opens Household Settings dialog
- `→` (LogOut) clears session

### 6.3 Controls (right-to-left reading order)

1. Language toggle `EN / עב`
2. Dark mode toggle (Sun / Moon)
3. Divider
4. Avatar + name/household
5. Household settings icon (`Users`)
6. Sign out icon (`LogOut`)
7. Settings gear

---

## 7. Overview Tab

**Purpose:** Instant snapshot of the household's financial health.

### 7.1 KPI Cards

Four cards in `2-col (mobile) → 4-col (md)` grid:

| Card | Value |
|------|-------|
| Monthly Income | Sum of all members' net monthly income |
| Monthly Expenses | Sum normalised to monthly |
| Free Cash Flow | Income − Expenses − Contributions |
| Total Assets | Sum of all account balances |

### 7.2 Deficit Warning Banner

Shown when `freeCashFlow < 0` — orange-red, `AlertTriangle` icon.

### 7.3 Expense Breakdown Chart

Recharts `PieChart` — categories as slices, 10-colour palette, percentage inline labels.

### 7.4 Savings by Liquidity Chart

Recharts `BarChart` — Liquid vs Locked bars, abbreviated Y-axis (`120k`).

### 7.5 Top Goals Progress

First 3 goals: name + percentage + progress bar.

---

## 8. Income Tab

**Purpose:** Define who earns what, with accurate net take-home calculation.

### 8.1 Member Card Structure

```
Member Name                    [₪XX,XXX/mo] [🗑]
  └── Source Card
  └── Source Card
  └── [+ Add Source]
```

### 8.2 Source Card

Displays: name, type badge, gross→net badge, contributions badge, gross amount (struck through), net amount in teal, expand chevron for full tax breakdown.

### 8.3 Tax Breakdown Expander

Inline expansion showing every deduction line:
- Income tax, Bituach Leumi, Health Tax (red)
- Employee contributions (amber)
- Net with effective rate % (teal, bold)

### 8.4 Add / Edit Source Dialog — Sections

| # | Section | Always shown? |
|---|---------|---------------|
| 1 | Basic Info (name, amount, type) | Yes |
| 2 | Gross toggle + country/IL fields | When `isGross = true` |
| 3 | Contributions toggle + fields | When `isGross = true` |
| 4 | Manual net toggle + override field | Yes |
| 5 | Net preview card | When `amount > 0` |
| 6 | Employer cost summary | When `isGross + useContributions` |

---

## 9. Expenses Tab

Expenses grouped by category. Only non-empty categories shown.

**Categories:** Housing · Food · Transport · Education · Leisure · Health · Utilities · Clothing · Insurance · Savings · Other

Each row: name, recurring/one-time badge, yearly amount + monthly equivalent badge, edit/delete.

---

## 10. Savings Tab

Accounts split into two lists: **Liquid** (immediate + short) and **Locked / Long-term** (medium + locked).

Summary row shows total liquid and total locked balances.

Each account: name, type badge, liquidity badge (colour-coded), return %, monthly contribution.

---

## 11. Goals Tab

### 11.1 Emergency Buffer

Slider (1–12 months) at top of tab. Buffer is subtracted from liquid savings before goal allocation.

### 11.2 Goal Card

```
[Status icon]  Goal Name         [Priority]  [Status]
₪30,000 / ₪80,000                               37%
[══════════════════════──────────────────]
Recommended/mo: ₪2,500    Deadline: Jan 2028
Gap: ₪800 (if applicable)
[↑] [↓]                                   [✏] [🗑]
```

**Status → colour mapping:**
- `realistic` → emerald
- `tight` → amber
- `unrealistic` / `blocked` → destructive

---

## 12. History Tab

Monthly snapshots. "Snapshot This Month" captures current income/expenses/savings/cash flow.

Trend chart: 3 lines (Income teal, Expenses red, Free Cash Flow blue).

Snapshots listed newest-first with free cash flow badge (green/red).

---

## 13. Settings Panel

Opened via gear icon. Contains:
- **Currency** select (ILS / USD / GBP / EUR / CAD)
- **Dark Mode** switch
- **Export JSON** — downloads full `FinanceData`
- **Import JSON** — replaces current data from file

---

## 14. Household Settings

Opened via 👥 icon in header. Owner-only management panel.

### 14.1 Household Name

Inline rename (owners only) — saves to both localStorage and Supabase.

### 14.2 Members List

Each member row:
```
[Avatar]  Name (you)              [Owner 👑] or [Member 👤]
          email                              [✕ remove]
```

Remove button only shown for non-owner members, only to the owner.

### 14.3 Pending Invitations

```
[E]  email@example.com            [Pending]
     Expires 01/05/2026           [📋] [✉] [✕]
```

- 📋 copies invite link to clipboard
- ✉ opens mailto with pre-filled subject + body
- ✕ cancels (expires) the invite
- Refresh button (↺) re-fetches from Supabase

### 14.4 Invite Dialog

Email input → creates invite in Supabase → shows in pending list.
Invite link format: `https://household-finance-planner.vercel.app?invite={id}`

---

## 15. Data Model

### Auth Types

```typescript
interface LocalUser {
  id: string
  name: string
  email: string
  avatar?: string          // Google profile photo URL
  authProvider: 'google' | 'email'
  householdId: string
  createdAt: string
  passwordHash?: string    // email auth only
}

interface Household {
  id: string
  name: string
  createdBy: string        // userId of owner
  memberships: HouseholdMembership[]
  createdAt: string
}

interface HouseholdMembership {
  userId: string
  role: 'owner' | 'member'
  joinedAt: string
}

interface Invitation {
  id: string
  email: string
  householdId: string
  invitedBy: string
  status: 'pending' | 'accepted' | 'expired'
  createdAt: string
  expiresAt: string        // 7 days from creation
}

interface AppSession {
  userId: string
  householdId: string
}
```

### Finance Types

```typescript
interface FinanceData {
  members: HouseholdMember[]   // income earners (finance domain)
  expenses: Expense[]
  accounts: SavingsAccount[]
  goals: Goal[]
  history: MonthSnapshot[]
  emergencyBufferMonths: number
  currency: Currency
  locale: Locale
  darkMode: boolean
  language: 'en' | 'he'
}
```

_(Full type definitions for IncomeSource, Expense, SavingsAccount, Goal, MonthSnapshot — see `src/types/index.ts`)_

---

## 16. Tax Engine

**File:** `src/lib/taxEstimation.ts`

### Israeli Monthly Calculation

```
Step 1 — Income Tax (progressive brackets)
  ₪0–₪7,010     → 10%
  ₪7,011–₪10,060 → 14%
  ₪10,061–₪16,150 → 20%
  ₪16,151–₪22,440 → 31%
  ₪22,441–₪46,690 → 35%
  > ₪46,690       → 47%
  − creditPoints × ₪242

Step 2 — Insured Salary = gross × (insuredSalaryRatio / 100)

Step 3 — Bituach Leumi (capped at ₪49,030)
  ₪0–₪7,522   → 3.5%
  ₪7,522–cap  → 12%

Step 4 — Health Tax (same cap)
  ₪0–₪7,522   → 3.1%
  ₪7,522–cap  → 5%

Step 5 — Employee Contributions (when useContributions = true)
  pension + education fund % of gross

Step 6 — Net = gross − all deductions
```

### Foreign Countries

Annual bracket estimates ÷ 12. Supported: US, UK, DE, FR, CA.

---

## 17. Smart Allocation Engine

**File:** `src/lib/savingsEngine.ts`

Priority-ordered processing. For each goal:

1. Calculate `liquidAvailable = liquidBalance − emergencyBuffer`
2. If `useLiquidSavings`: apply liquid savings toward gap
3. Calculate `monthlyRecommended = stillNeeded / monthsUntil(deadline)`
4. Compare against `remainingSurplus`
5. Assign status: `realistic` / `tight` / `unrealistic` / `blocked`
6. Subtract from `remainingSurplus` for next goal

| Status | Meaning |
|--------|---------|
| `realistic` | Achievable within current surplus |
| `tight` | Achievable but consuming > 50% of surplus with < 24 months |
| `unrealistic` | Partially fundable — gap exists |
| `blocked` | No surplus left, or deadline passed |

---

## 18. Internationalisation & RTL

- `t(en, he, lang)` wraps every user-visible string
- Switching language sets `document.documentElement.dir` and `lang`
- `me-*` / `ms-*` margin utilities for logical direction
- Recharts wrapped in `direction: ltr` to prevent axis mirroring
- `Intl.NumberFormat` with locale-appropriate currency formatting

---

## 19. Persistence & Data Flow

### Read Path

1. `main.tsx` — detect `?invite=` param → store to `hf-pending-invite` → strip from URL
2. `AuthContext` mounts → `migrateIfNeeded()` → `getSession()` → restore user + household
3. If user found → `FinanceProvider` mounts with `householdId` prop
4. `useState(() => load(householdId))` reads `hf-data-{householdId}` synchronously
5. App renders with hydrated state — no loading spinner

### Write Path

Every `setData(updater)`:
1. Calls `updater(prev)` → new state
2. Writes to `localStorage` synchronously
3. Returns new state to React

### Cloud Sync (invites only)

On sign-up / sign-in:
- `syncHousehold()` → upserts household row in Supabase
- `syncMembership()` → upserts membership row

On invite accept:
- `acceptCloudInvitation()` → marks invite `accepted`, adds membership
- User's `householdId` updated in localStorage + session

### Household Isolation

`FinanceProvider` receives `key={household.id}`. Switching households triggers React remount — fresh data load, no cross-household leaks.

---

## 20. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Single H1 | `<h1 className="sr-only">` always present |
| Focus management | Radix Dialog traps focus; returns to trigger on close |
| Focus rings | `focus-visible:ring-2` on all interactive elements |
| Toggle labels | Every Switch paired with Label — full row clickable |
| Colour signals | Every status uses icon + text + colour (never colour alone) |
| Keyboard nav | All interactions reachable via Tab + Enter/Space |
| Screen readers | `aria-hidden` on decorative SVGs; `title` on icon-only buttons |
| Tap targets | All interactive elements ≥ 44×44 px on mobile |

---

## 21. Responsiveness

| Breakpoint | Min-width | Changes |
|------------|-----------|---------|
| base | 0 | Single column, icon-only tabs |
| `sm` | 640 px | Tab labels, app title, user name |
| `md` | 768 px | 4-up KPI grid, side-by-side charts |
| `lg` | 1024 px | Centred container with breathing room |

- Tab bar: `overflow-x-auto` for narrow screens
- Dialogs: `mx-4` margin on mobile
- Source dialog: `max-h-[85vh]` scrollable
- Number inputs: `inputMode="decimal"` for mobile numeric keyboard

---

*Document version: 2.0 — reflects app state as of April 2026*
*Previous version: 1.0 (single-user, email-only auth, no household model)*
