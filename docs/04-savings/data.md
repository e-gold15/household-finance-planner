# Savings Tab — Data Layer

## Core Types

### `SavingsAccount`

Represents one savings or investment account. Stored in `FinanceData.accounts[]`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (`crypto.randomUUID()`) |
| `name` | `string` | Human label — e.g. "Emergency Fund" |
| `type` | `AccountType` | One of 9 account types (see below) |
| `balance` | `number` | Current balance in the household's currency |
| `liquidity` | `Liquidity` | Access tier: immediate / short / medium / locked |
| `annualReturnPercent` | `number` | Expected annual growth rate (0–100); default 0 |
| `monthlyContribution` | `number` | Monthly deposit amount; 0 if none |

There is no `linkedExpenseId` field on `SavingsAccount` — the linkage is owned by `Expense.linkedAccountId`. The account is the passive side; the expense is the active side that drives contribution updates.

---

### `AccountType`

```ts
type AccountType =
  | 'checking'    | 'savings'    | 'deposit'
  | 'pension'     | 'study_fund' | 'stocks'
  | 'crypto'      | 'real_estate'| 'other'
```

Account type is a display label only. It does not change any financial calculation. All nine types are treated identically by the engine — the **liquidity** tier is what determines goal allocation behaviour, not the account type.

---

### `Liquidity`

```ts
type Liquidity = 'immediate' | 'short' | 'medium' | 'locked'
```

| Value | Included in `liquidBalance`? | Notes |
|---|---|---|
| `'immediate'` | Yes | Most accessible — current accounts, liquid savings |
| `'short'` | Yes | Accessible within weeks/months |
| `'medium'` | No | Not counted as liquid for goals |
| `'locked'` | No | Pension, fixed deposits — excluded entirely from goal allocation |

---

## Key Derived Values

### `liquidBalance(accounts)`

The total liquid savings available for goal allocation. Defined as the sum of all `immediate` and `short` account balances:

```ts
function liquidBalance(accounts: SavingsAccount[]): number {
  return accounts
    .filter(a => a.liquidity === 'immediate' || a.liquidity === 'short')
    .reduce((sum, a) => sum + a.balance, 0)
}
```

### Emergency Buffer Deduction

Before goals can access liquid savings, the emergency buffer is reserved:

```ts
const reservedBuffer = data.emergencyBufferMonths * monthlyExpenses
const availableLiquid = Math.max(0, liquidBalance(data.accounts) - reservedBuffer)
```

`availableLiquid` is what the `allocateGoals` engine uses as the liquid savings offset.

`emergencyBufferMonths` is stored in `FinanceData` and configured in Household Settings.

### Total Assets

```ts
totalAssets = data.accounts.reduce((sum, a) => sum + a.balance, 0)
```

This is the figure shown on the Savings tab header and in the Overview Total Assets KPI card.

### Total Contributions

```ts
totalContributions = data.accounts.reduce((sum, a) => sum + a.monthlyContribution, 0)
```

Used in FCF calculation: `FCF = totalIncome - totalExpenses - totalContributions`.

---

## Context Methods

### `addAccount(account: Omit<SavingsAccount, 'id'>): void`

Creates a new account with a generated `id` and appends to `data.accounts[]`.

### `updateAccount(id: string, updates: Partial<SavingsAccount>): void`

Updates fields on the matching account. This is called by:
- The user editing an account directly in the dialog
- The savings linkage sync (from `addExpense`, `updateExpense`, `deleteExpense`) to update `monthlyContribution`

### `deleteAccount(id: string): void`

Removes the account. Also clears `linkedAccountId` on any expenses that reference this account (to prevent orphaned references):

```ts
setData(prev => {
  const accounts = prev.accounts.filter(a => a.id !== id)
  const expenses = prev.expenses.map(e =>
    e.linkedAccountId === id
      ? { ...e, linkedAccountId: undefined }
      : e
  )
  return { ...prev, accounts, expenses }
})
```

---

## Linkage Sync (Owned by Expense Operations)

The `monthlyContribution` field on a `SavingsAccount` is the **source of truth for FCF and forecasting**, but it is written by expense operations — not by account operations. This is by design: the expense is the intent ("I transfer ₪1,200/month to savings"), and the account reflects it.

**Write paths that update `monthlyContribution`:**

| Trigger | Effect on account |
|---|---|
| `addExpense` with `category='savings' && linkedAccountId` | Sets `account.monthlyContribution = monthlyAmount(expense)` |
| `updateExpense` with amount change | Updates `account.monthlyContribution` to new monthly amount |
| `updateExpense` with `linkedAccountId` change | Resets old account to 0; sets new account to new amount |
| `updateExpense` removing `linkedAccountId` | Resets old account to 0 |
| `deleteExpense` with `linkedAccountId` | Resets linked account to 0 |
| `deleteAccount` | Clears `linkedAccountId` on orphaned expenses |

All of these updates happen in a single `setData` call — there is never an intermediate state where expense and account are inconsistent.

---

## Data Flow

```
User adds a savings account
        ↓
addAccount() in FinanceContext
        ↓
data.accounts[] updated
        ↓
setData() → localStorage + Supabase push (debounced 1.5s)
        ↓
Savings tab renders new card
Overview updates: totalAssets KPI, savings forecast
```

```
User creates a "Savings" expense linked to an account
        ↓
addExpense({ category: 'savings', linkedAccountId: 'acc-123', amount: 1200, period: 'monthly' })
        ↓
FinanceContext finds account 'acc-123'
Sets account.monthlyContribution = 1200 (atomically in same setData)
        ↓
Savings tab: account card shows "+₪1,200/mo" with link badge
Overview: FCF reduced by ₪1,200; savings forecast increases by ₪1,200/mo per projection point
```

---

## Storage

| Location | What is stored |
|---|---|
| `data.accounts[]` in `FinanceData` | All savings account definitions and current balances |
| `data.emergencyBufferMonths` in `FinanceData` | Emergency buffer setting |
| `household_finance.data` (Supabase) | Full `FinanceData` — synced on every `setData` |

Account balances are **never** fetched from an external source. They are always entered and maintained manually by the user.

---

## Cloud Sync Behaviour

`data.accounts[]` is part of the `household_finance.data` JSONB blob. The merge strategy (defined in `cloudFinance.ts`) treats accounts as **cloud-wins** — when pulling data from Supabase, the cloud version of `accounts[]` replaces the local version (unless local is newer based on `updated_at`).

Per-device UI preferences (`darkMode`, `language`) are never overwritten by the cloud. Everything else — including accounts, balances, and contributions — syncs across all devices in the household.
