# Spec — v4.2: "This month's actual" net income

> **Status:** Draft, waiting for the user's approval · October 2026 · Owner: Product
> Mockup: published as an artifact alongside this spec (Income tab, edit sheet, Home hero, in EN and HE).

---

## Feature: Set this month's actual net income per source

**Problem:**
Each income source has one planned monthly net amount, such as Eilon's salary at ₪14,000 or Sivan's salary at ₪12,500. Real paychecks rarely match it exactly. Common reasons:
- vacation or sick days lower the pay
- longer months, overtime or shifts raise it
- a bonus, holiday gift (מתנה לחג) or retroactive payment (הפרשים)

Today the only way to reflect this is to edit the source itself. That has three problems:
1. **It changes the baseline.** The planned amount becomes wrong for every following month, and the user has to remember to change it back.
2. **It changes long-term planning.** Goal allocation, savings projections and the Income tab total all use the planned figure, so one bonus month makes the whole plan look better than it is.
3. **The History tab records the wrong number.** The current month's auto-snapshot copies whatever the source says, so either the real pay is never recorded or the plan is distorted.

**Goal:**
Let the household record what each person **actually received this month (net)**. That number is used for **this month only**: "Left to spend", the current-month snapshot, and therefore History. The planned amount stays untouched and is used again automatically next month.

**Users affected:**
- **Couple:** two salaries that vary month to month because of vacation days, bonuses and holiday gifts.
- **Freelancer:** marked *Variable*, so the actual pay differs from the planned amount almost every month.
- **Expat:** works the same way. The override is entered in the source's own currency and converted like the planned amount.

### Proposed solution

**1. Income tab: source row**
- The ⋯ menu gets a new first item, **"This month's actual / בפועל החודש"** (CalendarCheck icon).
- When a source has an actual amount for the current month, the row shows:
  - **Trailing area:** the actual net amount as the main number. Underneath, a small muted line reading "Planned ₪14,000".
  - **Meta line:** a chip such as `▲ +₪2,300 this month` (success tone) or `▼ −₪1,150 this month` (warning tone). The chip always has an icon, the sign and text, so status is never shown by colour alone.
  - An optional note, such as "Bonus" or "3 vacation days", shown as muted text under the row.

**2. "This month's actual" sheet**
This is a bottom sheet on mobile and a dialog on desktop.
- **Title:** "Eilon · Salary — October 2026". The month is shown read-only and is always the current calendar month.
- **Planned net (read-only):** ₪14,000.
- **Actual net this month:** a `MoneyInput` pre-filled with the existing actual amount, or with the planned amount if there is none.
- **Live difference:** "+₪2,300 vs planned".
- **Quick reason chips** fill in the note when tapped: Bonus / בונוס · Vacation days / ימי חופשה · Overtime / שעות נוספות · Holiday gift / מתנה לחג. The note can also be typed freely.
- **Buttons:**
  - **Save**.
  - **Reset to planned** (shown only when an actual is already set), which removes the override.
  - **Cancel**.
- **Helper text:** "Only October changes. Your planned amount and future months stay the same."
- **Validation:** the amount must be ≥ 0. A value of 0 is allowed, for example for unpaid leave. An empty or invalid value is never saved (this follows the v4 save guards).

**3. Income tab: summary header**
- When at least one source has an actual for this month, the header shows two lines:
  - **This month (actual)**, ₪28,800, as the large number.
  - **Planned monthly**, ₪26,500, smaller, with the ▲/▼ difference.
- With no overrides, the header is unchanged ("Total net monthly").

**4. What uses the actual amount and what keeps the planned amount**

| Surface | Uses |
|---|---|
| Home hero "Left to spend this month", pace bar, daily allowance | **Actual** for this month |
| Current-month auto-snapshot `totalIncome` / `freeCashFlow` (this is what History keeps when the month ends) | **Actual** |
| Monthly AI briefing (`incomeTotal` comes from the snapshot) | **Actual** |
| Income tab rows and header | Both (see above) |
| Planned amount on the source (`amount`, gross→net, tax breakdown) | **Planned**, never modified |
| Goal allocation plan, savings projection, "available for goals" | **Planned** (long-term planning should not jump on a bonus month) |
| Next month | **Planned**, automatically. Nothing needs to be reset. |

**5. Month rollover**
- The override is stamped with its month (`"2026-10"`). From 1 November it no longer matches the current month, so it is ignored everywhere. No cleanup job is needed.
- October's snapshot keeps the actual total that was in place on the last day the app was open in October. This is the existing auto-snapshot behaviour.
- The stale value stays on the source and does nothing. The next time the user sets an actual, it is overwritten.

### Data contract (🔴 Data Safety Protocol)

| Item | Change |
|---|---|
| `IncomeSource` type | **Add** one optional field: `monthActual?: { month: string /* "YYYY-MM" */; amount: number /* net, in source currency */; note?: string }`. Nothing is removed or renamed. |
| Why on the source, not on the snapshot | The current-month snapshot gets a random id on each device, and two devices can each create one before they sync. Overrides stored on it could be split across two snapshots or lost. A field on the source travels with the member, which is already merged with additive `mergeById`. |
| Merge strategy | **Unchanged.** `members` stays additive `mergeById` (cloud wins per member id), and the field travels inside the source object. No changes to `cloudFinance.ts` or to the `FinanceContext` sync/merge/push code. |
| Writes | Uses the existing `updateMember({ ...member, sources })` with `{ ...source, monthActual }`. Reset uses `{ ...source }` minus `monthActual`. |
| Edit safety | `SourceDialog` already builds the saved source as `{ ...existing, … }`, so editing the planned amount keeps `monthActual`. A unit test guards this. |
| Computation | A new pure helper `getNetForMonth(src, yearMonth)` in `taxEstimation.ts` returns `monthActual.amount` when `monthActual.month === yearMonth`, and otherwise `getNetMonthly(src)`. It is used by `autoSnapshotCurrentMonth` and by `computeMonthlyPlan` (Home hero). `computeLegacyTotals` and goal allocation keep `getNetMonthly`. |
| Backward compatibility | A source without `monthActual` behaves exactly as before. Old clients ignore the field and keep it when they spread the source. |
| Item counts | `members.length` and each `sources.length` are identical before and after setting or resetting an actual (unit test). |
| localStorage keys | None added. |

**Required tests (in `monthActualIncome.test.ts`):**
- `getNetForMonth`:
  - matching month returns the actual
  - other month returns the planned amount
  - absent field returns the planned amount
  - 0 is honoured
- The auto-snapshot uses actuals for the current month and keeps `historicalExpenses` and the other existing snapshot fields.
- `computeMonthlyPlan` uses the actual, and `computeLegacyTotals` keeps the planned amount.
- `mergeFinanceData`:
  - keeps `monthActual` in the empty-cloud, empty-local and diverged cases
  - member and source counts never decrease
- An edit through the SourceDialog save path keeps `monthActual`.
- Reset removes only `monthActual`, and every other field is identical.
- Foreign-currency source: the actual is converted with the same FX path as the planned amount.

### Acceptance criteria
- [ ] The user can open "This month's actual" from any source's ⋯ menu and save a net amount for the current month.
- [ ] After saving, the row shows the actual amount, "Planned ₪X" and a ▲/▼ difference chip with icon and text.
- [ ] The source's planned amount, gross/net settings and tax breakdown are unchanged.
- [ ] Home "Left to spend this month" moves by exactly the difference.
- [ ] The current-month History snapshot's income moves by exactly the difference.
- [ ] Goal allocation and savings projection do not change.
- [ ] "Reset to planned" restores every number to its previous value.
- [ ] On the first day of the next month the source shows the planned amount again with no user action, and the previous month's History entry keeps the actual.
- [ ] The value set on one device appears on the partner's device after sync.
- [ ] An empty or invalid amount cannot be saved. 0 can.
- [ ] All strings use `t(en, he, lang)`. Works in Hebrew RTL and English, light and dark, at 375px and on desktop. Tap targets are ≥ 44px.
- [ ] `npm test` and `npm run build` pass.

### Out of scope
- Setting actuals for **past** months. History → "Recorded income" already covers that.
- Setting actuals for **future** months, or recurring patterns such as "bonus every December".
- A one-off income that is **not** tied to an existing source. The user can add a source, or record it in History.
- Changing the planned amount from a rolling average of actuals ("learn my real salary").
- Gross-to-net calculation for the actual amount. It is net only, by design.

### Open questions for the user
1. **Goals and savings:** keep goal allocation on the **planned** income (recommended, stable plan), or let a bonus month raise this month's goal allocation too?
2. **Entry point:** per source (recommended, because the difference is visible per person), or one "actual this month" figure per member?

### Success metric
- ≥ 30% of active households set at least one actual within 2 months of launch.
- Edits to a source's planned `amount` drop, because people stop editing the baseline for one-off months.
- History income totals line up with real bank deposits, so fewer manual "Recorded income" corrections.
