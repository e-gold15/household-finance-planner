# v4 UX/UI Heuristic Audit — Household Finance Planner

*Audited 2026-10-03 by the UX/UI Designer role. Read-only: no source files were changed.*
*Scope: `src/App.tsx`, `src/components/**`, `src/components/ui/*`, `src/index.css`, `tailwind.config.js`, `src/pages/AuthPage.tsx`, `mockups/*.html`.*
*Primary target: mobile at 375px, Hebrew RTL. Companion to `docs/v4/research.md`.*

## Method

1. Code read of every file in scope.
2. **Live verification.** I ran the local dev build (`localhost:5173`, demo mode, Hebrew) in headless Chromium (Playwright) at 375×812 (mobile emulation) and at 1280 and 1440 desktop widths, in light and dark mode. I took DOM measurements (bounding boxes, computed styles, `scrollWidth`) and screenshots. Findings marked **[verified]** were measured in the browser, not only inferred from code.
3. I compiled the Tailwind output with `npx tailwindcss` to confirm which classes actually generate CSS.
4. I computed WCAG 2.1 contrast ratios for every token pair in `src/index.css`.

Priority key:
- **P0**: broken or unusable, data hidden, or an a11y/WCAG failure on the main flow. Fix before or at the start of v4.
- **P1**: significant friction or inconsistency. Part of the v4 refresh.
- **P2**: polish, debt, or nice-to-have.

---

## 1. Confirmed root causes for the reported bugs

### B1. Sticky header and demo banner let content show through **[verified] P0**
- **Header** (`src/components/Header.tsx:129`): `sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm`. The z-index is fine (40). The header *is* on top, but its background is only 80% opaque (computed `rgba(255,255,255,0.8)`), and `backdrop-blur-sm` is only 4px. Chart strokes and labels with strong colour, such as the orange Budget Health ring, stay readable *through* the header.
- **Demo banner** (`Header.tsx:396`): `sticky top-14 z-30 … bg-warning/20`. The computed value is `rgba(245,159,10,0.2)`, so the banner is **80% transparent**. Everything scrolling under it shows through at nearly full strength. This is the main cause of "the banner renders on top of content". The screenshots show Budget Health legend text and the donut ring legible inside the banner.
- **Secondary:** the banner has a fixed `h-10`, but the Hebrew string wraps to 2 lines at 375px. The second line ("דבר") overflows the 40px box and sits over the border line. The "Exit Demo" button is `min-h-[32px]` (`Header.tsx:412`), below the 44px rule.
- **Fix:**
  - Header: `bg-card` (solid), optionally adding `supports-[backdrop-filter]:bg-card/90 backdrop-blur-md` with a `shadow-sm` once the user has scrolled.
  - Banner: solid tinted surface, e.g. a new `--warning-subtle` token (`38 92% 92%` light / `38 40% 16%` dark) instead of `bg-warning/20`.
  - Drop the fixed `h-10` in favour of `min-h-10 py-1.5`. Shorten the mobile copy ("מצב דמו · לא נשמר"). Make Exit Demo 44px tall.
  - Consider merging the banner *into* the header on mobile as a chip, which saves 40px of sticky chrome (56 + 40 = 96px of a 812px screen today).

### B2. Expense Breakdown pie labels are clipped and overlap on mobile **[verified] P0**
- `src/components/Overview.tsx:812-831`: `<Pie outerRadius={80} label={name + pct} labelLine={false}>` inside a `ResponsiveContainer height={200}`. It has 9 categories and no `margin`.
- Measured at 375px (chart width 293px):
  - "מזון 23%" spans x = −11…51, so it is clipped on the left.
  - "ביטוח 4%" spans to 298, "ביגוד 4%" to 303 and "עבודה 3%" to 316, so all three are clipped on the right. This explains the "דה 3%" and "יגוד 4%" fragments.
  - "דיור 43%" is pushed above the SVG top and hidden under the card title.
  - The five small slices (2–5%) all put their labels in the same 60° arc, so "פנאי 2%" and "שירותים 4%" overlap.
- Labels are drawn in the slice colour (Recharts default). Amber/yellow text on white is about 2:1 contrast.
- The tooltip shows "₪תחבורה : 1,850" because `src/index.css:82-84` forces `direction: ltr` on `.recharts-wrapper`, which also flips the HTML tooltip's bidi order.
- **Fix:**
  - Remove outside labels entirely on mobile. Use a **donut** (`innerRadius="60%"`) with the total in the centre, plus an HTML legend list below it: colour dot + category + amount + %, sorted descending, with slices under 4% grouped as "Other".
  - On `md+`, a 2-column layout (donut and legend side by side) is fine.
  - Scope the `direction: ltr` rule to `.recharts-surface` only, and render the tooltip with `content={<ChartTooltip/>}` using `dir="auto"`.

### B3. Budget Health donut reads as empty or missing on desktop **P1 (partially reproduced)**
- `Overview.tsx:705-760`. The donut is fixed at `w-[130px] h-[130px]` inside `ResponsiveContainer width/height="100%"`. The legend next to it is `flex-1` with `justify-between` rows.
- In headless Chromium at 1280 and 1440 the ring did render (4 sectors, valid `d` paths). I could not reproduce a fully blank donut. Contributing causes I did confirm:
  1. **Recharts `ResponsiveContainer` starts at −1×−1.** It logs "width(-1) and height(-1) of chart should be greater than 0" on every mount, then re-measures. Every resize (window resize, devtools, fullPage capture) re-runs the entry animation from 0. In my fullPage captures the bar and area charts were blank for exactly this reason. A user resizing or snapping a desktop window sees an empty chart for about 1.5s.
  2. **The "No budget" slice uses `--muted` (`STATUS_FILL.none`, `Overview.tsx:36`).** That is 94% lightness on a white card, a 1.13:1 contrast, so it is invisible. In dark mode `--muted` (16%) on card (11%) is invisible too. With demo data, 2 of 9 categories (22% of the ring) disappear. When most categories are unbudgeted, the donut looks blank.
  3. **On desktop the legend spans about 650px.** Labels sit at one edge and counts at the far opposite edge (`Overview.tsx:742`, `justify-between`). The 130px donut is tucked into a corner, so the card reads as a legend with no chart.
  4. **The `0.001` placeholder values** (`Overview.tsx:405-408`) render as hairline slices and give the tooltip "0 cat." entries.
- **Fix:**
  - Use a fixed-size `<PieChart width={132} height={132}>` with no `ResponsiveContainer` for fixed-size donuts. Set `isAnimationActive={false}` or animate only on first mount.
  - Filter out zero-count statuses instead of using `0.001`.
  - Use a visible neutral for "none" (`hsl(var(--muted-foreground) / 0.35)`).
  - Add a centre label ("7/9" + "בתקציב") so the donut is never visually empty.
  - Give the legend `max-w-xs` with label and count adjacent.
  - The Goals Overview donut (`Overview.tsx:875-898`) has the same structure and needs the same fix.

### B4. Seven text tabs scroll horizontally on mobile **[verified] P0**
- `src/App.tsx:200-216`: `<nav className="flex gap-1 mb-6 overflow-x-auto pb-1">`. The measured `scrollWidth` is 609px against a `clientWidth` of 343px, so 266px (3.5 tabs: Goals, History, Members, part of Savings) are off-screen. There is no fade or affordance showing more tabs exist.
- The nav is **not sticky**: it scrolls away with content. After scrolling the 4,600px History page, the user has to scroll back to the top to switch tabs.
- Tab state is plain `useState` (`App.tsx:184`). There is no URL or hash, so the Android back button or swipe-back leaves the app. Switching tabs does not reset scroll position.
- The nav has no `role="tablist"`, `aria-selected` or `aria-current`.
- **Fix (v4):**
  - A **bottom tab bar** with 5 slots, sticky with `pb-[env(safe-area-inset-bottom)]`: סקירה · הוצאות · **[+ central quick-add]** · יעדים/חיסכון · עוד.
  - Fold Income, History, Members and Settings into "More", or into a segmented control inside a "Money" tab.
  - Keep the current top tabs on `md+` (or switch to a side rail on `lg`).
  - Mirror the active tab in `location.hash` so back works. Add `aria-current="page"`.
  - Remove the per-tab Expenses FAB (`Expenses.tsx:1634`) once the central "+" exists.

### B5. Surplus banner and KPI cards are too dense on mobile **[verified] P1**
- **SurplusBanner** (`src/components/SurplusBanner.tsx:182-251`):
  - The banner has 4 controls: Add to Goal, Add to Savings, Don't ask again, and X. At 375px they wrap to 2 rows, and the X ends up alone on a third line.
  - All the buttons are `size="sm"` (32px tall), failing the 44px rule (measured 98×32, 114×32, 99×32).
  - The `ChevronRight` icons (`:215`, `:221`) point the wrong way in RTL.
  - `<Badge>` (a `div`) is nested inside a `<p>` (`:188-193`), which triggers React's `validateDOMNesting` warning in the console.
  - **Fix:** one primary CTA ("חלק עודף") that opens a bottom sheet with Goal and Savings choices. Move "Don't ask again" into that sheet. Keep a single X. Make the amount the headline, in tabular numerals.
- **KPI cards** (`Overview.tsx:98-115`, `642-671`):
  - All four values are `text-primary` teal, including Expenses, so nothing tells income from outflow.
  - Each card stacks icon tile + trend pill + label + value + sub-label in about 160px of width.
  - Values have no `tabular-nums`, so digits jitter between months.
  - The 4 equal cards compete with each other, with no hero number.
  - **Fix:** one **hero card** for "Free to spend / תזרים חופשי" (`text-4xl tabular-nums`) with a pace line, then a compact 3-up row (Income / Expenses / Assets) at `text-lg`, without icon tiles. Neutral `text-foreground` values, with semantic colour only on the delta chip.

---

## 2. Prioritised findings

### P0 — broken, hidden content, or WCAG failures

| # | Area | File:line | Root cause | Fix |
|---|---|---|---|---|
| P0-1 | Header and demo banner bleed-through | `Header.tsx:129`, `:396-397`, `:412` | See B1 | See B1 |
| P0-2 | Pie labels clipped and overlapping | `Overview.tsx:812-831`, `index.css:82-84` | See B2 | See B2 |
| P0-3 | 7-tab horizontal nav | `App.tsx:200-216` | See B4 | See B4 |
| P0-4 | **Every dialog overflows the viewport by 16px on mobile** **[verified]** | `ui/dialog.tsx:35`, `ui/alert-dialog.tsx:34` | `fixed left-[50%] w-full max-w-lg translate-x-[-50%] … mx-4`. `w-full` = 375px plus `margin-left: 16px`, so the dialog spans x = 16…391 at 375px. The right 16px are cut off, including the close button area in LTR. | Replace with `w-[calc(100%-2rem)]` and no `mx-4`. Better: in v4, render a **bottom sheet** under `sm` (`inset-x-0 bottom-0 rounded-t-2xl max-h-[90dvh] pb-[env(safe-area-inset-bottom)]`) and keep the centred dialog on `sm+`. |
| P0-5 | **Dialog close X collides with the Hebrew title** **[verified]** | `ui/dialog.tsx:41` | `absolute right-4 top-4` is physical. In RTL the title starts at the right, so the X (x = 342…374) overlaps the title text (x = 41…366). The X is also 32×32 (<44). Its `sr-only` text is hardcoded "Close". `data-[state=open]:bg-accent` paints it with the vivid blue accent. | `end-3 top-3 h-11 w-11`, remove `bg-accent`. Pass a localised `closeLabel` prop. Add `pe-10` to `DialogHeader`. |
| P0-6 | **Savings tab overflows horizontally (page is 462px wide at 375)** **[verified]** | `Savings.tsx:367-420` (`AccountCard`) | Row is `flex justify-between`. The left block has no `min-w-0`, and its badges row (`flex gap-1.5`) does not wrap. The right block holds the balance plus 3 icon buttons of 44px each (Transfer, Edit, Delete), about 212px. The buttons are pushed outside the card and the whole page scrolls sideways. | Two-line row: name + balance on line 1, badges (`flex-wrap`) on line 2. Move Transfer, Edit and Delete into a `⋯` menu or a bottom-sheet action list. Add `min-w-0` to the text column. |
| P0-7 | **Goals allocation table is clipped on mobile** **[verified]** | `Goals.tsx:509-510` | 6-column `<table>` inside `overflow-x-auto`. In RTL it is clipped at the start edge: the "Progress" column shows "(0,000" and "התקדמ". | Under `sm`, render each row as a stacked card list (goal · status chip · needed/allocated · progress bar). Keep the table on `md+`. |
| P0-8 | **Brand teal fails contrast** | `index.css:11`, `:44` | `--primary 162 63% 41%`. Teal text on white is **2.92:1**, and white text on teal buttons is **2.92:1**; AA needs 4.5:1 for 14px text. In dark mode, white on teal is **2.44:1**. This affects every primary button, KPI value, "remaining" and income amount. | Split brand from text use: `--primary` stays the fill colour. Add `--primary-strong 162 64% 30%` (5.03:1 on white) for text and links. Darken the button fill to about 33% or use dark foreground text. In dark mode set `--primary-foreground: 162 40% 7%` (7.4:1 on teal 45%). |
| P0-9 | **Muted text fails contrast** | `index.css:16` | `--muted-foreground 162 20% 45%`: 3.92:1 on card, 3.69 on background, 3.47 on `bg-muted`. It is used for almost every label and `text-xs` caption. | `162 16% 38%` gives 5.1:1 on background. Dark mode (`162 15% 55%`, 5.5:1) passes. |
| P0-10 | **Warning text unreadable** | `Expenses.tsx:1236`, `:1262-1270`, `Income.tsx:1119` | `text-warning` (`38 92% 50%`) on white or `bg-warning/10` is **2.14:1**. Examples: the "Variable ₪6,220" pill, the "Clear now" button, the FX estimated note. | Add a `--warning-strong 32 95% 32%` text token (5.5:1). Only use `text-warning-foreground` / `--warning-strong` for text, never `text-warning`. |
| P0-11 | **iOS zooms on every input focus** | `ui/input.tsx:10`, `ui/select.tsx:17` (trigger) | Input and SelectTrigger are `h-9 text-sm` (36px tall, 14px font). iOS Safari auto-zooms any field under 16px and does not zoom back. Measured: inputs 36px / 14px. | `h-11 text-base sm:h-9 sm:text-sm` in the primitives. That also satisfies the 44px rule. |
| P0-12 | **Progress and Slider fill from the wrong side in RTL** **[verified]** | `ui/progress.tsx:16`, `ui/slider.tsx`, no `DirectionProvider` in the app | Progress uses `translateX(-(100-v)%)`, so it always fills from the left (measured indicator at x = −47…262 inside a 33…342 track). Radix Slider defaults to `dir="ltr"` with no provider, so the Goals emergency-buffer slider runs left to right in Hebrew. | Wrap the app in Radix `<DirectionProvider dir={lang==='he'?'rtl':'ltr'}>`. In Progress, use `rtl:` with a positive translate, or a width-based indicator (`style={{width: v+'%'}}` anchored at `start-0`). |
| P0-13 | **Switch thumb escapes the track in RTL** | `ui/switch.tsx:19` | `data-[state=checked]:translate-x-4` moves the thumb right. In RTL it starts on the right, so a checked switch pushes it outside the track. | Add `rtl:data-[state=checked]:-translate-x-4`. |

### P1 — significant friction or inconsistency

**Navigation and IA**

| # | Area | File:line | Root cause | Fix |
|---|---|---|---|---|
| P1-1 | Members is a top-level tab *and* inside Household Settings | `App.tsx:165`, `Members.tsx`, `HouseholdSettings.tsx:36` (`MemberRow`) | Two member lists that duplicate each other. Members is a rarely used screen holding a primary nav slot. | Keep a single member list inside Household Settings, reached from the avatar menu or "More". Frees one tab. |
| P1-2 | History is a 4,600px wall **[verified]** | `History.tsx:429+` | Every snapshot card is fully expanded: 6 KPI tiles, category grid, 2 add buttons, delete. | Collapsed month rows (month · FCF chip · chevron) that expand one at a time. Default to the last 3 months, with "Show older". |
| P1-3 | Expenses toolbar places a destructive bulk action at top level | `Expenses.tsx:1316-1326` | "Clear Variable" (red outline) sits next to the view toggle and Compare. It is easy to hit and visually loud. | Move it into a `⋯` overflow menu on the toolbar. It is already confirmed by an AlertDialog, so keep that. |
| P1-4 | Month navigation chevrons point the wrong way in RTL **[verified]** | `Expenses.tsx:1171-1203` | "Previous month" sits on the right in RTL but shows `ChevronLeft` (pointing inward). The buttons are 36×36. No directional icon in the app is mirrored: `SurplusBanner.tsx:215,221` and `Income.tsx:1077` (Gross→Net arrow) have the same bug. | Add a shared `<DirIcon>` or apply `rtl:-scale-x-100` to every directional icon (Chevron L/R, Arrow L/R). Size the buttons `h-11 w-11`. |
| P1-5 | Auth page is English-only and has no value proposition | `AuthPage.tsx:12`, `:262-363` | `const lang = 'en'` is hardcoded. There is no language toggle. Demo then opens in Hebrew, which is jarring. Two stacked "or" dividers. No tagline or screenshot. The password eye button has `tabIndex={-1}` (`:46`), so keyboard users cannot reach it, and it is under 44px. | Language toggle in the corner, defaulting to `navigator.language`. One-line value proposition + 3 benefit bullets. A single divider. Make the eye button focusable and 44px. |

**Typography, colour and data display**

| # | Area | File:line | Root cause | Fix |
|---|---|---|---|---|
| P1-6 | No tabular numerals on most money values | Overview 0 uses of `tabular-nums` vs 14 `formatCurrency` calls; Goals 0/21; SurplusBanner 0/14; Members/Header 0 | Digits shift width as values change, and columns of amounts don't align. | Apply `font-variant-numeric: tabular-nums` globally on a `.num` utility, or on `body` (`font-feature-settings: "tnum"`), and use a `<Money>` component everywhere. |
| P1-7 | No font is defined | `index.css:76-79`, `tailwind.config.js` (no `fontFamily`) | Falls back to the Tailwind system stack. Hebrew renders in Arial on Windows and Android, so EN and HE glyph metrics differ. | Self-host a variable font with Hebrew and Latin support and tabular figures, e.g. **Rubik** or **Heebo** for UI, optionally with Inter for Latin. Set `font-display: swap`. |
| P1-8 | Semantic colour misused | `Expenses.tsx:1225` & `:864` (total in `text-destructive`), `Overview.tsx:109` (all KPIs teal), `Overview.tsx:33,37` (on-track = `chart-2` blue), `History.tsx:608` (`text-green-600`), `ui/badge.tsx:14` (`emerald-*`) | Red is used for "your budget", which is a neutral value, so alarm red loses meaning. The same "on track" state appears in three colours: blue in the donut, teal in the progress bars, emerald in the badge. History and Badge bypass the tokens entirely. | Add a `--success` token and map *every* status to exactly one token: success / warning / danger / neutral. Use neutral `text-foreground` for totals. Replace `emerald-*` and `green-*` with the token. |
| P1-9 | Chart category colours are unstable | `Overview.tsx:24-29`, `:825` | Colours are assigned by array index of the categories present. Food is blue today and becomes green when a new category appears, and colours differ between devices. | Add a fixed `category → --chart-n` map in `src/lib/categories.ts`, reused by the pie, Expenses category dots and History. |
| P1-10 | Hardcoded English units in Hebrew UI | `Savings.tsx:376` (`%/yr`), `:381` (`/mo`), `Income.tsx:1116` (`/mo`), `Overview.tsx:492` (`+${m}m`), `App.tsx:264-269` (SW update toast) | i18n rule violations. | Wrap them in `t()`. Format units with `Intl` where possible. |
| P1-11 | Bidi garbling of currency + unit | `Income.tsx:1618` badge renders as "חודש/₪ 18,200"; `Income.tsx:1106` "/חודש נטו" | A Latin-digit money string next to a Hebrew suffix with no isolation. | Wrap amounts in `<bdi>` or `<span dir="ltr">` inside a `<Money>` component. Write units as words ("לחודש") rather than with a slash prefix. |
| P1-12 | Wrong Hebrew copy | `Expenses.tsx:1532` | "Due this month!" is translated "פג החודש!", which means "expired". | "לתשלום החודש!". Have a native speaker do a copy pass on all `t()` Hebrew strings. |

**Forms**

| # | Area | File:line | Root cause | Fix |
|---|---|---|---|---|
| P1-13 | Numeric inputs are poor on mobile | 30+ `type="number"` fields (e.g. `Expenses.tsx:380`, `SurplusBanner.tsx:142`, `Savings.tsx:113-122`, `Goals.tsx:86-97`, `Income.tsx:260-909`). No `inputMode` anywhere. | `type="number"` combined with `+e.target.value` means the field can never be empty. It shows "0" that the user must delete (visible in the Add Expense dialog). Mouse-wheel scroll changes values, there are no thousands separators, and no currency prefix. | A shared `<MoneyInput>`: `type="text" inputMode="decimal"`, ₪ adornment on the start side, live grouping, empty state allowed, `text-2xl` amount in quick-add. Use `inputMode="numeric"` for integers (months, percent). |
| P1-14 | Form field order and labelling | `Expenses.tsx:214-524`, `Income.tsx:93-100` (`FieldRow`), `SurplusBanner.tsx:261,297` | In Add Expense the amount, the most important field, comes 4th, after the scan zone, When? and Name. Many `<Label>`s have no `htmlFor` (Period, Due Month, Category, Expense type; every `FieldRow` in Income; both Surplus selects), so labels are not associated. The Save button is not sticky, so it scrolls off in long forms. | Order: Amount (large) → Category (chip grid) → Name → advanced options in a disclosure. Every Label gets `htmlFor` / `aria-labelledby`. Use a sticky footer action bar in sheets. |
| P1-15 | Tap targets under 44px **[verified]** | `ui/button.tsx:19-22` (`default` 36, `sm` 32, `icon` 36). Measured failures: Expenses 15 controls (month nav 36×36, view toggle 36, Compare 32, every "Edit budget" 32); Income 4 ("Add income entry", "Add member", "Add source" ×2 at 32); Savings/Goals "Add" at 32; header language toggle 40×44; Slider thumb 16px (`ui/slider.tsx:17`); Switch 20px | The primitives' default sizes are below 44px, and fixes are applied one call site at a time. | Fix it in the primitive: `default: h-11 sm:h-9`, `sm: h-10 sm:h-8`, `icon: h-11 w-11 sm:h-9 sm:w-9`. Give the Slider thumb `h-6 w-6` with a 44px hit area (`before:` pseudo-element). |
| P1-16 | Generic delete confirmations | `Expenses.tsx:776`, `:1608`, plus 10 more AlertDialogs across Goals, Savings, History and Income | "Are you sure? This cannot be undone." does not say what is being deleted. | A shared `<ConfirmDelete itemName=… />`: "למחוק את 'שכר דירה'?". On mobile, offer an undo toast instead of a modal for single items. |

**Components, motion and feedback**

| # | Area | File:line | Root cause | Fix |
|---|---|---|---|---|
| P1-17 | Card-in-card nesting wastes width | `Income.tsx:1027-1160` inside the member card | Member card `p-6` + source card `p-3` + 1px strip, so source content gets about 260px at 375px. Each source shows up to 6 badges. | Flatten: member becomes a section header, sources become list rows. Limit to 2 visible badges and put the rest in the detail sheet. |
| P1-18 | No enter/exit motion at all | `ui/dialog.tsx:18,35`, `ui/alert-dialog.tsx`, `ui/select.tsx` | Uses `animate-in`, `fade-in-0`, `zoom-in-95` and similar, but `tailwindcss-animate` is **not installed or registered** (`tailwind.config.js:56`, `plugins: []`). Compiled CSS has 0 matches, so dialogs and menus pop in and out abruptly. | Add `tailwindcss-animate`, or define keyframes in the theme. See Motion in §4. |
| P1-19 | Loading is a full-page spinner | `App.tsx:170-179` | The research doc recommends skeletons for 2–10s loads. A spinner hides layout and feels slower. | A `<Skeleton>` primitive plus per-tab skeleton layouts (KPI blocks, list rows). |
| P1-20 | Toaster ignores RTL and dark mode | `App.tsx:233` | `<Toaster position="bottom-right" />` has no `dir`, `theme` or `richColors`, and no offset for the FAB or a future bottom nav. Toasts are always light, and in LTR they overlap the FAB. | `<Toaster dir={dir} theme={dark?'dark':'light'} position="top-center" offset={…}/>` on mobile. |
| P1-21 | Collapsible card headers aren't keyboard-operable | `Expenses.tsx:1416-1420` | `CardHeader` is a `div` with `onClick` and `aria-expanded`, but no `role="button"`, no `tabIndex` and no key handler. | Use a real `<button>` covering the header row (or Radix Collapsible). |

### P2 — polish and debt

| # | Area | File:line | Note / fix |
|---|---|---|---|
| P2-1 | Component duplication in Expenses (1,657 lines) and Income (1,680 lines) | — | Extract the following shared components (see §3): `SegmentedControl`, `MonthYearPicker`, `MonthName`/`MONTHS`, `ConfirmDelete`, `MoneyInput`, `Money`, `ListRow` with actions, `EmptyState`, `StatusChip`, `SectionHeader`, `AlertBanner`. |
| P2-2 | Inconsistent empty states | `Expenses.tsx:1386-1389`, `Income.tsx:1604-1607` | Goals, Savings and History use the mockup-03 pattern (icon tile + text + CTA). Expenses and Income still use the old icon + grey text with no CTA. Overview has no first-run state: it shows ₪0 KPIs and "No expenses yet" cards. Use one `<EmptyState>` everywhere, and add a guided first-run checklist on Overview (add income → add expenses → set a goal). |
| P2-3 | Select item RTL | `ui/select.tsx:60`, `:65` | `pl-8 pr-2` and the indicator at `left-2` are physical, so the checkmark lands on the wrong side in Hebrew. Use `ps-8 pe-2` and `start-2`. |
| P2-4 | Savings Forecast x-axis | `Overview.tsx:1005` | The "+12m" tick overflows the chart edge by about 5px (measured 793…819 of 814). Add `padding={{ right: 12 }}` and localise the labels. |
| P2-5 | Briefing card uses emoji as status icons | `Overview.tsx:120-125` | ✅ ⚠️ 🚨 ℹ️ render differently on each OS and in dark mode. Use lucide icons in token colours, consistent with the rest of the app. |
| P2-6 | `theme-color` is static | `index.html` (`#25a27a`) | No dark variant. Add `<meta name="theme-color" media="(prefers-color-scheme: dark)">` and update it when the in-app dark toggle changes. |
| P2-7 | No safe-area handling | `index.html` viewport, `Expenses.tsx:1634` FAB | Add `viewport-fit=cover` and `env(safe-area-inset-*)` padding on sticky header, bottom nav and FAB (PWA standalone on iPhone). |
| P2-8 | Micro text | `Header.tsx:235`, `Overview.tsx:919`, `HouseholdSettings.tsx:662` | `text-[10px]` is below the scale's minimum. Use `text-xs` (12px) as the floor. |
| P2-9 | Card radius vs other radii | `ui/card.tsx:6` (`rounded-lg` = 12px), banners `rounded-xl`, dialogs `rounded-lg`, pills `rounded-full` / `rounded-md` | Several radii coexist with no rule. See the radius scale in §4. |
| P2-10 | `as any` in Income formatting | `Income.tsx:~128`, `:1040` | Not visual, but `fmt` casts `currency as any`. Flag for the Frontend role. |
| P2-11 | Copy mismatch | `Expenses.tsx:444` | Says "Accounts tab", but the tab is called Savings / חיסכון. |
| P2-12 | Header lacks app identity on mobile | `Header.tsx:136` | The name is hidden under `sm`, and the logo tile isn't a link to Overview. Make the logo tap target navigate to Overview. |

---

## 3. Component duplication — proposed shared components

| Proposed component | Current copies |
|---|---|
| `SegmentedControl` (2–3 options, `aria-pressed` or radiogroup) | `Expenses.tsx:296-327` (When?), `:478-506` (Fixed/Variable), `Income.tsx:1307+` (When?), `Expenses.tsx:1276-1307` (Category/Date view), `HouseholdSettings.tsx:516-533` (Email/Link), `AuthPage.tsx:303-320` (Sign in/Up) |
| `MonthYearPicker` + `MONTHS` / `monthName()` | `Expenses.tsx:18-37`, `:330-367`; `Income.tsx:52-70` + its picker; `Overview.tsx:43-44` (`MONTH_SHORT_*`). Replace with `Intl.DateTimeFormat` |
| `CATEGORY_LABELS` | `Overview.tsx:47-60` duplicates `src/lib/categories.ts` |
| `ConfirmDelete` | 24 `AlertDialogContent` blocks: Expenses 6, History 6, Income 4, Header 4, Goals 2, Savings 2 |
| `ListRow` (leading strip/icon · title · meta · trailing amount · actions menu) | Expense row `Expenses.tsx:1556-1630`, Income `SourceCard`, Savings `AccountCard`, History items, Members `MemberCard`, HouseholdSettings `MemberRow`. Each uses a different action pattern: vertical split, footer row, or inline icons |
| `Money` (`tabular-nums`, `<bdi>`, sign, tone) and `MoneyInput` | About 110 inline `formatCurrency` calls with ad-hoc classes; 30+ numeric inputs |
| `StatusChip` (icon + text + tone, one mapping) | `Overview.tsx:601-612`, `Goals.tsx:323-348`, Expenses budget dot + text, History FCF badge |
| `AlertBanner` (info/success/warning/danger, icon, action) | Deficit banner `Overview.tsx:689`, due bills `Expenses.tsx:1361`, stale variables `:1249`, scan error `:283`, AuthPage `ErrorBanner`, Joined banner `App.tsx:25` |
| `EmptyState` | 6 variants (see P2-2) |
| `KpiTile` / `StatTile` | Overview KPI, Expenses summary banner, Savings liquid/locked tiles, History 4-tile grid, Goals card stat tiles |
| `ChartCard` (title, optional badge, fixed-height body, legend slot) | 6 chart cards in Overview + History trend |

Expected effect: about 30–35% fewer lines in Expenses and Income, and consistent behaviour fixes. Fixing tap targets, RTL and contrast in one place fixes them everywhere.

---

## 4. Mockups: what shipped and what didn't

| Mockup | Status | Notes |
|---|---|---|
| 01 Header mobile (avatar dropdown) | **Implemented** | `Header.tsx:161-218`. The custom dropdown isn't a Radix menu: no arrow-key navigation or focus trap, and the outside-click handler is `mousedown` only. |
| 02 KPI cards (vertical stack, inline trend) | **Implemented** | `Overview.tsx:98-115`. The hierarchy problem remains: 4 equal cards, all teal (see B5). |
| 03 Empty states (icon + message + CTA) | **Partial** | Goals, Savings and History done. Expenses, Income and Overview not done. |
| 04 Trend badges → tokens | **Implemented** | `bg-primary/10 text-primary`. Still inherits the teal contrast failure (P0-8). |
| 05 Settings dialog grouped | **Implemented** | `Header.tsx:310-368`. The "Data" group heading style differs from "Preferences": `text-sm font-medium` vs uppercase `text-xs`. |
| 06 Expenses UX A–E | **A, B, D, E implemented. C partial** | C proposed "actions in overflow menu". It shipped as a vertical split Edit/Delete column (`Expenses.tsx:1597-1628`), which is still 2 icons per row. A (summary) uses red for the total. |
| 07 Fund goal from savings | **Implemented** | `Goals.tsx:139` (`FundGoalDialog`). |
| overview-mockups.html (v2.9) | **Implemented** | Donut and forecast cards. Their chart issues are covered in B2/B3. |

---

## 5. Dark mode and RTL summary

- **Dark mode** mostly works through tokens (verified via screenshot). Failures:
  - White on teal is 2.44:1 (P0-8).
  - The "none" slice is invisible (B3).
  - The Toaster is always light (P1-20).
  - `theme-color` is static (P2-6).
  - The badge `success` variant uses a separate emerald palette (P1-8).
- **RTL:**
  - Logical margins (`ms-`/`me-`) are used correctly almost everywhere. `rtl:divide-x-reverse` is used correctly in `Overview.tsx:980`.
  - Remaining failures: dialog close X (P0-5), Progress and Slider (P0-12), Switch (P0-13), directional icons (P1-4), Select items (P2-3), bidi money strings (P1-11), chart tooltip (B2), and the English-only auth page (P1-5).
  - Fix the root cause by adding Radix `DirectionProvider`, and add an RTL screenshot test to CI (Playwright, 375px, `he`).

---

## 6. Proposed design-system direction (v4, keeps the teal brand)

### Colour tokens (HSL, light / dark)

The main change is to separate fill colours from text colours so every pair passes WCAG AA.

```
/* Brand */
--primary            162 63% 38%   / 162 60% 48%   fills, active nav, chart-1
--primary-strong     162 64% 30%   / 162 60% 62%   teal TEXT & links (5.0:1 / 8:1)
--primary-subtle     162 45% 94%   / 162 30% 15%   tinted surfaces (selected row, hero card)
--primary-foreground 0 0% 100%     / 162 40% 7%    (dark: dark text on teal = 7.4:1)

/* Neutrals — slightly cooler, more steps */
--background   160 20% 97%  / 162 22% 7%
--surface-1 (card)   0 0% 100% / 162 22% 10%
--surface-2 (raised/sheet) 0 0% 100% / 162 20% 13%
--muted        162 15% 94%  / 162 18% 16%
--muted-foreground 162 16% 38% / 162 12% 62%   (5.1:1 / 6:1)
--border       162 18% 88%  / 162 16% 20%

/* Semantic — each has base (fill), strong (text), subtle (bg) */
--success   152 60% 40% | strong 152 65% 28% | subtle 152 50% 93%
--warning    38 92% 50% | strong  32 95% 32% | subtle  38 92% 92%
--danger      0 72% 51% | strong   0 70% 42% | subtle   0 80% 96%
--info      199 89% 48% | strong 201 90% 32% | subtle 199 80% 94%

/* Data viz — fixed category map, 10 hues tuned for equal lightness,
   plus --chart-neutral for "other/none" (never --muted). */
```

Rule: a status is always icon + text + `*-strong` text on `*-subtle` background. `text-warning` and `text-primary` are banned for body text.

### Type scale (mobile-first; one family with Hebrew and Latin)

Font: **Rubik** or **Heebo** (variable, self-hosted), with `font-feature-settings: "tnum" 1` on numerals through a `.num` class or the `<Money>` component.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 36/40 (`text-4xl`) | 700 | Hero "free to spend" number |
| `title-1` | 24/32 | 700 | Page title |
| `title-2` | 18/26 | 600 | Section and card title |
| `body` | 16/24 mobile, 14/20 `sm+` | 400 | Default text **and inputs** (no iOS zoom) |
| `label` | 14/20 | 500 | Form labels, list titles |
| `caption` | 12/16 | 400–500 | Meta, badges (floor: no `text-[10px]`) |
| `num-lg` / `num-md` | 20 / 16 | 600, tabular | Amounts in lists and KPIs |

### Spacing and layout
- 4px base grid. Page gutter 16px on mobile, 24px on `md`.
- Card padding: 16px on mobile, 20–24px on `md`. Retire `p-6` on mobile cards to recover width.
- List rows are at least 56px tall (44px target + breathing room). Gap between cards: 12px on mobile, 16px on desktop.
- **Shell:** sticky solid header (48–56px), **bottom nav at 64px + safe-area** on mobile, top tabs or side rail on `md+`. `max-w-4xl` content.

### Elevation
| Level | Use | Light | Dark |
|---|---|---|---|
| 0 | Page | background | background |
| 1 | Card | `surface-1` + 1px border, no shadow | `surface-1` + border |
| 2 | Sticky header, bottom nav | `surface-1` + `shadow-[0_1px_0_hsl(var(--border))]` (+ soft shadow on scroll) | border only |
| 3 | Sheet, dialog, menu | `surface-2` + `shadow-lg` | `surface-2` + border + `shadow-lg` at 40% |

Translucent surfaces only at 92% opacity or more, with `backdrop-blur-md`. Never `/20`.

### Radius
`--radius-sm 8px` (inputs, chips) · `--radius-md 12px` (cards, buttons) · `--radius-lg 16px` (hero card, banners) · `--radius-xl 24px` (bottom-sheet top corners) · `full` (pills, avatars, FAB). One rule: a container's radius is greater than or equal to its children's radius.

### Motion
- Install `tailwindcss-animate`.
- Durations: 120ms (press/hover), 200ms (menus, chips), 280ms (sheets and dialogs, `cubic-bezier(0.32,0.72,0,1)`).
- Charts animate once on first mount (`isAnimationActive` only on initial render), never on resize.
- Number changes use a 300ms count-up on the hero only.
- Everything respects `prefers-reduced-motion: reduce`, which disables transforms and keeps opacity.

### Mobile interaction primitives to add
- `Sheet` (bottom sheet built on Radix Dialog with drag-to-dismiss) for all create and edit forms on mobile. Centred `AlertDialog` only for destructive confirmations.
- `BottomNav` with a central quick-add "+", RTL-mirrored order.
- `ActionMenu` (`⋯`) for row actions, with swipe as a progressive enhancement that mirrors in RTL.
- `Skeleton`, `EmptyState`, `Money`, `MoneyInput`, `SegmentedControl`, `StatusChip`, `ChartCard` (see §3).

---

## 7. Suggested sequencing

1. **Week 1, primitives (fixes about 60% of findings at once):**
   - Dialog width and close button.
   - Input, Select and Button sizes.
   - Progress, Slider and Switch RTL, plus `DirectionProvider`.
   - Contrast tokens and `--success`.
   - `tailwindcss-animate`.
   - Solid header and banner.
2. **Week 2, shell:** bottom nav + hash routing, Members folded into settings, `Sheet` for forms, Toaster config, safe areas.
3. **Week 3, Overview:** hero number, donut + legend charts, stable category colours, compact surplus banner.
4. **Week 4, list screens:** `ListRow` + `ActionMenu` across Expenses, Income, Savings and History. Collapsed History. Goals mobile card list. `MoneyInput` everywhere.
5. Add a Playwright visual regression job at 375px in `he` light and dark (the scripts used for this audit can be the seed).
