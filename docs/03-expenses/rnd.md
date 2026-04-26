# Expenses Tab — Engineering & Implementation Notes

## Files

| File | Purpose |
|---|---|
| `src/components/Expenses.tsx` | Main Expenses tab — list, budget bars, compare toggle, dialogs |
| `src/lib/aiAdvisor.ts` | AI integration — `scanReceipt`, `explainPlan`, Anthropic API client |
| `src/lib/categories.ts` | `EXPENSE_CATEGORIES` constant — single source of truth for all category metadata |

---

## Savings Linkage — Atomic Sync

This is one of the most important correctness guarantees in the app: when a savings-category expense is added, updated, or deleted, the linked account's `monthlyContribution` is updated **in the same `setData` call**. There is never a moment where the expense and account are out of sync.

### `addExpense`

```ts
setData(prev => {
  const newExpense = { ...expense, id: crypto.randomUUID() }
  const expenses   = [...prev.expenses, newExpense]
  let   accounts   = prev.accounts

  if (newExpense.category === 'savings' && newExpense.linkedAccountId) {
    accounts = accounts.map(acc =>
      acc.id === newExpense.linkedAccountId
        ? { ...acc, monthlyContribution: monthlyAmount(newExpense) }
        : acc
    )
  }

  return { ...prev, expenses, accounts }
})
```

### `updateExpense`

The most complex case — handles four scenarios for the linked account:

```ts
setData(prev => {
  const old = prev.expenses.find(e => e.id === id)
  const updated = { ...old, ...updates }
  const expenses = prev.expenses.map(e => e.id === id ? updated : e)

  let accounts = prev.accounts

  // Reset old account if linkage changes or category changes away from savings
  if (old.linkedAccountId && old.linkedAccountId !== updated.linkedAccountId) {
    accounts = accounts.map(acc =>
      acc.id === old.linkedAccountId
        ? { ...acc, monthlyContribution: 0 }
        : acc
    )
  }

  // Set new account's contribution
  if (updated.category === 'savings' && updated.linkedAccountId) {
    accounts = accounts.map(acc =>
      acc.id === updated.linkedAccountId
        ? { ...acc, monthlyContribution: monthlyAmount(updated) }
        : acc
    )
  }

  return { ...prev, expenses, accounts }
})
```

### `deleteExpense`

```ts
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

---

## Receipt Scan Flow

The full flow lives in `Expenses.tsx` (orchestration) and `src/lib/aiAdvisor.ts` (API call).

### Step 1 — File Input Trigger

A hidden `<input>` element is used to trigger the native camera/file picker:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  capture="environment"   // opens rear camera on mobile
  className="hidden"
  onChange={handleFileSelect}
/>
```

`capture="environment"` opens the device's rear camera on mobile. On desktop, it falls back to a file picker.

### Step 2 — FileReader → Base64

```ts
const reader = new FileReader()
reader.onload = async (e) => {
  const dataUrl  = e.target?.result as string
  const base64   = dataUrl.split(',')[1]    // strip "data:image/jpeg;base64," prefix
  const mimeType = file.type               // e.g. "image/jpeg"
  await callScanReceipt(base64, mimeType)
}
reader.readAsDataURL(file)
```

The image is never assigned to any variable outside this function scope.

### Step 3 — Anthropic API Call (`scanReceipt`)

In `src/lib/aiAdvisor.ts`:

```ts
export async function scanReceipt(
  base64: string,
  mimeType: string,
  lang: Language
): Promise<ReceiptScanResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract the expense from this receipt. Reply with JSON only:
{"name":"<short description>","amount":<number>,"category":"<one of: ${VALID_CATEGORIES.join('|')}>"}
No markdown. No explanation.`,
          },
        ],
      }],
    }),
  })

  const json = await response.json()
  const text = json.content[0].text.replace(/```json?|```/g, '').trim()
  const parsed = JSON.parse(text)

  // Safe defaults
  return {
    name:     typeof parsed.name     === 'string' ? parsed.name     : 'Receipt',
    amount:   typeof parsed.amount   === 'number' ? parsed.amount   : 0,
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
  }
}
```

**Model:** `claude-haiku-4-5` — chosen for speed and low cost; the prompt is simple enough that the smaller model handles it reliably.

**Header `anthropic-dangerous-direct-browser-access: true`:** Required to call the Anthropic API directly from a browser. This is acceptable here because the API key is user-supplied via an environment variable and the app is a personal household tool, not a multi-tenant SaaS.

### Step 4 — Form Pre-fill

```ts
setFormValues(prev => ({
  ...prev,
  name:     result.name,
  amount:   result.amount,
  category: result.category,
}))
setScanStatus('success')
```

### Step 5 — Cleanup

After the form is pre-filled, `base64` goes out of scope. No image bytes are stored in state, localStorage, or Supabase.

---

## Safe Defaults in `scanReceipt`

The function never throws on bad AI output — it always returns a usable result:

| Scenario | Fallback |
|---|---|
| `name` missing or not a string | `"Receipt"` |
| `amount` missing, negative, or not a number | `0` |
| `category` not in VALID_CATEGORIES | `"other"` |
| JSON parse fails | Catch → return all-defaults |
| Network/API error | Catch → `setScanStatus('error')` in component |

---

## Test Coverage

| Test file | Tests | What is covered |
|---|---|---|
| `src/test/expenseFeatures.test.ts` | 35 | F1 fixed/variable, F2 budget limits, F3 MoM deltas, F4 sinking funds, F5 actuals log |
| `src/test/savingsLinkage.test.ts` | 20 | Add/update/delete account sync, yearly÷12, account switch, ghost IDs, multi-account isolation |
| `src/test/historicalExpenses.test.ts` | 11 | add/delete/update items, category change, clamp to 0, backward compatibility |
| `src/test/addExpenseToMonth.test.ts` | 20 | Stub creation, fixed pre-population, variable excluded, existing snapshot, year boundary |
| `src/test/receiptScan.test.ts` | 20 | Valid JSON, markdown fences stripped, missing fields use defaults, invalid category → 'other', JSON parse error, network error |

**Key edge cases tested:**

- Savings linkage: update to a different `linkedAccountId` — old account resets to 0, new account gets contribution
- Savings linkage: change category from 'savings' to 'food' — linked account contribution reset to 0
- Yearly expense: `monthlyAmount` correctly returns `amount / 12` not `amount`
- Stub snapshot: variable expenses are excluded from pre-population; only `recurring && expenseType === 'fixed'`
- `addExpenseToMonth` on a month with an existing real snapshot: historical expense appended, `categoryActuals` updated
- Receipt scan: model returns extra whitespace or markdown code fences — stripped before JSON parse
- Receipt scan: `amount` returned as string `"12.50"` — coerced or falls back to 0 (type check)
