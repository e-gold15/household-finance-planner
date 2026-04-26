# History — Engineering Reference

## Key Files

| File | Responsibility |
|------|---------------|
| `src/components/History.tsx` | History tab UI — snapshot cards, trend chart, dialogs |
| `src/context/FinanceContext.tsx` | All snapshot and historical item mutation methods |
| `src/lib/cloudFinance.ts` | `mergeFinanceData()` — cloud data merge; triggers `repairSnapshotTotals` |

---

## Atomic Update Pattern

Every add, edit, or delete of a historical expense or income item is handled in a **single `setData()` call**. There are no two-step updates where totals are written separately.

### Example — `addHistoricalExpense`

```typescript
setData(prev => {
  const snapshots = prev.history.map(snapshot => {
    if (snapshot.id !== snapshotId) return snapshot

    const updatedItems = [...(snapshot.historicalExpenses ?? []), newItem]

    // Atomically update categoryActuals
    const updatedActuals = { ...(snapshot.categoryActuals ?? {}) }
    updatedActuals[newItem.category] =
      (updatedActuals[newItem.category] ?? 0) + newItem.amount

    // Recompute derived totals
    const totalExpenses = Object.values(updatedActuals).reduce((s, v) => s + v, 0)
    const freeCashFlow = snapshot.totalIncome - totalExpenses - snapshot.totalSavings

    return {
      ...snapshot,
      historicalExpenses: updatedItems,
      categoryActuals: updatedActuals,
      totalExpenses,
      freeCashFlow,
    }
  })

  return { ...prev, history: snapshots }
})
```

This pattern guarantees that `totalExpenses` and `freeCashFlow` are always consistent with `categoryActuals`. There is no window where a snapshot is partially updated.

The same pattern applies to `updateHistoricalExpense`, `deleteHistoricalExpense`, `addHistoricalIncome`, `updateHistoricalIncome`, `deleteHistoricalIncome`, and `updateSnapshotActuals`.

---

## `repairSnapshotTotals`

### Signature

```typescript
function repairSnapshotTotals(data: FinanceData): FinanceData
```

### Implementation

```typescript
function repairSnapshotTotals(data: FinanceData): FinanceData {
  const repairedHistory = data.history.map(snapshot => {
    const actuals = snapshot.categoryActuals ?? {}
    const totalExpenses = Object.values(actuals).reduce((s, v) => s + v, 0)
    const freeCashFlow = snapshot.totalIncome - totalExpenses - (snapshot.totalSavings ?? 0)
    return { ...snapshot, totalExpenses, freeCashFlow }
  })
  return { ...data, history: repairedHistory }
}
```

### Call sites

```
FinanceContext.load()
  └── reads localStorage
  └── repairSnapshotTotals(parsed)   ← call 1

FinanceContext.mount (useEffect)
  └── fetchCloudFinanceData()
  └── mergeFinanceData(local, cloud)
  └── repairSnapshotTotals(merged)   ← call 2  (critical — bypasses load())
  └── setDataState(repaired)
```

If `repairSnapshotTotals` were only called in `load()`, cloud-merged data would bypass the repair pass entirely. Bugs in `totalExpenses` from v2.3–v2.5 would persist on any device that did a cloud sync. The post-merge call ensures this can never happen.

---

## Cloud Sync Data Path

Full sequence from mount to render:

```
1. FinanceProvider mounts
2. load() called
   a. Read localStorage hf-data-{householdId}
   b. repairSnapshotTotals(parsed)
   c. setDataState(repaired)        ← first render with local data

3. useEffect fires (async)
   a. fetchCloudFinanceData()       ← Supabase SELECT
   b. If cloud row exists:
      mergeFinanceData(local, cloud)
      repairSnapshotTotals(merged)
      setDataState(repaired)        ← second render with merged data
   c. If no cloud row AND local has data:
      pushCloudFinanceData(local)   ← seed the cloud (owner bootstrap)

4. On every setData() call:
   - Writes to localStorage immediately
   - Debounced pushCloudFinanceData() after 1500ms
```

**Key invariant:** `setDataState` is always called with repaired data. No component ever receives a snapshot where `totalExpenses !== sum(categoryActuals)`.

---

## Stub Snapshot Lifecycle

```
User adds retroactive expense/income
      │
      ▼
addExpenseToMonth / addIncomeToMonth
      │
      ├─ Existing snapshot for that month?
      │         YES → addHistoricalExpense/Income to it
      │
      └─ NO → Create stub:
               totalIncome = 0
               categoryActuals = { fixed expenses pre-populated }
               totalExpenses = sum(fixed expenses)
               freeCashFlow = -totalExpenses
               historicalExpenses = []
               historicalIncomes = []
               │
               └─ Then add the new item to the stub
                  (which updates categoryActuals and totals atomically)

Later: user adds first income to the stub
      │
      └─ addHistoricalIncome increments totalIncome
         freeCashFlow becomes totalIncome - totalExpenses - totalSavings
         FCF badge on card updates from "—" to coloured value
         BUT: snapshot is still a stub (totalIncome is now > 0 only after this call)
         AND: it is NOW usable as FCF source for Goals engine
```

Note: once a stub has income (`totalIncome > 0`), it becomes indistinguishable from a real snapshot for purposes of the Goals engine FCF source. The "(fixed expenses only)" label is still shown because `surplusActioned` is absent, but the FCF is now meaningful.

---

## Test Coverage

| Test file | Tests | What is covered |
|-----------|-------|----------------|
| `src/test/historicalExpenses.test.ts` | 11 | `addHistoricalExpense`, `deleteHistoricalExpense`, `updateHistoricalExpense`: categoryActuals update, clamp-to-0 on delete, backward compat (no categoryActuals field), category change on update |
| `src/test/historicalIncome.test.ts` | 13 | `addHistoricalIncome`, `deleteHistoricalIncome`, `updateHistoricalIncome`: FCF recompute, clamp-to-zero on delete, backward compat, stub FCF transition |
| `src/test/addExpenseToMonth.test.ts` | 20 | Stub creation, fixed expense pre-population, existing snapshot found, year boundary (Dec→Jan), stub visual indicator, immutability |
| `src/test/addIncomeToMonth.test.ts` | 26 | FCF computed on creation (not zero), existing snapshot found, fixed pre-pop, immutability, year boundary, multiple income items accumulate correctly |

**Total: 70 tests** covering the History feature set.

### Running tests

```bash
npm test                          # Run all 300 tests once
npm run test:watch                # Watch mode
npm run test:coverage             # Coverage report
```

---

## Adding a New Field to `MonthSnapshot`

1. Add the field to the `MonthSnapshot` interface in `src/types/index.ts`.
2. If the field is a derived total (recomputed from other data), add the recomputation to `repairSnapshotTotals` in `FinanceContext.tsx`.
3. If the field is optional (for backward compat), use `field?: type` and handle `undefined` everywhere.
4. Add the field to the relevant `addXxx` / `updateXxx` context method.
5. Write test cases covering:
   - Adding the field to a new item
   - Reading the field from an old snapshot that lacks it (backward compat)
   - Cloud merge preserving the field
6. Run `npm test` and `npm run build` before committing.

---

## Common Pitfalls

| Pitfall | Why it matters | How to avoid |
|---------|---------------|-------------|
| Two-step `setData` calls | Creates a window where totals are inconsistent; can cause brief incorrect renders | Always recompute totals inside the same `setData` callback |
| Forgetting the post-merge repair | Cloud data bypasses `load()` and can carry stale totals indefinitely | Always call `repairSnapshotTotals` after `mergeFinanceData` |
| Missing `Math.max(0, ...)` on delete | Deleting an item from a category with no prior actuals can go negative | Guard all decrements: `Math.max(0, current - deleted.amount)` |
| Including stubs in FCF source | Stubs have `totalIncome = 0` → negative FCF → all Goals show Blocked | Filter: `snapshot.totalIncome > 0` |
| Missing `?? {}` on `categoryActuals` | Old snapshots may lack the field; destructuring crashes | Always default to empty object: `snapshot.categoryActuals ?? {}` |
