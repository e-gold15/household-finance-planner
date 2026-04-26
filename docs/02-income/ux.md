# Income Tab — UX & Design Specification

## Layout

The Income tab uses a stacked, accordion-style layout. Each household member has their own collapsible panel.

```
┌─────────────────────────────────────────────┐
│  Income                    [+ Add Member]   │  ← tab header + action
│  Total Household Net Income: ₪18,400/mo     │  ← summary KPI
├─────────────────────────────────────────────┤
│  ▼  Yael Cohen                    ₪9,200   │  ← member panel (expanded)
│  ┌───────────────────────────────────────┐  │
│  │ Salary at Startup    [Salary]  ₪9,200 │  │  ← source row
│  │ [Edit] [Delete]                        │  │
│  └───────────────────────────────────────┘  │
│  [+ Add Income Source]  [Add Income Entry]  │  ← member-level actions
├─────────────────────────────────────────────┤
│  ▶  Dan Cohen                     ₪9,200   │  ← member panel (collapsed)
└─────────────────────────────────────────────┘
```

- **Vertical rhythm:** `space-y-4` between member panels
- **Member panel card:** `rounded-xl border bg-card p-4`
- **Container:** `max-w-4xl mx-auto px-4`

---

## Member Accordion Panel

Each member panel is an expandable card. The header row contains:

| Element | Detail |
|---|---|
| Chevron icon | Rotates 90° when open — `transition-transform` |
| Member name | `font-semibold text-base` |
| Net total | `text-primary font-bold` (teal) — sum of all sources' net |
| Edit name button | Icon-only, `title="Edit member name"` |
| Delete member button | Icon-only `text-destructive`, shown only if member has no sources |

---

## Income Source Row

Each income source appears as a row inside the member panel:

```
┌──────────────────────────────────────────────────────────────────┐
│  Salary at Startup   [Salary]   ₪18,500 gross → ₪9,200 net/mo  │
│                                                    [✏] [🗑]      │
└──────────────────────────────────────────────────────────────────┘
```

**Row layout:** `grid grid-cols-[1fr_auto_auto] items-center gap-3`

**Type badge:** `variant="secondary"` — Salary / Freelance / Business / Rental / Investment / Pension / Other

**Amount display:**
- If `isGross = true`: show gross → net format: `₪18,500 gross → ₪9,200 net/mo`
- If `useManualNet = true`: show `₪9,200 net/mo` (no gross)
- Period toggle (monthly/yearly): if yearly, show `÷12 = ₪X/mo` below

**Edit button:** icon `Pencil`, `size="icon"`, `variant="ghost"`, `title="Edit source"`, `aria-label="Edit [source name]"`

**Delete button:** icon `Trash2`, `size="icon"`, `variant="ghost"`, `className="text-destructive"`, `title="Delete source"`, `aria-label="Delete [source name]"`

---

## Add / Edit Income Source Dialog

A modal dialog with sections for core fields, tax settings, and contributions.

### Section 1 — Core

| Field | Input type | Notes |
|---|---|---|
| Source name | Text input | e.g. "Salary at Google" |
| Income type | Select | Salary / Freelance / Business / Rental / Investment / Pension / Other |
| Amount | Number input | Gross or net depending on toggle |
| Period | Segmented toggle | Monthly / Yearly |
| Gross or Net | Toggle switch | "Enter gross, I'll compute net" vs "I know my net" |

### Section 2 — Tax Settings (shown when `isGross = true`)

| Field | Input type | Default |
|---|---|---|
| Country | Select | Israel (IL), US, UK, DE, FR, CA |
| Tax credit points (IL only) | Number input (step 0.25) | 2.25 |
| Insured salary ratio | Slider or input (0–100%) | 100% |

### Section 3 — Contributions (shown when `isGross = true` or manual net + `useContributions`)

| Field | Input type | Default |
|---|---|---|
| Employee pension | % input | 6% |
| Employee education fund | % input | 2.5% |
| Use contributions toggle | Switch | off |

**Expandable section — Employer contributions (informational):**

| Field | Notes |
|---|---|
| Employer pension % | Reference only |
| Employer education fund % | Reference only |
| Severance % | Reference only |

Employer fields are inside a `<details>` / collapsible section labeled "Employer contributions (for reference)". They do not affect any calculation.

### Tax Summary Expand/Collapse

Below the source row (or inside the dialog), a collapsed "Tax breakdown" section shows:

```
Gross:              ₪18,500
Income tax:        − ₪4,800
Credit points:     + ₪242
Bituach Leumi:    − ₪1,100
Health Tax:       − ₪ 380
Pension (emp):    − ₪1,110
Education fund:   − ₪ 463
──────────────────────────
Net take-home:     ₪10,889
```

- Labels: `text-sm text-muted-foreground`
- Values: `text-sm font-mono`
- Net line: `font-bold text-primary`

---

## "When?" Toggle — Add Income Entry

Clicking "Add Income Entry" (in the member's action bar) opens a dialog with a segmented toggle:

```
  [Current budget]   [Past month]
```

**Current budget mode:**
- Shows: member dropdown + source name + net amount → saves as a new `IncomeSource`
- Same as "Add Income Source" dialog in simplified form

**Past month mode:**
- Shows: month picker + year picker + member datalist + amount + note
- Month picker: select element with all past months
- Year picker: select element, current year back 3 years
- Year = current year → clamps month to exclude current and future months
- Defaults: previous calendar month

**Month picker label format:** "March 2025" (localised — Hebrew shows "מרץ 2025")

**Member datalist:** native `<datalist>` element (RTL-safe, no custom dropdown needed) — autocompletes from `data.members[].name`

---

## Period Toggle (Monthly / Yearly)

A small segmented toggle on source rows and in the dialog:

```
  [/mo]   [/yr]
```

When "yearly" is selected:
- The amount input stores the annual total
- A helper text below shows: `÷ 12 = ₪X per month`
- All downstream calculations use the monthly-normalised figure

---

## Dark Mode

All colours use HSL design tokens:
- Net income amounts: `text-primary` (teal) — teal is the "positive money" colour
- Gross amounts: `text-muted-foreground`
- Deductions in tax breakdown: `text-destructive` prefix with `−` sign
- Employer contribution section: `bg-muted/40 rounded-lg` background

---

## RTL (Hebrew) Support

- All margin utilities: `me-*` / `ms-*` only
- Tax breakdown table: right-aligned values with `text-end` (logical)
- Native `<datalist>` for member autocomplete works correctly in RTL
- Dialog stacks correctly with `flex-col gap-4` regardless of direction

---

## Mobile (375px) Behaviour

| Element | Mobile behaviour |
|---|---|
| Member panel | Full width, chevron left-aligned |
| Source row | Stacks to 2 lines: name + badge on line 1, amounts + actions on line 2 |
| Tax breakdown | Scrollable inside dialog (`max-h-[40vh] overflow-y-auto`) |
| Dialog | `max-h-[85vh] overflow-y-auto` |
| Action buttons | `min-h-[44px]` — full-width on mobile |

---

## Accessibility

| Element | Requirement |
|---|---|
| Edit source button | `title="Edit [name]"` + `aria-label="Edit [name]"` |
| Delete source button | `title="Delete [name]"` + `aria-label="Delete [name]"` |
| Amount inputs | `<Label htmlFor="amount">` associated with input |
| Segmented toggles | Radio group with `role="radiogroup"` and `aria-label` |
| Tax breakdown | `<summary>` element on `<details>` is keyboard-focusable |
| Type badge | Text content only — no colour-only status |
| "Add Income Entry" button | `aria-label="Add income entry for [member name]"` |
