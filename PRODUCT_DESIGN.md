# Household Finance Planner — Full Product Design Document

> **Audience:** designers, engineers, and product stakeholders.
> This document is the single source of truth for every feature, screen, interaction, and design decision in the app.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Design System](#4-design-system)
5. [Authentication](#5-authentication)
6. [Header & Global Navigation](#6-header--global-navigation)
7. [Overview Tab](#7-overview-tab)
8. [Income Tab](#8-income-tab)
9. [Expenses Tab](#9-expenses-tab)
10. [Savings Tab](#10-savings-tab)
11. [Goals Tab](#11-goals-tab)
12. [History Tab](#12-history-tab)
13. [Settings Panel](#13-settings-panel)
14. [Data Model](#14-data-model)
15. [Tax Engine](#15-tax-engine)
16. [Smart Allocation Engine](#16-smart-allocation-engine)
17. [Internationalisation & RTL](#17-internationalisation--rtl)
18. [Persistence & Data Flow](#18-persistence--data-flow)
19. [Accessibility](#19-accessibility)
20. [Responsiveness](#20-responsiveness)

---

## 1. Product Vision

**Problem:** Israeli households lack a free, private tool that accurately calculates take-home pay (accounting for Bituach Leumi, health tax, pension, and progressive income tax) and connects it to a realistic savings and goal plan.

**Solution:** A browser-only web app that:
- Computes real net income from gross salary using the Israeli (and multi-country) tax system
- Tracks expenses with category grouping and monthly normalisation
- Models savings accounts with liquidity tiers and expected returns
- Allocates surplus cash toward user-defined financial goals intelligently
- Runs entirely on-device — no backend, no subscription, no data sharing

**Core promise:** _"Enter your gross salary. Know your real financial picture in five minutes."_

---

## 2. User Personas

### Primary — The Israeli Dual-Income Couple
- Age 30–45, salaried employees (hi-tech / public sector)
- Both earn gross salaries; confused by pay slips
- Have a mortgage, kids, pension fund, study fund
- Want to know: "How much can we actually save each month?"

### Secondary — The Freelancer / Self-Employed
- Variable monthly income, no employer contributions
- Needs to estimate quarterly tax liability and set aside for Bituach Leumi
- Uses the manual net override + goal tracking

### Tertiary — The Expat / Multi-Country Household
- One partner earns in ILS, one in USD or EUR
- Needs multi-currency display and simplified foreign tax brackets

---

## 3. Information Architecture

```
App (root)
│
├── Auth Gate
│   ├── Sign In
│   └── Create Account
│
└── Main App (authenticated)
    │
    ├── Header (global, sticky)
    │   ├── Logo + App name
    │   ├── Tab navigation (6 tabs)
    │   ├── Language toggle (EN / עב)
    │   ├── Dark mode toggle
    │   ├── Settings panel (currency, data export/import)
    │   └── User chip (avatar initial + name + logout)
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

All colours are defined as HSL semantic tokens in `src/index.css` and consumed via Tailwind utility classes. Never use hardcoded hex values.

| Token | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| `--primary` | `162 63% 41%` (teal) | `162 63% 45%` | Buttons, active states, KPI values |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary bg |
| `--background` | `160 20% 97%` | `162 25% 8%` | Page background |
| `--card` | `0 0% 100%` | `162 25% 11%` | Card surfaces |
| `--muted` | `162 15% 94%` | `162 20% 16%` | Subtle backgrounds, toggle rows |
| `--muted-foreground` | `162 20% 45%` | `162 15% 55%` | Secondary labels, placeholders |
| `--accent` | `199 89% 48%` (sky blue) | `199 89% 48%` | Accent highlights |
| `--destructive` | `0 72% 51%` (red) | `0 62% 50%` | Errors, delete actions |
| `--border` | `162 20% 88%` | `162 20% 20%` | Card and input borders |

**Chart palette** (10 colours, `--chart-1` through `--chart-10`):
`teal → sky → amber → purple → red → emerald → blue → orange → pink → cyan`

**Status colours** (used alongside icons — never colour alone):
- Realistic → emerald (`text-emerald-600`)
- Tight → amber (`text-amber-600`)
- Unrealistic / Blocked → destructive (`text-destructive`)

### 4.2 Typography

- **Font family:** System sans-serif stack (no custom font download)
- **Headings:** `font-bold tracking-tight` — tight letter spacing for impact
- **Body:** `text-sm` (14 px), `leading-relaxed` for readability
- **Numbers:** `font-semibold tabular-nums` — monospaced digits to prevent layout shift
- **Labels:** `text-xs text-muted-foreground` — 12 px, secondary weight
- **Single H1:** visually hidden (`sr-only`), always present for accessibility

### 4.3 Spacing & Layout

- Container: `max-w-4xl mx-auto px-4`
- Section spacing: `space-y-4` between cards, `space-y-6` on overview
- Card padding: `p-6` (header + content), `p-4` for compact cards
- Grid: `grid-cols-2` on mobile → `grid-cols-4` on md for KPI cards

### 4.4 Border Radius

- Cards, dialogs, inputs: `rounded-lg` (`0.75rem`)
- Badges, avatars: `rounded-full`
- Buttons: `rounded-md` (`0.5rem`)

### 4.5 Elevation

- Cards: `shadow-sm` — subtle depth without heavy borders
- Dialogs: `shadow-lg` over `backdrop-blur-sm` overlay
- Header: `bg-card/80 backdrop-blur-sm` — frosted glass on scroll

### 4.6 Component Library

Built on **shadcn/ui** + **Radix UI** primitives. All components are owned in `src/components/ui/` — no external stylesheet dependency.

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | 6 variants: default, destructive, outline, secondary, ghost, link |
| Card | `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` |
| Dialog | `dialog.tsx` | Modal with overlay, close button, focus trap |
| Badge | `badge.tsx` | 6 variants: default, secondary, destructive, outline, success, warning |
| Input | `input.tsx` | Standard text input with focus ring |
| Label | `label.tsx` | Accessible label wired to form controls |
| Select | `select.tsx` | Radix dropdown with chevron trigger |
| Slider | `slider.tsx` | Range slider for emergency buffer |
| Progress | `progress.tsx` | Goal progress bar with `indicatorClassName` override |
| Switch | `switch.tsx` | Toggle with full-row clickable label pattern |

### 4.7 Motion & Transitions

- `transition-colors` on all hover states
- `animate-pulse` on loading skeletons
- Dialog open/close: Radix built-in `data-[state]` animations (fade + zoom)
- No heavy animation libraries — keep bundle lean

---

## 5. Authentication

### 5.1 Overview

Fully local, no external service. Credentials never leave the device.

**Storage:**
- `hf-accounts` — `LocalUser[]` (id, email, displayName, passwordHash, createdAt)
- `hf-session` — user ID of the logged-in user
- `hf-data-{userId}` — isolated financial data per user

**Security:**
- Passwords hashed with **SHA-256** via `crypto.subtle.digest` (Web Crypto API — built into all modern browsers, zero dependencies)
- Hash is stored, plain-text password is never persisted
- Session is a simple localStorage key (appropriate for a local, single-device app)

### 5.2 Auth Page Layout

```
┌─────────────────────────────────────┐
│                                     │
│         [Wallet icon — teal]        │
│    Household Finance Planner        │
│         מתכנן פיננסי ביתי           │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Sign In  │  Create Account   │  │  ← tab bar, active tab underlined
│  ├───────────────────────────────┤  │
│  │                               │  │
│  │  [Form fields]                │  │
│  │  [Error banner — if any]      │  │
│  │  [Submit button]              │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  All data stored locally on device  │  ← footer note
└─────────────────────────────────────┘
```

### 5.3 Sign In Form Fields

| Field | Type | Validation |
|-------|------|------------|
| Email | `type="email"` | Required, matched to account |
| Password | Password input + show/hide toggle | Required, compared to hash |

**Error states:** "No account found with this email." / "Incorrect password."

### 5.4 Sign Up Form Fields

| Field | Type | Validation |
|-------|------|------------|
| Full Name | text | Required, non-empty after trim |
| Email | `type="email"` | Required, must be unique |
| Password | Password input + show/hide | Required, min 6 characters |
| Confirm Password | Password input + show/hide | Must match password |

**Error states:** "Please fill in all fields." / "Password must be at least 6 characters." / "Passwords do not match." / "An account with this email already exists."

### 5.5 UX Details

- Password inputs have an eye icon toggle (show/hide) on the right
- Submit button shows "Signing in…" / "Creating account…" while async hash runs
- Submit disabled until form is valid (client-side check before hash)
- Switching tabs resets form state but retains no data between tabs
- On successful sign-in/sign-up: app unmounts auth page and mounts main app instantly
- `FinanceProvider` receives `key={user.id}` so switching users triggers a full remount with fresh data

---

## 6. Header & Global Navigation

### 6.1 Layout

```
┌────────────────────────────────────────────────────────────────┐
│  [🔵 Wallet]  Household Finance Planner   [עב] [🌙] [⚙]  │ A ▾│
│                                                                │
│  [Overview] [Income] [Expenses] [Savings] [Goals] [History]   │
└────────────────────────────────────────────────────────────────┘
```

- Sticky (`position: sticky; top: 0; z-index: 40`)
- `bg-card/80 backdrop-blur-sm` — frosted glass effect
- Height: `h-14` (56 px)
- On `< sm`: app title hidden, tab labels hidden (icons only)

### 6.2 Logo

- Wallet icon from lucide-react in a rounded teal chip (`bg-primary p-1.5 rounded-lg`)
- App name text: `font-bold tracking-tight` — hidden below `sm`

### 6.3 Tab Navigation

- 6 equal tabs rendered as `<button>` elements
- Active: `bg-primary text-primary-foreground rounded-lg`
- Inactive: `text-muted-foreground hover:bg-muted hover:text-foreground`
- Tab labels hidden below `sm` breakpoint (icons always visible)
- Overflow: `overflow-x-auto` for very narrow screens

### 6.4 User Chip

- Circular avatar with user's first initial (`bg-primary/20 text-primary font-bold`)
- Display name next to avatar (hidden below `sm`)
- `LogOut` icon button → clears session, returns to auth page
- Separated from settings controls by a `1px` vertical divider

### 6.5 Controls (right side, left-to-right order)

1. **Language toggle** — `EN` or `עב` text button, switches `data.language`
2. **Dark mode toggle** — Sun / Moon icon, switches `data.darkMode`
3. **Settings gear** → opens settings dialog (see §13)
4. **Divider**
5. **User chip** (avatar + name + logout)

---

## 7. Overview Tab

**Purpose:** Instant snapshot of the household's financial health.

### 7.1 KPI Cards

Four cards in a `2-col (mobile) → 4-col (md)` grid:

| Card | Icon | Value | Subtitle |
|------|------|-------|----------|
| Monthly Income | TrendingUp | Sum of all members' net monthly income | — |
| Monthly Expenses | TrendingDown | Sum of all expenses (monthly normalised) | — |
| Free Cash Flow | Wallet | Income − Expenses − Contributions | "surplus" / "deficit" in green/red |
| Total Assets | PiggyBank | Sum of all account balances | — |

**KPI card anatomy:**
```
┌──────────────────────┐
│  [Icon chip]  Label  │
│               ¥¥¥¥¥ │  ← large bold number
│               sub    │  ← small coloured subtitle
└──────────────────────┘
```

### 7.2 Deficit Warning Banner

Shown when `freeCashFlow < 0`:
```
⚠ Your expenses exceed income. Review your budget.
```
Orange-red background, `AlertTriangle` icon, full width.

### 7.3 Expense Breakdown Chart

- Recharts `PieChart` with `Pie` + `Cell`
- `outerRadius={80}`, inline label: `"CategoryName XX%"`
- 10-colour chart palette cycling
- `Tooltip` shows formatted currency on hover
- Empty state: centred text "No expenses yet"

### 7.4 Savings by Liquidity Chart

- Recharts `BarChart` — two bars: Liquid vs Locked
- Y-axis abbreviated (`120k` format)
- Rounded top corners on bars (`radius={[4,4,0,0]}`)
- `Tooltip` shows formatted currency
- Empty state: centred text "No accounts yet"

### 7.5 Top Goals Progress

- Shown only when at least one goal exists
- First 3 goals rendered as name + percentage + progress bar
- Progress bar colour follows goal status (not shown on overview — just green)

---

## 8. Income Tab

**Purpose:** Define who earns what, with accurate net take-home calculation.

### 8.1 Toolbar

- Left: "Total net monthly: ₪XX,XXX" — real-time sum across all members and sources
- Right: "Add Member" button → opens Add Member dialog

### 8.2 Empty State

Large `Users` icon + "Add a household member to get started"

### 8.3 Member Card

```
┌──────────────────────────────────────────┐
│  Member Name          [₪XX,XXX/mo] [🗑] │
├──────────────────────────────────────────┤
│  [Source Card]                           │
│  [Source Card]                           │
│  [+ Add Source]                          │
└──────────────────────────────────────────┘
```

- Badge shows member's total net monthly income
- Trash button deletes member and all their sources (no confirmation — low risk)

### 8.4 Source Card

```
┌─────────────────────────────────────────────┐
│  Source Name                  ₪X,XXX (gross)│
│  [משכורת] [ברוטו→נטו] [הפרשות]  ₪X,XXX net │
│                                        /mo  │
│  ▼ Tax breakdown                            │
│  ─────────────────────────────────────────  │
│                          [✏ Edit] [🗑 Del]  │
└─────────────────────────────────────────────┘
```

**Badges shown conditionally:**
- Source type badge (always): `משכורת` / `פרילנס` / `עסק עצמאי` / `שכ"ד` / `השקעות` / `פנסיה` / `אחר`
- `ברוטו→נטו` (secondary): when `isGross = true` and `useManualNet = false`
- `ידני` (warning/amber): when `useManualNet = true`
- `הפרשות` (secondary): when `useContributions = true`

**Amount display:**
- When gross calculated: struck-through gross above, bold teal net below
- When manual: shows manual net amount
- When net as-is: shows the net amount

### 8.5 Tax Breakdown Expander

Triggered by clicking "▼ Tax breakdown" chevron row. Expands inline:

```
Gross               ₪20,000
─────────────────────────────
Income Tax        − ₪3,200
Bituach Leumi     − ₪620
Health Tax        − ₪540
Pension (employee)− ₪1,200
Edu. Fund (emp.)  − ₪500
─────────────────────────────
Net (22.3% effective)  ₪13,940
```

- Income tax, BL, health tax → `text-destructive`
- Employee contributions → amber
- Net row → `text-primary`, bold

### 8.6 Add / Edit Income Source Dialog

**Trigger:** "+ Add Source" outline button below source list, or ✏ pencil icon on existing source card.

**Dialog layout** (`max-h-[85vh] overflow-y-auto`):

#### Section 1 — Basic Info
- **Source Name** — full-width text input, placeholder "e.g. Main Salary / משכורת ראשית"
- **Monthly Amount** + **Type** — 2-column grid
  - Amount: number input, placeholder "0"
  - Type: select (salary / freelance / business / rental / investment / pension / other — in Hebrew when RTL)

#### Section 2 — Gross Toggle
Full-width toggle row (`bg-secondary/40 border rounded-lg`):
- Label: "This is gross pay (calculate net)"
- Sublabel: "Apply tax brackets and deductions"
- Switch on the right

**When `isGross = true` AND `useManualNet = false`:** bordered secondary card expands below with:

##### Country Select
- Options: ישראל 🇮🇱 / USA 🇺🇸 / UK 🇬🇧 / Germany 🇩🇪 / France 🇫🇷 / Canada 🇨🇦

##### IL-Only Fields (2-column grid, only when `country === 'IL'`)
- **Tax Credit Points** — number input, step 0.25, default 2.25
- **Insured Salary %** — number input, step 1, range 0–100, default 100

##### Contributions Toggle
Full-width toggle row:
- Label: "Add salary contributions"
- Sublabel: "Pension, education fund, severance"

**When `useContributions = true`:** inner card with two sections:

**Employee (deducted from net)** — 2-column grid:
- Pension % (default 6)
- Education Fund % (default 2.5)

**Employer (informational)** — 3-column grid:
- Pension % (default 6.5)
- Education Fund % (default 7.5)
- Severance % (default 8.33)

#### Section 3 — Manual Net Toggle
Full-width toggle row:
- Label: "Override net manually"
- Sublabel: "Skip all calculations — enter take-home directly"

**When `useManualNet = true`:** Manual Net Amount input appears below.

> **Mutual exclusion rule:** both `isGross` and `useManualNet` can be enabled simultaneously. Manual always wins — the gross tax block is hidden when manual is active.

#### Section 4 — Net Preview Card
Shown whenever `amount > 0`. Teal-tinted rounded card:
```
Monthly Net          ₪XX,XXX (gross struck through)
Effective deduction rate: XX.X%
```

#### Section 5 — Employer Cost Summary
Shown only when `isGross + useContributions + amount > 0`. Dashed border card (informational):
```
Employer Cost (on top of your gross)
Pension             ₪X,XXX
Education Fund      ₪X,XXX
Severance           ₪X,XXX
─────────────────────────────
Total employer cost ₪XX,XXX
```

#### Submit Button
Full-width "Save Source". **Disabled** until:
- `name.trim()` is non-empty, AND
- `amount > 0`, AND
- If `useManualNet`: `manualNetOverride > 0`

### 8.7 Add Member Dialog

Simple dialog:
- Full Name text input
- "Add" button (disabled until name non-empty)
- Enter key submits

---

## 9. Expenses Tab

**Purpose:** Track all household spending with category grouping and monthly normalisation.

### 9.1 Toolbar

- Left: "Total monthly: ₪XX,XXX" in red — sum of all expenses normalised to monthly
- Right: "+ Add Expense" primary button

### 9.2 Empty State

`ShoppingCart` icon + "No expenses yet. Add your first one!"

### 9.3 Category Groups

Expenses are grouped by category. Only non-empty categories are rendered.

**Categories:**
`Housing · Food · Transport · Education · Leisure · Health · Utilities · Clothing · Insurance · Savings · Other`

Each category renders as a Card:

```
┌──────────────────────────────────────────┐
│  Housing                    ₪5,200/mo   │
├──────────────────────────────────────────┤
│  Rent                                    │
│  [Recurring]              ₪5,000/mo  ✏ 🗑│
│  ─────────────────────────────────────── │
│  Arnona (yearly)                         │
│  [One-time] [₪200/mo]    ₪2,400/yr  ✏ 🗑│
└──────────────────────────────────────────┘
```

- Category total badge (outline) in header
- Each expense row: name + badges + amount + edit/delete actions
- For yearly expenses: shows monthly equivalent badge + full yearly amount
- `Recurring` badge → secondary style
- `One-time` badge → outline style

### 9.4 Add / Edit Expense Dialog

| Field | Type | Notes |
|-------|------|-------|
| Name | text | e.g. "Rent / שכ"ד" |
| Amount | number | — |
| Period | select | Monthly / Yearly |
| Category | select | 11 options |
| Recurring | switch | Toggle |

---

## 10. Savings Tab

**Purpose:** Track all savings accounts and assets; distinguish liquid from locked funds.

### 10.1 Toolbar

- Left: "Monthly contributions: ₪X,XXX" — sum of all account monthly contributions
- Right: "+ Add Account" button

### 10.2 Empty State

`PiggyBank` icon + "Add your savings accounts and assets"

### 10.3 Summary Row

Two side-by-side cards:
```
┌────────────────┐  ┌────────────────┐
│  Liquid Assets │  │  Locked Assets │
│   ₪XXX,XXX    │  │   ₪XXX,XXX    │
└────────────────┘  └────────────────┘
```

**Liquid** = `immediate` + `short` liquidity
**Locked** = `medium` + `locked` liquidity

### 10.4 Account Lists

Two separate cards: "Liquid Accounts" and "Locked / Long-term"

Each account row:
```
Account Name                          ₪XX,XXX
[Checking] [Immediate] [3.5%/yr]
+₪500/mo contribution
                                    ✏ 🗑
```

**Account type badges:** `עו"ש / Checking · חיסכון / Savings · פיקדון / Deposit · פנסיה / Pension · קרן השתלמות / Study Fund · מניות / Stocks · קריפטו / Crypto · נדל"ן / Real Estate · אחר / Other`

**Liquidity badge colours:**
- Immediate → success (green)
- Short-term → secondary (grey)
- Medium-term → warning (amber)
- Locked → destructive (red)

### 10.5 Add / Edit Account Dialog

| Field | Type | Default |
|-------|------|---------|
| Name | text | — |
| Type | select | checking |
| Liquidity | select | immediate |
| Current Balance | number | 0 |
| Annual Return % | number (step 0.1) | 0 |
| Monthly Contribution | number | 0 |

---

## 11. Goals Tab

**Purpose:** Define financial goals and get a realistic monthly savings plan.

### 11.1 Toolbar

- Left: "Monthly surplus for goals: ₪X,XXX" — `income - expenses - contributions` (red if negative)
- Right: "+ Add Goal" button

### 11.2 Emergency Buffer Control

Persistent card at the top of the tab:
```
Emergency Buffer: 3 months        (₪XX,XXX)
[────●──────────────────────────] 1-12 slider
```

The buffer is subtracted from liquid savings before allocating to goals.

### 11.3 Empty State

`Target` icon + "Set a financial goal to get started"

### 11.4 Goal Card

```
┌───────────────────────────────────────────────┐
│  ✓ Buy a Car         [High] [Realistic]       │
├───────────────────────────────────────────────┤
│  ₪30,000 / ₪80,000                      37%  │
│  [══════════════════════─────────────────]    │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │ Recommended/mo   │ │ Deadline          │  │
│  │ ₪2,500           │ │ Jan 2028         │   │
│  └──────────────────┘ └──────────────────┘   │
│  Monthly gap: ₪800          ← only if gap > 0 │
│  Notes text here (if any)                     │
│  [↑] [↓]                          [✏] [🗑]   │
└───────────────────────────────────────────────┘
```

**Status icons:**
- Realistic → `CheckCircle` (emerald)
- Tight → `AlertTriangle` (amber)
- Unrealistic → `XCircle` (red)
- Blocked → `XCircle` (red)

**Progress bar colour:**
- Realistic → `bg-emerald-500`
- Tight → `bg-amber-500`
- Unrealistic / Blocked → `bg-destructive`

**Priority badge variants:**
- High → `default` (primary teal)
- Medium → `secondary`
- Low → `outline`

**Status badge variants:**
- Realistic → `success`
- Tight → `warning`
- Unrealistic / Blocked → `destructive`

**Reordering:** Up/Down chevron buttons. Top goal's Up button is disabled; bottom goal's Down button is disabled.

### 11.5 Add / Edit Goal Dialog

| Field | Type | Notes |
|-------|------|-------|
| Goal Name | text | e.g. "Emergency Fund / קרן חירום" |
| Target Amount | number | — |
| Already Saved | number | Current progress toward goal |
| Deadline | date | `type="date"` |
| Priority | select | High / Medium / Low |
| Notes | text | Optional free text |
| Use Liquid Savings | switch | Counts liquid savings toward gap |

---

## 12. History Tab

**Purpose:** Record monthly snapshots and visualise trends over time.

### 12.1 Toolbar

- Left: "X snapshots recorded"
- Right: "Snapshot This Month" button (Camera icon)

**Snapshot logic:** Captures current `totalIncome`, `totalExpenses`, `totalSavings`, `freeCashFlow`, and stores with current month label + ISO date string.

### 12.2 Empty State

`History` icon + "Take your first monthly snapshot to start tracking trends"

### 12.3 Trend Chart

Recharts `LineChart` with three lines:
- **Income** → `hsl(162,63%,41%)` (teal)
- **Expenses** → `hsl(0,72%,51%)` (red)
- **Free Cash Flow** → `hsl(199,89%,48%)` (blue)

Props: `strokeWidth={2}`, `dot={false}`, `CartesianGrid` with `--border` colour, formatted Y-axis (`k` suffix), formatted tooltip.

### 12.4 Snapshot Cards

Rendered newest-first. Each card:

```
┌────────────────────────────────────────┐
│  April 2026           [+₪1,200] [🗑]  │
│  24/04/2026                            │
├────────────────────────────────────────┤
│  Income      Expenses     Savings      │
│  ₪18,000     ₪14,500      ₪2,300      │
└────────────────────────────────────────┘
```

- Free cash flow badge: `success` if ≥ 0, `destructive` if < 0, with `+` prefix for positive
- Trash button deletes the snapshot immediately (no confirmation)

---

## 13. Settings Panel

Opened via the gear icon in the header. Radix Dialog.

### 13.1 Currency

Select with 5 options. Changing currency also updates the locale for `Intl.NumberFormat`:

| Currency | Locale |
|----------|--------|
| ₪ ILS | he-IL |
| $ USD | en-US |
| £ GBP | en-GB |
| € EUR | de-DE |
| $ CAD | en-CA |

### 13.2 Dark Mode

Switch toggle — mirrors the header dark mode button.

### 13.3 Data Export / Import

Two outline buttons side-by-side:
- **Export JSON** — downloads `household-finance.json` with full `FinanceData`
- **Import JSON** — opens a hidden `<input type="file">`, reads and parses JSON, replaces current data (no confirmation — data is re-importable)

---

## 14. Data Model

### `FinanceData` (root state)

```typescript
interface FinanceData {
  members: HouseholdMember[]
  expenses: Expense[]
  accounts: SavingsAccount[]
  goals: Goal[]
  history: MonthSnapshot[]
  emergencyBufferMonths: number  // 1–12
  currency: Currency
  locale: Locale
  darkMode: boolean
  language: 'en' | 'he'
}
```

### `HouseholdMember`

```typescript
interface HouseholdMember {
  id: string
  name: string
  sources: IncomeSource[]
}
```

### `IncomeSource`

```typescript
type IncomeSourceType = 'salary' | 'freelance' | 'business' | 'rental' | 'investment' | 'pension' | 'other'

interface IncomeSource {
  id: string
  name: string
  amount: number          // always monthly
  period: 'monthly' | 'yearly'  // legacy field, new sources use monthly
  type: IncomeSourceType
  isGross: boolean
  useManualNet: boolean
  manualNetOverride?: number
  country: Country        // 'IL' | 'US' | 'UK' | 'DE' | 'FR' | 'CA'
  taxCreditPoints: number        // default 2.25
  insuredSalaryRatio: number     // percentage 0–100, default 100
  useContributions: boolean
  pensionEmployee: number        // % of gross
  educationFundEmployee: number
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
}
```

### `Expense`

```typescript
type ExpenseCategory = 'housing' | 'food' | 'transport' | 'education' | 'leisure' | 'health' | 'utilities' | 'clothing' | 'insurance' | 'savings' | 'other'

interface Expense {
  id: string
  name: string
  amount: number
  category: ExpenseCategory
  recurring: boolean
  period: 'monthly' | 'yearly'
}
```

### `SavingsAccount`

```typescript
type AccountType = 'checking' | 'savings' | 'deposit' | 'pension' | 'study_fund' | 'stocks' | 'crypto' | 'real_estate' | 'other'
type Liquidity = 'immediate' | 'short' | 'medium' | 'locked'

interface SavingsAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  liquidity: Liquidity
  annualReturnPercent: number
  monthlyContribution: number
}
```

### `Goal`

```typescript
type GoalPriority = 'high' | 'medium' | 'low'

interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string       // ISO date string
  priority: GoalPriority
  notes: string
  useLiquidSavings: boolean
}
```

### `MonthSnapshot`

```typescript
interface MonthSnapshot {
  id: string
  label: string          // "April 2026"
  date: string           // ISO timestamp
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  freeCashFlow: number
}
```

---

## 15. Tax Engine

**File:** `src/lib/taxEstimation.ts`

### 15.1 Israeli Calculation Chain

Given `grossMonthly`:

**Step 1 — Income Tax**
Apply monthly progressive brackets:
```
₪0      – ₪7,010   → 10%
₪7,011  – ₪10,060  → 14%
₪10,061 – ₪16,150  → 20%
₪16,151 – ₪22,440  → 31%
₪22,441 – ₪46,690  → 35%
> ₪46,690           → 47%
```
Subtract credit: `incomeTax = max(0, bracketTax − creditPoints × 242)`

**Step 2 — Insured Salary**
`insuredSalary = gross × (insuredSalaryRatio / 100)`

**Step 3 — Bituach Leumi** (on insured salary, capped at ₪49,030)
```
₪0      – ₪7,522  → 3.5%
₪7,522  – ₪49,030 → 12%
> ₪49,030          → 0% (capped)
```

**Step 4 — Health Tax** (on insured salary, same cap)
```
₪0      – ₪7,522  → 3.1%
₪7,522  – ₪49,030 → 5%
> ₪49,030          → 0% (capped)
```

**Step 5 — Employee Contributions** (on full gross, only when `useContributions = true`)
```
pensionEmployee     = gross × pensionEmployee%
educationFundEmp    = gross × educationFundEmployee%
```

**Step 6 — Net**
```
net = gross − incomeTax − bituachLeumi − healthTax − pensionEmployee − educationFundEmployee
effectiveRate = (totalDeductions / gross) × 100
```

**Manual override path:** `net = manualNetOverride`, all other fields = 0, `isManual = true`

**Net-only path:** no deductions, `net = amount`, `effectiveRate = 0`

### 15.2 Return Type: `TaxBreakdown`

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
  effectiveRate: number
  isManual: boolean
  hasContributions: boolean
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
  totalEmployerContrib: number
}
```

### 15.3 Foreign Country Support

Annual bracket estimates divided by 12 for monthly approximation:

| Country | Method |
|---------|--------|
| US | 7-bracket federal (2023 rates) |
| UK | 4-bracket incl. personal allowance |
| DE | 3-bracket |
| FR | 5-bracket |
| CA | 6-bracket federal |

### 15.4 Legacy Compatibility

`insuredRatio` (decimal 0–1) from old data is auto-detected and converted to percentage. `pensionEmployeePercent` and `educationFundPercent` from old data are read as fallbacks.

---

## 16. Smart Allocation Engine

**File:** `src/lib/savingsEngine.ts`

### 16.1 Inputs

```typescript
interface EngineInput {
  goals: Goal[]
  monthlySurplus: number
  accounts: SavingsAccount[]
  emergencyBufferMonths: number
  monthlyExpenses: number
}
```

### 16.2 Algorithm

```
liquidAvailable = sum(immediate + short accounts) − (emergencyBufferMonths × monthlyExpenses)
remainingSurplus = monthlySurplus

For each goal (in priority order, top to bottom):
  months = monthsUntil(goal.deadline)
  needed = goal.targetAmount − goal.currentAmount
  liquidHelp = goal.useLiquidSavings ? min(liquidAvail, needed) : 0
  stillNeeded = needed − liquidHelp

  if stillNeeded ≤ 0:
    status = 'realistic', monthlyRecommended = 0

  else if months = 0:
    status = 'blocked', gap = stillNeeded

  else:
    monthlyRecommended = stillNeeded / months

    if monthlyRecommended ≤ remainingSurplus:
      status = 'realistic' (or 'tight' if consuming > 50% of surplus with < 24 months)
      remainingSurplus -= monthlyRecommended

    else:
      gap = monthlyRecommended − remainingSurplus
      status = remainingSurplus > 0 ? 'unrealistic' : 'blocked'
      remainingSurplus = 0
```

### 16.3 Output: `GoalAllocation[]`

Each goal extended with `status`, `monthlyRecommended`, `monthsNeeded`, `gap`.

### 16.4 Status Semantics

| Status | Meaning |
|--------|---------|
| `realistic` | Achievable with current surplus and timeline |
| `tight` | Achievable but consuming most of the surplus |
| `unrealistic` | Partially fundable — surplus covers some but not all |
| `blocked` | No surplus left for this goal (or deadline already passed) |

---

## 17. Internationalisation & RTL

### 17.1 Language Toggle

`data.language: 'en' | 'he'` — persisted in localStorage with all other data. Switching language:
1. Sets `document.documentElement.dir = 'rtl' | 'ltr'`
2. Sets `document.documentElement.lang = 'he' | 'en'`
3. Re-renders all strings through `t(en, he, lang)`

### 17.2 Translation Helper

```typescript
function t(en: string, he: string, lang: 'en' | 'he'): string {
  return lang === 'he' ? he : en
}
```

Every user-visible string uses this — there are no hardcoded English strings in JSX.

### 17.3 Currency Formatting

```typescript
function formatCurrency(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}
```

### 17.4 RTL Layout Rules

- Use `me-*` (margin-end) and `ms-*` (margin-start) instead of `mr-*`/`ml-*`
- Recharts charts are wrapped in `direction: ltr` to prevent axis mirroring
- Icons that imply direction (arrows, chevrons) should be mirrored via CSS transforms in RTL — currently handled by Tailwind's RTL variants
- Dialog text alignment: `sm:text-start` (auto-corrects in RTL)

---

## 18. Persistence & Data Flow

### 18.1 localStorage Keys

| Key | Contents | Size estimate |
|-----|----------|---------------|
| `hf-accounts` | `LocalUser[]` — hashed passwords, display names | < 5 KB |
| `hf-session` | Current user UUID | 36 bytes |
| `hf-data-{userId}` | Full `FinanceData` JSON | 10–100 KB |

### 18.2 Read Path

1. App mounts → `AuthContext` reads `hf-session` → resolves `LocalUser` from `hf-accounts`
2. If user found → `FinanceProvider` mounts with `userId` prop
3. `useState(() => load(userId))` reads `hf-data-{userId}` synchronously on mount
4. App renders with hydrated state — no loading spinner needed

### 18.3 Write Path

Every `setData(updater)` call:
1. Calls `updater(prev)` to get next state
2. Writes to `localStorage` synchronously (< 1 ms for typical payloads)
3. Returns next state to React for re-render

No debounce, no async — writes are synchronous and instant.

### 18.4 User Isolation

`FinanceProvider` receives `key={user.id}` in `App.tsx`. When a different user logs in, React unmounts the old provider and mounts a fresh one — loading the new user's data from their own key. No data leaks between users.

### 18.5 Export / Import

- **Export:** Serialises `FinanceData` to pretty-printed JSON, triggers browser download
- **Import:** Reads uploaded JSON file, merges with `defaultData` (missing keys get defaults), saves immediately

---

## 19. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Single H1 | `<h1 className="sr-only">` always present |
| Heading order | H1 → H3 (CardTitle) — no skipped levels |
| Focus management | Radix Dialog traps focus; returns to trigger on close |
| Focus rings | `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements |
| Toggle labels | Every `<Switch>` paired with `<Label htmlFor>` — full row is clickable |
| Colour signals | Every status uses icon + text + colour (never colour alone) |
| Contrast | Primary teal on white passes WCAG AA; muted text checked at design time |
| Keyboard nav | All interactions reachable via Tab + Enter/Space — no mouse-only actions |
| Screen readers | `aria-hidden` on decorative SVGs; `sr-only` for icon-only buttons (`title` attribute as fallback) |
| Responsive tap targets | All interactive elements ≥ 44×44 px effective area on mobile |

---

## 20. Responsiveness

### Breakpoints (Tailwind defaults)

| Prefix | Min-width | Layout changes |
|--------|-----------|---------------|
| (base) | 0 | Single column, icon-only tabs, full-width dialogs |
| `sm` | 640 px | Tab labels appear, app title in header, user name visible |
| `md` | 768 px | KPI cards go 4-up, charts side-by-side |
| `lg` | 1024 px | Max-width container centred with breathing room |

### Mobile-First Specifics

- Tab bar: `overflow-x-auto` to handle overflow on very small screens
- Dialogs: `mx-4` margin to prevent edge-to-edge on phone
- KPI cards: 2-column grid on mobile
- Source dialog: full scrollable with `max-h-[85vh]`
- Number inputs: `type="number"` with `inputMode="decimal"` on mobile (shows numeric keyboard)
- Tap targets: all buttons ≥ `h-9` (36 px), destructive icon buttons `h-7 w-7` with generous padding area

---

*Document version: 1.0 — reflects app state as of April 2026*
