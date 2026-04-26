# Expenses Tab — UX & Design Specification

## Layout

The Expenses tab uses a full-width card list, grouped by category. A toolbar at the top holds the main actions.

```
┌───────────────────────────────────────────────────────────┐
│  Expenses               [Compare ↔]  [Set Budgets]  [+ Add]│
│  Total: ₪8,400/mo                                          │
├───────────────────────────────────────────────────────────┤
│  Housing                              ₪4,200/mo           │
│  ████████████████░░ 84%  [Budget: ₪5,000]  [Warning]     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Rent        [Lock] [Monthly]    ₪4,200   [✏] [🗑]  │  │
│  └─────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────┤
│  Food                                 ₪1,800/mo           │
│  ████████░░░░░░░░ 45%  [Budget: ₪4,000]  [On track]      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Groceries   [Waves][Monthly]    ₪1,800   [✏] [🗑]  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

- **Container:** `max-w-4xl mx-auto px-4`
- **Card spacing:** `space-y-4`
- **Category section header:** bold category name + right-aligned monthly subtotal

---

## Expense Row

Each expense renders as a row inside its category group card.

```
┌──────────────────────────────────────────────────────────────────┐
│  Rent       [Lock]  [Monthly]    ₪4,200/mo         [✏]  [🗑]   │
└──────────────────────────────────────────────────────────────────┘
```

**Row grid:** `grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2`

| Column | Content | Style |
|---|---|---|
| Name | Expense name | `font-medium text-sm` |
| Type badge | Lock (fixed) or Waves (variable) | See badges below |
| Period badge | "Monthly" or "Yearly" | `variant="outline" text-xs` |
| Amount | Monthly-normalised | `font-semibold text-sm` |
| Edit | Pencil icon button | `variant="ghost" size="icon"` |
| Delete | Trash2 icon button | `variant="ghost" size="icon" text-destructive` |

**Type badge design:**

| Type | Badge label | Icon | Variant |
|---|---|---|---|
| Fixed | "Fixed" | `Lock` | `secondary` |
| Variable | "Variable" | `Waves` | `outline` |
| Not set | _(hidden)_ | — | — |

**Sinking fund badges (yearly expenses with `dueMonth`):**

Below the main row, two small badges appear inline:

```
₪200/mo provision    [Due in 3 months]
```

- Provision badge: `variant="secondary"` — `₪{amount/12}/mo provision`
- Countdown badge: same thresholds as Upcoming Bills (days/weeks/months → warning/outline/secondary)

**Linked account badge (savings expenses):**

```
  [🔗 Emergency Fund]
```

- `Link2` icon + account name
- `variant="outline" text-xs`
- `title="Linked to [account name]"` for accessibility

---

## Budget Progress Bars (Category Level)

Shown between the category header and the expense rows.

```
████████████████░░░░  84%   Budget: ₪5,000   [Warning]
```

**Bar colours:**

| Condition | `className` |
|---|---|
| Spent < 80% | `bg-primary` (teal) |
| Spent 80–100% | `bg-warning` (amber) |
| Spent > 100% | `bg-destructive` (red) |

- Bar container: `h-2 rounded-full bg-muted`
- Fill: `h-2 rounded-full transition-all`
- Percentage text: `text-xs text-muted-foreground`
- Budget amount: `text-xs text-muted-foreground ms-2`
- Status badge: `variant="default"/"warning"/"destructive"` matching colour

Categories without a budget limit show **no progress bar** — just the category subtotal.

---

## Month-over-Month Compare Toggle

A toggle button in the toolbar:

```
[Compare ↔]
```

When active, each category section gains a delta column showing MoM change:

```
  Food                  ₪1,800/mo    ▲ 12.5%
```

**Delta badge design:**

| Condition | Symbol | Colour |
|---|---|---|
| Spending increased | ▲ | `text-destructive` (red) |
| Spending decreased | ▼ | `text-green-600` (green) |
| No change | = | `text-muted-foreground` |

- Badge: `text-xs font-medium px-1.5 py-0.5 rounded`
- Hidden if fewer than one non-stub historical snapshot exists

---

## ExpenseDialog — Add / Edit Expense

A modal dialog. Opens from the `[+ Add]` toolbar button or the row edit button.

### "When?" Toggle

At the top of the dialog:

```
  [Current budget]   [Past month]
```

- Segmented toggle: `role="radiogroup"`
- "Current budget" is the default

**Past month mode** shows:
```
Month:  [March    ▾]    Year: [2025 ▾]
```
- Month select: all past months (current month excluded)
- Year select: current year back 3 years
- If year = current year → months limited to Jan through last complete month
- Default selection: previous calendar month

### Core Fields

| Field | Input type | Notes |
|---|---|---|
| Expense name | Text | Required |
| Amount | Number | Required — always positive |
| Period | Segmented toggle | Monthly / Yearly |
| Category | Select | 11 categories |
| Expense type | Segmented toggle | Fixed / Variable / Not set |
| Recurring | Checkbox | Marks the expense as a regular recurring cost |

### Yearly-only Fields

When period = "Yearly":
```
Due month:  [December ▾]   (optional)
```
- `dueMonth` select: Jan–Dec or "Not set"
- Helper text: "Sets a monthly provision and due-date countdown"

### Savings-only Field

When category = "Savings":
```
Link to account:  [Emergency Fund ▾]   (optional)
```
- Datalist or select showing all savings accounts
- If no accounts exist: "Add a savings account first (go to Savings tab)"

### Scan Receipt Button

When `VITE_ANTHROPIC_API_KEY` is set, a camera icon appears in the dialog header:

```
  Add Expense   [📷]
```

- Icon: `Camera` from lucide-react
- `title="Scan receipt with AI"` + `aria-label="Scan receipt with AI"`
- While scanning: spinner + "Reading receipt…" text (button disabled)
- On success: fields auto-fill; user can still edit before saving
- On error: red inline banner — "Could not read receipt. Please fill in manually."
  - Banner style: `bg-destructive/10 text-destructive rounded-md p-3 text-sm`

---

## Budget Limit Editor

Opened via "Set Budgets" button. A dialog with one row per expense category:

```
┌────────────────────────────────────────────┐
│ Set Category Budgets                        │
│                                             │
│ Housing      [₪ 5,000        ]             │
│ Food         [₪ 4,000        ]             │
│ Transport    [₪ 1,500        ]             │
│ …                                           │
│                        [Cancel]  [Save]    │
└────────────────────────────────────────────┘
```

- Each row: category label (`text-sm`) + number input (`text-end`)
- Empty input = no budget limit (removes existing limit)
- `[Save]` applies all changes atomically
- Changes immediately update progress bars in the expense list

---

## Dark Mode

- Progress bar background: `bg-muted` (dark-mode aware)
- Budget editor inputs: use `bg-background border` — dark-mode aware
- Error banner: `bg-destructive/10 text-destructive` — readable in dark
- Sinking fund provision badge: `bg-secondary text-secondary-foreground`
- All chart colours via HSL tokens

---

## RTL (Hebrew) Support

- All margins: `me-*` / `ms-*`
- Row grid alignment: logical properties (`text-start`, `text-end`)
- Delta arrows (▲/▼) are direction-neutral characters — render correctly in RTL
- Budget editor inputs: `text-end` for number alignment (natural in RTL)
- "Due in N months" countdown uses localised number formatting

---

## Mobile (375px) Behaviour

| Element | Mobile behaviour |
|---|---|
| Expense row | Stacks: name + badges on line 1, amount + actions on line 2 |
| Toolbar | Buttons wrap or use icon-only variants with `title` attributes |
| Budget editor dialog | `max-h-[85vh] overflow-y-auto` |
| Compare column | Appears below category subtotal (not inline) |
| Scan button | Full-width on mobile in dialog header |

All interactive elements: `min-h-[44px]`.

---

## Accessibility

| Element | Requirement |
|---|---|
| Edit expense button | `title="Edit [name]"` + `aria-label="Edit [name]"` |
| Delete expense button | `title="Delete [name]"` + `aria-label="Delete [name]"` |
| Scan receipt button | `aria-label="Scan receipt with AI"` |
| Progress bars | `role="progressbar"` + `aria-valuenow` + `aria-valuemin="0"` + `aria-valuemax="100"` |
| Type badges | Text content — not colour alone |
| Budget editor inputs | `<Label htmlFor="budget-[category]">` associated correctly |
| Compare delta | Screen reader text includes the direction ("increased by 12%") |
| "When?" toggle | `role="radiogroup"` with named options |
