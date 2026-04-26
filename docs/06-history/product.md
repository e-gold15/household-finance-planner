# History — Product Overview

## Purpose

The History tab is the household's financial diary. It records what actually happened each month — how much came in, how much went out, and what was saved — and turns that record into visible trends over time.

Where the rest of the app deals with plans and budgets (what you intend to spend), History deals with actuals (what you actually spent). Together they form a complete picture: plan vs. reality.

---

## User Value

> "See at a glance whether last month was better or worse than the month before — and understand exactly why."

History serves three distinct needs:

1. **Accountability** — Did we actually stick to the budget?
2. **Trend awareness** — Are things getting better or worse over time?
3. **Retroactive capture** — If you forgot to record something at the time, you can still add it to the right month.

---

## Features

### 1. Monthly Snapshots

A snapshot is a point-in-time record of a single month's finances. Snapshots are created by the user at the end of each month by pressing the "Snapshot Month" button on the Overview tab.

Each snapshot captures:

| Field | Description |
|-------|-------------|
| Label | Month and year (e.g. "March 2025") |
| Total income | Sum of all income for the month |
| Total expenses | Sum of all expenses for the month |
| Total savings | Planned savings contributions for the month |
| Free cash flow | Income − Expenses − Savings |
| Category actuals | Actual spending per expense category |

Once created, a snapshot is a historical record. It can be enriched with retroactive data (see below) but its core financial totals are recomputed atomically whenever data changes.

---

### 2. Trend Line Chart

A line chart displays free cash flow (FCF) over time, with one data point per snapshot. This gives an immediate visual signal of whether the household's financial health is improving, deteriorating, or stable.

- Only real snapshots (those with actual income data) appear in the trend chart.
- Auto-created stub snapshots (see below) are excluded.
- The area below the zero line is filled red to highlight months where spending exceeded income.

---

### 3. Historical Expense Entry

You can add named expense line items retroactively to any past snapshot. This is useful when:

- A receipt arrives late and you want to record it in the correct month.
- You forgot to log an expense at the time.
- You are reconstructing a past month from bank statements.

Each historical expense item records: a name, an amount, a category, and an optional note. Adding an expense automatically updates the snapshot's `categoryActuals` and recomputes `totalExpenses` and `freeCashFlow`.

---

### 4. Historical Income Entry

You can add named income items retroactively to any past snapshot. Each income item records: the household member who received it, the net amount, and an optional note.

Adding income atomically updates `totalIncome` and recomputes `freeCashFlow`. The month's FCF badge on the snapshot card updates immediately.

---

### 5. Category Actuals

For each snapshot, you can record actual spending per category (e.g. Housing: ₪4,200; Food: ₪1,800). These actuals feed the month-over-month comparison feature in the Expenses tab (the Δ% delta badges).

Category actuals can be edited directly via the Actuals dialog, or they are updated automatically when historical expense items are added, edited, or deleted.

---

### 6. Stub Snapshots

When a user adds a retroactive expense or income entry to a month that has no snapshot, the app automatically creates a "stub" snapshot for that month. The user does not need to do anything manually.

Stubs are a convenience feature — they ensure the data has a home without requiring the user to formally "close out" the month.

**What a stub contains at creation:**

- Pre-populated fixed recurring expenses (locked expenses that repeat every month) in `categoryActuals`.
- `totalExpenses` set to the sum of those fixed expenses.
- `totalIncome = 0` — income is unknown until the user adds it.
- A "—" FCF badge instead of a coloured positive/negative badge.
- An italic label "(fixed expenses only)" to signal the data is incomplete.

**Transitioning from stub to real:**

A stub automatically becomes a real snapshot in terms of FCF display as soon as the first income entry is added. The FCF badge changes from "—" to a coloured value. However, a stub is never treated as a real snapshot for FCF trend purposes — only user-created snapshots (via "Snapshot Month") appear in the trend chart.

---

### 7. FCF Auto-Recompute

Every time a historical expense or income item is added, edited, or deleted, the snapshot's financial totals are recomputed atomically in a single operation. There is no intermediate state where totals are out of sync.

The recomputation formula:

```
totalExpenses = sum(categoryActuals values)
freeCashFlow  = totalIncome - totalExpenses - totalSavings
```

This means you can freely edit past records without worrying about leaving the data in an inconsistent state.

---

### 8. Comparison — Powering MoM Δ%

The History tab is not just a standalone view — it supplies data to the rest of the app:

- **Expenses tab**: The month-over-month delta badges (▲/▼/=) on each expense category are computed by comparing the current month's budget against the most recent snapshot's `categoryActuals`.
- **Overview tab**: Trend arrows on KPI cards (income, expenses, FCF) compare the current plan against the last snapshot.
- **Goals tab**: The FCF figure used by the allocation engine comes from the most recent non-stub snapshot.

---

## Stub vs. Real Snapshot — Summary

| Property | Real snapshot | Stub snapshot |
|----------|--------------|---------------|
| Created by | User presses "Snapshot Month" | Auto-created when retroactive data is added |
| FCF badge | Coloured (green/red) | "—" neutral until income is added |
| Appears in trend chart | Yes | No |
| Used as FCF source for Goals | Yes (if `totalIncome > 0`) | No |
| Appears in History list | Yes | Yes |
| Label suffix | None | "(fixed expenses only)" |
| `totalIncome` at creation | > 0 (from snapshot data) | 0 |

---

## Out of Scope

- Automatic import of transactions from a bank (CSV import is on the future roadmap).
- Editing the core snapshot totals directly — totals are always derived from income/expense items and category actuals.
- Deleting a snapshot — snapshots are permanent records once created. (Individual expense/income items within a snapshot can be deleted.)
