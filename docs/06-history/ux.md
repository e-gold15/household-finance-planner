# History — UX & UI Specification

## Snapshot Cards

Each monthly snapshot is shown as a card in the History list, ordered from most recent to oldest.

### Card Layout

| Element | Detail |
|---------|--------|
| **Month label** | Bold heading — e.g. "March 2025" |
| **Stub label** | Italic sub-label "(fixed expenses only)" — shown only on stub snapshots |
| **Income** | `text-primary` (teal) — formatted in household currency |
| **Expenses** | `text-destructive` (red) — formatted in household currency |
| **Savings** | `text-muted-foreground` — formatted in household currency |
| **FCF badge** | Coloured pill — see FCF Badge below |
| **Expand button** | ChevronDown/Up — expands the card to show expense items and income items |
| **Add expense button** | Plus icon — opens HistoricalExpenseDialog |
| **Add income button** | Plus icon — opens HistoricalIncomeDialog |
| **Actuals button** | BarChart2 icon — opens ActualsDialog |

### FCF Badge

| Condition | Display | Colour |
|-----------|---------|--------|
| Stub with `totalIncome === 0` | "—" | Neutral (`secondary` variant) |
| FCF > 0 | "+₪X,XXX" | `success` (green) |
| FCF < 0 | "−₪X,XXX" | `destructive` (red) |
| FCF = 0 | "₪0" | `secondary` (muted) |

The FCF badge updates live whenever income or expense items are added, edited, or deleted.

---

## Trend Line Chart

The trend chart appears at the top of the History tab, above the snapshot list.

| Property | Detail |
|----------|--------|
| **Library** | Recharts `LineChart` |
| **X-axis** | Month labels (short format: "Mar", "Apr") |
| **Y-axis** | FCF in household currency; auto-scaled |
| **Data points** | One per non-stub snapshot; stubs are excluded |
| **Line colour** | `--primary` (teal) |
| **Below-zero fill** | Red area fill below the zero line (negative FCF months) |
| **Tooltip** | Shows month, FCF value, and income/expenses on hover |
| **Empty state** | Chart is hidden if fewer than 2 real snapshots exist |

On mobile (< 640px), the chart height is reduced from 200px to 120px and the X-axis labels are rotated 45° to avoid overlap.

---

## Historical Expense Dialog (HistoricalExpenseDialog)

Triggered by the "Add expense" button on a snapshot card.

### Fields

| Field | Control | Validation |
|-------|---------|------------|
| **Name** | Text input | Required; max 60 characters |
| **Amount** | Number input | Required; > 0 |
| **Category** | Select (EXPENSE_CATEGORIES list) | Required |
| **Note** | Textarea | Optional |

### Behaviour

- Dialog title shows the target month: "Add expense to March 2025"
- On save: calls `addHistoricalExpense(snapshotId, item)`
- The snapshot card's expense total and FCF badge update immediately
- The category's value in `categoryActuals` is incremented automatically
- An existing item row can be tapped/clicked to open an edit version of this dialog
- Delete icon on each item row removes the entry (with inline confirmation)

---

## Historical Income Dialog (HistoricalIncomeDialog)

Triggered by the "Add income" button on a snapshot card.

### Fields

| Field | Control | Validation |
|-------|---------|------------|
| **Member name** | Text input + `<datalist>` autocomplete | Required; autocomplete suggests household member names |
| **Amount** | Number input | Required; > 0 |
| **Note** | Textarea | Optional |

### Behaviour

- Dialog title shows the target month: "Add income to March 2025"
- Member name uses a native HTML `<datalist>` — no custom combobox; RTL-safe
- On save: calls `addHistoricalIncome(snapshotId, item)`
- `totalIncome` is incremented; `freeCashFlow` is recomputed immediately
- If this is the first income on a stub snapshot, the FCF badge transitions from "—" to a coloured value
- Income amounts are displayed in `text-primary` (teal) in the expanded item list — visually distinct from expenses in `text-destructive` (red)

---

## Actuals Dialog (ActualsDialog)

Triggered by the BarChart2 icon on a snapshot card. Allows direct editing of per-category actual spending.

### Layout

- A grid of rows, one per expense category
- Each row: category name (left) + number input (right)
- Pre-filled with existing `categoryActuals` values
- Save button calls `updateSnapshotActuals(snapshotId, updatedActuals)`
- `totalExpenses` and `freeCashFlow` recompute on save

The ActualsDialog is an escape hatch for bulk editing. Most users will use the historical expense items approach (which updates actuals atomically), but the dialog supports advanced users who want to set category totals directly.

---

## "Add Expense to Past Month" Flow (from Expenses Tab)

The "When?" toggle in the Add Expense dialog allows adding an expense to a past month rather than the current budget.

When "Past month" is selected:

- Month picker appears (scrollable list of months, last 3 years, past months only)
- Year picker appears
- Year change auto-clamps the month selection if the user had selected a future month for the new year
- On save: calls `addExpenseToMonth(year, month, item)` which finds or creates a stub snapshot
- A confirmation message shows the target month name (localised — Hebrew uses the Hebrew month name)

---

## Empty State

When no snapshots exist, the History tab shows:

- A brief headline: "No history yet"
- An explanation: "Take a snapshot at the end of each month to start tracking your financial story."
- A secondary note about retroactive entry: "You can also add past expenses and income directly to any past month."

The trend chart and snapshot list are both hidden until at least one snapshot exists.

---

## Mobile Layout

On screens narrower than 640px:

- Snapshot cards are full width
- Income / Expenses / Savings figures stack in a 2-column grid (not a 4-column row)
- The FCF badge moves to a second line below the grid
- Expand/collapse icon is in the card header, full-width tappable area
- Dialog forms are full-width with `px-4` padding
- Trend chart height is 120px; X-axis labels rotate 45°

---

## RTL (Hebrew) Support

- All margins use logical properties (`me-*`, `ms-*`)
- Trend chart is mirrored — most recent months appear on the right
- Month confirmation messages in the Add Expense flow use the Hebrew month name when `lang === 'he'`
- All dialogs flip layout direction with the document

---

## Accessibility Checklist

- [ ] Icon-only buttons have `title` attributes (Add expense, Add income, Actuals, Delete item)
- [ ] Income and expense amounts use colour AND a sign prefix (+/−) — not colour alone
- [ ] FCF badge "—" has `aria-label="No income data yet"` for screen readers
- [ ] Dialogs have `role="dialog"`, `aria-labelledby`, and focus trapping
- [ ] Datalist inputs on HistoricalIncomeDialog have associated `<label>` elements
- [ ] All interactive elements meet 44px minimum tap target
- [ ] Number inputs have `inputmode="decimal"` for mobile keyboard optimisation
