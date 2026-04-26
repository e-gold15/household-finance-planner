# Savings Tab — Engineering & Implementation Notes

## File

**`src/components/Savings.tsx`**

The Savings tab is a single functional component. It renders the summary header, the account card grid, the Add/Edit dialog, and the empty state. The linkage sync logic lives in `FinanceContext`, not in this component.

---

## Linkage Sync Logic (in `FinanceContext`)

The savings expense → account linkage is the most complex data integrity requirement in the Savings feature. All sync happens inside `FinanceContext.tsx`, not in the Savings component.

### Why context owns the sync

Components call `addExpense`, `updateExpense`, or `deleteExpense`. They do not need to know about accounts. Context intercepts these calls and applies the account update in the same `setData` — a single atomic state transition. This guarantees that:

1. The UI never shows an inconsistent state (expense amount ≠ account contribution)
2. The Supabase sync always pushes a consistent snapshot
3. The Savings component is purely a display layer — it never writes to accounts directly

### Reset on delete

```ts
// Inside deleteExpense in FinanceContext:
setData(prev => {
  const target   = prev.expenses.find(e => e.id === id)
  const expenses = prev.expenses.filter(e => e.id !== id)
  let   accounts = prev.accounts

  if (target?.linkedAccountId) {
    accounts = accounts.map(acc =>
      acc.id === target.linkedAccountId
        ? { ...acc, monthlyContribution: 0 }
        : acc
    )
  }

  return { ...prev, expenses, accounts }
})
```

### Reset on account change

When a user changes which account a savings expense is linked to:

```ts
// Inside updateExpense in FinanceContext:
const oldLinked = old.linkedAccountId
const newLinked = updated.linkedAccountId

let accounts = prev.accounts

// Reset old account if link changed
if (oldLinked && oldLinked !== newLinked) {
  accounts = accounts.map(acc =>
    acc.id === oldLinked
      ? { ...acc, monthlyContribution: 0 }
      : acc
  )
}

// Set new account's contribution
if (updated.category === 'savings' && newLinked) {
  accounts = accounts.map(acc =>
    acc.id === newLinked
      ? { ...acc, monthlyContribution: monthlyAmount(updated) }
      : acc
  )
}
```

### Reset on account delete

When a savings account is deleted, any expenses that referenced it via `linkedAccountId` must be cleaned up to prevent orphaned references:

```ts
// Inside deleteAccount in FinanceContext:
setData(prev => ({
  ...prev,
  accounts: prev.accounts.filter(a => a.id !== id),
  expenses: prev.expenses.map(e =>
    e.linkedAccountId === id
      ? { ...e, linkedAccountId: undefined }
      : e
  ),
}))
```

This ensures that if the user later creates a new account with the same ID (unlikely but possible with `crypto.randomUUID()`), the old linkage doesn't ghost-apply.

---

## Savings Forecast Computation (Overview Tab)

While the forecast is *displayed* on the Overview tab, the computation logic is documented here because it is driven entirely by `data.accounts`:

```ts
function projectAccount(account: SavingsAccount): number[] {
  const points = [account.balance]
  for (let i = 1; i <= 12; i++) {
    const prev     = points[i - 1]
    const interest = prev * (account.annualReturnPercent / 100 / 12)
    points.push(prev + account.monthlyContribution + interest)
  }
  return points
}

const projection = Array.from({ length: 13 }, (_, month) =>
  data.accounts.reduce(
    (sum, acc) => sum + projectAccount(acc)[month],
    0
  )
)
```

**Why per-account projection:** Summing balances first then applying a single "average" rate would be mathematically incorrect when accounts have different return rates. Projecting each account separately and summing the results is the accurate approach.

**Compound interest note:** Interest compounds monthly, not daily. The formula `balance × (annualRate / 12)` is a standard monthly compounding approximation.

---

## `liquidBalance` Function

This helper is used by the goal allocation engine. It lives in `savingsEngine.ts` (not in the Savings component):

```ts
export function liquidBalance(
  accounts: SavingsAccount[],
  emergencyBufferMonths: number,
  monthlyExpenses: number
): number {
  const liquid = accounts
    .filter(a => a.liquidity === 'immediate' || a.liquidity === 'short')
    .reduce((sum, a) => sum + a.balance, 0)

  const reserved = emergencyBufferMonths * monthlyExpenses
  return Math.max(0, liquid - reserved)
}
```

This is called inside `allocateGoals` — not directly by the Savings component.

---

## Monthly Contribution Display in Savings.tsx

The Savings component needs to determine whether a contribution is manually set or auto-synced from an expense. It does this by looking up whether any expense references each account:

```ts
const linkedExpenseFor = (accountId: string): Expense | undefined =>
  data.expenses.find(
    e => e.linkedAccountId === accountId && e.category === 'savings'
  )
```

If a linked expense exists:
- The contribution field in the edit dialog is rendered as `disabled`
- A link badge is shown on the card: `[🔗 {expense.name}]`
- Tooltip: "Auto-synced from linked savings expense. Edit the expense to change."

If no linked expense:
- The contribution field is editable normally
- No link badge is shown

---

## Test Coverage

| Test file | Tests | What is covered |
|---|---|---|
| `src/test/savingsLinkage.test.ts` | 20 | Add/update/delete account sync, yearly÷12 normalisation, account switch (reset old + set new), ghost ID edge case, multi-account isolation |

**Key scenarios tested:**

| Scenario | Expected behaviour |
|---|---|
| Add savings expense with `linkedAccountId` | Account `monthlyContribution` = expense monthly amount |
| Add yearly savings expense | Account contribution = `amount / 12` (not full amount) |
| Update expense amount (same account) | Account contribution updated to new monthly amount |
| Update `linkedAccountId` to different account | Old account → 0; new account → new amount |
| Remove `linkedAccountId` from existing expense | Old account → 0 |
| Change category from 'savings' to 'food' | Old account → 0; `linkedAccountId` cleared |
| Delete savings expense with link | Account → 0 |
| Delete savings account | `linkedAccountId` cleared on linked expenses |
| Multiple expenses linked to same account | Last write wins (only one expense can own the contribution) |
| Expense linked to non-existent account ID | No error thrown; accounts array unchanged |

---

## Architecture Notes

- **No local state for account data:** The Savings component reads from `useFinance()` only. It holds only dialog open/closed state and the form values being edited.
- **Account ID stability:** `crypto.randomUUID()` is used for account IDs. These IDs are stable across sessions — they are persisted in `FinanceData` and synced to Supabase. Changing an account's ID would break all expense linkages.
- **`monthlyContribution` is the FCF truth:** Even if the user edits the account contribution manually (without a linked expense), that value feeds into `totalContributions` and therefore FCF. The Savings component does not validate or constrain this — it trusts the user's input.
- **No lazy loading needed:** The Savings tab is lightweight (one component, no heavy charts). The savings forecast chart is on the Overview tab and is already covered by Overview's rendering budget.
