# Household Finance Planner — Full Product Design Document

> **Audience:** designers, engineers, and product stakeholders.
> This document is the single source of truth for every feature, screen, interaction, and design decision in the app.
> **Version:** 2.3-draft — April 2026

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

*Document version: 2.4-draft — reflects app state as of April 2026*
*Previous version: 2.3 (Historical Expense Entry on snapshots in History tab)*

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
