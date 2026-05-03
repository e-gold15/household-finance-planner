# Household Finance Planner — Full Product Design Document

> **Audience:** designers, engineers, and product stakeholders.
> This document is the single source of truth for every feature, screen, interaction, and design decision in the app.
> **Version:** 3.3-draft — May 2026

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
22. [Feature Spec: Historical Expense Entry (v2.3)](#22-feature-spec-historical-expense-entry-v23)
24. [Feature Spec: Historical Income Entry (v2.5)](#24-feature-spec-historical-income-entry-v25)
25. [Feature Spec: Add Income to Past Month from Income Tab (v2.6)](#25-feature-spec-add-income-to-past-month-from-income-tab-v26)

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

Each snapshot card supports two complementary ways to record what actually happened that month:

1. **Log Actuals** (existing, v2.2) — set a single total per category (e.g. "Food: ₪3,400"). Quick, summary-level.
2. **Historical Expense Entry** (new, v2.3) — add individual named line items to the snapshot (e.g. "Dentist ₪800", "Car service ₪1,200"). Items automatically adjust the corresponding category actual total.

See [Section 22](#22-feature-spec-historical-expense-entry-v23) for the full spec.

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
Invite link format: `https://household-finance-planner.com?invite={id}`

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

*Document version: 2.5-draft — reflects app state as of April 2026*
*Previous version: 2.4.1 (Past-month expense entry from Expenses tab + fixed expense pre-population)*

---

## 24. Feature Spec: Historical Income Entry (v2.5)

### 24.1 Problem

**User pain:** A user can now log past-month expenses (v2.3 / v2.4), but past-month snapshots still show `totalIncome: ₪0` and a "—" free-cash-flow badge. There is no way to record what was actually earned in a past month. Without income, the History tab can't show a meaningful FCF or trend — the "Free Cash" line on the chart is flat at 0 for all stub months.

**Who is affected:** All personas — anyone who takes retroactive snapshots or uses `addExpenseToMonth` to log a past month.

---

### 24.2 Solution Overview

Add the ability to log individual income line items against any past-month snapshot in the History tab — symmetric to the `HistoricalExpense` feature (v2.3).

Key principles:
- **Simple entry** — no gross/net tax calculation. Past income is always entered as the **net amount received** (what actually hit the bank account).
- **Per-person** — member name is a free-text field or a select from existing household members.
- **FCF recomputes live** — adding or removing income recalculates `totalIncome` and `freeCashFlow` on the snapshot atomically.
- **Symmetric UI** — "Recorded income (N)" section on History snapshot cards, parallel to "Recorded expenses (N)".

---

### 24.3 Data Model Changes

#### New type: `HistoricalIncome`

```typescript
export interface HistoricalIncome {
  id: string
  memberName: string   // who received this income (free text or from member list)
  amount: number       // net amount received that month (positive)
  note?: string        // optional: "bonus", "freelance project", etc.
}
```

#### Updated `MonthSnapshot`

```typescript
export interface MonthSnapshot {
  // ... existing fields unchanged ...
  categoryActuals?:    Partial<Record<ExpenseCategory, number>>
  historicalExpenses?: HistoricalExpense[]
  historicalIncomes?:  HistoricalIncome[]   // ← NEW
}
```

#### `totalIncome` and `freeCashFlow` update rules

**Add income item:**
```
totalIncome    += item.amount
freeCashFlow    = totalIncome - totalExpenses - totalSavings
```

**Delete income item:**
```
totalIncome    -= item.amount  (clamped to 0)
freeCashFlow    = totalIncome - totalExpenses - totalSavings
```

**Edit income item (amount changed):**
```
totalIncome    -= old.amount (clamped to 0)
totalIncome    += new.amount
freeCashFlow    = totalIncome - totalExpenses - totalSavings
```

`freeCashFlow` recomputes fully each time so it is always consistent with `totalIncome - totalExpenses - totalSavings`. Once income is recorded, the stub's "—" badge is replaced by the real FCF (green if positive, red if negative).

---

### 24.4 New Context Methods

```typescript
addHistoricalIncome:    (snapshotId: string, item: Omit<HistoricalIncome, 'id'>) => void
deleteHistoricalIncome: (snapshotId: string, itemId: string) => void
updateHistoricalIncome: (snapshotId: string, item: HistoricalIncome) => void
```

**Implementation of `addHistoricalIncome`:**
```typescript
const addHistoricalIncome = (snapshotId: string, item: Omit<HistoricalIncome, 'id'>) =>
  setData((d) => ({
    ...d,
    history: d.history.map((h) => {
      if (h.id !== snapshotId) return h
      const newItem: HistoricalIncome = { ...item, id: generateId() }
      const newTotalIncome = h.totalIncome + item.amount
      return {
        ...h,
        historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
        totalIncome:  newTotalIncome,
        freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
      }
    }),
  }))
```

**Implementation of `deleteHistoricalIncome`:**
```typescript
const deleteHistoricalIncome = (snapshotId: string, itemId: string) =>
  setData((d) => ({
    ...d,
    history: d.history.map((h) => {
      if (h.id !== snapshotId) return h
      const toDelete = (h.historicalIncomes ?? []).find((i) => i.id === itemId)
      if (!toDelete) return h
      const newTotalIncome = Math.max(0, h.totalIncome - toDelete.amount)
      return {
        ...h,
        historicalIncomes: (h.historicalIncomes ?? []).filter((i) => i.id !== itemId),
        totalIncome:  newTotalIncome,
        freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
      }
    }),
  }))
```

**Implementation of `updateHistoricalIncome`:**
```typescript
const updateHistoricalIncome = (snapshotId: string, item: HistoricalIncome) =>
  setData((d) => ({
    ...d,
    history: d.history.map((h) => {
      if (h.id !== snapshotId) return h
      const old = (h.historicalIncomes ?? []).find((i) => i.id === item.id)
      if (!old) return h
      const newTotalIncome = Math.max(0, h.totalIncome - old.amount) + item.amount
      return {
        ...h,
        historicalIncomes: (h.historicalIncomes ?? []).map((i) => i.id === item.id ? item : i),
        totalIncome:  newTotalIncome,
        freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
      }
    }),
  }))
```

---

### 24.5 UI Design

#### 24.5.1 Snapshot card — updated layout

```
┌─────────────────────────────────────────────────────┐
│  March 2026   01/03/2026                            │
│               [+₪12,300]  [📋 Actuals logged]       │
│               [📋 Edit Actuals] [🗑]                │
│                                                     │
│  Income        Expenses        Savings              │
│  ₪18,000       ₪14,200         ₪0                   │
│                                                     │
│  ── Recorded income (2) ──────────────────────────  │
│  Eilon   Main salary   ₪15,000   [✏] [🗑]           │
│  Sara    Freelance     ₪3,000    [✏] [🗑]           │
│  [+ Add Income]                                     │  ← inline in section header
│                                                     │
│  ── Actual spending by category ────────────────── │
│  ...                                                │
│                                                     │
│  ── Recorded expenses (1) ────────────────────────  │
│  Dentist   Health   ₪2,800   [✏] [🗑]               │
│  [+ Add Expense to March 2026]                      │
└─────────────────────────────────────────────────────┘
```

#### 24.5.2 Add / Edit Historical Income dialog

```
┌──────────────────────────────────────┐
│  💰 Add Income — March 2026          │
│                                      │
│  Person                              │
│  [Eilon               ▼]  ← select from members, or type free text │
│                                      │
│  Net amount received                 │
│  [___________]                       │
│                                      │
│  Note (optional)                     │
│  [e.g. Monthly salary, Bonus…]       │
│                                      │
│  [    Save Income    ]               │
│  [       Cancel      ]               │
└──────────────────────────────────────┘
```

- **Person** — `<Select>` populated from `data.members` (existing household members). If the user wants to enter someone not in the member list, they can type freely (combo-box pattern: Select with an "Other / type name" option that reveals a text input). For simplicity in v2.5: use a plain `<Input>` with `list` datalist from member names (native browser combo-box). This avoids a custom combobox component.
- **Net amount received** — number input, required, > 0
- **Note** — optional free text

#### 24.5.3 Row layout in "Recorded income" section

```
[memberName]    [note if present]    ₪amount    [✏] [🗑]
```

- Member name: `font-medium`
- Note: `text-xs text-muted-foreground` (inline, truncated)
- Amount: `font-semibold tabular-nums text-primary` (green, positive income)
- Edit/Delete icons: same style as expense rows

#### 24.5.4 "Recorded income" section placement

Placed **above** the "Actual spending by category" section and above "Recorded expenses" — income comes first, then expenses.

---

### 24.6 Interaction Flows

#### Flow A — Add income to a past snapshot

1. User opens History tab
2. Finds March 2026 snapshot card
3. Clicks **"+ Add Income"** button
4. Dialog opens: Person select pre-filled with first member, amount empty
5. User selects "Eilon", enters 15000, note "Main salary"
6. Clicks "Save Income"
7. `addHistoricalIncome('snap-march', { memberName: 'Eilon', amount: 15000, note: 'Main salary' })`
8. `totalIncome` updates: `0 → 15000`
9. `freeCashFlow` updates: `0 → 15000 - 14200 - 0 = +800`
10. Snapshot card updates:
    - Income cell: ₪15,000
    - FCF badge changes from "—" to "+₪800" (green)
    - "Recorded income (1)" section appears

#### Flow B — Income changes FCF badge from stub "—" to real value

Once the first income item is added to a stub, `totalIncome > 0` and `freeCashFlow` is recomputed. The History tab's stub visual logic (stub detected when `totalIncome === 0 && totalExpenses > 0`) no longer triggers — the "—" badge is replaced by the real FCF badge (green/red).

---

### 24.7 Stub detection update

The stub detection condition in History.tsx currently is:
```
snap.totalIncome === 0 && snap.totalExpenses > 0
```

This correctly shows "—" when income hasn't been logged yet. Once `addHistoricalIncome` sets `totalIncome > 0`, the condition becomes false and the normal FCF badge renders. No code change needed for this — it's automatic.

---

### 24.8 i18n — New Strings

| English | Hebrew |
|---------|--------|
| `Recorded income ({n})` | `הכנסות שנרשמו ({n})` |
| `Add Income — {month}` | `הוסף הכנסה — {month}` |
| `Edit Income — {month}` | `ערוך הכנסה — {month}` |
| `Net amount received` | `סכום נטו שהתקבל` |
| `Save Income` | `שמור הכנסה` |
| `Person` | `אדם` |
| `e.g. Monthly salary, Bonus…` | `למשל: משכורת חודשית, בונוס…` |
| `Delete recorded income` | `מחק הכנסה שנרשמה` |
| `Edit recorded income` | `ערוך הכנסה שנרשמה` |

---

### 24.9 Acceptance Criteria

**Data**
- [ ] `HistoricalIncome` type in `src/types/index.ts`
- [ ] `historicalIncomes?: HistoricalIncome[]` on `MonthSnapshot`
- [ ] Three methods in `FinanceContext` and `FinanceContextType`
- [ ] `addHistoricalIncome` increments `totalIncome` and recomputes `freeCashFlow`
- [ ] `deleteHistoricalIncome` decrements `totalIncome` (clamped to 0) and recomputes `freeCashFlow`
- [ ] `updateHistoricalIncome` reverses old, applies new, recomputes `freeCashFlow`
- [ ] Old snapshots without `historicalIncomes` render correctly (`?? []`)

**UI**
- [ ] "Recorded income (N)" section visible on snapshot cards that have income items
- [ ] "Recorded income" section hidden when empty/missing
- [ ] "Recorded income" section placed above "Actual spending" and "Recorded expenses"
- [ ] "+ Add Income" button visible at bottom of "Recorded income" section header
- [ ] Inline "Add Income" button also appears when section is empty (always-visible)
- [ ] Dialog: Person (datalist from members), Amount, Note fields
- [ ] Save disabled until memberName non-empty and amount > 0
- [ ] Amount shown in `text-primary` (green) in the row
- [ ] FCF badge transitions from "—" to real value once income is recorded

**i18n** — all new strings through `t(en, he, lang)`

**Accessibility**
- [ ] All inputs have `<Label>` + `id`/`htmlFor`
- [ ] Icon-only buttons have `aria-label` + `title`
- [ ] All interactive elements ≥ 44px

**Tests (`src/test/historicalIncome.test.ts`)**
- [ ] `addHistoricalIncome` — increments totalIncome correctly
- [ ] `addHistoricalIncome` — recomputes freeCashFlow
- [ ] `deleteHistoricalIncome` — decrements totalIncome (clamped to 0)
- [ ] `deleteHistoricalIncome` — recomputes freeCashFlow after delete
- [ ] `updateHistoricalIncome` — handles amount change
- [ ] `updateHistoricalIncome` — does not mutate original
- [ ] Old snapshot without historicalIncomes field — backward compatible
- [ ] Multiple items accumulate correctly in totalIncome
- [ ] Sibling snapshots unchanged after mutation

---

### 24.10 Out of Scope (v2.5)

- Adding income via the Income tab "Past month" toggle (future v2.6)
- Gross-to-net tax calculation for past income entries (net-only in v2.5)
- Auto-populating income in stubs from current member sources (income varies month to month)
- Editing `totalSavings` for past months

---

### 24.11 Implementation Checklist for Agents

#### 🎨 Frontend Agent
1. Add `HistoricalIncome` interface to `src/types/index.ts` (after `HistoricalExpense`)
2. Add `historicalIncomes?: HistoricalIncome[]` to `MonthSnapshot`
3. Add three method signatures to `FinanceContextType`, implement all three in `FinanceContext.tsx`
4. Import `HistoricalIncome` alongside other types
5. Update `History.tsx`:
   - Add `HistoricalIncomeDialog` component (add/edit, with member datalist)
   - Add "Recorded income" section to each snapshot card (above actuals and expenses)
   - Add always-visible "+ Add Income" button
   - Wire edit/delete per row
   - Destructure `deleteHistoricalIncome` from `useFinance()`

#### 🧪 QA Agent
1. Write `src/test/historicalIncome.test.ts` — 9 tests from §24.9
2. `npm test` — all 222 + 9 = 231 tests must pass

#### 🖌 UX Agent
1. Income amount in rows uses `text-primary` (green) to distinguish from expenses (red)
2. Dialog uses `DollarSign` or `TrendingUp` lucide icon in the title
3. Verify `datalist` approach for member names works in Hebrew RTL
4. Verify FCF badge color transition (—→green/red) is correct after income added

#### 🔍 Code Review Agent
1. `freeCashFlow` recomputation: confirm `totalIncome - totalExpenses - totalSavings` each time
2. `deleteHistoricalIncome` clamps `totalIncome` to 0 before subtracting
3. `updateHistoricalIncome` reverses old item before applying new (handles any amount change)
4. No `any` types; all strings through `t()`

---

## 23. Feature Spec: Add Expense to Past Month from Expenses Tab (v2.4)

### 23.1 Problem

**User pain:** A user is on the Expenses tab and remembers they paid ₪2,800 for a dentist visit last March. The natural action is to click "Add Expense" right there — but today that only adds items to the *current ongoing budget*, not to a past month. The workaround (go to History → find the snapshot → click "Add Expense to March 2026") requires navigating away and finding the right card.

**Why not just use the History tab flow (v2.3)?** The Expenses tab is where users spend most of their time. Switching tabs to log something they just thought of breaks their flow. The entry point should be where the thought occurs.

**Who is affected:** All personas — anyone who realises mid-session that a past expense wasn't recorded.

---

### 23.2 Solution Overview

Extend the existing "Add Expense" dialog in the Expenses tab with a **month selector**. By default it behaves exactly as today ("Current budget"). When the user switches to "Past month", a month/year picker appears and the expense is saved as a `HistoricalExpense` on that month's snapshot — **not** added to the recurring budget list.

If no snapshot exists for the selected month, a **stub snapshot** is created automatically so the expense has somewhere to live.

After saving, a **confirmation badge** briefly appears on the "History" tab label to signal where the item was recorded.

---

### 23.3 Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Extend existing dialog vs. separate button | Extend dialog | One mental model — "Add Expense" covers both cases |
| Where past expenses are stored | `HistoricalExpense` on `MonthSnapshot` | Consistent with v2.3; category actuals stay accurate |
| What happens if no snapshot exists for the month | Auto-create a stub snapshot | Zero-friction; user shouldn't need to "take a snapshot" first |
| Stub snapshot totals | All zero (income/expenses/savings/FCF = 0) | Honest — we only know what was recorded, not the full picture |
| Max lookback range | 24 months | Practical limit; older data has diminishing value |
| Feedback to user | Small toast / tab badge after save | Confirms where the item was stored without blocking the flow |

---

### 23.4 Data Model Changes

**No new types.** The feature reuses `HistoricalExpense` (from v2.3) and `MonthSnapshot`.

**New context method:**

```typescript
/**
 * Add a HistoricalExpense to a specific past month.
 * If no snapshot exists for (year, month), a stub snapshot is created first.
 * The stub has all financial totals set to 0 — only the historicalExpenses list is populated.
 */
addExpenseToMonth: (
  year: number,
  month: number,       // 1–12
  item: Omit<HistoricalExpense, 'id'>
) => void
```

**Stub snapshot shape** (created when no snapshot exists for the target month):

```typescript
const label = `${MONTH_NAMES[month - 1]} ${year}`           // e.g. "March 2026"
const date  = new Date(year, month - 1, 1).toISOString()    // first of the month

const stub: MonthSnapshot = {
  id:            generateId(),
  label,
  date,
  totalIncome:   0,
  totalExpenses:  0,
  totalSavings:  0,
  freeCashFlow:  0,
  categoryActuals:    {},
  historicalExpenses: [],
}
```

After creating the stub, `addHistoricalExpense` logic runs on it (increment `categoryActuals[category]`, push to `historicalExpenses`).

**Implementation of `addExpenseToMonth`:**

```typescript
const addExpenseToMonth = (year: number, month: number, item: Omit<HistoricalExpense, 'id'>) =>
  setData((d) => {
    const newItem: HistoricalExpense = { ...item, id: generateId() }
    const targetDate = new Date(year, month - 1, 1).toISOString()
    const label = `${MONTH_NAMES_EN[month - 1]} ${year}`

    // Find existing snapshot for this month
    const existingIdx = d.history.findIndex((h) => {
      const hDate = new Date(h.date)
      return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
    })

    if (existingIdx !== -1) {
      // Snapshot exists — add item to it
      const updatedHistory = d.history.map((h, i) => {
        if (i !== existingIdx) return h
        const prevActuals = h.categoryActuals ?? {}
        return {
          ...h,
          historicalExpenses: [...(h.historicalExpenses ?? []), newItem],
          categoryActuals: {
            ...prevActuals,
            [item.category]: (prevActuals[item.category] ?? 0) + item.amount,
          },
        }
      })
      return { ...d, history: updatedHistory }
    } else {
      // No snapshot — create stub then add item
      const stub: MonthSnapshot = {
        id: generateId(),
        label,
        date: targetDate,
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        freeCashFlow: 0,
        categoryActuals: { [item.category]: item.amount },
        historicalExpenses: [newItem],
      }
      return { ...d, history: [...d.history, stub] }
    }
  })
```

---

### 23.5 UI Design

#### 23.5.1 Updated "Add Expense" dialog — new section at the top

The existing `ExpenseDialog` in `Expenses.tsx` gets a new **"When?"** section as the very first field, above Name:

```
┌──────────────────────────────────────────┐
│  Add Expense                             │
│                                          │
│  When?                                   │
│  [ Current budget ]  [ Past month  ]     │  ← segmented toggle (default: Current)
│                                          │
│  ┌─ shown only when "Past month" ──────┐ │
│  │  Month          Year               │ │
│  │  [March    ▼]   [2026  ▼]          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Name                                    │
│  [________________________]              │
│  ...rest of form unchanged...            │
└──────────────────────────────────────────┘
```

- **"Current budget" (default):** dialog behaves exactly as today — saves to `data.expenses` as a recurring budget item
- **"Past month":** month+year pickers appear; on Save the item is stored as a `HistoricalExpense` via `addExpenseToMonth()`
- When "Past month" is active, the `Period` field (monthly/yearly) and the `Recurring` switch are **hidden** — past expenses are always one-time amounts
- When "Past month" is active, the `expenseType` (Fixed/Variable) toggle is also **hidden** — irrelevant for historical items
- The `dueMonth` field is already conditional on `period === 'yearly'`, so it auto-hides too

#### 23.5.2 Month/Year pickers

- **Month:** `<Select>` with January–December (same `MONTHS` constant already in `Expenses.tsx`)
- **Year:** `<Select>` with the last 3 years (e.g. 2024, 2025, 2026 when current year is 2026)
- Default selection: **previous month** (most common use case)
- Restrict: cannot select the current month (use the regular budget flow for that) or future months

#### 23.5.3 Confirmation feedback after saving a past-month expense

After `addExpenseToMonth()` fires, show a **small inline success message** below the save button (before the dialog auto-closes):

```
✓ Added to March 2026 in History
```

This uses `text-primary text-xs` and disappears when the dialog closes. No toast library needed.

#### 23.5.4 "Edit Expense" dialog for existing budget items

No change — `existing` budget items always open in "Current budget" mode. The "Past month" toggle is only visible when adding a new expense (no `existing` prop).

---

### 23.6 Interaction Flow

```
1. User is on Expenses tab
2. Clicks "Add Expense"
3. Dialog opens — "When?" defaults to "Current budget"
4. User clicks "Past month"
   → Month/Year pickers appear
   → Period, Recurring, and Fixed/Variable fields hide
5. User fills: Month=March, Year=2026, Name=Dentist, Amount=2800, Category=Health
6. Clicks "Save"
7. addExpenseToMonth(2026, 3, { name:'Dentist', amount:2800, category:'health' }) fires
   → If March 2026 snapshot exists: adds item to it
   → If not: creates stub snapshot for March 2026, adds item
8. Brief "✓ Added to March 2026 in History" message appears
9. Dialog closes after 1 second (or immediately on a second click of Save)
10. User can verify in History tab → March 2026 card → "Recorded expenses (1)"
```

---

### 23.7 Edge Cases & Rules

| Scenario | Behaviour |
|----------|-----------|
| User selects current month in Past Month mode | Not possible — current month is excluded from the year/month options |
| User selects a future month | Not possible — future months are excluded |
| Stub snapshot created — what shows in History trend chart? | Stub with 0 income/expenses; line chart shows 0 for that month. Honest, not ideal. Label in History card will show "(recorded expenses only)" to distinguish from full snapshots |
| User takes a real snapshot for a month that already has a stub | The real snapshot replaces the stub — but this can't happen today because `snapshotMonth()` snapshots *this month*, not past ones. So stubs and real snapshots won't collide. |
| Two expenses added to the same stub-month | Both accumulate correctly — same logic as v2.3 `addHistoricalExpense` |
| `addExpenseToMonth` called with current month | Should not happen via UI; but if called programmatically, it finds the existing snapshot if any and adds to it |

---

### 23.8 i18n — New Strings

| English | Hebrew |
|---------|--------|
| `When?` | `מתי?` |
| `Current budget` | `תקציב שוטף` |
| `Past month` | `חודש קודם` |
| `Month` | `חודש` |
| `Year` | `שנה` |
| `Added to {label} in History` | `נוסף ל{label} בהיסטוריה` |
| `(recorded expenses only)` | `(הוצאות שנרשמו בלבד)` |

---

### 23.9 Acceptance Criteria

**Data**
- [ ] `addExpenseToMonth` method exists in `FinanceContext` and `FinanceContextType`
- [ ] When snapshot exists for target month: item added to `historicalExpenses`, `categoryActuals` updated
- [ ] When no snapshot exists: stub created with correct `label`, `date`, zero totals; item added
- [ ] Stub snapshot appears in History tab just like real snapshots
- [ ] Two calls to `addExpenseToMonth` for the same month without a snapshot → second call finds the stub created by the first

**UI**
- [ ] "When?" segmented toggle appears only when `existing` is undefined (new expense only)
- [ ] "Past month" mode shows Month + Year selects; hides Period, Recurring, Fixed/Variable
- [ ] Month select shows only past months (excludes current and future)
- [ ] Year select shows last 3 full years
- [ ] Default selection is the previous calendar month
- [ ] Saving in "Current budget" mode works exactly as before (no regression)
- [ ] Confirmation message "✓ Added to [label] in History" appears after save
- [ ] Dialog closes 1 second after showing the confirmation (or immediately on second Save click)

**i18n**
- [ ] All new strings use `t(en, he, lang)`
- [ ] Month names in the select use the existing `MONTHS` constant

**Accessibility**
- [ ] Month and Year selects have associated `<Label>`
- [ ] Toggle buttons have `aria-pressed` reflecting current state
- [ ] All interactive elements ≥ 44px tap target

**Tests (new, in `src/test/addExpenseToMonth.test.ts`)**
- [ ] Adds to existing snapshot — `historicalExpenses` updated, `categoryActuals` incremented
- [ ] Creates stub snapshot when none exists — correct label, date, zero totals
- [ ] Stub creation: `categoryActuals` set from first item
- [ ] Second item to same month (stub exists from first call): accumulates correctly
- [ ] Does not touch other snapshots in history
- [ ] Stub snapshot has correct `label` format ("March 2026")

---

---

### 23.9b Enhancement: Auto-populate Fixed Monthly Expenses in Stub Snapshots (v2.4.1)

**Problem:** When `addExpenseToMonth` creates a stub snapshot for a past month that has no snapshot, the stub has zero totals and empty `categoryActuals`. But the user's fixed monthly recurring expenses (rent, insurance, subscriptions, etc.) definitely occurred that month too. The stub should reflect them automatically — the user shouldn't have to re-enter rent every time they log a one-off past expense.

**Solution:** When building a stub snapshot, pre-populate `categoryActuals` and `totalExpenses` from all **fixed recurring** expenses in the current budget (same logic as `snapshotMonth`, but filtered to `expenseType === 'fixed'` or undefined, and `recurring === true`).

**Why only fixed, not variable?**
Variable expenses (food, dining, entertainment) change month to month — we cannot assume last month's budget equals actuals. Fixed expenses (rent, mortgage, phone bill, insurance) are the same every month by definition. Pre-populating only fixed ones gives an accurate baseline without guessing.

**What changes in `addExpenseToMonth` (stub branch only):**

```typescript
// Build categoryActuals from fixed recurring expenses
const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
let fixedTotal = 0
d.expenses
  .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
  .forEach((e) => {
    const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
    categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
    fixedTotal += monthly
  })

// Stack the new one-off item on top
categoryActuals[item.category] = (categoryActuals[item.category] ?? 0) + item.amount

const stub: MonthSnapshot = {
  id: generateId(),
  label,
  date: targetDate,
  totalIncome: 0,           // unknown for past months
  totalExpenses: fixedTotal + item.amount,
  totalSavings: 0,          // unknown
  freeCashFlow: 0,          // unknown — not computed to avoid misleading -X display
  categoryActuals,
  historicalExpenses: [newItem],
}
```

**`totalExpenses`** is set to `fixedTotal + item.amount` so the History card summary row shows a meaningful expenses figure instead of ₪0. `totalIncome`, `totalSavings`, and `freeCashFlow` stay at 0 (honest — we cannot know past income or savings for a stub month).

**No change to existing snapshots or the "existing snapshot" branch** of `addExpenseToMonth` — only the stub creation path is affected.

**Acceptance criteria for v2.4.1:**
- [ ] Stub `categoryActuals` includes all fixed recurring expenses (monthly-normalized)
- [ ] Stub `totalExpenses` = sum of fixed recurring expenses + new item amount
- [ ] Variable expenses (`expenseType === 'variable'`) are NOT included
- [ ] Non-recurring expenses (`recurring === false`) are NOT included
- [ ] Adding to an existing snapshot is unchanged
- [ ] If there are no fixed expenses, stub still works (empty `categoryActuals` beyond new item)
- [ ] New unit tests cover: stub with fixed expenses, stub with mixed fixed/variable (only fixed included), stub with no fixed expenses

---

### 23.10 Out of Scope (v2.4)

- Editing past-month items from the Expenses tab (use History tab for that)
- Adding income to a past month
- Selecting a specific day within the past month (month granularity is enough)
- Converting a stub snapshot into a full snapshot with income/savings data
- "This month" option in Past Month mode (use regular Add Expense flow)

---

### 23.11 Implementation Checklist for Agents

#### 🎨 Frontend Agent
1. Add `addExpenseToMonth` to `FinanceContextType` interface and implement it in `FinanceContext.tsx`
2. Add `MONTH_NAMES_EN` constant (string array) near the top of `FinanceContext.tsx` for use in stub label generation (reuse the existing `MONTHS` from `categories`-adjacent code, or define inline)
3. Update `ExpenseDialog` in `Expenses.tsx`:
   - Add `mode: 'budget' | 'past'` local state (default `'budget'`)
   - Add "When?" toggle (two buttons)
   - Add Month + Year selects (conditional on `mode === 'past'`)
   - Hide Period, Recurring, Fixed/Variable when `mode === 'past'`
   - On Save in `'past'` mode: call `addExpenseToMonth()` instead of `onSave(form)`
   - Show confirmation message after save; close dialog after 1 s

#### 🖌 UX Agent
1. Verify "When?" toggle uses same segmented-button style as Fixed/Variable toggle
2. Verify Month/Year selects are correctly labelled and mobile-friendly
3. Verify hidden fields truly disappear (not just disabled) in Past Month mode
4. Verify confirmation message uses `text-primary` and is RTL-safe

#### 🧪 QA Agent
1. Write `src/test/addExpenseToMonth.test.ts` with the 6 tests in §23.9
2. Run `npm test` — all 202 + 6 = 208 tests must pass

#### 🔍 Code Review Agent
1. Confirm `addExpenseToMonth` is pure (no side effects beyond `setData`)
2. Confirm month/year range calculation doesn't produce future or current months
3. Confirm stub snapshot is added to history (not replacing existing), sorted correctly
4. Confirm "Current budget" Save path is completely unchanged (no regression)

#### 🗄 Data Engineer Agent
1. No Supabase schema change — stub snapshots are stored inside `household_finance.data.history[]`
2. Verify `FINANCE_DEFAULTS` and `mergeFinanceData` handle stubs (they will — same structure as real snapshots)
3. Add `(recorded expenses only)` label logic note to `cloudFinance.ts` comment block

---

## 22. Feature Spec: Historical Expense Entry (v2.3)

### 22.1 Problem

**User pain:** A user remembers in May that they paid ₪2,800 for a dentist visit and ₪1,400 for a car service in March. They want to record these against March's history so their spending picture is accurate — but there's currently no way to add individual named line items to a past month.

**Current workaround (painful):** Open March's snapshot → "Edit Actuals" → manually calculate and type a new category total. This is lossy — the name and details of the expense are gone, and the user must do mental arithmetic.

**Who is affected:**
- **Primary:** The Israeli dual-income couple — both partners want to reconcile last month's credit-card statement against the plan.
- **Secondary:** The freelancer — needs to log project-related one-off costs to a specific billing month.
- **All personas** who take monthly snapshots and later want to record what they actually spent, item by item.

---

### 22.2 Solution Overview

Add the ability to attach **individual, named expense line items** to any existing month snapshot in the History tab.

Key principles:
- **Additive, not destructive** — line items add to (or subtract from) the category actual total; they don't replace the "Log Actuals" workflow.
- **No new tab or page** — the feature lives entirely within the existing History tab snapshot cards.
- **Backward compatible** — existing snapshots without line items continue to work exactly as before.
- **Category actuals stay accurate** — adding or deleting a line item automatically adjusts `categoryActuals[category]` so the F3 month-over-month delta comparison always reflects the true total.

---

### 22.3 Concepts & Terminology

| Term | Definition |
|------|-----------|
| **Snapshot** | A `MonthSnapshot` record — a frozen monthly picture taken by the user |
| **Category Actual** | The declared total spent in a category for a snapshot month (`categoryActuals[category]`) |
| **Historical Expense** | A new `HistoricalExpense` record: a named line item attached to a snapshot |
| **Recorded Expenses** | The list of `HistoricalExpense` items visible on a snapshot card |

---

### 22.4 Data Model Changes

#### New type: `HistoricalExpense`

```typescript
export interface HistoricalExpense {
  id: string               // generateId() — unique within the snapshot
  name: string             // "Dentist", "Car service", "Birthday gift"
  amount: number           // always a positive monetary amount for that month
  category: ExpenseCategory
  note?: string            // optional free-text annotation
}
```

No `date` field — the date is implied by the snapshot it belongs to.
No `period` field — it is always a one-time amount for that specific month.

#### Updated type: `MonthSnapshot`

```typescript
export interface MonthSnapshot {
  // ... existing fields unchanged ...
  categoryActuals?: Partial<Record<ExpenseCategory, number>>
  /**
   * Individual named expense line items added retroactively to this snapshot.
   * When items exist for a category, their sum is reflected in categoryActuals[category].
   * Absence of this field (undefined or []) means no items have been added.
   */
  historicalExpenses?: HistoricalExpense[]
}
```

#### `categoryActuals` update rule

When a `HistoricalExpense` is **added** to a snapshot:
```
categoryActuals[item.category] = (categoryActuals[item.category] ?? 0) + item.amount
```

When a `HistoricalExpense` is **deleted** from a snapshot:
```
categoryActuals[item.category] = Math.max(0, (categoryActuals[item.category] ?? 0) - item.amount)
```

When a `HistoricalExpense` is **edited** (amount or category changed):
1. Reverse the old item's effect on the old category
2. Apply the new item's effect on the new category

This ensures `categoryActuals` always equals the sum of all contributions (planned + manual overrides + line items), and the F3 delta comparison stays accurate without any extra computation.

---

### 22.5 New Context Methods

Two new methods added to `FinanceContext`:

```typescript
/** Add a HistoricalExpense to a snapshot and update categoryActuals accordingly. */
addHistoricalExpense: (snapshotId: string, item: Omit<HistoricalExpense, 'id'>) => void

/** Remove a HistoricalExpense from a snapshot and reverse its effect on categoryActuals. */
deleteHistoricalExpense: (snapshotId: string, itemId: string) => void

/** Update an existing HistoricalExpense (handles category/amount changes correctly). */
updateHistoricalExpense: (snapshotId: string, item: HistoricalExpense) => void
```

---

### 22.6 UI Design

#### 22.6.1 Snapshot card — updated layout

```
┌─────────────────────────────────────────────────────┐
│  March 2026            01/03/2026                   │
│                        [+₪4,200]  [📋 Actuals logged]│
│                        [📋 Edit Actuals] [🗑]        │
│                                                     │
│  Income        Expenses        Savings              │
│  ₪20,000       ₪14,200         ₪2,000               │
│                                                     │
│  ── Actual spending by category ──────────────────  │
│  Housing    ₪5,200     Food       ₪3,400            │
│  Health     ₪3,600     Transport  ₪2,000            │
│                                                     │
│  ── Recorded expenses (3) ────────────────────────  │
│  Dentist            Health    ₪2,800    [✏] [🗑]    │
│  Car service        Transport ₪1,400    [✏] [🗑]    │
│  Birthday dinner    Leisure   ₪400      [✏] [🗑]    │
│                                                     │
│  [+ Add Expense to This Month]                      │
└─────────────────────────────────────────────────────┘
```

- The **"Recorded expenses (N)"** section appears below the category actuals breakdown, only when `historicalExpenses.length > 0`.
- The **"+ Add Expense to This Month"** button always appears at the bottom of every snapshot card that has a snapshot (even those without actuals yet).
- The button label uses the snapshot's label: `+ Add Expense to March 2026`.

#### 22.6.2 Add / Edit Historical Expense dialog

Opens as a `Dialog` (same pattern as `ExpenseDialog` and `ActualsDialog`).

```
┌──────────────────────────────────────┐
│  Add Expense — March 2026            │
│                                      │
│  Name                                │
│  [________________________]          │
│                                      │
│  Amount          Category            │
│  [________]      [Housing       ▼]   │
│                                      │
│  Note (optional)                     │
│  [________________________]          │
│                                      │
│  [    Save Expense    ]              │
│  [       Cancel       ]              │
└──────────────────────────────────────┘
```

- **Name** — free text, required, placeholder: "e.g. Dentist visit"
- **Amount** — number input, required, positive only, `min="0.01"`
- **Category** — Select, same 11 options as the Expenses tab
- **Note** — optional free text, single line
- On Save: calls `addHistoricalExpense()` or `updateHistoricalExpense()`, closes dialog
- Validation: name must be non-empty, amount must be > 0

Edit mode: same dialog pre-filled with existing values, title changes to "Edit Expense — March 2026".

#### 22.6.3 Recorded expenses row layout

Each line item row (within the snapshot card):

```
[Name]                [Category badge]    ₪X,XXX    [✏] [🗑]
[Note if present — text-xs text-muted-foreground below name]
```

- Category badge: `Badge variant="outline"` with category label
- Amount: `font-semibold tabular-nums`
- Edit icon: opens the Edit dialog pre-filled
- Delete icon: removes the item, reverses the category actual; requires no confirmation (amount is small; user can re-add)
- Tap targets: `min-h-[44px] min-w-[44px]` on icon buttons

#### 22.6.4 Section header

```
── Recorded expenses (3) ─────────────────────────── [+ Add]
```

A subtle inline `[+ Add]` button in the section header allows adding another item without scrolling to the bottom. Both the header button and the bottom button open the same dialog.

---

### 22.7 Interaction Flows

#### Flow A — Add a new historical expense

1. User opens History tab
2. User finds the relevant snapshot (e.g. March 2026)
3. User clicks "**+ Add Expense to March 2026**"
4. Dialog opens with empty form
5. User fills in: Name="Dentist", Amount=2800, Category=Health
6. User clicks "Save Expense"
7. Dialog closes
8. `addHistoricalExpense('snap-march', { name: 'Dentist', amount: 2800, category: 'health' })` fires
9. `categoryActuals.health += 2800`
10. Snapshot card updates immediately:
    - "Recorded expenses (1)" section appears
    - "Dentist · Health · ₪2,800" row is visible
    - Health amount in the category breakdown increases
    - "Actuals logged" badge appears if it wasn't already there

#### Flow B — Edit a historical expense

1. User clicks ✏ on "Dentist · Health · ₪2,800"
2. Edit dialog opens, pre-filled
3. User changes amount to 3200
4. Clicks "Save Expense"
5. `updateHistoricalExpense()` reverses old delta (−2800 from health), applies new (+3200 to health)
6. Health total updates in the breakdown

#### Flow C — Delete a historical expense

1. User clicks 🗑 on "Dentist · Health · ₪2,800"
2. Item is removed from `historicalExpenses`
3. `categoryActuals.health -= 2800` (clamped to 0)
4. Row disappears; if no items remain, "Recorded expenses" section hides

#### Flow D — Mix of Log Actuals + line items

1. User uses "Log Actuals" to set Food = ₪3,400 (summary level)
2. User then uses "+ Add Expense" to add "Dentist ₪2,800" to Health
3. `categoryActuals.health` was previously not set (or set to planned amount)
4. After adding, `categoryActuals.health += 2,800` — stacks on top of whatever was there
5. Both systems coexist — Log Actuals handles the categories the user doesn't itemize; line items handle specific notable purchases

---

### 22.8 Edge Cases & Rules

| Scenario | Behaviour |
|----------|-----------|
| Snapshot has no `categoryActuals` yet | Adding a line item initialises `categoryActuals = {}` and sets `categoryActuals[category] = amount` |
| Deleting an item when `categoryActuals[category] < item.amount` | Clamp to 0 — never go negative |
| `historicalExpenses` is `undefined` in old snapshots | Treated as `[]` — no rendering, no errors |
| Empty `historicalExpenses: []` | "Recorded expenses" section is hidden |
| Amount field left blank or zero | Validation error inline — Save button remains disabled |
| Name field left blank | Validation error inline — Save button remains disabled |
| Very long name (> 60 chars) | Truncate with ellipsis in the row display; full text in the edit dialog |
| Category changed on edit | Old category actual decremented, new category actual incremented atomically |
| Snapshot deleted | All its `historicalExpenses` are deleted with it (no orphan cleanup needed) |

---

### 22.9 i18n — All new strings

| English | Hebrew |
|---------|--------|
| `Add Expense to {month}` | `הוסף הוצאה ל{month}` |
| `Edit Expense — {month}` | `ערוך הוצאה — {month}` |
| `Recorded expenses ({n})` | `הוצאות שנרשמו ({n})` |
| `Save Expense` | `שמור הוצאה` |
| `Note (optional)` | `הערה (אופציונלי)` |
| `e.g. Dentist visit` | `למשל: ביקור אצל רופא שיניים` |
| `Delete recorded expense` | `מחק הוצאה שנרשמה` |
| `Edit recorded expense` | `ערוך הוצאה שנרשמה` |
| `Name is required` | `שם חובה` |
| `Amount must be greater than 0` | `הסכום חייב להיות גדול מ-0` |

---

### 22.10 Acceptance Criteria

**Data**
- [ ] `HistoricalExpense` type is in `src/types/index.ts`
- [ ] `MonthSnapshot.historicalExpenses` field is optional, backward compatible
- [ ] `addHistoricalExpense`, `updateHistoricalExpense`, `deleteHistoricalExpense` are in `FinanceContext` and typed in `FinanceContextType`
- [ ] Adding an item increments `categoryActuals[category]` by `item.amount`
- [ ] Deleting an item decrements `categoryActuals[category]` by `item.amount`, clamped to 0
- [ ] Editing an item that changes category correctly adjusts both the old and new category actuals
- [ ] Old snapshots without `historicalExpenses` render with no errors

**UI**
- [ ] "Recorded expenses (N)" section visible on snapshot cards that have line items
- [ ] "Recorded expenses" section hidden when `historicalExpenses` is empty or missing
- [ ] "+ Add Expense to [Month Label]" button visible on every snapshot card
- [ ] Add/Edit dialog has Name, Amount, Category, Note (optional) fields
- [ ] Save button disabled until Name is non-empty and Amount > 0
- [ ] Edit button on each row opens the dialog pre-filled
- [ ] Delete button on each row removes the item immediately
- [ ] Category actuals breakdown in the snapshot card reflects the updated total after add/edit/delete
- [ ] "Actuals logged" badge appears on the snapshot after the first item is added

**i18n**
- [ ] All new strings use `t(en, he, lang)` — no hardcoded English in JSX
- [ ] Dialog title uses the snapshot label (e.g. "Add Expense — March 2026")
- [ ] RTL layout correct for Hebrew

**Accessibility**
- [ ] Dialog has a descriptive `DialogTitle`
- [ ] All icon-only buttons have `aria-label` and `title`
- [ ] All inputs have associated `<Label>`
- [ ] All interactive elements have `min-h-[44px]` tap targets

**Tests (new, in `src/test/historicalExpenses.test.ts`)**
- [ ] `addHistoricalExpense` — increments correct category actual
- [ ] `addHistoricalExpense` — initialises `categoryActuals` when snapshot has none
- [ ] `deleteHistoricalExpense` — decrements correct category actual
- [ ] `deleteHistoricalExpense` — clamps to 0 (never negative)
- [ ] `updateHistoricalExpense` — handles category change (old decremented, new incremented)
- [ ] `updateHistoricalExpense` — handles amount change within same category
- [ ] Snapshot without `historicalExpenses` field is backward compatible
- [ ] Multiple items in same category accumulate correctly
- [ ] Deleting one of two items in same category leaves the other's contribution intact

---

### 22.11 Out of Scope (v2.3)

- **Adding expenses to "this month"** — current month has no snapshot yet; use the Expenses tab for ongoing budget items.
- **Receipts / photo attachments** — a possible v3 feature (camera capture).
- **Import from bank CSV** — separate roadmap item.
- **Editing the snapshot's planned totals** (`totalIncome`, `totalExpenses`, etc.) — those remain frozen at snapshot time.
- **Recurring historical entries** — all items are one-off line items tied to one snapshot.
- **Reordering items within a snapshot** — not needed; sort is chronological (add order).

---

### 22.12 Implementation Checklist for Agents

Below is the ordered task list for the other agent roles. Each role should read this spec before starting.

#### 🎨 Frontend Agent
1. Add `HistoricalExpense` interface to `src/types/index.ts`
2. Add `historicalExpenses?: HistoricalExpense[]` to `MonthSnapshot` in `src/types/index.ts`
3. Add three new methods to `FinanceContextType` interface in `src/context/FinanceContext.tsx`
4. Implement the three methods in `FinanceContext` (pure `setData` mutations)
5. Update `src/components/History.tsx`:
   - Add `HistoricalExpenseDialog` component (add/edit)
   - Add "Recorded expenses" section to each snapshot card
   - Add "+ Add Expense to [label]" button to each snapshot card
   - Wire up edit/delete row buttons

#### 🖌 UX Agent
1. Verify dialog follows existing `DialogContent` + `max-h-[85vh] overflow-y-auto` pattern
2. Verify all icon-only buttons have `title` + `aria-label` + `min-h-[44px] min-w-[44px]`
3. Verify "Recorded expenses" section uses HSL tokens only — no hardcoded colours
4. Verify RTL (Hebrew) layout on the dialog and the row layout
5. Verify mobile (375px) — rows must not overflow, amounts must not be cut off

#### 🧪 QA Agent
1. Write `src/test/historicalExpenses.test.ts` covering all 9 test cases in §22.10
2. Run `npm test` — all 191 + 9 = 200 tests must pass
3. Run `npm run build` — no TypeScript errors
4. Manual QA: add → verify total changes, edit → verify old/new category both update, delete → verify clamp behaviour

#### 🔍 Code Review Agent
1. No `any` types in new code
2. All new strings go through `t(en, he, lang)`
3. Context methods are pure (no side effects beyond `setData`)
4. No direct localStorage reads in `History.tsx`
5. `historicalExpenses` access always guarded with `?? []`

#### 🗄 Data Engineer Agent
1. `HistoricalExpense` is a nested type inside `MonthSnapshot` — no Supabase schema change needed (stored as part of `household_finance.data` JSONB)
2. Add `historicalExpenses: []` to `FINANCE_DEFAULTS` in `src/lib/cloudFinance.ts` to handle old cloud blobs
3. `mergeFinanceData` already merges `history` wholesale — no change needed
4. Update `src/test/cloudFinance.test.ts` fixtures if needed

---

## 25. Feature Spec: Add Income to Past Month from Income Tab (v2.6)

### 25.1 Problem

**User pain:** A user is reviewing their income sources on the Income tab and realises they received a freelance payment or bonus last month that was never recorded. The natural action is to log it right there — but today the Income tab only allows adding recurring income sources to the current budget template. Recording past income requires navigating away to the History tab, finding the right snapshot card, and using `HistoricalIncomeDialog`. This is a context-switch that breaks the user's flow.

**Why not just use the History tab flow (v2.5)?** The Income tab is where users think about earnings. Mirroring the v2.4 "When?" pattern — already familiar from the Expenses tab — gives users a consistent mental model: any "Add" dialog can target either the current budget or a specific past month.

**Who is affected:** All personas — especially freelancers and expats with irregular or one-off income payments that they want to log after the fact.

---

### 25.2 Solution Overview

Add a new **"Add Income Entry"** button to the Income tab toolbar (next to the existing "Add Member" button). The button opens a lightweight dialog with a **"When?" toggle** — identical in structure to the v2.4 Expenses tab pattern.

- **Current budget mode** records a new `IncomeSource` with `useManualNet: true` via the existing `handleSaveSource` path — no new data model needed.
- **Past month mode** records a `HistoricalIncome` item on the target snapshot (or creates a stub snapshot if none exists) via a new context method `addIncomeToMonth(year, month, item)` — parallel to `addExpenseToMonth`.

Stub snapshots created by `addIncomeToMonth` pre-populate fixed recurring expenses (same logic as v2.4.1) so that `totalExpenses` is meaningful rather than ₪0. `totalIncome` is set to the recorded amount and `freeCashFlow` is computed immediately, causing the History tab stub badge to show a real FCF value rather than "—".

---

### 25.3 Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Separate "Add Income Entry" button vs. extend existing "Add Source" | Separate button | "Add Source" is a complex recurring-income form; a past-month one-off entry needs a simpler form with different fields |
| Current budget mode form | Member dropdown + Source Name + Monthly Net Amount → saves as `IncomeSource` with `useManualNet: true` | Reuses existing `handleSaveSource` without duplication; keeps the simpler form consistent |
| Past month mode form | Month picker + Year picker + Member name (datalist) + Net Amount + optional Note | Matches `HistoricalIncome` shape; symmetric with expense past-month form |
| Stub pre-population | Fixed recurring expenses pre-populate `categoryActuals` + `totalExpenses` (v2.4.1 logic) | Same as expense stubs — gives an honest baseline without guessing variable costs |
| FCF computation on stub | `totalIncome = item.amount; freeCashFlow = totalIncome − totalExpenses − totalSavings` | Income is now known, so FCF can be computed; eliminates the "—" badge immediately |
| Max lookback | Last 3 years (36 months), excluding current and future months | Consistent with v2.4 expense lookback |
| Feedback after saving past-month income | Inline confirmation message "✓ Added to [Month] [Year] in History" | Same pattern as v2.4; no toast library needed |

---

### 25.4 Data Model Changes

**No new types.** The feature reuses `HistoricalIncome` (from v2.5) and `MonthSnapshot`.

**New context method:**

```typescript
/**
 * Add a HistoricalIncome item to a specific past month.
 * If no snapshot exists for (year, month), a stub snapshot is created first,
 * pre-populated with fixed recurring expenses (same logic as addExpenseToMonth v2.4.1).
 * totalIncome and freeCashFlow are set/recomputed immediately on the stub.
 */
addIncomeToMonth: (
  year: number,
  month: number,       // 1–12
  item: Omit<HistoricalIncome, 'id'>
) => void
```

**Stub snapshot shape** (created when no snapshot exists for the target month):

```typescript
const label = `${MONTH_NAMES_EN[month - 1]} ${year}`         // e.g. "April 2026"
const date  = new Date(year, month - 1, 1).toISOString()     // first of the month

// Pre-populate fixed recurring expenses (mirrors addExpenseToMonth v2.4.1)
const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
let fixedTotal = 0
d.expenses
  .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
  .forEach((e) => {
    const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
    categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
    fixedTotal += monthly
  })

const stub: MonthSnapshot = {
  id:              generateId(),
  label,
  date,
  totalIncome:     item.amount,
  totalExpenses:   fixedTotal,
  totalSavings:    0,
  freeCashFlow:    item.amount - fixedTotal,
  categoryActuals,
  historicalIncomes: [{ ...item, id: generateId() }],
}
```

**Implementation of `addIncomeToMonth`:**

```typescript
const addIncomeToMonth = (year: number, month: number, item: Omit<HistoricalIncome, 'id'>) =>
  setData((d) => {
    const newItem: HistoricalIncome = { ...item, id: generateId() }
    const targetDate = new Date(year, month - 1, 1).toISOString()
    const label = `${MONTH_NAMES_EN[month - 1]} ${year}`

    const existingIdx = d.history.findIndex((h) => {
      const hDate = new Date(h.date)
      return hDate.getFullYear() === year && hDate.getMonth() + 1 === month
    })

    if (existingIdx !== -1) {
      // Snapshot exists — add income item to it (same logic as addHistoricalIncome)
      const updatedHistory = d.history.map((h, i) => {
        if (i !== existingIdx) return h
        const newTotalIncome = h.totalIncome + item.amount
        return {
          ...h,
          historicalIncomes: [...(h.historicalIncomes ?? []), newItem],
          totalIncome:  newTotalIncome,
          freeCashFlow: newTotalIncome - h.totalExpenses - h.totalSavings,
        }
      })
      return { ...d, history: updatedHistory }
    } else {
      // No snapshot — create stub with fixed expenses pre-populated, then add income
      const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
      let fixedTotal = 0
      d.expenses
        .filter((e) => e.recurring && (e.expenseType ?? 'fixed') === 'fixed')
        .forEach((e) => {
          const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
          categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
          fixedTotal += monthly
        })

      const stub: MonthSnapshot = {
        id:              generateId(),
        label,
        date:            targetDate,
        totalIncome:     item.amount,
        totalExpenses:   fixedTotal,
        totalSavings:    0,
        freeCashFlow:    item.amount - fixedTotal,
        categoryActuals,
        historicalIncomes: [newItem],
      }
      return { ...d, history: [...d.history, stub] }
    }
  })
```

---

### 25.5 UI Design

#### 25.5.1 Income tab toolbar — new "Add Income Entry" button

The Income tab header area currently has a single "Add Member" button. A second button is added to its right:

```
┌─────────────────────────────────────────────────────┐
│  Income                                             │
│                              [+ Add Member]         │
│                              [+ Add Income Entry]   │
└─────────────────────────────────────────────────────┘
```

- Label: `+ Add Income Entry` (EN) / `+ הוסף הכנסה` (HE)
- Uses the same `Button` variant as "Add Member" (secondary or outline)
- Minimum tap target: `min-h-[44px]`

#### 25.5.2 "Add Income Entry" dialog — layout

```
┌──────────────────────────────────────────┐
│  Add Income Entry                        │
│                                          │
│  When?                                   │
│  [ Current budget ]  [ Past month  ]     │  ← segmented toggle (default: Current)
│                                          │
│  ┌─ shown only when "Past month" ──────┐ │
│  │  Month          Year               │ │
│  │  [March    ▼]   [2026  ▼]          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ── Current budget fields ─────────────  │  ← shown when "Current budget"
│  Member                                  │
│  [Eilon              ▼]                  │
│  Source name                             │
│  [e.g. Main salary]                      │
│  Monthly net amount                      │
│  [___________]                           │
│                                          │
│  ── Past month fields ─────────────────  │  ← shown when "Past month"
│  Person                                  │
│  [Eilon               ] ← datalist       │
│  Net amount received                     │
│  [___________]                           │
│  Note (optional)                         │
│  [e.g. Freelance project…]               │
│                                          │
│  [    Save    ]                          │
│  [   Cancel   ]                          │
└──────────────────────────────────────────┘
```

- **"When?" toggle** — same segmented-button style as the v2.4 Expenses dialog toggle
- Default selection: **Current budget**
- The two sets of fields are mutually exclusive — only one set is visible at a time
- In **Current budget** mode:
  - Member: `<Select>` from `data.members`
  - Source name: text input (required)
  - Monthly net amount: number input (required, > 0)
  - On Save: calls existing `handleSaveSource` with `useManualNet: true`, `netAmount: value`
- In **Past month** mode:
  - Month/Year pickers: past months only, last 3 years, default = previous calendar month (same restrictions as v2.4)
  - Person: `<Input>` with `<datalist>` from member names (same pattern as `HistoricalIncomeDialog` in v2.5)
  - Net amount received: number input (required, > 0)
  - Note: optional text input
  - On Save: calls `addIncomeToMonth(year, month, { memberName, amount, note })`

#### 25.5.3 Confirmation feedback after saving a past-month income entry

After `addIncomeToMonth()` fires, show a brief inline success message below the Save button:

```
✓ Added to March 2026 in History
```

Uses `text-primary text-xs`. Dialog closes automatically after 1 second (or immediately on a second Save click). Same behaviour as v2.4.

#### 25.5.4 Year-change clamping

When the user switches the Year picker to the current year, the Month picker is automatically adjusted to the previous calendar month if the currently selected month is the current month or later — preventing selection of a future or current month. Same guard as v2.4.

---

### 25.6 Interaction Flows

#### Flow A — Log a past-month income from the Income tab

```
1. User is on the Income tab
2. Clicks "+ Add Income Entry"
3. Dialog opens — "When?" defaults to "Current budget"
4. User clicks "Past month"
   → Month/Year pickers appear (default: previous month)
   → Current budget fields (Member select, Source name, Monthly net) hide
   → Past month fields (Person datalist, Net amount, Note) appear
5. User fills: Month=March, Year=2026, Person=Eilon, Amount=15000, Note=Freelance
6. Clicks "Save"
7. addIncomeToMonth(2026, 3, { memberName: 'Eilon', amount: 15000, note: 'Freelance' }) fires
   → If March 2026 snapshot exists: adds HistoricalIncome item, increments totalIncome, recomputes freeCashFlow
   → If not: creates stub with fixed expenses pre-populated, sets totalIncome=15000, freeCashFlow=15000−fixedTotal
8. Inline "✓ Added to March 2026 in History" message appears
9. Dialog closes after 1 second
10. User can verify in History tab → March 2026 card → "Recorded income (1)" section
```

#### Flow B — Add a recurring income source from the Income tab (unchanged)

```
1. User is on the Income tab
2. Clicks "+ Add Income Entry"
3. Dialog opens — "When?" defaults to "Current budget"
4. User leaves "Current budget" selected
5. Fills: Member=Sara, Source name=Part-time job, Monthly net=4500
6. Clicks "Save"
7. handleSaveSource fires — saves new IncomeSource with useManualNet: true, netAmount: 4500
8. Dialog closes immediately
9. Sara's income card updates with the new source
```

#### Flow C — Stub FCF badge auto-transitions

When `addIncomeToMonth` creates a stub and sets `totalIncome > 0`, the History tab's stub detection condition (`totalIncome === 0 && totalExpenses > 0`) is no longer true. The "—" FCF badge is replaced by the real FCF value (green if positive, red if negative) — automatically, with no extra code.

---

### 25.7 Edge Cases & Rules

| Scenario | Behaviour |
|----------|-----------|
| User selects current or future month in Past month mode | Not possible — current and future months are excluded from pickers |
| `addIncomeToMonth` called for a month that already has a stub (from `addExpenseToMonth`) | Finds the existing stub; adds income item to it; recalculates `totalIncome` and `freeCashFlow` |
| `addIncomeToMonth` called twice for the same month without a prior snapshot | Second call finds the stub created by the first; accumulates correctly |
| No fixed recurring expenses in current budget | Stub `totalExpenses = 0`; `freeCashFlow = item.amount` |
| Amount field left blank or zero | Inline validation error; Save button remains disabled |
| Person/Member name left blank in past month mode | Inline validation error; Save button remains disabled |
| Source name left blank in current budget mode | Inline validation error; Save button remains disabled |
| Very long person name | Truncated with ellipsis in the row display; full name in the edit dialog |

---

### 25.8 i18n — New Strings

| English | Hebrew |
|---------|--------|
| `Add Income Entry` | `הוסף הכנסה` |
| `When?` | `מתי?` |
| `Current budget` | `תקציב שוטף` |
| `Past month` | `חודש קודם` |
| `Month` | `חודש` |
| `Year` | `שנה` |
| `Member` | `חבר` |
| `Source name` | `שם מקור` |
| `e.g. Main salary` | `למשל: משכורת ראשית` |
| `Monthly net amount` | `סכום נטו חודשי` |
| `Person` | `אדם` |
| `Net amount received` | `סכום נטו שהתקבל` |
| `Note (optional)` | `הערה (אופציונלי)` |
| `e.g. Freelance project…` | `למשל: פרויקט פרילנס…` |
| `Added to {label} in History` | `נוסף ל{label} בהיסטוריה` |
| `(fixed expenses only)` | `(הוצאות קבועות בלבד)` |

---

### 25.9 Acceptance Criteria

**Data**
- [ ] `addIncomeToMonth` method exists in `FinanceContext` and is typed in `FinanceContextType`
- [ ] When snapshot exists for target month: `HistoricalIncome` item added, `totalIncome` incremented, `freeCashFlow` recomputed
- [ ] When no snapshot exists: stub created with fixed recurring expenses pre-populated in `categoryActuals` and `totalExpenses`; `totalIncome = item.amount`; `freeCashFlow = totalIncome − totalExpenses`
- [ ] Stub snapshot appears in History tab alongside real snapshots
- [ ] Two calls to `addIncomeToMonth` for the same stub month: second call finds the stub, accumulates `totalIncome` correctly
- [ ] Adding income to an existing stub (created by `addExpenseToMonth`) correctly increments `totalIncome` and recomputes `freeCashFlow`
- [ ] Variable and non-recurring expenses are NOT included in stub `totalExpenses`

**UI**
- [ ] "+ Add Income Entry" button visible in the Income tab toolbar, next to "Add Member"
- [ ] Button has `min-h-[44px]` tap target
- [ ] Dialog has "When?" segmented toggle; default is "Current budget"
- [ ] "Current budget" mode shows: Member select, Source name input, Monthly net amount input
- [ ] "Past month" mode shows: Month select, Year select, Person datalist input, Net amount input, Note input (optional)
- [ ] "Current budget" and "Past month" field sets are mutually exclusive (not just hidden)
- [ ] Month select excludes current and future months
- [ ] Year select shows last 3 years
- [ ] Default month/year selection is the previous calendar month
- [ ] Year-change clamping: switching to current year adjusts month to previous month if needed
- [ ] Saving in "Current budget" mode calls `handleSaveSource` — no regression to existing behaviour
- [ ] Saving in "Past month" mode calls `addIncomeToMonth` and shows confirmation message
- [ ] Confirmation message "✓ Added to [label] in History" appears after past-month save
- [ ] Dialog closes 1 second after confirmation (or immediately on second Save click)
- [ ] FCF badge on stub transitions from "—" to real value after first income item added

**i18n**
- [ ] All new strings use `t(en, he, lang)` — no hardcoded English in JSX
- [ ] Month names in the select use the existing `MONTHS` constant
- [ ] Confirmation message uses localised month name

**Accessibility**
- [ ] Month and Year selects have associated `<Label>` with `htmlFor`
- [ ] "When?" toggle buttons have `aria-pressed` reflecting current state
- [ ] All inputs have associated `<Label>`
- [ ] Icon-only buttons have `aria-label` + `title`
- [ ] All interactive elements have `min-h-[44px]` tap target

**Tests (new, in `src/test/addIncomeToMonth.test.ts`)**
- [ ] Adds to existing snapshot — `historicalIncomes` updated, `totalIncome` incremented, `freeCashFlow` recomputed
- [ ] Creates stub when no snapshot exists — correct `label`, `date`, `totalIncome = item.amount`
- [ ] Stub creation: fixed recurring expenses pre-populate `categoryActuals` and `totalExpenses`
- [ ] Stub creation: variable expenses excluded from `totalExpenses`
- [ ] Stub creation: non-recurring expenses excluded from `totalExpenses`
- [ ] Stub `freeCashFlow = totalIncome − totalExpenses`
- [ ] Second call to same stub month accumulates `totalIncome` correctly
- [ ] Existing snapshot (from `addExpenseToMonth`): income added, `freeCashFlow` recomputed
- [ ] Does not touch other snapshots in history
- [ ] Stub `label` format is correct ("March 2026")

---

### 25.10 Out of Scope (v2.6)

- Gross-to-net tax calculation for past income entries — net-only (same as v2.5 `HistoricalIncome`)
- Editing or deleting past-month income items from the Income tab — use the History tab for that (same pattern as expenses)
- Auto-populating `totalSavings` in stub snapshots — savings vary too much to assume
- "This month" option in Past month mode — use the regular current-budget path
- Multi-currency conversion for past income entries
- Importing past income from bank CSV statements

---

### 25.11 Success Metric

A user on the Income tab can record a past-month income payment in under 30 seconds without leaving the tab. After saving, the correct snapshot in the History tab shows the income item in "Recorded income (N)" and displays a real FCF badge (not "—").

---

### 25.12 Implementation Checklist for Agents

#### 🎨 Frontend Agent
1. Add `addIncomeToMonth` to `FinanceContextType` interface in `src/context/FinanceContext.tsx`
2. Implement `addIncomeToMonth` in `FinanceContext.tsx` (reuse `MONTH_NAMES_EN` from `addExpenseToMonth`)
3. Add "+ Add Income Entry" button to the Income tab toolbar in `src/components/Income.tsx`
4. Create `AddIncomeEntryDialog` component in `src/components/Income.tsx` (or a separate file):
   - "When?" segmented toggle (state: `'budget' | 'past'`, default `'budget'`)
   - Current budget fields: Member `<Select>`, Source name `<Input>`, Monthly net `<Input type="number">`
   - Past month fields: Month `<Select>`, Year `<Select>`, Person `<Input list="...">` + `<datalist>`, Net amount `<Input type="number">`, Note `<Input>`
   - Month/Year defaults to previous calendar month; year-change clamping
   - On Save (budget mode): call `handleSaveSource` or equivalent with `useManualNet: true`
   - On Save (past mode): call `addIncomeToMonth(year, month, item)`, show confirmation, auto-close after 1 s
5. Wire open/close state: button → dialog → save → close

#### 🖌 UX Agent
1. Verify "When?" toggle uses same segmented-button style as the v2.4 Expenses dialog
2. Verify Month/Year selects are correctly labelled and mobile-friendly (375 px)
3. Verify field sets switch cleanly — hidden fields truly gone, not just invisible
4. Verify confirmation message uses `text-primary` and is RTL-safe
5. Verify "+ Add Income Entry" button does not break Income tab layout on mobile

#### 🧪 QA Agent
1. Write `src/test/addIncomeToMonth.test.ts` with the 10 tests in §25.9
2. Run `npm test` — all 235 + 10 = 245 tests must pass
3. Run `npm run build` — no TypeScript errors
4. Manual QA: past-month save → verify History tab snapshot updates; current-budget save → verify Income tab source card appears

#### 🔍 Code Review Agent
1. Confirm `addIncomeToMonth` is a pure `setData` mutation — no side effects
2. Confirm stub `freeCashFlow` computation: `totalIncome − totalExpenses − totalSavings`
3. Confirm month/year range excludes current and future months
4. Confirm "Current budget" Save path is completely unchanged (no regression to `handleSaveSource`)
5. Confirm fixed-expense pre-population guard: `e.recurring && (e.expenseType ?? 'fixed') === 'fixed'`
6. No `any` types; all strings through `t(en, he, lang)`

#### 🗄 Data Engineer Agent
1. No Supabase schema change — stub snapshots are stored inside `household_finance.data.history[]`
2. Verify `FINANCE_DEFAULTS` and `mergeFinanceData` handle stubs with `historicalIncomes` (same structure as real snapshots)
3. Confirm `historicalIncomes: []` default is already covered by existing `FINANCE_DEFAULTS` (added in v2.5)

---

## 26. Feature Spec: Savings Expense → Account Linkage (v2.7)

### 26.1 Problem

**User pain:** When a user adds a "Savings" expense (e.g. a monthly transfer to an emergency fund or a dedicated savings account), the expense appears in the budget but has no connection to the accounts listed in the Savings tab. The user must manually update `monthlyContribution` on the matching account separately — two steps when one would do. This disconnect means the Overview KPIs and goal-progress bars can fall out of sync with the actual budget plan.

**Who is affected:** All personas — but especially the Israeli dual-income couple who run multiple named savings accounts (emergency fund, vacation, car replacement) and want the budget to stay consistent with their savings plan automatically.

---

### 26.2 Solution Overview

When the user selects **"Savings"** as the expense category in the Add/Edit Expense dialog, an **account selector** appears listing all accounts from `data.accounts` (the Savings tab). Selecting one links the expense to that account. On save, `account.monthlyContribution` is updated to reflect the expense's monthly-equivalent amount.

Key principles:
- **Optional linkage** — the selector is not required; the user can leave it blank and the expense behaves exactly as before.
- **One-way sync on save** — linking sets `monthlyContribution` on the account at the moment of save. Subsequent manual edits to the account are not overwritten.
- **No auto-revert on delete or unlink** — deleting a linked expense or changing its category does not reset `monthlyContribution`. The user controls the account directly after the initial link.
- **No schema change** — `linkedAccountId` is a new optional field on the `Expense` JSON blob; `cloudFinance.ts` syncs it automatically as part of `household_finance.data`.

---

### 26.3 Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Where the selector appears | Only when `category === 'savings'` | Linking makes no semantic sense for non-savings categories |
| Field cleared on category change | `linkedAccountId` set to `undefined` when category changes away from 'savings' | Prevents stale links to accounts for non-savings expenses |
| Sync direction | Expense → Account (`monthlyContribution`) on save only | Keeps data flow simple and predictable; avoids circular updates |
| Yearly expense normalisation | `monthlyContribution = amount / 12` when `period === 'yearly'` | Account contributions are always expressed monthly |
| On delete of linked expense | Do NOT revert `monthlyContribution` | User may have manually adjusted the account; auto-revert would be destructive |
| On unlink (category change or clearing selector) | Do NOT revert `monthlyContribution` | Same reason — user controls the account after the first sync |
| Dangling `linkedAccountId` (account deleted) | Expense retains `amount`; badge omitted or shows "(deleted account)" | Graceful degradation — no hard crash, no data loss |
| Schema change | None | `linkedAccountId` lives inside the expense JSON blob, synced via `cloudFinance.ts` |

---

### 26.4 Data Model Changes

#### Updated type: `Expense`

```typescript
export interface Expense {
  // ... existing fields unchanged ...
  linkedAccountId?: string   // ← NEW: ID of a SavingsAccount from data.accounts
}
```

- Present only when `category === 'savings'` and the user has selected an account.
- Always `undefined` (or absent) when `category !== 'savings'`.
- Cleared to `undefined` automatically when the user changes the category away from `'savings'` in the dialog.

#### No changes to `SavingsAccount`, `MonthSnapshot`, or any other type.

#### `monthlyContribution` sync rule (on save)

```
if (linkedAccountId && category === 'savings') {
  const monthly = period === 'yearly' ? amount / 12 : amount
  account.monthlyContribution = monthly
}
```

This update is applied atomically inside `setData` — the expense is saved and the account is updated in a single state mutation.

---

### 26.5 UI Design

#### 26.5.1 Add / Edit Expense dialog — account selector

When `category === 'savings'`, a new optional field appears immediately below the Category select:

```
┌──────────────────────────────────────────┐
│  Add Expense                             │
│                                          │
│  Name                                    │
│  [________________________]              │
│                                          │
│  Amount          Category                │
│  [________]      [Savings          ▼]    │
│                                          │
│  ┌─ shown only when category = Savings ─┐│
│  │  Link to savings account (optional)  ││
│  │  [Emergency Fund              ▼]     ││
│  │  Sets monthly contribution on save   ││
│  └──────────────────────────────────────┘│
│                                          │
│  Period         Recurring                │
│  [Monthly ▼]    [●]                      │
│                                          │
│  [    Save Expense    ]                  │
│  [       Cancel       ]                  │
└──────────────────────────────────────────┘
```

- **Selector label:** `Link to savings account (optional)` / `קישור לחשבון חיסכון (אופציונלי)`
- **Helper text:** `Sets monthly contribution on save` / `מעדכן תרומה חודשית בשמירה` — shown in `text-xs text-muted-foreground` directly below the selector
- **Options:** one `<SelectItem>` per entry in `data.accounts`, displaying `account.name`. First option is a blank "—" (no linkage).
- **Default:** blank ("—") for new expenses; pre-selected with `expense.linkedAccountId` when editing an existing linked expense.
- **Accounts list empty:** if `data.accounts` is empty, the selector is not rendered (the field is silently omitted — no error message needed).
- **Clearing the link:** the user can re-select "—" to remove the link before saving. This sets `linkedAccountId = undefined` and does NOT update the account.

#### 26.5.2 Expense list — account badge on linked rows

In the Expenses tab list, linked savings expenses show a small account badge after the category badge:

```
[Rent]     [Housing]                     ₪4,500 / mo     [✏] [🗑]
[Savings]  [Savings] [🏦 Emergency Fund]  ₪1,500 / mo     [✏] [🗑]
```

- Badge: `Badge variant="outline"` with a `PiggyBank` (or `Landmark`) lucide icon + account name
- If `linkedAccountId` references a deleted account: badge is silently omitted (no "(deleted account)" text in the list — just no badge)
- RTL: badge appears after the category badge in logical order (`ms-1`)

#### 26.5.3 Savings tab — visual indicator on linked accounts

No structural change to the Savings tab. When an account has a `monthlyContribution` that was set via a linked expense, it displays normally — the Savings tab is unaware of the link source. The contribution value is simply accurate.

---

### 26.6 Interaction Flows

#### Flow A — Link a new savings expense to an account

```
1. User is on the Expenses tab
2. Clicks "Add Expense"
3. Fills: Name="Emergency fund", Amount=1500, Category=Savings
   → Account selector appears below Category
4. User selects "Emergency Fund" from the selector
5. Helper text: "Sets monthly contribution on save"
6. Clicks "Save Expense"
7. setData fires atomically:
   a. New Expense saved with linkedAccountId = 'acct-123'
   b. data.accounts: account 'acct-123'.monthlyContribution = 1500
8. Expenses tab: new row shows [Savings] [🏦 Emergency Fund] ₪1,500/mo
9. Savings tab: Emergency Fund card now shows monthlyContribution = ₪1,500
```

#### Flow B — Edit a linked expense (change amount)

```
1. User clicks ✏ on the "Emergency fund ₪1,500/mo" row
2. Edit dialog opens; Category = Savings, account selector pre-selects "Emergency Fund"
3. User changes Amount from 1500 → 2000
4. Clicks "Save Expense"
5. setData fires:
   a. Expense amount updated to 2000, linkedAccountId unchanged
   b. account.monthlyContribution updated to 2000
6. Savings tab: Emergency Fund shows monthlyContribution = ₪2,000
```

#### Flow C — Unlink (change category away from Savings)

```
1. User clicks ✏ on "Emergency fund ₪1,500/mo"
2. Changes Category from "Savings" → "Housing"
   → Account selector disappears
   → linkedAccountId cleared to undefined
3. Clicks "Save Expense"
4. Expense saved with category = 'housing', no linkedAccountId
5. Emergency Fund account: monthlyContribution remains at ₪1,500 (not reverted)
```

#### Flow D — Delete a linked expense

```
1. User clicks 🗑 on "Emergency fund ₪1,500/mo"
2. Expense is removed from data.expenses
3. Emergency Fund account: monthlyContribution remains at ₪1,500 (not reverted)
4. Expenses tab: row disappears
5. Savings tab: Emergency Fund still shows ₪1,500/mo (user adjusts manually if needed)
```

#### Flow E — Account deleted after expense was linked

```
1. User deletes "Emergency Fund" account from Savings tab
2. Expense remains in data.expenses with linkedAccountId = 'acct-123' (dangling ref)
3. Expenses tab: expense row shows [Savings] with no account badge (badge silently omitted)
4. If user opens Edit dialog: account selector shows "—" (deleted account not in list)
5. No error thrown; data consistent
```

---

### 26.7 Edge Cases & Rules

| Scenario | Behaviour |
|----------|-----------|
| `data.accounts` is empty when Savings selected | Account selector not rendered; expense saves without `linkedAccountId` |
| `period === 'yearly'` on a linked expense | `monthlyContribution = amount / 12` (normalised to monthly) |
| User clears the selector (selects "—") before saving | `linkedAccountId = undefined`; account's `monthlyContribution` not touched |
| Two expenses linked to the same account | Second save overwrites `monthlyContribution` with its own amount; only the last-saved amount wins |
| Linked account is deleted | Expense retains `linkedAccountId`; badge silently omitted in list; account selector shows "—" in edit dialog |
| `addExpenseToMonth` (past-month flow, v2.4) with category = Savings | `linkedAccountId` can be set the same way; `monthlyContribution` sync applies on save |
| `cloudFinance.ts` merging | `linkedAccountId` is part of the expense JSON blob; no special merge logic needed |
| `migrateIfNeeded()` on old data | Old expenses without `linkedAccountId` are treated as unlinked (`?? undefined`); no migration needed |

---

### 26.8 i18n — New Strings

| English | Hebrew |
|---------|--------|
| `Link to savings account (optional)` | `קישור לחשבון חיסכון (אופציונלי)` |
| `Sets monthly contribution on save` | `מעדכן תרומה חודשית בשמירה` |
| `No account` | `ללא חשבון` |

---

### 26.9 Acceptance Criteria

**Data**
- [ ] `linkedAccountId?: string` field added to `Expense` interface in `src/types/index.ts`
- [ ] `linkedAccountId` is `undefined` when `category !== 'savings'`
- [ ] `linkedAccountId` is cleared to `undefined` when the user changes category away from `'savings'` in the dialog
- [ ] On save with a valid `linkedAccountId`: `account.monthlyContribution` updated atomically in the same `setData` call
- [ ] Yearly expense normalisation: `monthlyContribution = amount / 12` when `period === 'yearly'`
- [ ] On delete of a linked expense: `account.monthlyContribution` is NOT reverted
- [ ] On category change away from Savings: `account.monthlyContribution` is NOT reverted
- [ ] Old expenses without `linkedAccountId` render without errors

**UI**
- [ ] Account selector appears in Add/Edit Expense dialog only when `category === 'savings'`
- [ ] Account selector disappears (and `linkedAccountId` clears) when category changes away from `'savings'`
- [ ] Selector lists all accounts from `data.accounts` plus a blank "—" option as default
- [ ] Selector is not rendered when `data.accounts` is empty
- [ ] Helper text `"Sets monthly contribution on save"` visible below the selector in `text-xs text-muted-foreground`
- [ ] Edit dialog pre-selects the linked account when editing an existing linked expense
- [ ] Linked savings expenses show an account badge (icon + account name) in the Expenses tab list
- [ ] Badge is silently omitted when `linkedAccountId` references a deleted account
- [ ] Savings tab account card reflects the updated `monthlyContribution` after a linked expense is saved

**i18n**
- [ ] All new strings use `t(en, he, lang)` — no hardcoded English in JSX
- [ ] Account selector label and helper text correct in Hebrew RTL

**Accessibility**
- [ ] Account selector has an associated `<Label>` with `htmlFor`
- [ ] Selector has `min-h-[44px]` tap target on mobile

**Tests (new, in `src/test/linkedSavingsAccount.test.ts`)**
- [ ] Saving an expense with `linkedAccountId` updates `account.monthlyContribution`
- [ ] Yearly expense: `monthlyContribution` set to `amount / 12`
- [ ] Monthly expense: `monthlyContribution` set to `amount` directly
- [ ] Category changed away from Savings before save: `linkedAccountId` is `undefined`, account untouched
- [ ] Saving without selecting an account (selector left at "—"): account untouched
- [ ] Two expenses linked to same account: second save overwrites `monthlyContribution`
- [ ] Deleting a linked expense: `account.monthlyContribution` not changed
- [ ] Old expense without `linkedAccountId`: renders without error, treated as unlinked
- [ ] Dangling `linkedAccountId` (account deleted): expense data intact, no crash

---

### 26.10 Out of Scope (v2.7)

- Auto-reverting `monthlyContribution` when a linked expense is deleted or unlinked — user controls the account directly after initial sync
- Two-way sync: changes to `account.monthlyContribution` in the Savings tab do not update the linked expense amount
- Linking a savings expense to a savings **goal** (as opposed to an account) — a possible future feature
- Showing the linked expense name on the Savings account card — not needed in this iteration
- Validation warning when two expenses link to the same account — silently last-write-wins
- Linking expenses in the past-month flow from the History tab (technically possible via `updateHistoricalExpense`; out of scope for v2.7 UI)

---

### 26.11 Success Metric

A user can link a new savings expense to an account in under 10 seconds. After saving, the account's `monthlyContribution` in the Savings tab immediately reflects the expense amount — without the user needing to open the Savings tab and edit the account manually.

---

### 26.12 Implementation Checklist for Agents

#### 🎨 Frontend Agent
1. Add `linkedAccountId?: string` to `Expense` interface in `src/types/index.ts`
2. Update `ExpenseDialog` in `src/components/Expenses.tsx`:
   - Add local state `linkedAccountId: string | undefined` (default `undefined`)
   - When `category` changes away from `'savings'`, reset `linkedAccountId = undefined`
   - Render account `<Select>` only when `category === 'savings'` and `data.accounts.length > 0`
   - First `<SelectItem>` is blank "—" (`value=""`); remaining items map `data.accounts`
   - On edit open: pre-populate `linkedAccountId` from `existing.linkedAccountId`
3. Update `onSave` / save handler:
   - Include `linkedAccountId` in the expense object passed to `setData`
   - If `linkedAccountId` is set: within the same `setData` updater, also update `data.accounts` — find account by id and set `monthlyContribution = period === 'yearly' ? amount / 12 : amount`
4. Update expense row in Expenses tab list: if `expense.linkedAccountId` is set and the account exists in `data.accounts`, render the account name badge after the category badge

#### 🖌 UX Agent
1. Account selector uses the same `<Select>` / `<SelectTrigger>` / `<SelectContent>` pattern as the Category selector — no new primitive components needed
2. Helper text `"Sets monthly contribution on save"` uses `text-xs text-muted-foreground` beneath the selector
3. Account badge in the expense list uses `Badge variant="outline"` with `PiggyBank` lucide icon; `ms-1` margin for RTL safety
4. Verify selector disappears cleanly (not just hidden) when category changes away from Savings
5. Verify mobile (375 px): dialog with selector does not overflow; account names truncate gracefully
6. Verify Hebrew RTL: selector label and badge direction correct

#### 🧪 QA Agent
1. Write `src/test/linkedSavingsAccount.test.ts` with the 9 tests in §26.9
2. Run `npm test` — all 235 + 9 = 244 tests must pass (or 245 if v2.6 tests are already merged)
3. Run `npm run build` — no TypeScript errors
4. Manual QA: add linked expense → verify Savings tab updates; change category → verify account untouched; delete expense → verify account untouched; delete account → verify no crash in Expenses list

#### 🔍 Code Review Agent
1. Confirm `linkedAccountId` is cleared on category change — not just in UI state but in the saved expense object
2. Confirm the account `monthlyContribution` update is inside the same `setData` call as the expense save — single atomic update, no race condition
3. Confirm yearly normalisation: `period === 'yearly' ? amount / 12 : amount`
4. Confirm delete path does NOT touch `account.monthlyContribution`
5. Confirm dangling `linkedAccountId` is handled gracefully — `data.accounts.find(a => a.id === expense.linkedAccountId)` returns `undefined` without throwing
6. No `any` types; all new strings through `t(en, he, lang)`

#### 🗄 Data Engineer Agent
1. No Supabase schema change — `linkedAccountId` lives inside the expense object within `household_finance.data.expenses[]`
2. `cloudFinance.ts` `mergeFinanceData` already merges `expenses` and `accounts` wholesale — no change needed
3. Confirm `FINANCE_DEFAULTS` does not need updating — new field is optional and absent from defaults by design
4. Update `.claude/docs/database.md` to note that `Expense` now carries an optional `linkedAccountId` field in the JSONB blob

---

## 27. Feature Spec: AI-Powered Savings Allocation Calculator (v2.8)

### 27.1 Problem

**User pain:** A household with multiple savings goals (emergency fund, vacation, car, home down-payment) has no guidance on how to split its monthly free cash flow across those goals. The current Goals tab shows a projected completion date per goal but leaves the user to decide manually how much to put toward each goal each month. Users frequently either over-commit to ambitious goals and feel like they're failing, or under-commit and make no real progress.

**Who is affected:** All personas — but especially the Israeli dual-income couple with 3–6 simultaneous goals spanning different time horizons and priorities, and the freelancer with variable monthly FCF who needs a realistic starting allocation they can adjust.

---

### 27.2 Solution Overview

Two complementary parts are shipped together:

**Part 1 — Smart Allocation Engine (deterministic, no AI)**
A new pure function `autoAllocateSavings(goals, freeCashFlow, liquidSavings)` in `src/lib/savingsEngine.ts` distributes available FCF across goals using a priority-tiered, proportional algorithm. The result is displayed in a new **"Allocation Plan"** card on the Goals tab, showing a table of per-goal monthly amounts and progress bars comparing the total allocation to the available FCF.

**Part 2 — AI Explanation (optional, Claude-powered)**
An **"Explain my plan 🤖"** button in the Allocation Plan card calls the Anthropic Claude API to generate a plain-English assessment of the allocation — flagging at-risk goals, assessing overall realism, and suggesting 1–2 actionable changes. The button is only visible when `VITE_ANTHROPIC_API_KEY` is set in the environment. The AI response is shown in a collapsible card and cached for the session.

---

### 27.3 Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Algorithm location | New function in `src/lib/savingsEngine.ts` | Keeps all goal/savings logic in one file; pure function is easy to test |
| Priority tiers | high → medium → low; within each tier pro-rate proportionally if FCF is insufficient | Simple mental model the user can verify; mirrors real-world "pay essentials first" logic |
| AI integration point | New `src/lib/aiAdvisor.ts` owns the `fetch` call to the Claude API | Isolates the external call; easy to mock in tests; keeps components thin |
| Client-side API call | Acceptable for a self-hosted single-user app where the user controls their own Vercel env var | Security tradeoff: the key is never in source, but it is visible to the browser. Documented explicitly in §27.3 Security Note. Acceptable because the app is single-household and the user is the key owner |
| API key handling | `VITE_ANTHROPIC_API_KEY` — set only in Vercel dashboard, never committed to source | Standard Vite env var pattern; `.gitignore` already excludes `.env.local` |
| Feature visibility | "Explain my plan 🤖" button rendered only when `import.meta.env.VITE_ANTHROPIC_API_KEY` is a non-empty string | Graceful degradation — users without the key see the deterministic plan only |
| AI response language | Always English (Claude output language is not controlled) | Noted in UI with a tooltip; `t()` wraps all surrounding UI strings |
| Response caching | Cached in component state (per session, not persisted) | Avoids duplicate API calls on re-renders; cache is intentionally discarded on page reload so stale data is never shown |
| Streaming | No — plain text, single response | Simpler implementation; response is short enough that streaming adds no perceptible UX value |
| Re-calculate button | Reruns `autoAllocateSavings` without calling the AI | Lets the user update allocations after editing goals, without incurring an AI call |
| New type field | `GoalAllocation.monthlyAllocated?: number` added to `src/types/index.ts` | Carries the computed allocation alongside the existing goal fields; optional so existing data is backward-compatible |
| Data sent to Claude | Goal names, target amounts, deadlines, priorities, `monthlyAllocated`, `freeCashFlow`, currency — NO account numbers, balances, or personally identifiable financial details | Minimises data exposure; sufficient for Claude to assess goal realism |
| No backend proxy | Direct `fetch` to `api.anthropic.com` from the browser | Acceptable for self-hosted single-user app; avoids adding a serverless function dependency |

**§27.3 Security Note — Client-Side API Key**
`VITE_ANTHROPIC_API_KEY` is a browser-visible environment variable. This is an accepted tradeoff for a self-hosted, single-household app: the user who sets the key in Vercel is the same person using the app. The key is never committed to the repository. Users who share their deployment URL with other household members implicitly share key access; this is documented in the README and in the in-app tooltip. A backend proxy would eliminate this exposure and is listed as a future improvement.

---

### 27.4 Data Model Changes

#### Updated type: `GoalAllocation` (new optional field)

```typescript
// src/types/index.ts
export interface GoalAllocation {
  // ... existing fields unchanged ...
  monthlyAllocated?: number   // ← NEW: amount assigned by autoAllocateSavings(), in the household currency
}
```

- `monthlyAllocated` is `undefined` until the user runs the allocation.
- It is NOT persisted to `household_finance.data` — it is computed on demand and held in component state.
- It is NOT part of the cloud sync payload.

#### New function signature in `src/lib/savingsEngine.ts`

```typescript
/**
 * Distributes freeCashFlow across goals by priority tier.
 * Within each tier, allocates proportionally if FCF is insufficient.
 * Goals with status 'completed' or 'blocked' receive 0.
 *
 * @param goals        Array of SavingsGoal objects (from FinanceData.goals)
 * @param freeCashFlow Available monthly free cash flow (may be negative — all goals receive 0)
 * @param liquidSavings Total liquid savings available (passed through; used only for status recomputation)
 * @returns            A new array of GoalAllocation objects with monthlyAllocated set
 */
export function autoAllocateSavings(
  goals: SavingsGoal[],
  freeCashFlow: number,
  liquidSavings: number
): GoalAllocation[]
```

#### New module: `src/lib/aiAdvisor.ts`

```typescript
/**
 * Calls the Anthropic Claude API with an allocation summary.
 * Returns plain-text advice.
 * Throws if VITE_ANTHROPIC_API_KEY is not set or if the API returns an error.
 */
export async function explainAllocationPlan(
  goals: GoalAllocation[],
  freeCashFlow: number,
  currency: string
): Promise<string>
```

- Uses `fetch` directly to `https://api.anthropic.com/v1/messages`.
- Model: `claude-haiku-4-5` (fast, low cost — sufficient for a short advisory response).
- `max_tokens`: 400 — keeps responses concise and costs predictable.
- Prompt instructs Claude to respond in English only and to structure the reply as: (1) overall assessment, (2) at-risk goals (if any), (3) 1–2 actionable suggestions.
- No streaming; awaits the full response before returning.

---

### 27.5 Algorithm: `autoAllocateSavings`

```
Input: goals[], freeCashFlow, liquidSavings

1. If freeCashFlow ≤ 0: return goals with monthlyAllocated = 0 for all

2. Filter out goals where status = 'completed' or status = 'blocked'
   → these receive monthlyAllocated = 0

3. Sort remaining goals by priority: 'high' → 'medium' → 'low'

4. For each priority tier (high, medium, low):
   a. remaining = freeCashFlow − sum(monthlyAllocated already assigned to prior tiers)
   b. If remaining ≤ 0: all goals in this tier get monthlyAllocated = 0; continue
   c. Compute each goal's "ideal monthly" = (targetAmount − currentAmount) / max(1, monthsUntilDeadline)
      — if deadline is null, use a default of 60 months
   d. Sum the ideals for this tier → tierIdealTotal
   e. If remaining ≥ tierIdealTotal: each goal gets its full ideal monthly (capped at 0 if currentAmount ≥ targetAmount)
   f. Else: each goal gets (goalIdeal / tierIdealTotal) × remaining  (proportional share of the shortfall)

5. Return a new GoalAllocation[] with monthlyAllocated set on each entry
   (other fields copied from the input SavingsGoal as-is)
```

---

### 27.6 UI Design

#### 27.6.1 Goals tab — Allocation Plan card

A new card appears below the existing goal list on the Goals tab:

```
┌─────────────────────────────────────────────────────┐
│  Allocation Plan                    [Re-calculate]  │
│                                                     │
│  Based on free cash flow: ₪4,200 / mo              │
│                                                     │
│  Goal              Priority  Allocated / mo         │
│  ─────────────────────────────────────────────────  │
│  Emergency Fund    High      ₪1,800   ████████░░░  │
│  Home Down-Payment High      ₪1,400   ██████░░░░░  │
│  Vacation Fund     Medium    ₪600     ████░░░░░░░  │
│  New Car           Low       ₪400     ███░░░░░░░░  │
│  ─────────────────────────────────────────────────  │
│  Total allocated:  ₪4,200 / ₪4,200 FCF  ✓          │
│                                                     │
│  [Explain my plan 🤖]  ← only if API key is set    │
└─────────────────────────────────────────────────────┘
```

- **Card header:** "Allocation Plan" (left) + "Re-calculate" button (right, `variant="outline"`, `size="sm"`)
- **Sub-header:** "Based on free cash flow: {formatted FCF} / mo" in `text-sm text-muted-foreground`
- **Table columns:** Goal name | Priority badge | Allocated amount | Progress bar
- **Priority badge:** `Badge variant` maps — high → `destructive`, medium → `warning`, low → `secondary`
- **Progress bar:** width = `(monthlyAllocated / freeCashFlow) × 100%`, capped at 100%; colour = `bg-primary`
- **Total row:** sums all `monthlyAllocated`. If total = FCF: "✓" in `text-primary`; if total < FCF: remaining shown in `text-muted-foreground`; if total > FCF (rounding): shown with `text-destructive`
- **"Explain my plan 🤖" button:** `variant="outline"` with a `Sparkles` lucide icon; visible only when `!!import.meta.env.VITE_ANTHROPIC_API_KEY`; disabled and shows spinner while the API call is in flight

#### 27.6.2 AI Response card

Shown below the Allocation Plan card after the user clicks "Explain my plan 🤖":

```
┌─────────────────────────────────────────────────────┐
│  AI Assessment  [▲ Collapse]                        │
│  ─────────────────────────────────────────────────  │
│  ⚠ Note: AI response is always in English           │
│                                                     │
│  Your allocation looks realistic overall. The       │
│  Emergency Fund and Home Down-Payment goals are     │
│  on track for their deadlines. However, your        │
│  New Car goal may be delayed — at ₪400/mo it        │
│  would take 28 months, but your deadline is         │
│  18 months away. Consider temporarily increasing    │
│  the Car allocation to ₪650/mo by reducing the      │
│  Vacation Fund contribution.                        │
└─────────────────────────────────────────────────────┘
```

- Collapsible via a "▲ Collapse" / "▼ Expand" toggle button (`variant="ghost"`, `size="sm"`)
- Default state: expanded after the API call completes
- Warning note: `text-xs text-muted-foreground` with an `Info` icon — "AI response is always in English"
- Response text: `text-sm` in a `<p>` with `whitespace-pre-wrap` to preserve Claude's paragraph breaks
- Error state: if the API call fails, the card shows "Could not load AI assessment. Check your API key and try again." in `text-destructive`
- Loading state: spinner replaces the card content while the call is in flight

---

### 27.7 Interaction Flows

#### Flow A — First visit to Goals tab (no allocation yet)

```
1. User opens Goals tab
2. Allocation Plan card is visible with empty rows and monthlyAllocated = 0 for all goals
3. Sub-header: "Run allocation to see suggested amounts"
4. User clicks "Re-calculate"
5. autoAllocateSavings() runs synchronously (no network)
6. Table updates immediately with per-goal amounts
7. Sub-header updates: "Based on free cash flow: ₪4,200 / mo"
8. "Explain my plan 🤖" button appears (if API key is set)
```

#### Flow B — User clicks "Explain my plan 🤖"

```
1. Button shows spinner, is disabled
2. explainAllocationPlan() called with current GoalAllocation[] + freeCashFlow + currency
3. fetch() POSTs to Anthropic API; awaits response
4. On success: AI Response card appears expanded below Allocation Plan card
5. Response cached in component state
6. Button re-enables; label returns to "Explain my plan 🤖"
7. On subsequent renders (re-renders, tab switches): cached response shown, no re-call
```

#### Flow C — User edits a goal, then re-runs allocation

```
1. User changes a goal's target amount or deadline in the Goals tab
2. Allocation Plan card shows stale amounts (monthlyAllocated from previous run)
3. Sub-header adds note: "(recalculate to update)" — in text-muted-foreground
4. Cached AI response card is dismissed (cache invalidated on any goal edit)
5. User clicks "Re-calculate"
6. autoAllocateSavings() reruns; table updates
7. "Explain my plan 🤖" button re-enables (previous AI response gone)
```

#### Flow D — FCF is negative

```
1. autoAllocateSavings() receives freeCashFlow ≤ 0
2. All goals receive monthlyAllocated = 0
3. Table renders with ₪0 for all rows
4. Total row: "Total allocated: ₪0 / ₪0 FCF"
5. Sub-header: "Free cash flow is ₪0 or negative — no funds to allocate"
6. "Explain my plan 🤖" still callable; Claude will flag this situation in its response
```

#### Flow E — API key not set

```
1. VITE_ANTHROPIC_API_KEY is undefined or empty string
2. Allocation Plan card renders normally (Part 1 fully functional)
3. "Explain my plan 🤖" button is NOT rendered
4. No error shown — feature simply does not exist for this user
```

---

### 27.8 Edge Cases & Rules

| Scenario | Behaviour |
|----------|-----------|
| No goals defined | Allocation Plan card shows empty state: "Add goals to see an allocation plan" |
| All goals are 'completed' | All receive `monthlyAllocated = 0`; total = ₪0; sub-header notes this |
| All goals are 'blocked' | Same as above |
| Goal with no deadline | Default lookback of 60 months used for "ideal monthly" calculation |
| Goal where `currentAmount ≥ targetAmount` | Ideal monthly = 0; goal receives ₪0 allocation; shown as 'completed' |
| FCF ≤ 0 | All goals receive 0; sub-header warns |
| One priority tier fully funded, others starved | Each tier computed independently; high-priority goals get their full ideal before any medium or low goal receives anything |
| Rounding causes total > FCF by ≤ ₪1 | Truncate the last goal's allocation to close the gap; never exceed FCF |
| API call fails (network error, 401, 429) | Error message shown in AI Response card; button re-enables; no crash |
| `VITE_ANTHROPIC_API_KEY` is set to an invalid key | API returns 401; error message shown: "Could not load AI assessment. Check your API key and try again." |
| User switches household | Component unmounts (due to `key={household.id}`); allocation state + AI cache discarded |
| User has `lang = 'he'` | All UI strings use `t(en, he, lang)`; AI response renders in English with the "always in English" note |
| `explainAllocationPlan` called with 0 goals | Returns a short advisory note; no crash |

---

### 27.9 i18n — New Strings

| Key (concept) | English | Hebrew |
|---------------|---------|--------|
| Card title | `Allocation Plan` | `תוכנית הקצאה` |
| Sub-header (with FCF) | `Based on free cash flow: {amount} / mo` | `מבוסס על תזרים חופשי: {amount} לחודש` |
| Sub-header (initial state) | `Run allocation to see suggested amounts` | `הפעל הקצאה לראות סכומים מוצעים` |
| Sub-header (stale) | `(recalculate to update)` | `(חשב מחדש לעדכון)` |
| Sub-header (FCF ≤ 0) | `Free cash flow is ₪0 or negative — no funds to allocate` | `תזרים חופשי הוא ₪0 או שלילי — אין כספים להקצות` |
| Re-calculate button | `Re-calculate` | `חשב מחדש` |
| Table header — Goal | `Goal` | `יעד` |
| Table header — Priority | `Priority` | `עדיפות` |
| Table header — Allocated | `Allocated / mo` | `מוקצה / חודש` |
| Total row label | `Total allocated:` | `סך מוקצה:` |
| No goals empty state | `Add goals to see an allocation plan` | `הוסף יעדים כדי לראות תוכנית הקצאה` |
| AI button label | `Explain my plan` | `הסבר את התוכנית שלי` |
| AI response card title | `AI Assessment` | `הערכת בינה מלאכותית` |
| AI language note | `AI response is always in English` | `תשובת הבינה המלאכותית תמיד באנגלית` |
| Collapse toggle | `Collapse` | `כווץ` |
| Expand toggle | `Expand` | `הרחב` |
| AI error message | `Could not load AI assessment. Check your API key and try again.` | `לא ניתן לטעון הערכת בינה מלאכותית. בדוק את מפתח ה-API ונסה שוב.` |
| Loading state | `Thinking…` | `חושב…` |

---

### 27.10 Acceptance Criteria

**Algorithm (Part 1)**
- [ ] `autoAllocateSavings` is a pure function in `src/lib/savingsEngine.ts`
- [ ] Returns `GoalAllocation[]` with `monthlyAllocated` set on every goal
- [ ] High-priority goals are fully funded before medium goals receive any allocation
- [ ] Medium-priority goals are fully funded before low goals receive any allocation
- [ ] Within a tier, allocation is proportional to each goal's ideal monthly amount when FCF is insufficient
- [ ] Goals with status `'completed'` or `'blocked'` receive `monthlyAllocated = 0`
- [ ] Goal with no deadline defaults to a 60-month horizon
- [ ] Total `monthlyAllocated` across all goals does not exceed `freeCashFlow` (within ₪1 rounding tolerance)
- [ ] When `freeCashFlow ≤ 0`, all goals receive `monthlyAllocated = 0`
- [ ] Function is deterministic — same inputs always produce the same output

**UI — Allocation Plan card (Part 1)**
- [ ] Card is visible on the Goals tab
- [ ] Table renders one row per goal with name, priority badge, allocated amount, and progress bar
- [ ] Priority badges: high = `destructive`, medium = `warning`, low = `secondary`
- [ ] Progress bar width = `(monthlyAllocated / freeCashFlow) × 100%`, capped at 100%
- [ ] Total row shows sum of `monthlyAllocated` vs `freeCashFlow` with correct indicator (✓ / remaining / over)
- [ ] "Re-calculate" button reruns `autoAllocateSavings` and updates the table synchronously
- [ ] Sub-header shows formatted FCF after calculation
- [ ] Empty state shown when `data.goals` is empty
- [ ] All strings use `t(en, he, lang)` — no hardcoded English in JSX
- [ ] Card works in Hebrew RTL (priority badges, amounts, progress bars)
- [ ] Card works in dark mode
- [ ] Card works at 375 px width (mobile)

**UI — AI Assessment card (Part 2)**
- [ ] "Explain my plan 🤖" button only rendered when `!!import.meta.env.VITE_ANTHROPIC_API_KEY`
- [ ] Button is disabled and shows spinner while API call is in flight
- [ ] On success: AI Response card appears expanded below the Allocation Plan card
- [ ] Response text rendered with `whitespace-pre-wrap`
- [ ] "Always in English" note visible with an `Info` icon
- [ ] Collapsible toggle works (▲ Collapse / ▼ Expand)
- [ ] On API error: error message shown in `text-destructive`, button re-enables
- [ ] Response is cached in component state — navigating away and back shows the cached response without a re-call
- [ ] Cache is invalidated when the user edits any goal
- [ ] AI card not rendered when API key is absent

**Security**
- [ ] `VITE_ANTHROPIC_API_KEY` is not committed to any source file or `.env` file in the repository
- [ ] Only goal names, target amounts, deadlines, priorities, `monthlyAllocated`, `freeCashFlow`, and currency are sent to the API — no account numbers, user emails, or other PII
- [ ] `aiAdvisor.ts` reads the key from `import.meta.env.VITE_ANTHROPIC_API_KEY` — not from localStorage or any other runtime storage

**Tests**
- [ ] `npm test` passes — all existing tests green
- [ ] `npm run build` passes — no TypeScript errors
- [ ] `autoAllocateSavings` has unit tests covering: all tiers funded, tier partially funded (proportional), FCF = 0, negative FCF, completed/blocked goals, no-deadline goal, single goal, empty goals array
- [ ] `explainAllocationPlan` has a unit test with the API mocked — verifies the correct payload shape is sent and the returned string is passed through

---

### 27.11 Out of Scope (v2.8)

- Persisting `monthlyAllocated` values to `household_finance.data` — allocation is always recomputed on demand
- Applying the allocation automatically to goal `monthlyContribution` fields — user reviews and applies changes manually
- Streaming the AI response — single blocking `fetch`, full response displayed at once
- Letting the user edit per-goal allocations inline in the table (drag-to-redistribute, manual override) — a possible v3 feature
- A backend proxy to hide the Anthropic API key from the browser — listed as a future improvement
- Controlling the AI response language (Claude output language cannot be guaranteed by prompt alone)
- AI explanations for individual goals — the feature covers the holistic allocation only
- Rate-limiting or cost-capping the API calls — the user manages this via their own Anthropic account

---

### 27.12 Success Metric

A user with 3 or more active goals can open the Goals tab, click "Re-calculate", and immediately see a concrete per-goal monthly allocation that sums to their available FCF — without needing to do any mental arithmetic. If the API key is configured, clicking "Explain my plan" returns an actionable assessment in under 5 seconds that identifies at least one concrete change the user could make.

---

### 27.13 Implementation Checklist for Agents

#### 🏗 Backend Agent
1. Add `autoAllocateSavings(goals, freeCashFlow, liquidSavings): GoalAllocation[]` to `src/lib/savingsEngine.ts`
2. Implement the priority-tier proportional algorithm as specified in §27.5
3. Ensure the function is pure and deterministic — no side effects, no `Date.now()` without injection
4. Export the function; add it to the barrel export if one exists

#### 🎨 Frontend Agent
1. Add `monthlyAllocated?: number` to the `GoalAllocation` interface in `src/types/index.ts`
2. Create `src/lib/aiAdvisor.ts` with `explainAllocationPlan(goals, freeCashFlow, currency): Promise<string>`
   - `fetch` to `https://api.anthropic.com/v1/messages`
   - Model: `claude-haiku-4-5`, `max_tokens: 400`
   - Reads key from `import.meta.env.VITE_ANTHROPIC_API_KEY`
   - Prompt: ask Claude to assess realism, flag at-risk goals, suggest 1–2 actionable changes — in English
   - Throws on non-2xx response
3. Add Allocation Plan card to the Goals tab component:
   - Local state: `allocations: GoalAllocation[]`, `aiResponse: string | null`, `aiError: string | null`, `aiLoading: boolean`, `aiCollapsed: boolean`
   - "Re-calculate" button calls `autoAllocateSavings` and updates `allocations`; clears `aiResponse`
   - "Explain my plan 🤖" button calls `explainAllocationPlan`; sets `aiResponse` or `aiError`; guards on `!!import.meta.env.VITE_ANTHROPIC_API_KEY`
4. Do NOT expose any raw financial account numbers in the payload to `explainAllocationPlan`

#### 🖌 UX Agent
1. Priority badge colours: high → `variant="destructive"`, medium → `variant="warning"`, low → `variant="secondary"`
2. Progress bar: `<div className="h-2 rounded-full bg-primary"` style `width: X%`
3. "Explain my plan 🤖" button: `variant="outline"` + `Sparkles` lucide icon; spinner via `Loader2 animate-spin` while loading
4. AI Response card: collapsible with `ChevronUp` / `ChevronDown` toggle; `whitespace-pre-wrap` on response text
5. Verify dark mode, Hebrew RTL (logical margins), and mobile 375 px for both new cards
6. All interactive elements `min-h-[44px]`

---

## 28. Feature Spec: Mobile PWA / Install to Home Screen (v4.0)

> **Status:** Spec approved — not yet implemented
> **Target version:** v4.0
> **Date written:** May 2026

---

### 28.1 Problem

The app is fully functional on mobile browsers, but users must navigate to `household-finance-planner.com` every time they want to check their finances. There is no icon on the home screen, no fullscreen experience, and no offline fallback — the app is dead on a plane or subway. For Israeli couples who check finances together on the couch, the friction of opening a browser tab kills daily engagement.

---

### 28.2 Users Affected

All three personas, but primarily:

- **Couple** — both partners want quick access from their phone home screen, without hunting for a browser bookmark
- **Freelancer** — checks income/expense balance on the go; needs the app to feel native
- **Expat** — may be on a spotty connection; expects at least cached data to be viewable offline

---

### 28.3 Proposed Solution

Install `vite-plugin-pwa` and configure it to:

1. Generate a Web App Manifest that makes the app installable on Android and iOS
2. Register a Workbox service worker that caches static assets (cache-first) and never caches Supabase or Anthropic API calls (network-only)
3. Show an install banner on Android via the `beforeinstallprompt` event; show a manual instruction tooltip on iOS (Safari does not fire `beforeinstallprompt`)
4. Provide a meaningful offline experience: users can view their last-loaded finance data; all write actions show a clear "you are offline" notice rather than a silent failure

No new backend work is required. The service worker operates entirely client-side.

---

### 28.4 Web App Manifest

The manifest file is generated by `vite-plugin-pwa` from the config in `vite.config.ts`. All fields below are required.

| Field | Value |
|-------|-------|
| `name` | `Household Finance Planner` |
| `short_name` | `Finance Planner` |
| `name` (he) | `מתכנן פיננסי ביתי` |
| `short_name` (he) | `פיננסי ביתי` |
| `description` | `Track household income, expenses, savings and goals — private and offline-ready` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` | `#25a27a` (= `hsl(162, 63%, 41%)`, the app's primary teal) |
| `background_color` | `#f0faf6` (= `hsl(160, 20%, 97%)`, the app's light background token) |
| `lang` | `he` (primary audience) |
| `dir` | `auto` |

The manifest must declare two icon sizes. Both icons use the same teal background (`#25a27a`) with a white motif centered at 70% of canvas width.

| Size | File | Purpose |
|------|------|---------|
| 512 × 512 | `public/icons/icon-512.png` | Android splash, Play Store |
| 192 × 192 | `public/icons/icon-192.png` | Android home screen, maskable |

Icon design direction: teal (`#25a27a`) filled square with rounded corners (matching `--radius: 0.75rem` aesthetic), white house silhouette centered — simple flat design, no gradients. The house icon is chosen over the piggy bank because it directly signals "household" and reads clearly at 48px (launcher icon) and 16px (favicon).

Add a `maskable` purpose entry for the 192 px icon so Android adaptive icons can apply their own shape mask without white bars.

---

### 28.5 Service Worker Strategy

The service worker is generated by Workbox via `vite-plugin-pwa`. The strategy is split by URL pattern:

| URL pattern | Strategy | Rationale |
|-------------|----------|-----------|
| App shell (JS, CSS, HTML, fonts, icons) | Cache-first, stale-while-revalidate on update | Must load instantly and work offline |
| `/*.png`, `/*.svg`, `/*.ico` | Cache-first | Static assets, content-addressed |
| `https://*.supabase.co/**` | Network-only, no cache | Auth tokens and finance sync must never be served stale |
| `https://api.anthropic.com/**` | Network-only, no cache | AI responses are stateful and must never be cached |
| Everything else | Network-first with offline fallback to index.html | Ensures SPA routing works offline |

The service worker must **never** cache:
- Supabase REST or realtime endpoints
- The Anthropic messages API
- Any URL containing `access_token`, `apikey`, or `authorization` query params

On service worker update (new deploy detected), the app shows a single non-blocking toast: "An update is available — refresh to get the latest version." The user is not force-reloaded.

---

### 28.6 Install Prompt Behaviour

#### Android (Chrome, Edge, Samsung Internet)

The browser fires `beforeinstallprompt` when PWA installability criteria are met. The app:

1. Captures the event and suppresses the default browser mini-infobar
2. Shows an install banner at the bottom of the screen (above the tab bar) with:
   - App icon (48 × 48)
   - Short name + tagline: "Add to Home Screen for quick access" / "הוסף למסך הבית לגישה מהירה"
   - "Install" button (primary, teal) and "Not now" dismiss button
3. On "Install": calls `event.prompt()` and waits for `userChoice`
4. On "Not now": hides the banner; does not ask again for 14 days (persisted in `localStorage` under key `hf-pwa-dismissed-at`)
5. Once installed (`appinstalled` event fires): hides the banner permanently for the session; does not re-show on next launch since the app is already installed

#### iOS (Safari)

Safari does not fire `beforeinstallprompt`. The app:

1. Detects iOS Safari via `navigator.userAgent` check (presence of `iPhone` or `iPad` and absence of `CriOS`/`FxiOS`)
2. Detects whether the app is already running in standalone mode via `navigator.standalone === true`
3. If on iOS Safari and NOT already standalone: shows a one-time tooltip anchored to the header, containing:
   - The Safari "Share" icon (SVG, not a font icon)
   - Instruction text: "Tap the Share button, then 'Add to Home Screen'" / "לחץ על כפתור השיתוף ואז 'הוסף למסך הבית'"
   - A dismiss "X" button
4. The tooltip is shown once per install (persisted via `localStorage` key `hf-ios-install-shown`)
5. When already in standalone mode: no prompt shown, no banner shown

#### Already-installed PWA (standalone mode)

When `window.matchMedia('(display-mode: standalone)').matches` is true: no install banner or tooltip is ever rendered.

---

### 28.7 Offline Behaviour

The finance data (income, expenses, savings, goals, history) lives in `localStorage`. This means the app can render all existing data with zero network connectivity. The service worker caches the app shell, so even the initial load works offline after the first visit.

| Scenario | Online | Offline |
|----------|--------|---------|
| View Overview, Income, Expenses, Savings, Goals, History | Works | Works — data from localStorage |
| Edit any data (add expense, update goal, etc.) | Saves to localStorage + queues cloud push | Saves to localStorage only; cloud push will retry on reconnect (existing debounce handles this) |
| Cloud push / pull (Supabase sync) | Works | Silent no-op — `cloudFinance.ts` already guards with `!supabaseConfigured` pattern; extend with `navigator.onLine` guard |
| Google Sign-In | Works | Blocked — show "Sign in requires an internet connection" / "כניסה דורשת חיבור לאינטרנט" |
| AI features (receipt scan, savings explanation) | Works | Blocked — show "AI features require an internet connection" / "תכונות הבינה המלאכותית דורשות חיבור לאינטרנט" |
| Invite link acceptance | Works | Blocked — show generic offline error |

A persistent offline indicator banner is shown at the top of the page when `navigator.onLine === false`. It uses the `--warning` HSL token (amber), not `--destructive` (red), because the app is still partially functional.

Reconnection: the app listens to the `online` event and hides the banner + retries the pending cloud push automatically.

---

### 28.8 Splash Screen

On Android, Chrome generates a splash screen automatically from the manifest `name`, `background_color`, and `icons`. No additional splash screen HTML is needed.

On iOS, Safari generates a splash screen from `<link rel="apple-touch-startup-image">` tags. `vite-plugin-pwa` can generate these via the `AppleDeviceSizes` helper. Target at minimum:

- iPhone SE (2nd gen): 750 × 1334
- iPhone 14: 1170 × 2532
- iPhone 14 Pro Max: 1290 × 2796
- iPad (10th gen): 1640 × 2360

All splash screens: teal background (`#25a27a`), white app name centered, white house icon above the name.

---

### 28.9 Acceptance Criteria

**Manifest and installability**
- [ ] `npm run build` generates a `manifest.webmanifest` in the dist output
- [ ] Manifest contains: `name`, `short_name`, `description`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `theme_color: "#25a27a"`, `background_color: "#f0faf6"`, icons at 192 px and 512 px
- [ ] Chrome DevTools > Application > Manifest shows no errors and "Installable" status
- [ ] Lighthouse PWA audit scores 100 (or all installability checks pass)
- [ ] iOS Safari: app icon appears correctly in "Add to Home Screen" sheet (no generic icon)
- [ ] Android Chrome: "Add to Home Screen" prompt triggers the native install dialog

**Service worker**
- [ ] Service worker is registered and active in Chrome DevTools > Application > Service Workers
- [ ] App shell loads from cache when offline (no network request for JS/CSS/HTML)
- [ ] Supabase requests are NOT cached — verified by going offline, reloading, and confirming Supabase calls fail (not served from cache)
- [ ] Anthropic API requests are NOT cached — same verification
- [ ] On new deployment: update toast appears within 30 seconds; refresh loads new version

**Offline experience**
- [ ] Offline banner appears within 1 second of losing connectivity
- [ ] Offline banner disappears when connectivity is restored
- [ ] All six tabs (Overview, Income, Expenses, Savings, Goals, History) render existing data while offline
- [ ] Adding an expense offline saves to localStorage without an error; cloud sync fires automatically on reconnect
- [ ] Google Sign-In button shows an error state (not a spinner) when offline
- [ ] AI buttons (receipt scan, explain plan) show a disabled state with tooltip "Requires internet connection" / "דורש חיבור לאינטרנט" when offline

**Android install prompt**
- [ ] Install banner renders correctly at 375 px width
- [ ] "Install" button triggers the native Chrome install dialog
- [ ] "Not now" dismisses for 14 days (verified by checking `hf-pwa-dismissed-at` in localStorage)
- [ ] Banner does not appear when `display-mode` is `standalone`
- [ ] Banner works in Hebrew RTL (icon on the inline-end side of the text)
- [ ] Banner works in dark mode

**iOS install prompt**
- [ ] Tooltip shown once on first visit in iOS Safari (not in Chrome for iOS)
- [ ] Tooltip not shown when already running in standalone mode
- [ ] Tooltip shows the correct Safari Share icon (not the Chrome share icon)
- [ ] `hf-ios-install-shown` key written to localStorage after first display
- [ ] Tooltip works in Hebrew RTL
- [ ] Tooltip works in dark mode

**Accessibility**
- [ ] Offline banner has `role="alert"` and `aria-live="polite"`
- [ ] Install banner "Install" and "Not now" buttons have `min-h-[44px]`
- [ ] Dismiss buttons have descriptive `aria-label`
- [ ] Tooltip has `role="tooltip"` and is associated with the triggering element

**i18n**
- [ ] All install prompt and offline strings use `t(en, he, lang)` — no hardcoded English in JSX

---

### 28.10 Out of Scope (v4.0)

- **Push notifications** — a separate feature (v4.x), not part of this PWA iteration. The service worker does not register a push subscription.
- **Background sync API** — `navigator.serviceWorker.sync` is not used. Offline writes rely on the existing debounced cloud push which fires on reconnect via the `online` event.
- **IndexedDB caching of finance data** — finance data stays in localStorage as today. The service worker only caches the app shell (static assets).
- **Workbox `expiration` plugin / cache size limits** — deferred until cache size becomes a real concern.
- **Chrome Web Store / Play Store listing** — the PWA installs via browser only; no app store submission in this iteration.
- **Periodic Background Sync** — monthly snapshot reminder notifications are deferred to the push notifications feature.
- **App Shortcuts** (manifest `shortcuts` field) — e.g. "Add Expense" deep link — deferred to v4.x.
- **Share Target API** — receiving shared content (e.g. a receipt photo) via the OS share sheet — deferred.
- **Windows / macOS PWA install** — only iOS and Android are in scope for install UX. Desktop browsers may install via their built-in PWA install UI without any custom prompt.

---

### 28.11 New localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `hf-pwa-dismissed-at` | `string` (ISO date) | Records when the user last dismissed the Android install banner; banner reappears after 14 days |
| `hf-ios-install-shown` | `"1"` | Records that the iOS install tooltip has been shown; prevents repeat display |

These keys must be documented in `README.md` under the "Data storage" section.

---

### 28.12 Success Metric

A new user on an Android phone visits `household-finance-planner.com`, sees the install banner within 5 seconds, taps "Install", and can open the app from their home screen within 10 seconds of tapping — with the app loading in under 2 seconds (cached shell). After installation, the Lighthouse PWA audit returns a passing score with all installability checks green and an offline load time under 3 seconds on a simulated 3G connection.

Secondary: at least one household member on iOS can reach the "Add to Home Screen" tooltip, follow the instruction, and confirm the app icon appears on their home screen with the correct teal icon and name.

---

### 28.13 Implementation Checklist for Agents

#### Build Agent (Frontend / Backend)
1. Install `vite-plugin-pwa` and `workbox-window` as dev dependencies
2. Add `VitePWA({ ... })` plugin to `vite.config.ts` with the manifest fields from §28.4
3. Configure Workbox runtime caching:
   - `StaleWhileRevalidate` for app shell (precache list auto-generated by plugin)
   - `NetworkOnly` matcher for `*.supabase.co` and `api.anthropic.com`
   - `NetworkFirst` fallback to `index.html` for navigation requests
4. Generate icon files: `public/icons/icon-192.png` and `public/icons/icon-512.png` per §28.4 design direction
5. Add `<link rel="apple-touch-icon" href="/icons/icon-192.png">` to `index.html`
6. Add iOS splash screen `<link>` tags to `index.html` for the sizes listed in §28.8
7. Add `theme-color` meta tag to `index.html`: `<meta name="theme-color" content="#25a27a">`

#### Frontend Agent
1. Create `src/hooks/usePWAInstall.ts` — captures `beforeinstallprompt`, exposes `canInstall`, `promptInstall()`, and `dismiss()`; reads/writes `hf-pwa-dismissed-at`
2. Create `src/hooks/useIOSInstall.ts` — detects iOS Safari + non-standalone; reads/writes `hf-ios-install-shown`
3. Create `src/hooks/useOnlineStatus.ts` — wraps `navigator.onLine` + `online`/`offline` events; returns `isOnline: boolean`
4. Create `src/components/PWAInstallBanner.tsx` — Android install banner (see §28.6)
5. Create `src/components/IOSInstallTooltip.tsx` — iOS install tooltip anchored to header (see §28.6)
6. Create `src/components/OfflineBanner.tsx` — top-of-page amber offline indicator (see §28.7)
7. Mount all three components in `App.tsx` above the tab content area
8. Thread `isOnline` into AI button disabled states in `Goals.tsx` and `ExpenseDialog.tsx`
9. Thread `isOnline` into Google Sign-In button in `AuthPage.tsx`
10. Register service worker update listener via `workbox-window` in `main.tsx`; show Sonner toast on update

#### UX Agent
1. Design the install banner: icon left, text center, two buttons right (or stacked on very narrow screens) — RTL-aware using `ms-*`/`me-*`
2. Design the offline banner: full-width, amber, `WifiOff` lucide icon + text, dismissible
3. Design the iOS tooltip: anchored to header share-icon area, speech-bubble style with arrow pointing up toward the header
4. Verify all new components at 375 px, dark mode, Hebrew RTL
5. Ensure all interactive elements in new components have `min-h-[44px]`

#### QA Agent
1. Write `src/test/pwaInstall.test.ts` covering:
   - `usePWAInstall`: dismiss writes correct key, 14-day re-show logic, no-op when already installed
   - `useIOSInstall`: shows on iOS Safari non-standalone, hidden when standalone, hidden after first show, hidden on non-iOS
   - `useOnlineStatus`: returns `true` when `navigator.onLine` is true, updates on `online`/`offline` events
2. Verify `npm test` passes (all existing 375 + new tests green)
3. Verify `npm run build` passes with no TypeScript errors
4. Manual QA: install on Android Chrome, confirm icon, open standalone, confirm offline load

#### 🧪 QA Agent
1. Create `src/test/aiSavingsAllocator.test.ts`:
   - `autoAllocateSavings()` — 8 unit tests (see §27.10)
   - `explainAllocationPlan()` — 1 test with `fetch` mocked
2. Run `npm test` — confirm all existing tests still pass; new file adds ≥ 9 tests
3. Run `npm run build` — no TypeScript errors
4. Manual QA:
   - Goals tab with no goals: empty state visible
   - Goals tab with mixed priorities: allocation amounts are in high → medium → low order
   - FCF = 0: all rows show ₪0
   - Toggle language to Hebrew: all strings localised except AI response
   - Toggle dark mode: both cards readable
   - Mobile 375 px: table scrolls horizontally if needed; buttons reachable
   - With API key set: AI button visible; click → spinner → response; navigate away and back → cached response shown
   - Without API key: AI button absent; no error

#### 🔍 Code Review Agent
1. Confirm `autoAllocateSavings` is a pure function — no mutation of input arrays, no side effects
2. Confirm total `monthlyAllocated` never exceeds `freeCashFlow` — check rounding guard
3. Confirm `VITE_ANTHROPIC_API_KEY` appears only in `src/lib/aiAdvisor.ts` — not in components
4. Confirm data sent to Claude API contains no account numbers, emails, or PII — review the prompt construction in `aiAdvisor.ts`
5. Confirm `monthlyAllocated` is NOT written to `setData` — it must remain in component state only
6. Confirm `GoalAllocation.monthlyAllocated` is typed as `number | undefined` (not `any`)
7. Confirm all new strings use `t(en, he, lang)` — no hardcoded English in JSX
8. Confirm AI Response card is conditionally rendered, not just hidden — no key leak via hidden DOM elements

#### 🗄 Data Engineer Agent
1. No Supabase schema change — `monthlyAllocated` is never persisted; `household_finance.data` is unchanged
2. `cloudFinance.ts` `mergeFinanceData` requires no change — `GoalAllocation` is a computed view, not stored
3. Confirm `FINANCE_DEFAULTS` does not reference `monthlyAllocated` — it is absent from defaults by design
4. Update `.claude/docs/database.md` to note that `GoalAllocation.monthlyAllocated` is a computed field, never written to the cloud
