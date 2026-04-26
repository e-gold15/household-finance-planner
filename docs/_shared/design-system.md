# Design System

## Overview

The Household Finance Planner uses a custom design system built on top of Tailwind CSS and shadcn/ui. All visual decisions are expressed through HSL design tokens defined in `src/index.css`. Hardcoded hex or RGB values are never used.

---

## Colour Tokens

All colours are defined as HSL CSS custom properties on `:root` and overridden on `.dark`. Components reference tokens via Tailwind utility classes — never raw colour values.

### Semantic tokens

| Token | Light mode | Dark mode | Primary usage |
|-------|-----------|-----------|---------------|
| `--primary` | `162 63% 41%` (teal) | `162 63% 45%` | Buttons, active nav states, positive KPI values, income amounts |
| `--primary-foreground` | `0 0% 98%` | `0 0% 98%` | Text on primary backgrounds |
| `--destructive` | `0 84% 60%` (red) | `0 84% 60%` | Errors, delete actions, negative FCF, expense amounts |
| `--destructive-foreground` | `0 0% 98%` | `0 0% 98%` | Text on destructive backgrounds |
| `--warning` | `38 92% 50%` (amber) | `38 92% 50%` | Warnings, "tight" goal status, expiry alerts |
| `--warning-foreground` | `0 0% 10%` | `0 0% 10%` | Text on warning backgrounds (dark on amber) |
| `--muted` | `162 15% 94%` | `162 20% 16%` | Subtle backgrounds, dividers, placeholder areas |
| `--muted-foreground` | `162 10% 45%` | `162 10% 60%` | Secondary text, labels, metadata |
| `--background` | `160 20% 97%` | `162 25% 8%` | Page background |
| `--foreground` | `162 25% 10%` | `162 10% 95%` | Primary text |
| `--card` | `0 0% 100%` | `162 20% 12%` | Card backgrounds |
| `--card-foreground` | `162 25% 10%` | `162 10% 95%` | Text on cards |
| `--border` | `162 15% 88%` | `162 15% 22%` | Card borders, input borders, dividers |
| `--input` | `162 15% 88%` | `162 15% 22%` | Input field borders |
| `--ring` | `162 63% 41%` | `162 63% 45%` | Focus rings (matches primary) |
| `--accent` | `210 70% 55%` (blue) | `210 70% 60%` | Accent highlights, info states |
| `--accent-foreground` | `0 0% 98%` | `0 0% 98%` | Text on accent backgrounds |
| `--success` | `142 71% 45%` (emerald) | `142 71% 48%` | Positive status, "realistic" goal status, positive FCF |
| `--success-foreground` | `0 0% 98%` | `0 0% 98%` | Text on success backgrounds |

### Chart colours

Recharts uses a separate set of tokens to ensure chart readability in both light and dark mode:

| Token | Value | Usage |
|-------|-------|-------|
| `--chart-1` | `162 63% 41%` (teal) | Primary data series (FCF line) |
| `--chart-2` | `210 70% 55%` (blue) | Secondary data series |
| `--chart-3` | `38 92% 50%` (amber) | Tertiary data series |
| `--chart-4` | `0 84% 60%` (red) | Negative / below-zero fill |
| `--chart-5` | `142 71% 45%` (emerald) | Positive fill |

### Using tokens in Tailwind

```tsx
// ✅ Correct — uses semantic token
<span className="text-primary">+₪3,200</span>
<div className="bg-muted rounded-lg">...</div>
<button className="bg-destructive text-destructive-foreground">Delete</button>

// ❌ Wrong — hardcoded colour value
<span style={{ color: '#2a9d8f' }}>+₪3,200</span>
<div className="bg-[#f0f4f2]">...</div>
```

---

## Badge Variants

Badges are used for status indicators, priority labels, and metadata tags. All badges must use text labels alongside colour — never colour alone.

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| `default` | `--primary` | `--primary-foreground` | None | Primary labels, Owner role |
| `secondary` | `--muted` | `--muted-foreground` | None | Neutral labels, Member role, Blocked status |
| `outline` | Transparent | `--foreground` | `--border` | Subdued labels, invite method |
| `destructive` | `--destructive` | `--destructive-foreground` | None | Errors, High priority, Unrealistic status |
| `success` | `--success` | `--success-foreground` | None | Positive status, Realistic status |
| `warning` | `--warning` | `--warning-foreground` | None | Caution status, Medium priority, Tight status |

### Status → Badge mapping

| Status | Badge variant |
|--------|--------------|
| Goal: Realistic | `success` |
| Goal: Tight | `warning` |
| Goal: Unrealistic | `destructive` |
| Goal: Blocked | `secondary` |
| Priority: High | `destructive` |
| Priority: Medium | `warning` |
| Priority: Low | `secondary` |
| Role: Owner | `default` |
| Role: Member | `secondary` |
| FCF: positive | `success` |
| FCF: negative | `destructive` |
| FCF: stub (—) | `secondary` |

---

## Spacing Conventions

Consistent spacing prevents visual clutter and makes the app feel intentional.

### Container

```tsx
<div className="max-w-4xl mx-auto px-4">
  {/* Page content */}
</div>
```

### Cards

```tsx
// Standard card — most content areas
<Card>
  <CardHeader className="p-6">
    <CardTitle>...</CardTitle>
  </CardHeader>
  <CardContent className="p-6 pt-0">
    ...
  </CardContent>
</Card>

// Compact card — dense information (e.g. member rows, expense items)
<Card className="p-4">...</Card>
```

### Section spacing

```tsx
// Between major sections within a tab
<div className="space-y-6">
  <SectionA />
  <SectionB />
</div>

// Between cards within a section
<div className="space-y-4">
  <CardA />
  <CardB />
</div>
```

### Grid layouts

```tsx
// KPI grid: 2 columns on mobile, 4 on md+
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {kpis.map(...)}
</div>

// Two-column form
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <FormField />
  <FormField />
</div>
```

---

## Typography

The app uses the system font stack — no custom fonts are loaded to keep performance fast.

| Use case | Tailwind class | Size |
|----------|---------------|------|
| Section heading | `text-lg font-semibold` | 18px |
| Card title | `text-base font-semibold` | 16px |
| Body text | `text-sm` | 14px |
| KPI value | `text-xl font-bold` or `text-2xl font-bold` | 20–24px |
| Label / metadata | `text-xs text-muted-foreground` | 12px |
| Error message | `text-sm text-destructive` | 14px |

---

## Touch Targets

Every interactive element must meet the minimum 44×44px tap target for mobile usability (WCAG 2.5.5 Target Size).

```tsx
// Button with icon only — add min-h and min-w
<Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
  <Trash2 className="h-4 w-4" />
</Button>

// Standard button — already meets target via default height
<Button>Save</Button>  {/* h-10 = 40px — pad with py if needed */}
```

---

## RTL Support

All margin utilities must use logical properties. This ensures the layout mirrors correctly when the document direction is `rtl` (Hebrew mode).

```tsx
// ✅ Correct — logical properties
<span className="me-2">icon</span>   // margin-inline-end
<div className="ms-4">label</div>   // margin-inline-start
<div className="ps-4">content</div> // padding-inline-start

// ❌ Wrong — directional properties
<span className="mr-2">icon</span>
<div className="ml-4">label</div>
<div className="pl-4">content</div>
```

Checking RTL during development:

1. Open the app in the browser.
2. Click the language toggle to switch to Hebrew.
3. Verify that the layout mirrors correctly (nav items move to the right, text aligns right, icons swap sides).

---

## Dark Mode

Dark mode is class-based — the `dark` class is applied to `<html>` when dark mode is active.

```tsx
// Toggling dark mode
document.documentElement.classList.toggle('dark', isDark)
```

All colours are defined via HSL tokens with dark-mode overrides in `src/index.css`. No component uses hardcoded colours that would not respond to the `dark` class.

Checking dark mode during development:

1. Open the app in the browser.
2. Toggle dark mode via the Settings menu or the DevTools `dark` class toggle.
3. Verify that all text, backgrounds, borders, and badges are legible.

---

## Icon Library

Icons come from `lucide-react`. Consistent sizing and stroke width keep the UI cohesive.

| Context | Size class | Stroke |
|---------|-----------|--------|
| Body / button icons | `h-4 w-4` | 1.5 (default) |
| KPI / hero icons | `h-5 w-5` or `h-6 w-6` | 1.5 (default) |
| Inline text icons | `h-3 w-3` | 1.5 (default) |

Icon-only buttons always include a `title` attribute for accessibility:

```tsx
<Button variant="ghost" size="icon" title="Delete expense" className="min-h-[44px] min-w-[44px]">
  <Trash2 className="h-4 w-4" />
</Button>
```

---

## Dialog Standards

All dialogs must be accessible and handle small screens gracefully.

```tsx
<Dialog>
  <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Add Goal</DialogTitle>
    </DialogHeader>
    {/* form content */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

The `max-h-[85vh] overflow-y-auto` combination ensures dialogs never overflow the viewport on small screens. The scrollbar appears inside the dialog, not on the page.

---

## Pre-commit UI Checklist

Before committing any UI change, verify:

- [ ] Works on mobile at 375px viewport width — no horizontal overflow
- [ ] Works in dark mode — all text legible, no invisible elements
- [ ] Works in Hebrew RTL — layout mirrors correctly, no text overflow
- [ ] All interactive elements have visible focus rings
- [ ] No hardcoded hex or RGB colour values
- [ ] No `mr-*` or `ml-*` margin utilities (use `me-*` / `ms-*`)
- [ ] Status indicators use text label + colour, not colour alone
- [ ] All icon-only buttons have `title` attributes
- [ ] Dialogs have `max-h-[85vh] overflow-y-auto`
