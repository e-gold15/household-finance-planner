# Overview Tab — Engineering & Implementation Notes

## File

**`src/components/Overview.tsx`** (~330 lines)

This is a single React functional component. It imports from the finance context, the savings engine, and Recharts. It renders all Overview content directly — no child route or lazy boundary is needed at current scale.

---

## Dependencies

| Dependency | Used for |
|---|---|
| `recharts` (`PieChart`, `AreaChart`, `BarChart`, `Cell`, `Tooltip`, `Legend`) | Budget Health donut, Expense pie, Savings bars, Savings Forecast area |
| `lucide-react` (`TrendingUp`, `TrendingDown`, `Sparkles`, `Link2`, etc.) | KPI card icons, surplus banner icon, trend arrows |
| `allocateGoals` from `src/lib/savingsEngine.ts` | Goal status computation |
| `SurplusBanner` from `src/components/SurplusBanner.tsx` | Surplus banner sub-component |
| `getNetMonthly` from `src/lib/taxEstimation.ts` | Net income per source |
| `useFinance` from `src/context/FinanceContext.tsx` | All finance data + write methods |
| `t` from `src/lib/utils.ts` | i18n string helper |

---

## MoM Trend Formula

The month-over-month trend is computed on the two most recent **non-stub** snapshots (where `totalIncome > 0`):

```ts
const nonStubHistory = data.history
  .filter(s => s.totalIncome > 0)
  .sort((a, b) => b.date.localeCompare(a.date))  // newest first

const curr = nonStubHistory[0]
const prev = nonStubHistory[1]

if (!curr || !prev) return null  // not enough history

const incomePct  = ((curr.totalIncome   - prev.totalIncome)   / prev.totalIncome)  * 100
const expensePct = ((curr.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100
```

The result is rounded to one decimal place for display (`3.2%`).

**Edge cases:**
- If `prev.totalIncome === 0` or `prev.totalExpenses === 0`, the division is skipped and the pill is hidden for that metric (avoids divide-by-zero).
- If only one non-stub snapshot exists, both pills are hidden.

---

## Budget Health Gauge

### Classification logic

```ts
const budgetHealth = Object.keys(spendByCategory).map(cat => {
  const spent  = spendByCategory[cat]  // monthly-normalised
  const budget = data.categoryBudgets[cat]

  if (!budget) return { cat, status: 'none', ratio: Infinity }

  const ratio = spent / budget
  const status =
    ratio > 1.0 ? 'over'    :
    ratio > 0.8 ? 'warning' :
                  'under'

  return { cat, status, ratio }
})
```

### Worst offender

```ts
const worstOffender = budgetHealth
  .filter(b => b.status === 'over')
  .sort((a, b) => b.ratio - a.ratio)[0]
```

### Donut chart data array

```ts
const gaugeData = [
  { name: 'On track', value: countUnder,   fill: 'hsl(var(--primary))' },
  { name: 'Warning',  value: countWarning, fill: 'hsl(var(--warning))' },
  { name: 'Over',     value: countOver,    fill: 'hsl(var(--destructive))' },
  { name: 'No budget',value: countNone,    fill: 'hsl(var(--muted-foreground))' },
]
// Zero-value slices are filtered before passing to Recharts to avoid ghost sectors
```

---

## Upcoming Bills Algorithm

```ts
const today = new Date()
const sixMonthsLater = addMonths(today, 6)

const upcomingBills = data.expenses
  .filter(e => e.period === 'yearly' && e.dueMonth != null)
  .map(e => {
    const thisYear  = new Date(today.getFullYear(), e.dueMonth - 1, 1)
    const nextYear  = new Date(today.getFullYear() + 1, e.dueMonth - 1, 1)
    const nextDue   = thisYear >= today ? thisYear : nextYear
    const daysUntil = differenceInDays(nextDue, today)
    return { ...e, nextDue, daysUntil }
  })
  .filter(e => e.nextDue <= sixMonthsLater)
  .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
```

**Countdown badge thresholds:**
- `daysUntil < 30` → `variant="warning"` — "In N days"
- `daysUntil < 56` (8 weeks) → `variant="outline"` — "In N weeks"
- Otherwise → `variant="secondary"` — "In N months"

---

## Savings Projection Formula

The projection tracks each account independently to accurately model compound interest at different return rates:

```ts
function projectAccount(account: SavingsAccount, months = 12): number[] {
  const points: number[] = [account.balance]
  for (let i = 1; i <= months; i++) {
    const prev = points[i - 1]
    const interest = prev * (account.annualReturnPercent / 100 / 12)
    points.push(prev + account.monthlyContribution + interest)
  }
  return points
}

// Sum across all accounts per month index
const savingsProjection = Array.from({ length: 13 }, (_, i) =>
  data.accounts.reduce((sum, acc) => sum + projectAccount(acc)[i], 0)
)
```

**Known limitation:** The projection assumes a fixed monthly contribution and flat return rate. It does not model variable contributions, goal withdrawals, or changes in return rate over time. This limitation is noted in the UI tooltip.

---

## Goal Status Donut

Goal statuses are driven entirely by `allocateGoals` — not by any status field stored in the data model.

```ts
const goalAllocations = useMemo(() =>
  allocateGoals({
    goals: data.goals,
    monthlySurplus: freeCashFlow,
    accounts: data.accounts,
    emergencyBufferMonths: data.emergencyBufferMonths,
    monthlyExpenses: totalExpenses,
  }),
  [data.goals, data.accounts, freeCashFlow, data.emergencyBufferMonths, totalExpenses]
)
```

This is `allocateGoals` (the display/planning function), **not** `autoAllocateSavings` (the action engine). The distinction is important: `allocateGoals` is a pure read function that returns statuses; `autoAllocateSavings` is called only when the user clicks "Recalculate" in the Goals tab.

---

## Surplus Banner Trigger

```ts
const surplusTrigger = useMemo(() => {
  const nonStub = data.history
    .filter(s => s.totalIncome > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  const lastSnapshot = nonStub[0]
  if (!lastSnapshot) return null

  const snapshotDate = new Date(lastSnapshot.date)
  const now = new Date()
  const isPastMonth =
    snapshotDate.getFullYear() < now.getFullYear() ||
    (snapshotDate.getFullYear() === now.getFullYear() &&
     snapshotDate.getMonth() < now.getMonth())

  const surplus = lastSnapshot.totalIncome
    - lastSnapshot.totalExpenses
    - lastSnapshot.totalSavings

  if (surplus > 0 && isPastMonth && !lastSnapshot.surplusActioned) {
    return { surplus, snapshot: lastSnapshot }
  }
  return null
}, [data.history])
```

**Session dismiss:** stored in local React state (`useState<boolean>`). Persists only for the browser session.

**Permanent dismiss:** calls `markSurplusActioned(snapshot.date)` which sets `snapshot.surplusActioned = true` in `data.history` and syncs to cloud. The banner will not reappear for this snapshot on any device.

---

## Performance

All expensive computations are wrapped in `useMemo` with precise dependency arrays:

| Computed value | Key dependencies |
|---|---|
| `totalIncome` | `data.members` |
| `totalExpenses` | `data.expenses` |
| `freeCashFlow` | `totalIncome`, `totalExpenses`, `data.accounts` |
| `budgetHealth` | `data.expenses`, `data.categoryBudgets` |
| `upcomingBills` | `data.expenses` |
| `goalAllocations` | `data.goals`, `data.accounts`, `freeCashFlow`, `data.emergencyBufferMonths`, `totalExpenses` |
| `savingsProjection` | `data.accounts` |
| `momTrend` | `data.history` |
| `surplusTrigger` | `data.history` |

No computation runs on every render. Charts re-render only when their specific data dependencies change.

---

## Test Coverage

| Test file | Tests | What is covered |
|---|---|---|
| `src/test/overviewUtils.test.ts` | 31 | MoM trend formula, budget health classification, upcoming bills algorithm, savings projection, stub filtering |
| `src/test/surplusAction.test.ts` | 24 | Banner trigger conditions, session vs permanent dismiss, `markSurplusActioned` idempotency, past-month detection |

**Key edge cases tested:**
- Fewer than 2 non-stub snapshots → trend returns `null`
- All categories have no budget → gauge is all-grey
- Yearly expense due month already passed → wraps to next year
- Account with 0% annual return → flat projection (no interest added)
- `freeCashFlow < 0` → all goals show "Blocked"
- Stub snapshot in last position → surplus banner does not trigger
- `surplusActioned = true` → banner suppressed even with positive FCF

---

## Architecture Notes

- **No child routes:** Overview is a flat component, not a routed sub-page
- **No lazy loading:** At current bundle size, eager loading is acceptable. If the Overview chart bundle grows past 200 KB gzipped, consider lazy-loading Recharts
- **SurplusBanner is a separate component** (`src/components/SurplusBanner.tsx`) to keep Overview.tsx under 350 lines and to allow independent testing of banner state logic
- **No local state for financial values:** all derived values live in `useMemo`, never in `useState` — this prevents stale values after context updates
