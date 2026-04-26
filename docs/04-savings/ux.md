# Savings Tab — UX & Design Specification

## Layout

The Savings tab displays a summary header followed by a grid of account cards.

```
┌──────────────────────────────────────────────────────────────┐
│  Savings                                        [+ Add Account]│
│  Total Assets: ₪185,400       Emergency Buffer: 3 months      │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │ Emergency Fund     │  │ Pension Fund       │             │
│  │ [Savings][Immediate│  │ [Pension][Locked]  │             │
│  │ ₪32,000    0.5%   │  │ ₪85,000    5.5%   │             │
│  │ + ₪1,200/mo  [✏🗑]│  │ + ₪2,400/mo  [✏🗑]│             │
│  └────────────────────┘  └────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

- **Container:** `max-w-4xl mx-auto px-4`
- **Account grid:** `grid grid-cols-1 sm:grid-cols-2 gap-4`
- **Summary row:** `flex items-center justify-between mb-6`

---

## Summary Header

Two key figures shown at the top of the tab:

| Element | Style | Content |
|---|---|---|
| Total Assets label | `text-sm text-muted-foreground` | "Total Assets" |
| Total Assets value | `text-2xl font-bold text-primary` | Sum of all account balances |
| Emergency Buffer | `text-sm text-muted-foreground` | "Emergency Buffer: N months" — informational |

The emergency buffer is read-only here. To change it, the user goes to Household Settings.

---

## Account Card

Each account is displayed as a card with a consistent layout.

```
┌──────────────────────────────────────────────┐
│  Emergency Fund                [✏]  [🗑]     │
│  [Savings]  [Immediate]                       │
│                                               │
│  ₪32,000                    0.5% / yr        │
│  Balance                    Annual return     │
│                                               │
│  + ₪1,200/mo                                 │
│  Monthly contribution                         │
│                                               │
│  [🔗 Rent Transfer expense]  (if linked)     │
└──────────────────────────────────────────────┘
```

**Card layout:** `rounded-xl border bg-card p-5 flex flex-col gap-3`

**Card header row:** account name (`font-semibold`) + edit + delete buttons

**Badge row:** type badge + liquidity badge (side by side, `flex gap-2`)

**Balance + return row:** `grid grid-cols-2`
- Balance: `text-xl font-bold`
- Return: `text-sm text-muted-foreground` + percentage

**Contribution row:** `text-primary font-medium` (teal) — "+" prefix indicates money going in

**Linked expense badge (optional):**
- Shown when `monthlyContribution` is auto-synced from a savings expense
- `Link2` icon + expense name
- `text-xs text-muted-foreground`
- Contribution field appears read-only in this state

---

## Liquidity Badge — Colour Coding

| Tier | Badge variant | Colour |
|---|---|---|
| Immediate | `success` (green) | `bg-green-100 text-green-700` |
| Short-term | `default` (teal) | `bg-primary/10 text-primary` |
| Medium-term | `warning` (amber) | `bg-warning/10 text-warning` |
| Locked | `destructive` (red) | `bg-destructive/10 text-destructive` |

Colour + text label are always shown together — never colour alone.

---

## Type Badge

All account types use `variant="secondary"` (grey). The type label is the only differentiator — no colour-coding by type.

| Type | Label |
|---|---|
| checking | Checking |
| savings | Savings |
| deposit | Deposit |
| pension | Pension |
| study_fund | Study Fund |
| stocks | Stocks |
| crypto | Crypto |
| real_estate | Real Estate |
| other | Other |

---

## Add / Edit Account Dialog

```
┌──────────────────────────────────────────────┐
│  Add Savings Account                          │
│                                               │
│  Account name     [Emergency Fund        ]    │
│  Account type     [Savings              ▾]   │
│  Liquidity        [Immediate            ▾]   │
│  Current balance  [₪ 32,000             ]    │
│  Annual return %  [0.5                  ]    │
│  Monthly contribution  [₪ 1,200        ]     │
│                       (or read-only if linked)│
│                                               │
│                        [Cancel]  [Save]       │
└──────────────────────────────────────────────┘
```

**Field details:**

| Field | Input type | Notes |
|---|---|---|
| Account name | Text | Required |
| Account type | Select | 9 options |
| Liquidity | Select | Immediate / Short-term / Medium-term / Locked |
| Current balance | Number | Non-negative; currency symbol shown as prefix |
| Annual return % | Number (0.00–100.00) | Optional; 0 = no growth assumed |
| Monthly contribution | Number | Editable unless linked to a savings expense |

**When contribution is read-only (linked expense):**

```
Monthly contribution  ₪1,200  [auto-synced from "Rent Transfer expense"]
```

The field is `disabled` and shows a help text explaining the link. A link icon is shown.

---

## Empty State

When no savings accounts have been added:

```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│          💰   No savings accounts yet                     │
│                                                            │
│       Add your first account to track your savings,       │
│       see your 12-month forecast, and plan your goals.    │
│                                                            │
│                   [+ Add First Account]                   │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

- Container: `flex flex-col items-center justify-center py-16 text-center`
- Icon: `PiggyBank` from lucide-react, `text-muted-foreground` size `48`
- Description: `text-sm text-muted-foreground max-w-xs`
- Button: `variant="default"` — same as primary add button

---

## Dark Mode

- Card backgrounds: `bg-card` token (dark-mode aware)
- Balance value: `text-foreground` — not hardcoded
- Contribution value: `text-primary` (teal) — works in both modes
- Liquidity badge backgrounds use `/10` opacity variants of the appropriate token
- Dialog inputs: `bg-background border` — dark-mode aware

---

## RTL (Hebrew) Support

- All margins: `me-*` / `ms-*`
- Card header: `flex items-center justify-between` — natural direction flip in RTL
- Badge row: `flex gap-2` — direction-neutral
- "+" prefix on contribution: `before:content-['+']` or explicit `+` character, both RTL-safe
- Number inputs: `text-end` for natural right-alignment in RTL

---

## Mobile (375px) Behaviour

| Element | Mobile behaviour |
|---|---|
| Account grid | `grid-cols-1` — single column on mobile |
| Account card | Full width; readable single-column layout |
| Summary header | Stacks vertically if content is long |
| Add Account dialog | `max-h-[85vh] overflow-y-auto` |
| Edit + delete buttons | `min-h-[44px] min-w-[44px]` tap targets |

---

## Accessibility

| Element | Requirement |
|---|---|
| Edit account button | `title="Edit [name]"` + `aria-label="Edit [name]"` |
| Delete account button | `title="Delete [name]"` + `aria-label="Delete [name]"` |
| Liquidity badge | Text label accompanies colour — never colour alone |
| Balance input | `<Label htmlFor="balance">` associated with `<input id="balance">` |
| Return % input | `<Label htmlFor="return">` associated with input |
| Linked expense indicator | `title` attribute on `Link2` icon explaining auto-sync |
| Add first account button | Descriptive label — not just "+" |
