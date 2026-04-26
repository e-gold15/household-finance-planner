# Income Tab — Data Layer

## Core Types

### `IncomeSource`

Represents a single stream of income for a household member. Stored in `member.sources[]`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (`crypto.randomUUID()`) |
| `name` | `string` | Human label — e.g. "Salary at Google" |
| `amount` | `number` | Always stored as a **monthly** figure internally |
| `period` | `'monthly' \| 'yearly'` | The period the user entered the amount in |
| `type` | `IncomeType` | salary / freelance / business / rental / investment / pension / other |
| `isGross` | `boolean` | `true` = user entered gross; `false` = user entered net |
| `useManualNet` | `boolean` | If `true`, bypass the tax engine and use `manualNetOverride` |
| `manualNetOverride` | `number \| undefined` | The manual net monthly amount |
| `country` | `string` | ISO country code — `'IL'` (default) / `'US'` / `'UK'` / `'DE'` / `'FR'` / `'CA'` |
| `taxCreditPoints` | `number` | IL only — default 2.25 |
| `insuredSalaryRatio` | `number` | 0–100 — % of salary subject to BL/HT (IL only) |
| `useContributions` | `boolean` | Whether to deduct employee contributions from net |
| `pensionEmployee` | `number` | % of gross (default 6%) |
| `educationFundEmployee` | `number` | % of gross (default 2.5%) |
| `pensionEmployer` | `number` | % of gross — informational only |
| `educationFundEmployer` | `number` | % of gross — informational only |
| `severanceEmployer` | `number` | % of gross — informational only |

**Period normalisation:** when `period === 'yearly'`, the stored `amount` is the annual total. All calculations use `amount / 12` internally. The UI always displays the monthly figure.

---

### `HouseholdMember`

Represents one person in the household.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `name` | `string` | Member's display name |
| `sources` | `IncomeSource[]` | All income streams for this member |

Members are stored in `FinanceData.members[]`.

---

### `HistoricalIncome`

A one-time income entry recorded against a past month's snapshot. Not a recurring source.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `memberName` | `string` | Free text — member's name (not a foreign key) |
| `amount` | `number` | Net monthly amount for that one-time entry |
| `note` | `string \| undefined` | Optional description (e.g. "Q1 bonus") |

Stored in `MonthSnapshot.historicalIncomes[]`.

---

## Key Computation: `getNetMonthly(source)`

Defined in `src/lib/taxEstimation.ts`. This is the central function for all income display and totalling.

```
getNetMonthly(source: IncomeSource): number
```

**Decision tree:**

```
if useManualNet:
  base = manualNetOverride (or 0 if undefined)
  if useContributions:
    base -= gross * pensionEmployee / 100
    base -= gross * educationFundEmployee / 100
  return Math.max(0, base)

else if isGross:
  monthlyGross = period === 'yearly' ? amount / 12 : amount
  return computeILNet(monthlyGross, source)   // or foreign bracket
       minus contributions (if useContributions)

else:
  return period === 'yearly' ? amount / 12 : amount
```

**Total household income:**
```ts
totalIncome = data.members
  .flatMap(m => m.sources)
  .reduce((sum, s) => sum + getNetMonthly(s), 0)
```

---

## Context Methods

All income mutations go through `FinanceContext`. Components never write to localStorage directly.

| Method | Signature | What it does |
|---|---|---|
| `addMember` | `(name: string) => void` | Creates a new `HouseholdMember` with an empty `sources[]` |
| `updateMember` | `(id, updates) => void` | Updates member name or sources list |
| `deleteMember` | `(id: string) => void` | Removes the member and all their income sources |
| `addSource` | `(memberId, source) => void` | Appends a new `IncomeSource` to a member's `sources[]` |
| `updateSource` | `(memberId, sourceId, updates) => void` | Updates fields on an existing source |
| `deleteSource` | `(memberId, sourceId) => void` | Removes a source from the member |
| `addIncomeToMonth` | `(year, month, item) => void` | Adds a `HistoricalIncome` to the target snapshot |

### `addIncomeToMonth` Detail

This method handles recording a one-time past income entry:

1. Find the existing `MonthSnapshot` for `(year, month)` in `data.history`
2. If not found, create a stub snapshot (with fixed recurring expenses pre-populated in `categoryActuals`, matching the v2.4.1 pattern)
3. Append the `HistoricalIncome` item to `snapshot.historicalIncomes[]`
4. Recompute the snapshot's `totalIncome`:
   ```ts
   snapshot.totalIncome += item.amount
   ```
5. Recompute FCF atomically:
   ```ts
   snapshot.freeCashFlow = snapshot.totalIncome
                         - snapshot.totalExpenses
                         - snapshot.totalSavings
   ```
6. If this snapshot was previously a stub (income was 0), the stub badge in the History tab auto-transitions to show real FCF

---

## FCF Recomputation on Historical Income Change

Any operation on `historicalIncomes[]` triggers an atomic recompute of the snapshot's financial totals.

**Add:** `totalIncome += item.amount`, then `FCF = totalIncome - totalExpenses - totalSavings`

**Update (amount changed):**
```ts
totalIncome += (newAmount - oldAmount)
FCF = totalIncome - totalExpenses - totalSavings
```

**Delete:**
```ts
totalIncome = Math.max(0, totalIncome - item.amount)  // clamp to 0 guard
FCF = totalIncome - totalExpenses - totalSavings
```

The `Math.max(0, ...)` guard prevents `totalIncome` from going negative due to rounding or data inconsistency.

---

## Data Flow

```
User enters income source
        ↓
addSource / updateSource (FinanceContext)
        ↓
data.members[] updated in state
        ↓
setData triggers localStorage write + Supabase debounced push (1.5s)
        ↓
useFinance() consumers re-render with new data
        ↓
Overview tab recomputes totalIncome, FCF, trend
```

```
User adds past income entry
        ↓
addIncomeToMonth(year, month, item) (FinanceContext)
        ↓
Finds or creates MonthSnapshot in data.history[]
        ↓
Appends HistoricalIncome, recomputes totalIncome + FCF atomically
        ↓
setData → localStorage + Supabase push
        ↓
History tab reflects new entry; stub badge updates if applicable
```

---

## Storage

| Location | What is stored |
|---|---|
| `data.members[]` in `FinanceData` | All recurring income sources and member definitions |
| `snapshot.historicalIncomes[]` in `data.history[]` | One-time past income entries per month |
| `household_finance.data` (Supabase) | Full `FinanceData` object — synced on every `setData` call (debounced) |

Income data is **never** stored in Supabase Auth or any user profile table. It lives entirely in `household_finance.data` keyed by `household_id`.
