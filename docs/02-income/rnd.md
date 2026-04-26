# Income Tab — Engineering & Implementation Notes

## Files

| File | Purpose |
|---|---|
| `src/components/Income.tsx` | Main Income tab component — member panels, source rows, dialogs |
| `src/lib/taxEstimation.ts` | Tax engine — `getNetMonthly`, IL brackets, foreign brackets, BL/HT |

---

## Israeli Tax Engine — Full Computation Chain

The engine is a pure function chain with no side effects. All figures are in NIS (₪) and monthly.

### Step 1 — Monthly Gross

```ts
const monthlyGross = source.period === 'yearly'
  ? source.amount / 12
  : source.amount
```

### Step 2 — Progressive Income Tax (7 brackets, 2024 rates)

```ts
const IL_BRACKETS = [
  { upTo: 7010,   rate: 0.10 },
  { upTo: 10060,  rate: 0.14 },
  { upTo: 16150,  rate: 0.20 },
  { upTo: 20990,  rate: 0.31 },
  { upTo: 43370,  rate: 0.35 },
  { upTo: 56070,  rate: 0.47 },
  { upTo: Infinity, rate: 0.50 },
]
```

Tax is computed by applying each marginal rate to the income within that bracket:

```ts
let remainingIncome = monthlyGross
let incomeTax = 0
for (const bracket of IL_BRACKETS) {
  const taxable = Math.min(remainingIncome, bracket.upTo - previousBracketTop)
  incomeTax += taxable * bracket.rate
  remainingIncome -= taxable
  if (remainingIncome <= 0) break
}
```

### Step 3 — Credit Point Deduction

Each credit point reduces tax by ₪242/month (2024 value):

```ts
const CREDIT_POINT_VALUE = 242  // ₪/month
incomeTax = Math.max(0, incomeTax - source.taxCreditPoints * CREDIT_POINT_VALUE)
```

Credit points cannot reduce income tax below zero.

### Step 4 — Bituach Leumi (Social Insurance)

Tiered rates applied to the **insured salary** (`monthlyGross × insuredSalaryRatio / 100`), capped at ₪49,030/month:

```ts
const BL_CAP = 49030
const insuredSalary = Math.min(monthlyGross * (source.insuredSalaryRatio / 100), BL_CAP)

const BL_BRACKETS = [
  { upTo: 7522,     rate: 0.004 },
  { upTo: BL_CAP,   rate: 0.07  },
]
// Same marginal application as income tax
```

### Step 5 — Health Tax (Mas Briut)

Same cap (`₪49,030/month`), different rates:

```ts
const HT_BRACKETS = [
  { upTo: 7522,   rate: 0.031 },
  { upTo: BL_CAP, rate: 0.05  },
]
```

### Step 6 — Employee Pension Contribution

```ts
const pensionDeduction = source.useContributions
  ? monthlyGross * (source.pensionEmployee / 100)
  : 0
```

### Step 7 — Education Fund Employee Contribution

```ts
const eduDeduction = source.useContributions
  ? monthlyGross * (source.educationFundEmployee / 100)
  : 0
```

### Step 8 — Net Take-Home

```ts
const netMonthly = monthlyGross
  - incomeTax
  - bituachLeumi
  - healthTax
  - pensionDeduction
  - eduDeduction

return Math.max(0, netMonthly)  // never negative
```

---

## Foreign Country Bracket Estimates

For countries other than Israel, a simplified single-bracket flat-rate estimate is used. No BL/HT is applied.

```ts
const FOREIGN_RATES: Record<string, number> = {
  US: 0.28,
  UK: 0.32,
  DE: 0.35,
  FR: 0.38,
  CA: 0.30,
}

function computeForeignNet(monthlyGross: number, country: string): number {
  const rate = FOREIGN_RATES[country] ?? 0.30
  return monthlyGross * (1 - rate)
}
```

This is a planning estimate only — no progressive brackets for foreign countries. The UI shows a disclaimer: "Simplified estimate — consult a tax advisor."

---

## Manual Net Override Path

```ts
if (source.useManualNet) {
  let net = source.manualNetOverride ?? 0
  if (source.useContributions) {
    // Still deduct contributions even from a manual net
    const gross = source.period === 'yearly' ? source.amount / 12 : source.amount
    net -= gross * (source.pensionEmployee / 100)
    net -= gross * (source.educationFundEmployee / 100)
  }
  return Math.max(0, net)
}
```

When `useManualNet = true`, the gross amount field in the dialog is still used to compute contribution deductions (so the user can enter their gross for contribution purposes without enabling the full tax engine).

---

## Tax Breakdown Object

The engine also exports a `getTaxBreakdown(source)` function that returns a detailed object for the expandable tax summary UI:

```ts
interface TaxBreakdown {
  monthlyGross:      number
  incomeTax:         number
  creditPointRelief: number
  bituachLeumi:      number
  healthTax:         number
  pensionEmployee:   number
  educationFund:     number
  netTakeHome:       number
}
```

This is computed separately from `getNetMonthly` only when the user expands the breakdown row — it is not called on every render.

---

## `addIncomeToMonth` Implementation

Located in `FinanceContext.tsx`:

```ts
addIncomeToMonth(year: number, month: number, item: Omit<HistoricalIncome, 'id'>) {
  setData(prev => {
    const snapshotKey = `${year}-${String(month).padStart(2, '0')}`
    let snapshots = [...prev.history]
    let idx = snapshots.findIndex(s => s.date === snapshotKey)

    if (idx === -1) {
      // Create stub with fixed expenses pre-populated
      const stub = createStubSnapshot(snapshotKey, prev.expenses)
      snapshots.push(stub)
      idx = snapshots.length - 1
    }

    const snapshot = { ...snapshots[idx] }
    const newItem: HistoricalIncome = { ...item, id: crypto.randomUUID() }

    snapshot.historicalIncomes = [...(snapshot.historicalIncomes ?? []), newItem]
    snapshot.totalIncome = (snapshot.totalIncome ?? 0) + item.amount
    snapshot.freeCashFlow = snapshot.totalIncome
                          - snapshot.totalExpenses
                          - snapshot.totalSavings

    snapshots[idx] = snapshot
    return { ...prev, history: snapshots }
  })
}
```

`createStubSnapshot` pre-populates `categoryActuals` and `totalExpenses` from fixed recurring expenses (the v2.4.1 pattern), so the stub shows a realistic expense baseline even before any income is recorded.

---

## Test Coverage

| Test file | Tests | What is covered |
|---|---|---|
| `src/test/taxEstimation.test.ts` | 22 | IL progressive brackets, BL/HT caps and tiers, credit point deduction, contribution deductions, manual override, foreign brackets |
| `src/test/historicalIncome.test.ts` | 13 | add/delete/update income items, FCF recompute, clamp-to-zero guard, backward compatibility with snapshots missing `historicalIncomes` |
| `src/test/addIncomeToMonth.test.ts` | 26 | Existing snapshot found, stub creation, fixed expense pre-population, FCF computed immediately (not 0), immutability of prior snapshots, year boundary clamping |

**Key edge cases tested:**

- Salary at the exact BL cap (₪49,030) — boundary case for BL/HT
- Credit points exceeding income tax → net tax clamped to 0
- `insuredSalaryRatio = 0` → no BL or HT
- `pensionEmployee = 0` + `useContributions = true` → no deduction
- Manual override with `manualNetOverride = undefined` → treated as 0
- Foreign country not in `FOREIGN_RATES` map → falls back to 30% rate
- `addIncomeToMonth` on current month → rejected (past months only)
- Adding income to a month that already has a non-stub snapshot → income appended, totals updated
