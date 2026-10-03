# Spec — v4.1: Mark goal as done + bottom-nav reorder

> **Status:** Approved by the user on 2026-10-03 (keep the central "+") · October 2026 · Owner: Product

---

## Feature 1: Mark a goal as done

**Problem:** Once a goal is reached (or abandoned as "good enough"), it stays in the active list forever. It keeps competing for monthly allocation, skews the Goals donut on Home and clutters the Goals tab. Today the only way to get rid of it is to delete it, which loses the record of what was achieved.

**Users affected:** All personas, mainly couples tracking several goals (vacation, car, renovation).

**Proposed solution:**
- In the goal card's ⋯ menu, add **"Mark as done / סמן כהושלם"** (CheckCircle icon).
- When a goal reaches 100% (`currentAmount ≥ targetAmount`), the card also shows an inline **"Mark as done"** button.
- Done goals move into a collapsible **"Completed (N) / הושלמו (N)"** section at the bottom of the Goals tab:
  - The section is collapsed by default.
  - Each done goal shows its name, the amount saved, the date it was completed, and a ⋯ menu with **"Reopen / פתח מחדש"**, Edit and Delete.
  - Delete keeps its existing confirmation.
- Done goals are **excluded** from:
  - the allocation plan
  - the monthly "available for goals" split
  - the Home goal donut and top-priority list
  - the goal-related insight and surplus targets
- **Nothing is deleted or moved.** `currentAmount`, `usedAmount` and every other field stay exactly as they are. Marking a goal done moves no money. Reopening restores the goal to the active list unchanged.
- A toast confirms the change: "'Vacation' marked as done ✓".

### Data contract (Data Safety Protocol)

| Item | Change |
|---|---|
| `Goal` type | **Add** one optional field, `completedAt?: string` (an ISO date, set on done and removed on reopen). Nothing is removed or renamed. |
| Merge strategy | Unchanged. `goals` stays additive `mergeById` (cloud wins per goal ID), and the field travels inside the goal object. |
| `cloudFinance.ts`, `FinanceContext.tsx` sync/merge | **No changes.** Marking done and reopening use the existing `updateGoal(goal)` call with `{ ...storedGoal, completedAt }`. |
| localStorage keys | None added. The collapsed/expanded state is React state only. |
| Backward compatibility | A goal with no `completedAt` is active, so all existing goals stay active. Every edit path spreads the stored goal (`{ ...existing, ... }`), so `completedAt` is never dropped by an edit. |
| Item counts | `goals.length` never changes when a goal is marked done or reopened. |

### Acceptance criteria
- [ ] The ⋯ menu offers "Mark as done" on active goals and "Reopen" on done goals.
- [ ] A goal at ≥100% shows an inline "Mark as done" button.
- [ ] Marking done sets `completedAt`. The goal leaves the active list, the allocation plan and the Home goal donut, and appears under "Completed (N)".
- [ ] Reopening removes `completedAt`. The goal returns to the active list and all its other fields are identical.
- [ ] `goals.length` is identical before and after marking done or reopening (unit test).
- [ ] A done goal syncs to the other device as done. `mergeFinanceData` keeps `completedAt` (unit test).
- [ ] Editing a done goal keeps `completedAt` (unit test).
- [ ] Works in Hebrew RTL and English, light and dark, at 375px and desktop.

### Out of scope
- Automatically marking a goal done when it reaches 100%. The user always decides.
- Moving the saved money to another goal or account when a goal is completed.
- Celebration animations or a goal history timeline.

### Success metric
Users complete goals instead of deleting them: the number of goal deletes drops, and done goals appear in households with 3 or more goals.

---

## Feature 2: Bottom navigation — Home · Expenses · Income · More

**Problem:** Income is used more often than Goals on mobile, so it should sit in the bottom bar.

**Proposed solution:**
- The mobile bottom bar becomes **Home · Expenses · [+] · Income · More**.
- **Goals moves into the More sheet.** The More sheet then lists Goals, Savings, History, Members and Settings.
- The desktop top nav is unchanged (all 7 tabs).

### Acceptance criteria
- [ ] The bottom bar shows Home, Expenses, Income, More, plus the central "+" if kept.
- [ ] Goals is reachable from More, and More shows as active while on Goals.
- [ ] `#/goals` deep links and the Back button still work.
- [ ] No overflow at 375px, in Hebrew and English.

### Open question for the user
- Keep the central **"+" Quick Add** button between Expenses and Income (recommended, since it is the 3-tap add flow), or drop it so the bar is exactly 4 items?

---

## Implementation & files
- `src/types/index.ts`: add `completedAt?: string` to `Goal` (additive only).
- `src/components/goals/*` and `Goals.tsx`: menu actions, the Completed section, and filtering active goals before allocation.
- `src/components/Overview.tsx` / `src/lib/insights.ts`: use active goals only.
- `src/components/SurplusBanner.tsx`: list only active goals as allocation targets.
- `src/lib/navigation.ts`: change `placement` (goals → `more`, income → `primary`); BottomNav order.
- Tests: `src/test/goalDone.test.ts`, which covers counts, merge round-trip, edit preservation and allocation exclusion. Navigation tests are updated for the new placements.
