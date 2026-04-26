# Expenses Tab — Data Layer

## Core Types

### `Expense`

The primary data type for all household spending. Stored in `FinanceData.expenses[]`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (`crypto.randomUUID()`) |
| `name` | `string` | Human label — e.g. "Car Insurance" |
| `amount` | `number` | The amount in the entered period (monthly or yearly) |
| `category` | `ExpenseCategory` | One of the 11 expense categories |
| `recurring` | `boolean` | Whether this is a regular recurring cost |
| `period` | `'monthly' \| 'yearly'` | The period the amount is expressed in |
| `expenseType` | `'fixed' \| 'variable' \| undefined` | Classification — Lock vs Waves badge |
| `dueMonth` | `1–12 \| undefined` | For yearly expenses — the calendar month when payment is due |
| `linkedAccountId` | `string \| undefined` | ID of a savings account linked to this savings-category expense |

**Monthly normalisation rule:** every computation uses the monthly-equivalent amount:

```ts
monthlyAmount(e: Expense): number {
  return e.period === 'yearly' ? e.amount / 12 : e.amount
}
```

This normalised figure is used in `totalExpenses`, budget health, comparisons, and all charts.

---

### `ExpenseCategory`

A union type of 11 string literals defining all valid expense categories:

```ts
type ExpenseCategory =
  | 'housing'   | 'food'      | 'transport' | 'education'
  | 'leisure'   | 'health'    | 'utilities' | 'clothing'
  | 'insurance' | 'savings'   | 'other'
```

The canonical list of categories (with display names and icons) is maintained in **`src/lib/categories.ts`** as `EXPENSE_CATEGORIES`. This is the single source of truth — used in the expense dialog, budget editor, category grouping, and tests.

---

### `HistoricalExpense`

A one-time expense entry recorded against a past month's snapshot.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `name` | `string` | Description of the expense |
| `amount` | `number` | Monthly-equivalent amount for this entry |
| `category` | `ExpenseCategory` | Category for categorisation and budget tracking |
| `note` | `string \| undefined` | Optional note (e.g. "Late invoice from Feb") |

Stored in `MonthSnapshot.historicalExpenses[]`.

`categoryActuals` on the snapshot is updated atomically whenever `historicalExpenses[]` changes:

```ts
snapshot.categoryActuals[item.category] =
  (snapshot.categoryActuals[item.category] ?? 0) + item.amount
snapshot.totalExpenses += item.amount
snapshot.freeCashFlow = snapshot.totalIncome - snapshot.totalExpenses - snapshot.totalSavings
```

---

### `MonthSnapshot.categoryActuals`

```ts
categoryActuals: Partial<Record<ExpenseCategory, number>>
```

A per-category spending record on each historical snapshot. This is what powers the MoM comparison feature: current `data.categoryBudgets` vs last snapshot's `categoryActuals`.

---

## Budget Health

Category budget limits are stored at the top level of `FinanceData`:

```ts
categoryBudgets: Partial<Record<ExpenseCategory, number>>
```

A category not present in this object has no budget limit set. The budget editor writes directly to this field.

**Budget progress calculation (per category):**

```ts
const spent  = Σ monthlyAmount(e) for all e where e.category === cat
const budget = data.categoryBudgets[cat]

if (!budget) return 'none'
const ratio  = spent / budget
return ratio > 1.0 ? 'over' : ratio > 0.8 ? 'warning' : 'under'
```

---

## Context Methods

All expense mutations go through `FinanceContext`. Components never access localStorage directly.

### `addExpense(expense: Omit<Expense, 'id'>): void`

1. Generates a new `id`
2. Appends to `data.expenses[]`
3. If `category === 'savings' && linkedAccountId`:
   - Atomically updates `account.monthlyContribution = monthlyAmount(expense)` in `data.accounts[]`
4. Calls `setData` once (single state update)

### `updateExpense(id: string, updates: Partial<Expense>): void`

1. Finds the expense in `data.expenses[]`
2. Applies updates
3. Savings linkage sync (atomic, all in one `setData`):

| Scenario | Action |
|---|---|
| `linkedAccountId` unchanged | Update `account.monthlyContribution` with new amount |
| `linkedAccountId` changed | Reset old account's contribution to 0; set new account's contribution |
| `linkedAccountId` removed | Reset old account's contribution to 0 |
| `category` changed away from 'savings' | Reset old linked account's contribution to 0; clear `linkedAccountId` |

### `deleteExpense(id: string): void`

1. Removes expense from `data.expenses[]`
2. If the expense had a `linkedAccountId`:
   - Resets `account.monthlyContribution = 0` on the linked account
3. Single atomic `setData` call

### `addHistoricalExpense(year, month, item): void`

Records a `HistoricalExpense` in the target month's snapshot:

1. Find or create stub snapshot for `(year, month)`
2. Append item to `snapshot.historicalExpenses[]`
3. Update `snapshot.categoryActuals[item.category]` atomically
4. Recompute `totalExpenses` and `freeCashFlow` on the snapshot
5. Single `setData` call

### `updateHistoricalExpense(year, month, itemId, updates): void`

1. Find the snapshot and the item
2. If `category` changed: adjust both old and new `categoryActuals` entries
3. If `amount` changed: adjust `totalExpenses` by the delta (`newAmount - oldAmount`)
4. Recompute FCF
5. Single `setData` call

### `deleteHistoricalExpense(year, month, itemId): void`

1. Remove item from `snapshot.historicalExpenses[]`
2. Subtract from `snapshot.categoryActuals[item.category]`, clamped to 0
3. Subtract from `snapshot.totalExpenses`, clamped to 0
4. Recompute FCF
5. Single `setData` call

---

## `addExpenseToMonth` — Stub Snapshot Creation

When no snapshot exists for the target `(year, month)`, a stub is created. The v2.4.1 pattern pre-populates the stub with fixed recurring expenses:

```ts
function createStubSnapshot(date: string, expenses: Expense[]): MonthSnapshot {
  const fixedExpenses = expenses.filter(
    e => e.recurring && e.expenseType === 'fixed'
  )

  const categoryActuals: Partial<Record<ExpenseCategory, number>> = {}
  let totalExpenses = 0

  for (const e of fixedExpenses) {
    const monthly = monthlyAmount(e)
    categoryActuals[e.category] = (categoryActuals[e.category] ?? 0) + monthly
    totalExpenses += monthly
  }

  return {
    date,
    totalIncome:   0,
    totalExpenses,
    totalSavings:  0,
    freeCashFlow:  -totalExpenses,  // negative: expenses with no income
    categoryActuals,
    historicalExpenses: [],
    historicalIncomes:  [],
    isStub:            true,   // used by UI for badge + FCF display
  }
}
```

The stub badge in the History tab shows `—` for FCF and an italic `(fixed expenses only)` label until real income is added.

---

## Receipt Scan Result

The receipt scan result is **ephemeral** — it is never stored in `FinanceData` or anywhere else.

```ts
interface ReceiptScanResult {
  name:     string
  amount:   number
  category: string   // validated against EXPENSE_CATEGORIES before use
}
```

The result is used only to pre-fill the Add Expense dialog form fields. If the user closes the dialog without saving, the result is discarded.

---

## Data Flow

```
User adds expense
       ↓
addExpense() in FinanceContext
       ↓
Savings linkage sync (if category='savings' && linkedAccountId)
       ↓
setData() → updates data.expenses[] + data.accounts[] atomically
       ↓
localStorage write + Supabase debounced push (1.5s)
       ↓
All consumers re-render: Expenses list, Overview KPIs, Budget Health Gauge
```

```
User scans receipt
       ↓
FileReader → base64 → scanReceipt(base64, mimeType, lang)
       ↓
Anthropic Claude Vision API → { name, amount, category }
       ↓
Form fields pre-filled (ephemeral state)
       ↓
User saves → addExpense() (same flow as above)
       ↓
Image bytes discarded immediately (never written anywhere)
```
