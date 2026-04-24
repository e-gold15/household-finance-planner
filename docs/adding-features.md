# Adding New Features

A practical guide for the most common extension patterns.

---

## New Finance Field

**Example:** Add `tags` to expenses.

1. **Type** (`src/types/index.ts`):
   ```typescript
   interface Expense {
     // ... existing fields
     tags?: string[]   // optional — old data without this field loads fine
   }
   ```

2. **Context** (`src/context/FinanceContext.tsx`):
   - Update `addExpense` default if the field needs a default value
   - `updateExpense` doesn't need changes — it replaces the whole object

3. **UI** (`src/components/Expenses.tsx`):
   - Add the input to the expense dialog
   - Wrap any new strings in `t(en, he, lang)`

4. **Tests**: Old data without the field must still load correctly (optional field = no migration needed).

---

## New Finance Tab

**Example:** Add a "Debts" tab.

1. Add to `TABS` array in `src/App.tsx`:
   ```typescript
   { id: 'debts', label: t('Debts', 'חובות', lang), icon: <CreditCard /> }
   ```

2. Create `src/components/Debts.tsx`:
   ```tsx
   export function Debts() {
     const { data } = useFinance()
     const lang = data.language
     return <div>...</div>
   }
   ```

3. Add to `AppShell` render in `App.tsx`:
   ```tsx
   {activeTab === 'debts' && <Debts />}
   ```

---

## New Auth Method

**Example:** Add Magic Link (email OTP) sign-in.

1. **Backend** (`src/lib/localAuth.ts`):
   - Add the OTP generation and verification logic
   - Export the new functions

2. **Context** (`src/context/AuthContext.tsx`):
   - Add the new method to `AuthContextType`
   - Add the handler function
   - Wire it into the context value

3. **UI** (`src/pages/AuthPage.tsx`):
   - Add a new tab or section in the email accordion

---

## New Supabase Table

1. **Migration** (`supabase/migration.sql`):
   ```sql
   create table if not exists public.my_table (
     id   text primary key,
     ...
   );
   alter table public.my_table enable row level security;
   create policy "allow_all" on public.my_table for all using (true) with check (true);
   ```

2. **Cloud functions** (`src/lib/cloudInvites.ts` or a new `src/lib/myFeature.ts`):
   - Always add `if (!supabaseConfigured) return/throw` at the top of every function

3. **Types** (`src/types/index.ts`): Add the interface

4. **Context**: Expose via `AuthContext` or a new context

5. **Documentation** (`docs/database.md`): Add the table description

---

## New i18n String

Every user-facing string must go through `t()`. Never hardcode English in JSX.

```tsx
// ✅ Correct
const lang = data.language
<p>{t('Monthly Total', 'סה"כ חודשי', lang)}</p>
<Button>{t('Save', 'שמור', lang)}</Button>
<title>{t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}</title>

// ❌ Wrong
<p>Monthly Total</p>
```

Get `lang` from `useFinance()`:
```tsx
const { data } = useFinance()
const lang = data.language
```

---

## New UI Component

Checklist before committing:

- [ ] No hardcoded hex or rgb colours — use HSL tokens only (`text-primary`, `bg-muted`, etc.)
- [ ] No `mr-*` / `ml-*` — use `me-*` / `ms-*` for RTL support
- [ ] Interactive elements have `min-h-[44px]` tap target
- [ ] Dialogs have `max-h-[85vh] overflow-y-auto`
- [ ] Works on 375px wide viewport (no overflow)
- [ ] Works in dark mode (no invisible text or icons)
- [ ] Works in Hebrew RTL (toggle `lang = 'he'` to test)
- [ ] Status indicators use icon + text + colour (never colour alone)

---

## New Test File

When adding business logic to `src/lib/myModule.ts`, create `src/test/myModule.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { myFunction } from '@/lib/myModule'

describe('myFunction()', () => {
  it('happy path', () => { ... })
  it('empty input', () => { ... })
  it('boundary values', () => { ... })
  it('error states', () => { ... })
})
```

Run `npm test` — all tests must stay green. The project currently has **95 tests**; new logic should add to that count.

---

## Pre-commit Checklist

```bash
npx tsc --noEmit   # zero TypeScript errors
npm test           # all tests green
```

Then commit:
```bash
git add <specific files>   # never git add -A blindly
git commit -m "feat(ui): ..."
git push
```
