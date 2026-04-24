# Finance State

All financial data lives in `localStorage` under the key `hf-data-{householdId}`. It never leaves the browser.

---

## `src/context/FinanceContext.tsx`

Consumed via `useFinance()`.

### `FinanceContextType`

```typescript
interface FinanceContextType {
  data: FinanceData
  setData(updater: (prev: FinanceData) => FinanceData): void

  // Income members (finance domain — not the same as auth household members)
  addMember(name: string): void
  updateMember(member: HouseholdMember): void
  deleteMember(id: string): void

  // Expenses
  addExpense(expense: Omit<Expense, 'id'>): void
  updateExpense(expense: Expense): void
  deleteExpense(id: string): void

  // Savings accounts
  addAccount(account: Omit<SavingsAccount, 'id'>): void
  updateAccount(account: SavingsAccount): void
  deleteAccount(id: string): void

  // Goals
  addGoal(goal: Omit<Goal, 'id'>): void
  updateGoal(goal: Goal): void
  deleteGoal(id: string): void
  moveGoal(id: string, direction: 'up' | 'down'): void

  // History
  snapshotMonth(): void

  // Data portability
  exportData(): void      // triggers JSON file download
  importData(json: string): void
}
```

### Usage pattern

```tsx
// ✅ Always go through context
const { data, addExpense } = useFinance()

// ❌ Never read localStorage directly in components
const raw = localStorage.getItem('hf-data-xyz')
```

### Provider setup

```tsx
// App.tsx — key forces full remount when household changes
<FinanceProvider key={household.id} householdId={household.id}>
  <AppShell />
</FinanceProvider>
```

---

## `FinanceData` Shape

```typescript
interface FinanceData {
  members:              HouseholdMember[]    // income earners
  expenses:             Expense[]
  accounts:             SavingsAccount[]
  goals:                Goal[]
  history:              MonthSnapshot[]
  emergencyBufferMonths: number              // default: 3
  currency:             Currency             // 'ILS' | 'USD' | 'GBP' | 'EUR' | 'CAD'
  locale:               Locale
  darkMode:             boolean
  language:             'en' | 'he'
}
```

---

## Income Members vs Auth Members

There are two separate concepts of "member" in the codebase:

| Type | Interface | Domain | Stored in |
|------|-----------|--------|-----------|
| `HouseholdMember` | Finance domain | Income earners tracked in the budget | `FinanceData.members` → `localStorage` |
| `LocalUser` + `HouseholdMembership` | Auth domain | Actual app users sharing the household | `hf-users`, `hf-households` → `localStorage` + Supabase |

A household with two app users (partners) sharing a budget would typically have two `HouseholdMember` entries in `FinanceData.members` — one per income earner.

---

## Data Persistence

Every call to `setData()` immediately serializes to `localStorage`:

```typescript
// Simplified from FinanceContext
function setData(updater) {
  setDataState((prev) => {
    const next = updater(prev)
    localStorage.setItem(`hf-data-${householdId}`, JSON.stringify(next))
    return next
  })
}
```

There is no debounce — every state change is persisted synchronously. This keeps data safe across tab closes and refreshes.

---

## Data Portability

### Export

`exportData()` serializes the current `FinanceData` to JSON and triggers a browser download named `household-finance-{date}.json`.

### Import

`importData(json)` parses the JSON and calls `setData()` with the result. The imported data replaces all current data for the household. There is no merge — it is a full replace.

---

## History Snapshots

`snapshotMonth()` creates a `MonthSnapshot` from the current totals and appends it to `data.history`. Snapshots are manual — the user decides when to take one.

```typescript
interface MonthSnapshot {
  id: string
  label: string       // e.g. "April 2026"
  date: string        // ISO
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  freeCashFlow: number
}
```

---

## Adding a New Finance Field

Example: adding `tags` to expenses.

1. Add to `Expense` in `src/types/index.ts`:
   ```typescript
   tags?: string[]
   ```
2. Update `addExpense` default in `FinanceContext` if needed
3. Update the expense dialog in `Expenses.tsx`
4. Old data without `tags` loads fine (optional field, no migration needed)
