# Overview Tab — UX & Design Specification

## Layout

The Overview tab uses a responsive single-column (mobile) to two-column (tablet and desktop) layout.

```
Mobile (< 768px)               Desktop (md+)
┌─────────────────────┐        ┌─────────────┬─────────────┐
│   KPI Cards (2-col) │        │  KPI Cards (4-col across) │
├─────────────────────┤        ├─────────────┬─────────────┤
│  Budget Health      │        │Budget Health│Upcoming Bills│
├─────────────────────┤        ├─────────────┼─────────────┤
│  Upcoming Bills     │        │Expense Pie  │Savings Bars  │
├─────────────────────┤        ├─────────────┼─────────────┤
│  Expense Pie Chart  │        │Goal Status  │Savings Fcst  │
├─────────────────────┤        └─────────────┴─────────────┘
│  Savings Bar Chart  │
├─────────────────────┤
│  Goal Status        │
├─────────────────────┤
│  Savings Forecast   │
└─────────────────────┘
```

- **Vertical rhythm:** `space-y-6` between card rows
- **Card padding:** `p-6` for all cards (header + content sections)
- **Container:** `max-w-4xl mx-auto px-4`

---

## KPI Cards

The four KPI cards (Income, Expenses, FCF, Total Assets) sit in a 2-column grid on mobile and 4-column grid on `md+`.

### Anatomy of a KPI card

```
┌────────────────────────────┐
│  [Icon bg]   Monthly Income│  ← icon: teal rounded bg (bg-primary/10)
│                            │     label: text-xs text-muted-foreground
│  ₪12,400           ▲ 3.2% │  ← value: text-xl font-bold
│                    [pill]  │     trend pill: see below
└────────────────────────────┘
```

**Icon container:** `rounded-lg bg-primary/10 p-2 text-primary` — always teal

**Trend pill styling:**

| Metric | Positive direction | Negative direction |
|---|---|---|
| Income | ▲ `bg-green-100 text-green-700` | ▼ `bg-destructive/10 text-destructive` |
| Expenses | ▼ `bg-green-100 text-green-700` | ▲ `bg-destructive/10 text-destructive` |
| FCF | ▲ `bg-green-100 text-green-700` | ▼ `bg-destructive/10 text-destructive` |
| Assets | Always neutral (no trend pill) | — |

- Pill text format: `▲ 3.2%` or `▼ 1.1%`
- Hidden entirely when fewer than 2 non-stub historical snapshots exist
- Uses HSL tokens only — never hardcoded hex

---

## Budget Health Gauge

A Recharts `PieChart` rendered as a donut.

**Chart dimensions:**
- `innerRadius="65%"` `outerRadius="90%"` (relative to container)
- Container: `w-full aspect-square max-w-[200px]`

**Colour mapping (HSL tokens):**

| Slice | Token |
|---|---|
| On track | `hsl(var(--primary))` |
| Warning | `hsl(var(--warning))` |
| Over budget | `hsl(var(--destructive))` |
| No budget | `hsl(var(--muted-foreground))` |

**Legend:** displayed to the right of the chart on desktop, below on mobile. Each item: coloured dot + label + count (e.g. "On track · 4").

**Footer line (below chart):**
```
Worst offender: Housing · 134%
```
- Text: `text-xs text-muted-foreground`
- Category name in `font-medium`
- Hidden if no category is over budget

---

## Upcoming Annual Bills

A vertical list of timeline rows. Each row:

```
┌─────────────────────────────────────────────────┐
│ Jun    Car Insurance       [In 6 weeks]   ₪2,400 │
└─────────────────────────────────────────────────┘
```

**Row layout:** `grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3`

**Month label:** `text-sm font-medium text-muted-foreground`

**Countdown badge variants:**

| Threshold | Badge variant | Example |
|---|---|---|
| < 30 days | `warning` (amber) | "In 18 days" |
| < 8 weeks | `outline` | "In 6 weeks" |
| ≥ 8 weeks | `secondary` (grey) | "In 3 months" |

**Amount:** `text-sm font-semibold text-destructive` (red — it's money going out)

**Empty state:** entire section hidden (`hidden`) — no empty-state message shown

---

## Goal Status Section

Two-column layout on desktop; stacked on mobile.

**Left column — Donut chart:**
- Same donut pattern as Budget Health Gauge
- Slices: Realistic (primary/teal), Tight (warning/amber), Unrealistic (destructive/red), Blocked (muted/grey)
- Legend below chart on mobile, beside on desktop

**Right column — Top-3 goals:**

Each goal row:
```
┌──────────────────────────────────────────┐
│ Emergency Fund              [Realistic]  │
│ ████████████░░░░ 65%    ₪1,200 / mo     │
└──────────────────────────────────────────┘
```

**Progress bar colours by status:**

| Status | Bar colour |
|---|---|
| Realistic | `bg-primary` (teal) |
| Tight | `bg-warning` (amber) |
| Unrealistic | `bg-destructive` (red) |
| Blocked | `bg-muted` (grey) |

**Status badge variants:** `default` (Realistic) · `warning` (Tight) · `destructive` (Unrealistic) · `secondary` (Blocked)

---

## 12-Month Savings Forecast Chart

Recharts `AreaChart` with a gradient fill.

**Gradient:**
```tsx
<defs>
  <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
  </linearGradient>
</defs>
```

**Chart spec:**
- `stroke="hsl(var(--primary))"` for the line
- `fill="url(#savingsGradient)"` for the area
- X-axis: abbreviated month names (Jan, Feb, …)
- Y-axis: compact currency format (₪120K)
- Tooltip: full amount with currency symbol

**Summary row below chart (3 columns):**

```
┌─────────────┬──────────────┬───────────────┐
│   Today     │  + Monthly   │  In 12 months │
│  ₪85,000   │   ₪3,200    │   ₪128,400    │
└─────────────┴──────────────┴───────────────┘
```
- Container: `grid grid-cols-3 text-center mt-4`
- Label: `text-xs text-muted-foreground`
- Value: `text-sm font-bold text-primary`

---

## End-of-Month Surplus Banner

Appears at the top of the page (above the KPI cards) when triggered.

```
┌─────────────────────────────────────────────────────────────┐
│ ✨  Last month you had a surplus of  [+ ₪1,850]             │
│     Add to Goal          Add to Savings      [✕]  [Dismiss] │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-primary/5 border border-primary/20 rounded-xl p-4`
- Icon: `Sparkles` from lucide-react, `text-primary`
- Surplus badge: `variant="success"` (green)
- "Add to Goal" button: `variant="default"` (primary/teal)
- "Add to Savings" button: `variant="outline"`
- Dismiss X: icon button, `variant="ghost"` `size="icon"`, `title="Dismiss for session"`, `aria-label="Dismiss for session"`
- "Don't ask again" link: `text-xs text-muted-foreground underline cursor-pointer`

**Mobile layout:** buttons stack vertically (`flex-col`); banner spans full width

---

## Dark Mode

All colours are defined using CSS HSL custom properties. No component in the Overview tab uses hardcoded hex, rgb, or fixed colour class names.

Checklist:
- [ ] Gradient fill uses `hsl(var(--primary))` — renders correctly in both modes
- [ ] Surplus banner background uses `bg-primary/5` — readable in dark mode
- [ ] Chart axes and grid lines use `text-muted-foreground` and `stroke-muted`
- [ ] KPI trend pills use token-based backgrounds (`bg-primary/10`, `bg-destructive/10`)

---

## RTL (Hebrew) Support

- All horizontal margin/padding utilities use logical properties: `me-*` / `ms-*`, never `mr-*` / `ml-*`
- Recharts charts reflow naturally (x-axis direction is left-to-right by default; text alignment handled via `textAnchor`)
- Badge and pill text is direction-neutral (numbers + symbols work in both directions)
- The surplus banner's icon and text stack correctly in RTL via `flex` with `gap-*` (not fixed margins)

---

## Mobile (375px) Behaviour

| Element | Mobile behaviour |
|---|---|
| KPI cards | 2-column grid (`grid-cols-2`) |
| Budget Health Gauge | Full width; legend below chart |
| Upcoming Bills | Horizontal row wraps to 2 lines if needed |
| Pie chart | 100% width container, legend below |
| Bar chart | 100% width; rotated x-axis labels if needed |
| Goal status | Stack: donut above, list below |
| Savings forecast | 100% width; summary row stays 3-col |
| Surplus banner | Stacks vertically; buttons full width |

All interactive elements meet the minimum tap target: `min-h-[44px]` or `min-w-[44px]`.

---

## Accessibility

| Element | Requirement |
|---|---|
| Dismiss X on surplus banner | `title="Dismiss for session"` + `aria-label="Dismiss for session"` |
| "Add to Goal" button | `aria-label` describing action with amount |
| Chart legends | Text labels accompany all colour-coded items |
| Status badges | Text content ("Realistic", "Over budget") — never colour alone |
| Progress bars | `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` |
| Budget Health legend | Each status uses icon + text + colour |

Focus rings: all interactive elements have visible focus rings (`:focus-visible:ring-2 ring-primary`).
