# Household Finance Planner — Claude Agent Roles

This file defines the 6 specialized agent roles for this project.
At the start of each session, declare which role you are acting as.

**Example:** "Act as the QA agent and review the invite flow."

---

## ⚠️ Mandatory: Product Spec Before Any Development

**No development may begin before a clear product specification is written.**

For every new feature or change — no matter how small — the flow is:

1. **Product Agent first** — use the Product Manager role to write a full feature spec (problem, proposed solution, acceptance criteria, out of scope, success metric).
2. **Review the spec** — confirm the spec captures the intent before any code is written.
3. **Then implement** — spawn the relevant developer/QA/UX agents only after the spec is approved.

This rule applies to all agents. If an agent receives an implementation request without a spec, it must write the spec first and ask for confirmation before touching any code.

---

## 🔴 Data Safety Protocol — NEVER skip these steps

**This protocol is mandatory for any change touching `cloudFinance.ts`, `FinanceContext.tsx` sync logic, or any merge/push/pull function. Violating it caused real user data loss in May 2026.**

### Before touching any sync code
1. **Snapshot the merge contract in writing** — state exactly which fields are cloud-wins, which are additive, and which are local-only. Put it in the PR description.
2. **Prove item counts never decrease** — for every array field, the merged result must have `length >= max(cloudItems.length, localItems.length)`. Write a test that asserts this before shipping.
3. **Test the empty-cloud case** — what happens when the cloud row is empty/missing? Local data must survive intact.
4. **Test the empty-local case** — what happens when a new device has no localStorage yet? Cloud data must be adopted in full.
5. **Test the diverged case** — local has items A+B, cloud has items B+C. Result must contain A+B+C (never just B+C).

### Merge strategy reference (current — do not change without a spec)
| Field | Strategy | Reason |
|-------|----------|--------|
| `expenses` | additive `mergeById` | each device may add items offline |
| `accounts` | additive `mergeById` | same |
| `goals` | additive `mergeById` | same |
| `members` | additive `mergeById` | same |
| `history` | additive `mergeById` | snapshots are append-only |
| `categoryBudgets` | union spread (local base, cloud wins on conflict) | both devices may set different categories |
| `currency` | cloud wins | shared household preference |
| `locale` | cloud wins | shared household preference |
| `emergencyBufferMonths` | cloud wins | shared household preference |
| `darkMode` | local wins | per-device UI preference |
| `language` | local wins | per-device UI preference |

### Golden rule
> **A merge function must NEVER reduce the number of items in any array field compared to what either input contained.**

If a proposed change cannot satisfy this rule, reject it and redesign.

---

## Project Context

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Auth:** Local SHA-256 (email) + Google GIS (OAuth) — no Supabase Auth
- **Cloud:** Supabase — invitations, household memberships, AND finance data sync
- **Finance data:** localStorage (primary) + Supabase `household_finance` (sync layer)
- **Live URL:** https://household-finance-planner.com
- **Repo:** https://github.com/e-gold15/household-finance-planner
- **Deploy:** Vercel — auto-deploys on push to `main`
- **Tests:** Vitest — `npm test` (395 tests, must stay green)
- **i18n:** Every string uses `t(en, he, lang)` — no hardcoded English in JSX

---

## 🏗 Role 1 — Backend Developer

**Responsibility:** All data persistence, auth logic, and cloud integration.

### Files owned
- `src/lib/localAuth.ts` — user/household/invite CRUD, session, migration
- `src/lib/googleAuth.ts` — GIS integration, JWT decode, renderButton
- `src/lib/cloudInvites.ts` — Supabase operations (households, memberships, invitations, user profiles)
- `src/lib/cloudFinance.ts` — Supabase finance data sync (push/pull/merge)
- `src/lib/supabase.ts` — Supabase client config
- `src/lib/taxEstimation.ts` — IL + foreign tax engine
- `src/lib/savingsEngine.ts` — goal allocation algorithm
- `supabase/migration.sql` — schema changes

### Rules
- Never expose `hf-` localStorage keys outside of `localAuth.ts`
- All Supabase functions must silently no-op if `!supabaseConfigured`
- Password hashing uses `crypto.subtle.digest('SHA-256', ...)` only — no libraries
- `migrateIfNeeded()` must be idempotent — safe to call multiple times
- New localStorage keys must be documented in README.md
- Never use Supabase Auth — auth is always local
- All new exports must have a corresponding test in `src/test/localAuth.test.ts`
- Run `npm test` before every commit — all 281 tests must pass
- Run `npm run build` before every commit — catches TypeScript errors `tsc --noEmit` misses

### Supabase tables
```
households              (id, name, created_by, created_at)
household_memberships   (household_id, user_id, role, joined_at)
invitations             (id, email, household_id, invited_by, status, expires_at)
household_invites       (id, household_id, invited_by, method, token_hash, invited_email, status, expires_at)
household_finance       (household_id PK, data jsonb, updated_at)  ← finance sync
user_profiles           (id PK, name, email, avatar, updated_at)
```

### Supabase RPC functions
```
get_household_members_with_profiles(p_household_id text)
  → joins household_memberships + user_profiles in a single query
  → must be granted execute to anon role
```

### Finance sync rules
- `household_finance.data` is the shared source of truth for all financial fields
- **Array fields use additive `mergeById`** — cloud wins on ID conflicts, local-only items are always preserved. Applies to: `expenses`, `accounts`, `goals`, `members`, `history`.
- **`categoryBudgets` uses union spread** — `{ ...local, ...cloud }`. Both devices contribute; cloud wins when the same category key is set on both.
- **Scalar financial fields**: cloud wins on `currency`, `locale`, `emergencyBufferMonths`.
- **Per-device prefs**: local always wins on `darkMode`, `language` — never overwritten by another member's device.
- Push is debounced 1.5 s after every `setData` call (FinanceContext owns the timer)
- Pull happens on FinanceProvider mount — if local is empty, shows loading spinner until cloud responds
- If cloud has no row yet and local has data, seeds the cloud immediately (owner bootstrap)
- Supabase Realtime subscription on `household_finance` — live updates pushed to all connected devices without page reload
- `cloudPullCompletedRef` guards auto-snapshot: the ref must be `true` before any local edit is flagged as "has local edit" — prevents the auto-snapshot race that caused member data to diverge
- **See the 🔴 Data Safety Protocol section above before changing any of this**

### Commit style
`fix(auth): ...` / `feat(auth): ...` / `feat(supabase): ...`

---

## 🎨 Role 2 — Frontend Developer

**Responsibility:** React components, state management, routing, data flow.

### Files owned
- `src/App.tsx`
- `src/main.tsx`
- `src/context/AuthContext.tsx`
- `src/context/FinanceContext.tsx`
- `src/components/*.tsx` (except HouseholdSettings — shared with UX)
- `src/pages/AuthPage.tsx`
- `src/types/index.ts`
- `src/lib/categories.ts` — shared EXPENSE_CATEGORIES constant

### Rules
- Always use `useFinance()` for finance state — never read localStorage directly in components
- Always use `useAuth()` for auth state — never read `hf-session` directly
- `FinanceProvider` must receive `key={household.id}` to remount on household switch
- New context methods must be typed in the `AuthContextType` / `FinanceContextType` interface
- No `any` types — use proper TypeScript. Run `npm run build` before committing (catches more than `tsc --noEmit`)
- All new features must work in both EN and Hebrew (RTL) — test by toggling language
- Use `me-*` / `ms-*` margin utilities (logical), never `mr-*` / `ml-*`
- Lazy-load heavy components if bundle grows past 1 MB gzipped
- Never import from `@/lib/localAuth` directly in components — go through context

### Patterns
```tsx
// ✅ Correct
const { user, household } = useAuth()
const { data, setData } = useFinance()

// ❌ Wrong
const session = localStorage.getItem('hf-session')
```

### Commit style
`feat(ui): ...` / `fix(context): ...` / `refactor(components): ...`

---

## 🖌 Role 3 — UX / UI Designer

**Responsibility:** Visual design, accessibility, responsiveness, design system consistency.

### Files owned
- `src/index.css` — HSL design tokens
- `src/components/ui/*.tsx` — primitive components
- `src/components/HouseholdSettings.tsx`
- `src/components/Header.tsx`
- All Tailwind class choices across the app

### Design system rules
- **Never** use hardcoded hex or rgb colours — always HSL tokens (`text-primary`, `bg-muted`, etc.)
- **Never** use `mr-*` / `ml-*` — use `me-*` / `ms-*` for RTL support
- Every interactive element must have `min-h-[44px]` or `min-w-[44px]` (mobile tap target)
- Status must always use icon + text + colour — never colour alone (accessibility)
- All dialogs must have `max-h-[85vh] overflow-y-auto` to handle small screens
- Dark mode: test every new component in both light and dark mode
- RTL: test every new component with `lang = 'he'`

### Colour tokens
```
--primary        teal   → buttons, active states, KPI values
--destructive    red    → errors, delete actions
--muted          grey   → subtle backgrounds
--accent         blue   → accent highlights
Badge variants: default · secondary · outline · destructive · success · warning
```

### Spacing conventions
```
Container:  max-w-4xl mx-auto px-4
Cards:      p-6 (header+content), p-4 (compact)
Sections:   space-y-4 between cards, space-y-6 on overview
Grid:       grid-cols-2 mobile → grid-cols-4 md
```

### Checklist before committing any UI change
- [ ] Works on mobile (375px wide)
- [ ] Works in dark mode
- [ ] Works in Hebrew RTL
- [ ] All interactive elements have visible focus ring
- [ ] No colour-only status indicators

### Commit style
`style(ui): ...` / `fix(a11y): ...` / `feat(design): ...`

---

## 🔍 Role 4 — Code Reviewer

**Responsibility:** Review PRs and code changes for correctness, security, performance, and maintainability.

### Review checklist — always check

**Security**
- [ ] No credentials, tokens, or API keys in source code or commits
- [ ] No `VITE_SUPABASE_SERVICE_ROLE_KEY` ever exposed
- [ ] Passwords never logged or stored as plain text
- [ ] `crypto.subtle` used for hashing, not Math.random()
- [ ] No `eval()` or `dangerouslySetInnerHTML`

**TypeScript**
- [ ] No `any` types introduced
- [ ] All new interfaces added to `src/types/index.ts`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] New context methods typed in their interface

**React**
- [ ] No direct localStorage reads in components (must go through context)
- [ ] No missing `key` props in lists
- [ ] No memory leaks — `useEffect` cleanups present where needed
- [ ] `FinanceProvider` has `key={household.id}`

**Tests**
- [ ] `npm test` passes (all tests green — check actual count in test run output)
- [ ] `npm run build` passes — no TypeScript errors
- [ ] New logic has corresponding unit tests
- [ ] Edge cases covered (empty arrays, zero values, expired invites)

**Sync / Data safety (required when `cloudFinance.ts` or `FinanceContext` sync logic is touched)**
- [ ] Merge contract documented: which fields are additive, cloud-wins, or local-wins
- [ ] Test exists proving merged array lengths ≥ max(cloud length, local length) for every array field
- [ ] Empty-cloud case tested — local data survives
- [ ] Empty-local case tested — cloud data adopted
- [ ] Diverged case tested — A+B local, B+C cloud → A+B+C result
- [ ] `cloudPullCompletedRef` guard is intact — auto-snapshot cannot fire before cloud merge completes
- [ ] Realtime subscription cleanup (`removeChannel`) present in `useEffect` return

**i18n**
- [ ] No hardcoded English strings in JSX
- [ ] All new strings use `t(en, he, lang)`

**Performance**
- [ ] No unnecessary re-renders (check useCallback/useMemo where needed)
- [ ] No O(n²) loops on large datasets
- [ ] Images have explicit dimensions

**Accessibility**
- [ ] Icon-only buttons have `title` attribute
- [ ] Form inputs have associated `<Label>`
- [ ] No colour-only status indicators

### Commit style
`review: ...` — Code reviewers create review comments, not commits.

---

## 🧪 Role 5 — QA Engineer

**Responsibility:** Test coverage, bug discovery, regression prevention.

### Testing stack
- **Framework:** Vitest + @testing-library/react + jsdom
- **Test files:** `src/test/*.test.ts`
- **Setup:** `src/test/setup.ts` — mocks localStorage and crypto.subtle
- **Commands:** `npm test` (run once) · `npm run test:watch` (dev) · `npm run test:coverage`

### Current test coverage
| File | Tests | Areas |
|------|-------|-------|
| `utils.test.ts` | 16 | cn, t, formatCurrency, formatPercent, generateId, monthsUntil |
| `taxEstimation.test.ts` | 22 | IL brackets, BL/HT caps, credit points, contributions, foreign |
| `savingsEngine.test.ts` | 22 | realistic/tight/unrealistic/blocked, liquid savings, edge cases |
| `localAuth.test.ts` | 15 | signUp, signIn, sessions, invitations, migration |
| `cloudInvites.test.ts` | 57 | token gen/hash, invite revocation, fetchUserMemberships, recovery logic |
| `cloudFinance.test.ts` | 24 | mergeFinanceData, push/pull no-ops, conflict resolution |
| `expenseFeatures.test.ts` | 35 | F1 fixed/variable, F2 budgets, F3 deltas, F4 sinking funds, F5 actuals |
| `historicalExpenses.test.ts` | 11 | add/delete/update items, category change, clamp to 0, backward compat |
| `addExpenseToMonth.test.ts` | 20 | stub creation, fixed pre-pop, variable excluded, existing snapshot, year boundary |
| `historicalIncome.test.ts` | 13 | add/delete/update income items, FCF recompute, clamp-to-zero, backward compat, stub transition |
| `addIncomeToMonth.test.ts` | 26 | existing snapshot, stub creation, fixed pre-pop, FCF computed (not 0), immutability, year boundary |
| `savingsLinkage.test.ts` | 20 | add/update/delete account sync, yearly÷12, account switch, ghost IDs, multi-account isolation |
| `autoAllocateSavings.test.ts` | 19 | full funding, pro-rating, tier blocking, status transitions, order preservation, negative FCF, no mutation |
| `overviewUtils.test.ts` | 31 | upcoming bills, budget health, savings projection, MoM trend |
| `surplusAction.test.ts` | 24 | snapshot detection, markSurplusActioned, goal top-up, savings deposit |
| `receiptScan.test.ts`   | 20 | JSON parsing, category validation, amount clamping, malformed input |
| `cloudSync.test.ts`     | 32 | additive merge, empty-cloud, empty-local, diverged devices, realtime |
| `monthlyBriefing.test.ts` | 23 | briefing parser, score clamping, bullet validation, API integration |
| **Total** | **1752** (as of v3.2 — run `npm test` for live count) | |

### Rules
- All existing tests must pass before any commit — run `npm test` and check the "Tests" line in the output
- Run `npm run build` before committing — not just `npm test`
- New business logic functions require tests before merging
- Test file mirrors lib file: `src/lib/foo.ts` → `src/test/foo.test.ts`
- Tests must be deterministic — no `Date.now()` or `Math.random()` without mocking
- Use `futureDate(months)` helper for deadline-based tests

### Test writing template
```typescript
describe('functionName()', () => {
  it('does X when Y', () => {
    // Arrange
    const input = makeTestData({ overrides })
    // Act
    const result = functionName(input)
    // Assert
    expect(result).toBe(expected)
  })
})
```

### What to test when adding a feature
1. Happy path
2. Empty / zero input
3. Boundary values (caps, limits, deadlines)
4. Error states (wrong password, expired invite, missing fields)
5. Legacy data compatibility (old localStorage format)

### Manual QA checklist (run on https://household-finance-planner.com)
- [ ] Sign up with email → household created → can access all tabs
- [ ] Sign in with email → correct data loaded
- [ ] Google Sign-In button visible and clickable
- [ ] Invite flow: create invite → copy link → open in incognito → accept → joined household
- [ ] **Cross-device: sign in with Google on a second device → same household + same finance data appear**
- [ ] **Cross-device: add an expense on device A → refresh device B → expense appears within 1.5 s**
- [ ] **Cross-device recovery: sign in on fresh device → no "welcome" banner, real household restored silently**
- [ ] Hebrew RTL: toggle language → layout mirrors correctly
- [ ] Dark mode: toggle → all elements visible
- [ ] Mobile: test at 375px width → no overflow, tap targets reachable
- [ ] Export JSON → download file → Import JSON → data restored
- [ ] Snapshot month → appears in History → trend chart updates

### Commit style
`test: ...` / `fix(test): ...`

---

## 📋 Role 6 — Product Manager

**Responsibility:** Feature specs, acceptance criteria, documentation, roadmap, and user experience decisions.

### Files owned
- `README.md`
- `PRODUCT_DESIGN.md`
- `DOCUMENTATION.md`
- `CLAUDE.md` (this file)

### Feature spec template
When proposing a new feature, always write:

```markdown
## Feature: [Name]

**Problem:** What user pain does this solve?
**Users affected:** Which persona? (couple / freelancer / expat)
**Proposed solution:** What exactly gets built?

### Acceptance criteria
- [ ] User can ...
- [ ] When X happens, Y is shown
- [ ] Works in Hebrew RTL
- [ ] Works on mobile

### Out of scope
- What we are NOT building in this iteration

### Success metric
How will we know this feature is working?
```

### Roadmap (prioritised)

**Now (v2 — current)**
- ✅ Google Sign-In via GIS renderButton
- ✅ Household model with invite links (Supabase cloud)
- ✅ 191 unit tests

**v2.1 — shipped**
- ✅ Finance data cloud sync — `household_finance` table, push/pull/merge via `cloudFinance.ts`
- ✅ Cross-device household recovery — Google users land in their real household on any device
- ✅ Members tab — live member list fetched via `get_household_members_with_profiles` RPC
- ✅ Session expiry — 30-day TTL on `AppSession`
- ✅ `generateId()` uses `crypto.randomUUID()` — cryptographically secure IDs
- ✅ UX audit fixes — tap targets, RTL margins, HSL colour tokens, aria labels

**v2.2 — shipped**
- ✅ F1: Fixed vs Variable expense classification — `expenseType` field, segmented toggle, Lock/Waves badges
- ✅ F2: Category budget limits — `categoryBudgets` in FinanceData, BudgetEditor, progress bars (green/amber/red)
- ✅ F3: Month-over-month Δ comparison — Compare toggle, delta badges (▲/▼/=) per category
- ✅ F4: Annual expense smoothing (sinking funds) — `dueMonth` field, provision/mo badge, due countdown
- ✅ F5: Monthly actuals log — `categoryActuals` on snapshots, ActualsDialog, snapshotMonth pre-populates
- ✅ Shared `src/lib/categories.ts` — single source of truth for EXPENSE_CATEGORIES
- ✅ 35 new unit tests covering all 5 features (F1–F5)

**v2.3 — shipped**
- ✅ Historical Expense Entry — `HistoricalExpense` type, named line items on past month snapshots
- ✅ 3 new FinanceContext methods: `addHistoricalExpense`, `deleteHistoricalExpense`, `updateHistoricalExpense`
- ✅ `categoryActuals` auto-updated atomically on add/edit/delete
- ✅ 11 new unit tests (202 total)
- ✅ UX: label/input association, mobile row layout, RTL margins, narrow-screen button text

**v2.4 — shipped**
- ✅ "When?" toggle in Add Expense dialog — Current budget vs Past month
- ✅ Month + Year pickers (past months only, last 3 years, defaults to prev month)
- ✅ `addExpenseToMonth` in FinanceContext — finds or auto-creates stub snapshot
- ✅ Stub snapshots: zero financial totals, appear in History with recorded expenses
- ✅ setTimeout leak fixed (useRef + useEffect cleanup + handleOpen cancel)
- ✅ Year-change clamping: switching to current year auto-adjusts pastMonth
- ✅ Hebrew confirmation message uses localized month name
- ✅ 11 new unit tests + 9 for v2.4.1 (222 total)
- ✅ v2.4.1: stub snapshots pre-populate fixed recurring expenses in categoryActuals + totalExpenses
- ✅ Stub visual indicator: neutral "—" FCF badge + "(fixed expenses only)" italic label

**v2.5 — shipped**
- ✅ Historical Income Entry — `HistoricalIncome` type + `historicalIncomes[]` on `MonthSnapshot`
- ✅ `addHistoricalIncome` / `deleteHistoricalIncome` / `updateHistoricalIncome` in FinanceContext
- ✅ FCF recomputed atomically: `totalIncome − totalExpenses − totalSavings` on every income change
- ✅ Delete clamps `totalIncome` to 0 with `Math.max(0, ...)` guard
- ✅ "Recorded income (N)" section in History tab with `HistoricalIncomeDialog`
- ✅ Member name autocomplete via native `<datalist>` — RTL safe, no custom combobox
- ✅ Stub badge auto-transitions from "—" to real FCF once first income is added
- ✅ Income amounts in `text-primary` (teal), distinct from expense `text-destructive` (red)
- ✅ UX: a11y attrs on Add Income button, mobile note overflow fixed, section header alignment
- ✅ 13 new unit tests (235 total)

**v2.6 — shipped**
- ✅ Add Past Income from Income tab — "Add Income Entry" toolbar button with "When?" toggle
- ✅ Current budget mode: member dropdown + source name + net amount → saves as IncomeSource
- ✅ Past month mode: month/year pickers + member datalist + net amount + note → `addIncomeToMonth`
- ✅ `addIncomeToMonth` in FinanceContext — find-or-create stub, FCF computed immediately (not 0)
- ✅ Stub pre-populates fixed recurring expenses (v2.4.1 pattern)
- ✅ `--warning` HSL token system + badge variant fix (no more hardcoded amber classes)
- ✅ UX audit: a11y attrs on all icon buttons, /mo net i18n, label/input associations
- ✅ 26 new unit tests (261 total)

**v2.7 — shipped**
- ✅ Savings expense → account linkage — `linkedAccountId?: string` on `Expense`
- ✅ Account selector in ExpenseDialog when category = 'savings' (optional, datalist from Savings tab)
- ✅ Atomic sync: addExpense/updateExpense/deleteExpense update `monthlyContribution` on linked account
- ✅ Expense list badge: linked account name shown with Link2 icon (a11y-safe)
- ✅ Hint shown when no savings accounts exist yet
- ✅ `--warning` HSL token system (shipped with v2.6)
- ✅ 20 new unit tests (281 total)

**v2.8 — shipped**
- ✅ `autoAllocateSavings` — priority-tiered pro-rata allocation engine in savingsEngine.ts
- ✅ `aiAdvisor.ts` — Claude Haiku API integration (client-side, VITE_ANTHROPIC_API_KEY gated)
- ✅ "Allocation Plan" card in Goals tab — table, progress bars, Recalculate button
- ✅ "Explain my plan 🤖" AI button — response in collapsible card, error handling, loading state
- ✅ Bug fix: stub snapshots excluded from FCF source (were causing all goals to show blocked)
- ✅ 19 new unit tests (300 total)

**v2.9 — shipped**
- ✅ Overview tab — 5 enhancements to `src/components/Overview.tsx`
- ✅ 28.5: Month-over-Month trend arrows on KPI cards (income + expenses Δ% vs last history snapshot)
- ✅ 28.1: Budget Health Gauge — donut chart (under/warning/over/none) + legend + worst offender footer
- ✅ 28.2: Upcoming Annual Bills timeline — next 6 months of yearly expenses with countdown badges
- ✅ 28.3: Goal Status Donut — 2-col grid (donut+legend left, top-priority progress bars right)
- ✅ 28.4: 12-Month Savings Growth Projection — AreaChart + 3-col summary + weighted avg return note
- ✅ 31 new unit tests for pure utility functions (331 total) in `src/test/overviewUtils.test.ts`

**v3.0 — shipped**
- ✅ End-of-month Surplus Action Prompt — `SurplusBanner` on Overview tab
- ✅ Detects most-recent past-month snapshot with positive FCF, not yet actioned
- ✅ "Add to Goal" dialog — dropdown of goals (name + %), amount input, increments `currentAmount`
- ✅ "Add to Savings" dialog — dropdown of accounts (name + balance), amount input, increments `balance`
- ✅ "Don't ask again" → `surplusActioned: true` on snapshot (persists + syncs to cloud)
- ✅ Session-only dismiss (X button) — no persistent change
- ✅ Sonner toast on confirm: "[amount] added to [destination] ✓"
- ✅ `surplusActioned?: boolean` added to `MonthSnapshot` type (backward-compatible)
- ✅ `markSurplusActioned(snapshotId)` added to `FinanceContext`
- ✅ 24 new unit tests (355 total) in `src/test/surplusAction.test.ts`

**v3.1 — shipped**
- ✅ Receipt Scan → Auto-populate Expense — `scanReceipt()` in `aiAdvisor.ts` using Claude Vision
- ✅ "📷 Scan Receipt" button in ExpenseDialog header (gated on `VITE_ANTHROPIC_API_KEY`)
- ✅ Mobile: `accept="image/*" capture="environment"` opens camera directly
- ✅ Auto-fills name, amount, category from receipt photo; user reviews before saving
- ✅ Spinner + "Scanning…" label during AI call; inline error banner on failure
- ✅ Images are ephemeral — never stored, only base64-encoded and sent to API
- ✅ Markdown fence stripping + safe defaults for all fields in API response parser
- ✅ 20 new unit tests in `src/test/receiptScan.test.ts`

**v3.2 — shipped**
- ✅ Monthly AI Financial Briefing card on Overview tab — score + color-coded bullets, cached per snapshot
- ✅ Savings tab month-over-month progress — "Last month: ₪X ▲ +₪Y" row per account
- ✅ Demo Mode — "Try Demo" button on login, ephemeral Dana + Yossi Cohen data, yellow banner with Exit
- ✅ Cross-device sync critical fix — `cloudPullCompletedRef` prevents auto-snapshot race condition
- ✅ Additive merge for all array fields — `mergeById` preserves local-only items (cloud no longer clobbers)
- ✅ `categoryBudgets` union merge — locally-set budget limits never overwritten by cloud
- ✅ Supabase Realtime subscription — live cross-device updates without page reload
- ✅ Payslip scan: 18-field `PayslipScanResult`, study fund extraction, net pinned from payslip
- ✅ 32 sync tests + 23 briefing tests added

**Next (v3.3)**
- [ ] Fix Google Sign-In on custom domain (Google Console authorized origins)
- [ ] Push notifications for monthly snapshot reminder
- [ ] Data export / backup — let users download a JSON snapshot they can restore from

**Later (v4)**
- [ ] Bank statement CSV import
- [ ] Mobile PWA / install to home screen — spec written in PRODUCT_DESIGN.md §28 (v4.0)
- [ ] Multi-currency conversion (live rates)
- [ ] Recurring expense reminders

**Icebox**
- Google Sheets export
- WhatsApp bot integration
- Accountant sharing mode (read-only link)

### Documentation rules
- README.md: keep install steps and feature table up to date after every release
- PRODUCT_DESIGN.md: update version number + date when spec changes
- DOCUMENTATION.md: update API docs when lib functions change
- All docs must be accurate — no aspirational features described as built

### Commit style
`docs: ...` / `product: ...`

---

## How to use these roles

### Single role session
Start your message with the role you want:
> "Act as the **QA agent**. Review the invite acceptance flow and write tests for edge cases."

> "Act as the **UX agent**. The household settings dialog feels cramped on mobile — fix it."

> "Act as the **Backend agent**. Add a function to transfer household ownership."

### Multi-agent parallel session
Ask Claude to spawn all relevant agents at once:
> "Spawn the Frontend, QA, and Code Review agents in parallel to implement and validate the new expense tags feature."

### Full release checklist (run all agents)
Before any major release, trigger all 6:
1. **Product** — confirm acceptance criteria are met
2. **Backend** — check data integrity and migration safety
3. **Frontend** — verify state management and TypeScript
4. **UX** — confirm RTL, dark mode, and mobile
5. **Code Review** — security and quality audit
6. **QA** — run full test suite + manual checklist

---

## 🗄 Role 7 — Data Engineer

**Responsibility:** Database schema, migrations, RLS policies, indexes, and data integrity.

### Files owned
- `supabase/migration.sql` — all schema changes (single file, not numbered)
- `src/lib/cloudInvites.ts` — Supabase CRUD for households, memberships, invites, profiles
- `src/lib/cloudFinance.ts` — Supabase finance data sync (push/pull/merge)
- `src/lib/supabase.ts` — Supabase client config
- `.claude/docs/database.md` — DB architecture reference (keep up to date)
- `.claude/skills/data-engineer.md` — this role's skill file

### Rules
- Before ANY schema task: read `.claude/docs/database.md` first
- All schema changes go into `supabase/migration.sql` — always at the bottom, always idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`)
- New tables always get `enable row level security` + `allow_all` policy
- After any schema change: tell the user to run the new SQL block in Supabase Dashboard → SQL Editor
- After any schema change: update `.claude/docs/database.md`
- Never use Supabase Auth — auth is always local
- All Supabase functions must silently no-op if `!supabaseConfigured`
- Finance data sync: array fields use additive `mergeById`; `categoryBudgets` uses union spread; scalars (`currency`, `locale`, `emergencyBufferMonths`) are cloud-wins; `darkMode` + `language` are local-wins. See 🔴 Data Safety Protocol and the merge strategy table.

### Commit style
`feat(db): ...` / `fix(db): ...` / `feat(supabase): ...`

---

## 📖 Lessons Learned — Real Incidents

These are documented so every agent knows what went wrong and never repeats it.

### May 2026 — Sync fix caused data loss for all household members

**What happened:**
A race condition in `FinanceContext` caused `hasLocalEditRef` to be set to `true` by the auto-snapshot routine before the cloud fetch had completed. This made the cloud merge guard skip the merge on first load, so each device kept only its own local data and pushed it to cloud — overwriting the other member's data.

**The fix (good):**
Added `cloudPullCompletedRef`. The auto-snapshot guard now waits for `cloudPullCompletedRef.current === true` before flagging a local edit. Cloud merge always runs on first load regardless of the local edit flag.

**The second problem:**
The original merge used "cloud wins" for all array fields. When the fix caused each device to push its reduced local data to cloud, the other device then fetched that and replaced its own items too. Result: items present only on one device were permanently lost.

**The fix (good):**
Switched all array fields to additive `mergeById` — union of cloud + local, cloud wins on ID conflicts. `categoryBudgets` uses union spread for the same reason.

**What could not be recovered:**
Data that was overwritten in both localStorage AND Supabase before the fixes landed is permanently gone. There is no undo. The user had to manually re-enter lost items.

**Rules added because of this:**
- 🔴 Data Safety Protocol section (see above) — mandatory checklist before any sync code change
- Sync / Data safety block added to Code Reviewer checklist
- Merge strategy table documented and locked — changes require a spec + QA sign-off

**Key lesson:**
> A sync change that looks like a "guard fix" can silently change what gets pushed to cloud. Always simulate the full sequence: (1) Device A loads → (2) Device B loads → (3) A edits → (4) B fetches. Verify nothing is lost at each step.
