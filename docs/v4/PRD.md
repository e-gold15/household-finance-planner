# PRD — v4.0 Mobile-First Redesign (Epic)

> **Status:** Approved by the user on 2026-10-03. Decisions: self-host Heebo via @fontsource-variable/heebo; buttons stay ≥44px at all breakpoints.
> **Version:** 4.0-draft, October 2026 · **Owner:** Product
> **Inputs:** [`research.md`](research.md), [`ux-audit.md`](ux-audit.md). Audit IDs (P0-x / P1-x / B-x) are referenced below.

---

## 0. Non-negotiables

1. **Zero data-model changes.**
   - No field may be added, removed or renamed in `FinanceData` or any nested type (`Expense`, `SavingsAccount`, `Goal`, `MonthSnapshot`, `IncomeSource`, …).
   - No new, renamed or removed `hf-*` localStorage keys.
   - No changes to `src/lib/cloudFinance.ts`, `src/lib/localAuth.ts`, `src/lib/contributionEngine.ts`, `supabase/*`, or to any sync, merge, pull, push, realtime, rollover or auto-snapshot logic in `src/context/FinanceContext.tsx`. In practice `FinanceContext.tsx` is **read-only** for v4.0.
   - Every new feature is either **derived** (a pure function of existing data) or **pure UI state** (React state or the URL hash).
   - If persistence is truly unavoidable, use a new `hf-ui-*` key and document it in README. **v4.0 plans none.**
   - New standalone TS types (e.g. `Insight`) and new pure lib files are allowed.
2. **Nothing is removed.** Every existing feature stays reachable, possibly in a new place. Explicitly protected:
   - demo mode
   - PWA install banner and iOS tooltip
   - receipt scan and payslip scan
   - AI briefing and AI plan explanation
   - surplus allocation, including "Don't ask again"
   - history editing (actuals, historical expenses and income, past-month add)
   - invites and household settings
   - month-rollover prompt (`NewMonthPrompt`, `hf-last-seen-month` logic copied verbatim)
   - JSON export and import
   - fund-goal-from-savings and account transfer
3. **Mobile-first.** Design for 375px first, then scale to 1280px. Every screen must work in Hebrew RTL and English, light and dark.
4. **Green builds.**
   - `npm test` and `npm run build` must pass.
   - No existing test may be deleted or weakened.
   - New pure logic ships with unit tests in a new test file.
5. **No new destructive paths.** v4.0 adds no new way to delete data. Existing deletes keep a confirmation, and the confirmation copy now names the item.

**Release gate (Code Review):** `git diff main...HEAD -- src/lib/cloudFinance.ts src/lib/localAuth.ts src/lib/contributionEngine.ts src/context/FinanceContext.tsx supabase/` must be **empty**. Any diff to `src/types/index.ts` must be additions of new standalone types only.

---

## 1. Epic

**Problem:**
- The app is functionally rich but hard to use on a phone. Seven tabs scroll sideways off-screen (B4), dialogs overflow by 16px (P0-4), the Savings page is 462px wide at 375px (P0-6), and iOS zooms on every input (P0-11).
- Brand teal fails WCAG contrast (P0-8).
- Home has 8 competing charts and no single answer to "are we OK this month?"
- Adding an expense takes too many taps, with the amount buried as the 4th field.

**Users affected:**
- **Couple:** both partners check and log on their phones.
- **Freelancer:** needs a quick "what's left" despite irregular income.
- **Expat:** Hebrew/English switching, so RTL correctness is critical.

**Proposed solution:** A mobile-first shell, design system v4, a 3-tap quick add, a redesigned Home built around one headline number, and P0 fixes across all tabs. All of it is derived from existing data.

**Success metrics:**
- **Zero data loss:** for every array field, JSON export lengths are identical before the upgrade and after the first v4 load, for a real household.
- **Quick add:** an expense is saved in **≤3 taps** (amount → category → Save), under 5 seconds, on a 375px phone.
- **No horizontal overflow** on any of the 7 tabs at 375px (`scrollWidth === 375`), in `he` and `en`.
- **Contrast:** every text/background token pair passes WCAG AA (≥4.5:1) in both themes.
- **Lighthouse:** mobile Accessibility ≥95.

---

## 2. Sub-features

### A. Design system v4

**Fonts and numerals**
- **Font: Heebo** (Google Fonts family) for Hebrew and Latin. Self-host it via `@fontsource-variable/heebo`:
  - The existing Workbox `woff2` precache makes it work offline.
  - No third-party request.
  - Fallback if rejected: a Google Fonts `<link>` plus a Workbox CacheFirst rule for `fonts.gstatic.com`.
- `font-variant-numeric: tabular-nums` on all money.

**Tokens (in `index.css`, light/dark, values per ux-audit §6)**
- Keep all existing token names working.
- Add `--primary-strong` (teal **text**), `--primary-subtle`, `--surface-2`.
- Add status triads: `--success|--warning|--danger|--info`, each with `-strong` (text) and `-subtle` (background).
- Add `--chart-1…10` and `--chart-neutral`.
- Re-tune `--primary` / `--primary-foreground` / `--muted-foreground` to pass AA (P0-8, P0-9, P0-10).

**Type scale, radius, motion**
- Type scale per audit §6: `display` 36px down to `caption` 12px. Remove every `text-[10px]`.
- Radius: 8 / 12 / 16 / 24 px.
- Motion: 120 / 200 / 280 ms. Install and register `tailwindcss-animate` (P1-18). Respect `prefers-reduced-motion`.

**Primitive fixes**
- Button: every size is ≥44px tall on every breakpoint (P1-15).
- Input and SelectTrigger: `h-11 text-base sm:text-sm` (P0-11).
- Dialog: fixed width (P0-4). Close button `end-3 top-3 h-11 w-11` with no accent background (P0-5); its localised label comes from the Radix direction.
- Progress: width-based fill anchored at `start` (P0-12).
- Slider: thumb 24px with a 44px hit area.
- Switch: RTL translate (P0-13).
- Select items: `ps/pe/start` (P2-3).
- Badge: `success` uses the token, not emerald.
- Recharts: scope `direction:ltr` to `.recharts-surface` only (B2).

**New primitives** (`src/components/ui/`)
- `Money`: wraps `formatCurrency` (output unchanged) in `<bdi dir="ltr">` with `tabular-nums` and `whitespace-nowrap`. Tones: `neutral | positive | negative | auto`. Sizes: `sm | md | lg | display`.
- `MoneyInput`: `type="text" inputMode="decimal"`, currency adornment on the start side, empty string allowed. It is never forced to `0`.
- Also: `DirIcon`, `Skeleton`, `EmptyState`, `StatusChip`, `ChartTooltip` (`dir="auto"`).

**Category colours and icons:** a fixed map in `src/lib/categories.ts` (P1-9).

**Acceptance criteria**
- [ ] All token pairs listed in the audit pass ≥4.5:1 for text (≥3:1 for large display text), in light and dark. Values are recorded in the PR.
- [ ] `text-warning` and `text-primary` are no longer used for body text in files touched by v4.0.
- [ ] Heebo renders for Hebrew and Latin. The digits `1111` and `0000` render at identical width.
- [ ] No input triggers iOS zoom. All buttons measure ≥44px at 375px.
- [ ] Progress, Slider and Switch fill and move from the start side in RTL.
- [ ] Dialog open/close animates. With reduced motion, only opacity changes.
- [ ] `MoneyInput` can be empty. `parseMoneyInput` handles `""`, `"1,234.5"`, `"₪50"`, `"abc"` and negative input, all unit-tested.

### B. App shell and navigation

**Routing**
- The tab lives in the URL hash: `#/overview | #/income | #/expenses | #/savings | #/goals | #/history | #/members`.
- Changing tabs pushes a history entry, so Back returns to the previous tab.
- An unknown or empty hash falls back to `overview` via `replaceState`.
- The `?inv=` invite handling in `main.tsx` is untouched.
- Scroll resets to the top on tab change.

**Mobile bottom nav (<768px)**
- Fixed at the bottom, 64px plus `env(safe-area-inset-bottom)`.
- Slots: **Home · Expenses · [+] · Goals · More**.
- Labels are always visible (`text-xs`). The active item uses `primary-strong` with an indicator pill and `aria-current="page"`.
- The order mirrors automatically in RTL.
- "+" is a 56px raised primary circle, labelled "Add expense / הוספת הוצאה", and opens Quick Add (D).

**More sheet**
- Rows: Income, Savings, History, Members, Settings. Settings opens the existing settings dialog.
- "More" shows as active when the current tab lives in the sheet.

**Desktop (≥768px)**
- Sticky horizontal nav with all 7 tabs.
- An "Add expense" primary button in the header opens Quick Add as a centred dialog.
- The bottom nav is hidden.

**Header**
- Solid `bg-card`, no transparency (B1). Top safe-area padding.
- Tapping the logo goes to Overview.
- The demo banner uses a solid `--warning-subtle` background with `min-h-10 py-1.5`, a short mobile copy, and a 44px Exit button.

**Global UI**
- `NavContext` (UI state only) exposes `{ tab, navigate, openQuickAdd, openSettings }`.
- Radix `DirectionProvider` wraps the app.
- `index.html`: `viewport-fit=cover` and a dark `theme-color`.
- Toaster: gets `dir`, `theme` and `richColors`. Position is `top-center` below 768px and `bottom-right` at 768px and up. The SW update toast is localised.
- The full-screen spinner is replaced by an `AppSkeleton` driven by the same `isLoading` condition (P1-19).
- The PWA banner and iOS tooltip sit above the bottom nav.

**Acceptance criteria**
- [ ] Every tab is reachable at 375px with no horizontal scroll, and every tab is reachable on desktop.
- [ ] Deep link `…/#/history` opens History, including after login. Back/forward moves between tabs.
- [ ] Invite links (`?inv=`) still work end to end.
- [ ] The bottom nav never covers content (main has bottom padding) and respects the iPhone home indicator in standalone mode.
- [ ] Content no longer shows through the header or the demo banner. Demo mode can be entered and exited.
- [ ] Toasts follow RTL and dark mode, and never cover the "+" button.
- [ ] `NewMonthPrompt` behaves exactly as in v3.x.

### C. Responsive sheets

**Behaviour**
- `DialogContent` renders as a **bottom sheet below 640px**:
  - `inset-x-0 bottom-0 rounded-t-[24px] max-h-[90dvh] overflow-y-auto pb-[safe-area]`
  - a drag handle; dragging it down more than 80px dismisses
  - a slide-up animation
- At 640px and up it renders as a centred dialog, `w-[calc(100%-2rem)] max-w-lg`.
- `DialogFooter` is sticky at the bottom inside sheets.
- `AlertDialog` (destructive confirmations) stays centred at every size.
- The public API is backward compatible. An optional `variant?: 'auto' | 'center'` defaults to `auto`.

**Acceptance criteria**
- [ ] Every add/edit form opens as a sheet at 375px and as a dialog at 1280px. This covers expense, income source, account, goal, transfer, fund-goal, historical items, actuals and surplus allocation.
- [ ] Save is visible without scrolling, or is sticky.
- [ ] The sheet stays usable with the iOS keyboard open.
- [ ] Esc, overlay tap, drag handle and the close X all dismiss. Focus is trapped and then restored.

### D. Quick Add

**Opening:** "+" (mobile) or the header button (desktop) opens the sheet.

**Fields, in order**
1. **Amount:** a `MoneyInput` at `display` size, autofocused, with the numeric keypad.
2. **Category chips:** all 12 categories with icons. The categories of the 3 most recently created expenses (by `createdAt`) come first, de-duplicated, then the rest in `EXPENSE_CATEGORIES` order. This is a pure helper, `rankQuickAddCategories`. No chip is preselected.
3. **Name:** optional. If blank, it defaults to the localised category label.
4. **When:** "This month" (default), or "Earlier month…", which reveals the existing month/year picker (past months only, last 3 years).

**Saving**
- **This month:** `addExpense({ name, amount, category, recurring: true, period: 'monthly', expenseType: 'variable', createdAt })`. These are the same defaults as today's `ExpenseDialog`.
- **Earlier month:** `addExpenseToMonth(year, month, { name, amount, category })`.
- On success, a toast reads "₪X added to Food" and the sheet closes. **No undo**, because `addExpense` returns no id and context changes are out of scope.

**Other actions**
- **More details** opens the full `ExpenseDialog` prefilled with amount, category and name. Linked account, fixed/yearly and due month are set there.
- **Scan receipt** icon (only when `aiEnabled`) reuses `scanReceipt` and fills amount, name and category.

**Expenses tab:** the per-tab floating button is removed; desktop keeps a toolbar "Add expense" button.

**Acceptance criteria**
- [ ] Amount → chip → Save adds a variable expense for the current month in 3 taps. It appears on the Expenses tab and syncs as today.
- [ ] Save is disabled until amount > 0 and a category is chosen. Invalid input shows an inline error and is never saved as 0.
- [ ] A past-month entry lands in the right snapshot, creating a stub if needed, with identical results to v3.x.
- [ ] Receipt scan works from the sheet. Without an API key the icon is absent.
- [ ] Works in RTL (adornment on the start side, chips mirror), in dark mode and at 375px.

### E. Home (Overview) redesign

**Hero — "Left to spend this month / נשאר להוציא החודש."** A pure function, `computeMonthlyPlan(data, today)` in `src/lib/insights.ts`:

```
monthly(e)     = e.period === 'yearly' ? e.amount / 12 : e.amount
income         = Σ getNetMonthly(src) over all members' sources     (same as today's KPI; no FX)
fixed          = Σ monthly(e) where (e.expenseType ?? 'fixed') === 'fixed'   (yearly = sinking-fund provision)
variableSpent  = Σ monthly(e) where e.expenseType === 'variable'     (live list = this month; rollover clears it)
savingsContrib = Σ a.monthlyContribution where a is NOT linked by a savings expense AND NOT deductedFromSalary
spendable      = income − fixed − savingsContrib
leftToSpend    = spendable − variableSpent        // ≡ existing Overview freeCashFlow (unit-tested equality)
daysInMonth, dayOfMonth from `today` (local time)
daysLeft       = daysInMonth − dayOfMonth + 1      (includes today)
elapsedPct     = (dayOfMonth − 1) / daysInMonth × 100
spentPct       = spendable > 0 ? variableSpent / spendable × 100 : null
dailyAllowance = leftToSpend > 0 ? leftToSpend / daysLeft : 0
status = income ≤ 0              → 'no-income'
       | leftToSpend < 0 or spendable ≤ 0 → 'over'
       | spentPct > elapsedPct + 10       → 'ahead'
       | otherwise                        → 'on-track'
```

**Display rules**
- Values are computed unrounded and displayed rounded via `Money`.
- The hero shows `leftToSpend` at `display` size with "N days left · ₪Y/day".
- **Pace bar:** the fill is `spentPct` (capped at 100), with a "today" marker at `elapsedPct`. The sentence reads "You've spent 62%, 40% of the month left".
- Tapping the hero expands the breakdown: income − fixed − savings − variable = left.

**Edge cases**
- `no-income`: an empty state with the CTA "Add income" (→ `#/income`). The pace bar is hidden.
- `spendable ≤ 0`: "Fixed costs and savings exceed income by ₪X", shown in danger. The pace bar is hidden.
- `leftToSpend < 0`: "₪X over" in danger, with a full red bar.
- `isLoading`: skeleton.
- Demo mode: computed normally.

**Insight cards** (up to 3, from `buildInsights(data, plan, today)`, sorted by priority)

| # | id | Condition | Tone | CTA |
|---|---|---|---|---|
| 1 | `deficit` | status `over` | danger | Review expenses → `#/expenses` |
| 2 | `surplus` | `findActionableSurplus(history, today)` is non-null and goals or accounts exist. This is the exact rule currently in `SurplusBanner`. | success | "Allocate ₪X" opens the existing allocation flow in a sheet, keeping "Don't ask again" (`markSurplusActioned` / `recordSurplusAllocation`) |
| 3 | `over-budget` | Some category has spent > budget > 0. Spent uses the same definition as Budget Health: all expenses, monthly, by category. | warning | See budgets → `#/expenses` |
| 4 | `bill-due` | A yearly expense with `dueMonth` equal to the current or next month | info | View → `#/expenses` |
| 5 | `pace-ahead` | status `ahead` | warning | See spending → `#/expenses` |
| 6 | `briefing` | The latest non-stub snapshot has an `aiBriefing` | neutral, with score chip | Read → expands the briefing section |

**Card behaviour**
- Each card shows an icon, text and tone.
- X dismisses for the session only (React state). The surplus "Don't ask again" keeps its existing persistence.
- The standalone deficit banner and the top-of-page SurplusBanner are folded into these cards.

**Layout below the cards**
- A compact 3-up KPI row (Income · Expenses · Assets) at `text-lg`. Values are neutral; colour appears only on the existing MoM delta chip (B5).
- Upcoming annual bills.
- Expense breakdown: a donut with the total in the centre, plus a legend list (dot · category · amount · %, sorted descending; slices under 4% grouped as "Other" when there are more than 6). Stable colours per category. No outside labels (B2).
- A collapsible **"More charts"** section, collapsed below 768px and expanded at 768px and up (UI state only). It holds:
  - Budget Health donut (B3 fixes: fixed size, no zero placeholders, visible "none" slice, centre label)
  - Goal donut
  - 12-month savings forecast
  - the full Monthly Briefing card, with generate available as today

**First run:** with no income and no expenses, an onboarding checklist (add income → add an expense → set a goal) replaces the hero. Each step's done state is derived.

**Acceptance criteria**
- [ ] `leftToSpend` equals the legacy FCF formula on demo data and on 10 or more fixtures (unit test).
- [ ] All edge cases above have unit tests, with `today` injected (no `Date.now()`).
- [ ] At most 3 insight cards are shown, in priority order. `deficit` and `pace-ahead` never co-occur.
- [ ] Surplus allocation, briefing generation, forecast, goal donut and budget health are all still reachable from Home.
- [ ] No chart label is clipped at 375px. Charts animate only on first mount, not on resize.
- [ ] Money uses `Money` with tabular numerals. RTL bidi is correct (no "חודש/₪").

### F. P0/P1 fixes across tabs, empty states, skeletons

**Savings:** P0-6.
- Two-line `AccountCard` (name + balance, then wrapping badges).
- Transfer, Edit and Delete move into a ⋯ `ActionMenu`.
- `%/yr` and `/mo` go through i18n (P1-10).
- The last-month progress row is kept.

**Goals:** P0-7.
- Below 640px, the allocation table becomes a stacked card list (goal · status chip · needed/allocated · progress). The table stays at 640px and up.
- The Slider uses the RTL fix.
- Fund-goal and AI explain are kept.

**History:** P1-2.
- Snapshots render as collapsed month rows (month · FCF chip · chevron). The newest is expanded; the newest 6 are listed, with "Show older (N)".
- Every existing per-snapshot action sits inside the expanded body.

**Expenses**
- Month navigation uses `DirIcon` at 44px (P1-4).
- "Clear variable" moves into a ⋯ menu, keeping its AlertDialog (P1-3).
- Totals are neutral (P1-8). Rows become `ListRow` with ⋯ (Edit/Delete).
- The keyboard-operable collapsible header is fixed (P1-21).
- Hebrew "Due this month" becomes "לתשלום החודש!" (P1-12). The "Accounts tab" copy is corrected (P2-11).

**Income**
- Flatten the card-in-card layout: the member becomes a section header and sources become rows (P1-17).
- Money is bidi-safe (P1-11), the Gross→Net arrow is mirrored, and units are localised.
- Payslip scan is kept.

**Members:** `EmptyState` and `Money`/`StatusChip` consistency.

**AuthPage:** a language toggle (React state, defaulting from `navigator.language`), a focusable 44px password eye button, and a single "or" divider (P1-5). Demo entry is kept.

**Everywhere:** surplus banner directional icons (P1-4), shared `EmptyState` with a CTA (P2-2), skeletons, and briefing emoji replaced by lucide icons (P2-5).

**Acceptance criteria:** every P0 item P0-1…P0-13 verified fixed at 375px in Hebrew. Each tab passes the QA checklist in §5.

### G. Component consolidation (only where it serves A–F)

- `ConfirmDelete` names the item ("Delete 'Rent'?") and replaces single-item delete AlertDialogs in touched files (P1-16).
- `SegmentedControl` (radiogroup, ≥44px) replaces the When? / Fixed-Variable / view toggles.
- `ListRow` (leading icon or strip · title · meta · trailing `Money` · ⋯ `ActionMenu`) is used for Expenses, Savings, Income sources and History items.

**Acceptance criteria:** the components are keyboard-accessible, work in RTL and dark mode, and have no `any`. Delete confirmations name the item.

---

## 3. Out of scope (v4.1+)

- `owner` mine/partner/shared attribution and its filter. It needs a data field, so it requires a separate spec under the Data Safety Protocol.
- A persisted health score or streaks.
- Bank or CSV import (Caspion).
- Multi-currency or FX in the hero (today's totals ignore FX; this known limitation is unchanged).
- Swipe row actions and pull-to-refresh (that needs a new re-pull context method, and sync is frozen).
- Quick-add undo, which needs `addExpense` to return an id.
- Per-category pace on Expenses.
- Push notifications.
- Folding Members into HouseholdSettings (P1-1).
- A desktop side rail and the hero count-up animation.
- A Playwright visual-regression CI job (recommended for v4.1).
- Fixing Google Sign-In on the custom domain (separate track).

---

## 4. Implementation waves and file ownership

**Rule:** a file has exactly one owner per wave. Files owned in Wave 1 are **frozen** in Wave 2. A primitive bug found in Wave 2 goes to the lead, and one Wave 1 owner fixes it. **Always read-only:** `FinanceContext.tsx`, `AuthContext.tsx`, `cloudFinance.ts`, `cloudInvites.ts`, `localAuth.ts`, `contributionEngine.ts`, `taxEstimation.ts`, `savingsEngine.ts`, `aiAdvisor.ts`, `supabase/*`, `vite.config.ts`, and all existing `src/test/*.test.ts` files.

### Wave 1 — Foundation (parallel)

| Workstream | Owner | Files (exclusive) |
|---|---|---|
| **1A Design system and primitives** | UX | `src/index.css`, `tailwind.config.js`, `package.json`/lockfile (adds `tailwindcss-animate`, `@radix-ui/react-direction`, `@radix-ui/react-dropdown-menu`, `@fontsource-variable/heebo`), `src/components/ui/{button,input,select,dialog,alert-dialog,progress,slider,switch,badge,card}.tsx`, new `src/components/ui/{money,money-input,segmented-control,list-row,action-menu,empty-state,skeleton,status-chip,dir-icon,chart-tooltip,confirm-delete}.tsx`, new `src/lib/moneyInput.ts`, `src/lib/categories.ts` (colour and icon map), new `src/test/moneyInput.test.ts` |
| **1B Shell and navigation** | Frontend | `src/App.tsx`, `src/components/Header.tsx`, `index.html`, `src/components/PWAInstallBanner.tsx`, `src/components/IOSInstallTooltip.tsx`, new `src/context/NavContext.tsx`, new `src/lib/navigation.ts` (`parseHash`/`tabToHash`), new `src/hooks/useHashTab.ts`, new `src/hooks/useMediaQuery.ts`, new `src/components/shell/{BottomNav,DesktopNav,MoreSheet,AppSkeleton}.tsx`, new `src/components/quick-add/QuickAddSheet.tsx` (**stub only**: exports `QuickAddSheet({ open, onOpenChange })`), new `src/test/navigation.test.ts` |

1B builds against the existing primitive APIs, which 1A keeps backward compatible. Merge 1A first, then 1B.

### Wave 2 — Features (parallel, after Wave 1 is merged)

| Workstream | Owner | Files (exclusive) |
|---|---|---|
| **2A Home and insights** | Frontend + UX | `src/components/Overview.tsx`, `src/components/SurplusBanner.tsx`, `src/types/index.ts` (new standalone types `MonthlyPlan`, `PaceStatus`, `Insight` only), new `src/lib/insights.ts`, new `src/components/home/{HeroCard,PaceBar,InsightCards,OnboardingChecklist,ExpenseDonut}.tsx`, new `src/test/insights.test.ts` |
| **2B Expenses and Quick Add** | Frontend + UX | `src/components/Expenses.tsx`, new `src/components/expenses/ExpenseDialog.tsx` (extracted, with an added `initial?: Partial<Expense>` prop), `src/components/quick-add/QuickAddSheet.tsx` (full implementation), new `src/lib/quickAdd.ts`, new `src/test/quickAdd.test.ts` |
| **2C Other tabs** | Frontend + UX (may split into 2C-i: Income and AuthPage; 2C-ii: Savings, Goals, History, Members) | `src/components/Income.tsx`, `src/components/Savings.tsx`, `src/components/Goals.tsx`, `src/components/History.tsx`, `src/components/Members.tsx`, `src/pages/AuthPage.tsx` |

### Wave 3 — Verification

| Workstream | Owner | Files |
|---|---|---|
| **3A Tests** | QA | New test files only. One is `src/test/v4DataFreeze.test.ts`, which asserts:<br>• the `FinanceData` key set of `DEMO_FINANCE_DATA` equals the v3.x list<br>• `mergeFinanceData` output is unchanged for fixed fixtures<br>• `computeMonthlyPlan` ≡ legacy FCF |
| **3B Code review** | Code Reviewer | No files. Checks the release gate (§0), the CLAUDE.md checklist, i18n, no `any`, and `npm test` + `npm run build` |
| **3C Manual mobile QA** | QA + UX | Runs §5 on a Vercel preview |
| **3D Docs** | Product | `README.md`, `PRODUCT_DESIGN.md`, `DOCUMENTATION.md`, `docs/**` |

---

## 5. Manual QA checklist

Run each item in 4 configurations at **375×812** (Hebrew light, Hebrew dark, English light, English dark), then once at **1280×800** in Hebrew and English.

**Data safety (run first, on a copy of a real household)**
- [ ] Before deploying: Export JSON and record the array lengths of `members`, `expenses`, `accounts`, `goals`, `history` and `categoryBudgets` keys.
- [ ] After the first v4 load: export again. Every length is identical and every value is unchanged.
- [ ] Two devices: add an expense via Quick Add on A; it appears on B. Nothing disappears on either device.

**Shell**
- [ ] No horizontal scroll on any tab (`document.documentElement.scrollWidth === innerWidth`).
- [ ] The bottom nav switches tabs, "+" opens Quick Add, and More opens the sheet with all 5 entries.
- [ ] The Back button walks the tab history. A `#/goals` deep link works.
- [ ] Desktop shows all 7 tabs and the header "Add expense" button. No bottom nav.
- [ ] Header and demo banner are opaque while scrolling. Exit Demo works.
- [ ] An invite link opened in incognito → accept → joined. Banner shown.
- [ ] PWA standalone on iPhone: the nav clears the home indicator. Install banner and iOS tooltip don't overlap the nav.

**Forms**
- [ ] Every add/edit opens as a bottom sheet on mobile and a centred dialog on desktop.
- [ ] The close X sits at the inline end and does not overlap the title.
- [ ] No iOS zoom on focus. A numeric keypad appears for amounts. Fields can be emptied.
- [ ] Delete confirmations name the item.

**Quick Add**
- [ ] 3-tap add. Past-month add. "More details" opens a prefilled full form. Receipt scan works.

**Home**
- [ ] The hero value matches Income − Expenses − contributions on the Expenses and Income tabs.
- [ ] Pace marker position is correct for today's date.
- [ ] Insight cards: at most 3, and each CTA navigates correctly. Surplus allocate and "Don't ask again" work.
- [ ] Donut legend: no clipping. "More charts" toggles. Briefing can be generated and read.
- [ ] Fresh account shows the onboarding checklist.

**Tabs**
- [ ] Savings: no overflow; ⋯ menu offers Transfer, Edit and Delete.
- [ ] Goals: card list on mobile; slider runs from the start side in RTL.
- [ ] History: rows are collapsible; "Show older" works; all edit actions inside still work.
- [ ] Income: payslip scan, gross→net, past-month income.
- [ ] Expenses: month nav arrows point the right way in RTL; "Clear variable" sits in ⋯ and still asks for confirmation.

**Accessibility**
- [ ] Every tap target is ≥44px and has a visible focus ring.
- [ ] Status is never conveyed by colour alone.
- [ ] Switch, Progress and Select are correct in RTL.
- [ ] Toasts follow RTL and dark mode.
