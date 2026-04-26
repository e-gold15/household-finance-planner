# Goals — UX & UI Specification

## Goal Cards

Each goal is rendered as a card in the goal list. Cards contain:

| Element | Detail |
|---------|--------|
| **Goal name** | Displayed as a heading (`text-sm font-semibold`) |
| **Priority badge** | Colour-coded — see Badge Colours below |
| **Deadline** | Formatted date string (e.g. "Dec 2026") |
| **Progress bar** | Filled to `currentAmount / targetAmount`; fill colour matches status |
| **Status badge** | Realistic / Tight / Unrealistic / Blocked — see Status Badge Colours below |
| **Monthly required** | Small label showing the engine's `monthlyRecommended` figure |
| **Up / Down buttons** | Icon buttons (ChevronUp / ChevronDown) to reorder; first card hides Up, last hides Down |
| **Edit button** | Pencil icon; opens the Edit Goal dialog |
| **Delete button** | Trash icon (destructive); removes the goal after confirmation |

All icon-only buttons carry a `title` attribute for screen reader accessibility.

---

## Badge Colours

### Priority Badges

| Priority | Badge Variant | Visual |
|----------|--------------|--------|
| High | `destructive` | Red background |
| Medium | `warning` | Amber background |
| Low | `secondary` | Muted grey background |

### Status Badges

| Status | Badge Variant | Visual | Meaning |
|--------|--------------|--------|---------|
| Realistic | `success` | Emerald green | Fully funded with surplus to spare |
| Tight | `warning` | Amber | Fully funded but uses most of surplus |
| Unrealistic | `destructive` | Red | Cannot be fully funded at current FCF |
| Blocked | `secondary` | Muted grey | No FCF remaining or deadline passed |

Status and priority are always communicated with both a colour and a text label — never colour alone — to meet accessibility requirements.

---

## Allocation Plan Card

The Allocation Plan card appears below the goal list. It contains:

### Table

| Column | Content | Notes |
|--------|---------|-------|
| **Goal** | Goal name (truncated if long) | Links to goal card above |
| **Priority** | Priority badge | Same colours as goal cards |
| **Needed/mo** | `monthlyRecommended` in household currency | Right-aligned numeric |
| **Allocated** | `monthlyAllocated` in household currency | Right-aligned; may differ from Needed/mo for unrealistic goals |
| **Status** | Status badge | Same colours as status badge on goal card |
| **Progress** | Mini progress bar (compact, inline) | Width fixed at ~80px |

On mobile screens (< 640px wide), the table scrolls horizontally. The Goal column is sticky (pinned to the left) so the goal name stays visible while the user scrolls through the numeric columns.

### Recalculate Button

- Position: top-right of the Allocation Plan card header
- Icon: RefreshCw (lucide-react)
- Behaviour: reruns `autoAllocateSavings()` with current FCF; table rows update immediately
- Loading state: button shows a spinning indicator and is disabled while the engine runs (engine is synchronous so this is near-instant; spinner handles any async wrapping)

---

## AI Explain Card

The AI Explain card is collapsible and appears directly below the Allocation Plan card.

| Property | Detail |
|----------|--------|
| **Trigger** | "Explain my plan" button with a robot icon in the Allocation Plan card header |
| **Loading state** | Spinner inside the card body; button is disabled and labelled "Thinking..." |
| **Response display** | Plain text, `text-sm`, inside a scrollable area (`max-h-[40vh] overflow-y-auto`) |
| **Error state** | Inline error message in `text-destructive`; retry is possible by clicking the button again |
| **Collapse** | Card can be collapsed after reading via a ChevronUp toggle |
| **Language** | Response language matches the app's current language setting (EN or Hebrew) |

The card does not appear at all if no Anthropic API key is configured in the environment.

---

## Add / Edit Goal Dialog

The dialog is triggered by the "Add Goal" button (top of Goals tab) or the Edit icon on a goal card.

### Fields

| Field | Control | Validation |
|-------|---------|------------|
| **Name** | Text input | Required; max 60 characters |
| **Target amount** | Number input | Required; > 0 |
| **Current amount** | Number input | Optional; defaults to 0; must be ≥ 0 |
| **Deadline** | Date picker | Required; must be a future date |
| **Priority** | Select (High / Medium / Low) | Required; defaults to Medium |
| **Notes** | Textarea | Optional; no character limit |
| **Use liquid savings** | Toggle switch | Optional; defaults to off |

### Dialog Behaviour

- Dialog title: "Add Goal" or "Edit Goal"
- Cancel button closes without saving
- Save button validates all required fields before calling `addGoal()` or `updateGoal()`
- Dialog uses `max-h-[85vh] overflow-y-auto` to handle small screens gracefully
- On mobile, the dialog is full-width with `px-4` padding

---

## Empty State

When no goals have been added yet, the Goals tab shows an empty-state illustration with:

- A brief headline: "No goals yet"
- A one-sentence explanation of what goals are for
- A prominent "Add your first goal" button

This replaces both the goal list and the Allocation Plan card. The empty state disappears as soon as one goal is saved.

---

## Mobile Layout

On screens narrower than 640px:

- Goal cards stack vertically, full width
- Priority badge and status badge appear on the same row, separated by a flex spacer
- Progress bar spans the full card width
- Up/Down reorder buttons are placed in the card footer alongside Edit and Delete
- The Allocation Plan table scrolls horizontally; Goal column is sticky
- The AI Explain card scrolls vertically within `max-h-[40vh]`

---

## RTL (Hebrew) Support

- All margin utilities use logical properties (`me-*`, `ms-*`) — never `mr-*` or `ml-*`
- Progress bars fill from right to left when the document direction is RTL
- The Allocation Plan table column order is visually mirrored
- The AI Explain response is returned in Hebrew when `lang === 'he'`

---

## Accessibility Checklist

- [ ] All icon-only buttons have `title` attributes
- [ ] Priority and status badges use text labels alongside colour
- [ ] Form inputs in the Add/Edit dialog have associated `<Label>` elements
- [ ] Progress bars include `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Dialog has `role="dialog"` and `aria-labelledby` pointing to the title
- [ ] Focus is trapped inside open dialogs
- [ ] All interactive elements meet the 44px minimum tap target requirement
