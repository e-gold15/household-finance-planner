# History — Data Model & API

## TypeScript Types

### `HistoricalExpense`

A named expense line item recorded retroactively on a past snapshot.

```typescript
interface HistoricalExpense {
  id: string          // crypto.randomUUID()
  name: string        // e.g. "Dentist visit"
  amount: number      // Positive number in household currency
  category: string    // Must be a valid value from EXPENSE_CATEGORIES
  note?: string       // Optional free-text
  addedAt: string     // ISO timestamp of when the item was created
}
```

---

### `HistoricalIncome`

A named income item recorded retroactively on a past snapshot.

```typescript
interface HistoricalIncome {
  id: string          // crypto.randomUUID()
  memberName: string  // Household member who received this income
  amount: number      // Net amount (after tax) in household currency
  note?: string       // Optional free-text
  addedAt: string     // ISO timestamp of when the item was created
}
```

---

### `MonthSnapshot`

The primary data type for a historical month record.

```typescript
interface MonthSnapshot {
  id: string                              // crypto.randomUUID()
  label: string                           // "March 2025" — human-readable label
  date: string                            // ISO date string, first day of month: "2025-03-01"
  totalIncome: number                     // Sum of income for the month
  totalExpenses: number                   // Sum of expenses for the month
  totalSavings: number                    // Planned savings contributions
  freeCashFlow: number                    // totalIncome - totalExpenses - totalSavings
  categoryActuals?: Record<string, number> // Actual spending per category key
  historicalExpenses?: HistoricalExpense[] // Named expense line items
  historicalIncomes?: HistoricalIncome[]  // Named income line items
  surplusActioned?: boolean               // true once user directs surplus to a goal
}
```

**Optional fields** (`categoryActuals`, `historicalExpenses`, `historicalIncomes`, `surplusActioned`) may be absent on older snapshots created before these features were introduced. All code that reads these fields must handle `undefined` gracefully.

---

## Stub Detection

A snapshot is considered a stub when:

```typescript
const isStub = (snapshot: MonthSnapshot): boolean => snapshot.totalIncome === 0
```

Stubs are excluded from:
- The FCF trend chart
- The FCF source selection for the Goals allocation engine
- The Surplus Banner (which only shows on real snapshots with positive FCF)

Stubs are included in:
- The History snapshot list
- The month-over-month comparison in the Expenses tab (category actuals are still valid)

---

## `repairSnapshotTotals(data: FinanceData): FinanceData`

A defensive, idempotent helper that recomputes derived totals on all snapshots.

### What it fixes

For each snapshot, it recalculates:

```
totalExpenses = sum(Object.values(snapshot.categoryActuals ?? {}))
freeCashFlow  = snapshot.totalIncome - totalExpenses - snapshot.totalSavings
```

### Why it is needed

Between v2.3 and v2.5, several bugs caused `totalExpenses` and `freeCashFlow` to drift out of sync with `categoryActuals`. Rather than writing a migration for each bug, `repairSnapshotTotals` acts as a single defensive pass that corrects any inconsistency at load time.

### When it runs

1. **On `load()`** — when `FinanceContext` initialises from `localStorage`.
2. **After `mergeFinanceData()`** — when cloud data is merged in after the `FinanceProvider` mounts.

The second call is critical: `mergeFinanceData()` bypasses `load()` entirely, so without a post-merge repair pass, cloud-merged data could carry stale totals indefinitely.

### Safety properties

- Idempotent — calling it multiple times produces the same result as calling it once.
- Non-destructive — it never modifies `totalIncome` or `totalSavings`.
- Handles `undefined` fields — missing `categoryActuals` is treated as an empty object.

---

## `surplusActioned`

A boolean flag on `MonthSnapshot`. When `true`, the Surplus Banner for that month is permanently hidden.

The flag is set by `markSurplusActioned(snapshotId: string)` in `FinanceContext` after the user confirms a surplus allocation action on the Overview tab. It is never reset to `false`.

---

## FinanceContext Methods

### Snapshot creation

| Method | Signature | Description |
|--------|-----------|-------------|
| `snapshotMonth` | `() => void` | Creates a real snapshot from current planned data. Sets `totalIncome`, `totalExpenses`, `totalSavings`, `freeCashFlow`, and a copy of `categoryBudgets` as the initial `categoryActuals`. |
| `markSurplusActioned` | `(snapshotId: string) => void` | Sets `surplusActioned = true` on the specified snapshot. |

---

### Historical expense methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addHistoricalExpense` | `(snapshotId: string, item: Omit<HistoricalExpense, 'id' \| 'addedAt'>) => void` | Appends item to `historicalExpenses[]`; increments `categoryActuals[item.category]`; recomputes `totalExpenses` and `freeCashFlow`. |
| `updateHistoricalExpense` | `(snapshotId: string, itemId: string, updates: Partial<HistoricalExpense>) => void` | Replaces item; adjusts `categoryActuals` by the delta; recomputes totals. |
| `deleteHistoricalExpense` | `(snapshotId: string, itemId: string) => void` | Removes item; decrements `categoryActuals[item.category]` with `Math.max(0, ...)` guard; recomputes totals. |

---

### Past-month expense entry (from Expenses tab)

| Method | Signature | Description |
|--------|-----------|-------------|
| `addExpenseToMonth` | `(year: number, month: number, item: Omit<HistoricalExpense, 'id' \| 'addedAt'>) => void` | Finds the existing snapshot for `year/month`, or creates a stub. Stub pre-populates `categoryActuals` with fixed recurring expenses. Then delegates to `addHistoricalExpense`. |

**Stub creation logic in `addExpenseToMonth`:**

```typescript
const fixedExpenses = data.expenses.filter(e => e.expenseType === 'fixed')
const categoryActuals: Record<string, number> = {}
for (const exp of fixedExpenses) {
  categoryActuals[exp.category] = (categoryActuals[exp.category] ?? 0) + exp.amount
}
const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0)

const stub: MonthSnapshot = {
  id: generateId(),
  label: formatMonthLabel(year, month),
  date: new Date(year, month - 1, 1).toISOString(),
  totalIncome: 0,       // stub marker
  totalExpenses: totalFixed,
  totalSavings: data.totalSavings,
  freeCashFlow: -totalFixed,  // negative until income is added
  categoryActuals,
  historicalExpenses: [],
  historicalIncomes: [],
}
```

---

### Historical income methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addHistoricalIncome` | `(snapshotId: string, item: Omit<HistoricalIncome, 'id' \| 'addedAt'>) => void` | Appends item to `historicalIncomes[]`; increments `totalIncome`; recomputes `freeCashFlow`. |
| `updateHistoricalIncome` | `(snapshotId: string, itemId: string, updates: Partial<HistoricalIncome>) => void` | Replaces item; adjusts `totalIncome` by the delta; recomputes `freeCashFlow`. |
| `deleteHistoricalIncome` | `(snapshotId: string, itemId: string) => void` | Removes item; decrements `totalIncome` with `Math.max(0, ...)` guard; recomputes `freeCashFlow`. |

---

### Past-month income entry (from Income tab)

| Method | Signature | Description |
|--------|-----------|-------------|
| `addIncomeToMonth` | `(year: number, month: number, item: Omit<HistoricalIncome, 'id' \| 'addedAt'>) => void` | Finds or creates a stub for `year/month` (same stub creation pattern as `addExpenseToMonth`). FCF is computed immediately as `totalIncome - fixedTotal`, not set to 0. Then delegates to `addHistoricalIncome`. |

---

### Category actuals

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateSnapshotActuals` | `(snapshotId: string, actuals: Record<string, number>) => void` | Replaces `categoryActuals` entirely with the provided object; recomputes `totalExpenses` and `freeCashFlow`. Used by the ActualsDialog for bulk edits. |

---

## Persistence Layout

Snapshots are stored in `FinanceData.history[]` in `localStorage` under `hf-data-{householdId}`:

```json
{
  "history": [
    {
      "id": "abc123",
      "label": "March 2025",
      "date": "2025-03-01T00:00:00.000Z",
      "totalIncome": 18000,
      "totalExpenses": 12500,
      "totalSavings": 2000,
      "freeCashFlow": 3500,
      "categoryActuals": {
        "housing": 4200,
        "food": 1800,
        "transport": 600
      },
      "historicalExpenses": [
        {
          "id": "exp-1",
          "name": "Dentist",
          "amount": 350,
          "category": "health",
          "addedAt": "2025-04-10T08:00:00.000Z"
        }
      ],
      "historicalIncomes": [],
      "surplusActioned": false
    }
  ]
}
```

All snapshot data is included in the `household_finance` Supabase cloud sync. Cloud wins on merge.
