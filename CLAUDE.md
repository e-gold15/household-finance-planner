# Household Finance Planner — Claude Agent Roles

This file defines the 6 specialized agent roles for this project.
At the start of each session, declare which role you are acting as.

**Example:** "Act as the QA agent and review the invite flow."

---

## Project Context

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Auth:** Local SHA-256 (email) + Google GIS (OAuth) — no Supabase Auth
- **Cloud:** Supabase — invitations, household memberships, AND finance data sync
- **Finance data:** localStorage (primary) + Supabase `household_finance` (sync layer)
- **Live URL:** https://household-finance-planner.com
- **Repo:** https://github.com/e-gold15/household-finance-planner
- **Deploy:** Vercel — auto-deploys on push to `main`
- **Tests:** Vitest — `npm test` (191 tests, must stay green)
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
- Run `npm test` before every commit — all 191 tests must pass
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
- Cloud wins on: members, expenses, accounts, goals, history, currency, locale, emergencyBufferMonths
- Local device keeps: darkMode, language (per-device UI prefs, never overwritten by cloud)
- Push is debounced 1.5 s after every `setData` call (FinanceContext owns the timer)
- Pull happens on FinanceProvider mount — if local is empty, shows loading spinner until cloud responds
- If cloud has no row yet and local has data, seeds the cloud immediately (owner bootstrap)

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
- [ ] `npm test` passes (all 191 tests green)
- [ ] `npm run build` passes — no TypeScript errors
- [ ] New logic has corresponding unit tests
- [ ] Edge cases covered (empty arrays, zero values, expired invites)

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
| **Total** | **191** | |

### Rules
- All 191 existing tests must pass before any commit
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

**Next (v2.3)**
- [ ] Fix Google Sign-In on custom domain (Google Console authorized origins)
- [ ] Push notifications for monthly snapshot reminder

**Later (v3)**
- [ ] Bank statement CSV import
- [ ] Mobile PWA / install to home screen
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
- Finance data sync: cloud wins on financial fields; local wins on `darkMode` + `language`

### Commit style
`feat(db): ...` / `fix(db): ...` / `feat(supabase): ...`
