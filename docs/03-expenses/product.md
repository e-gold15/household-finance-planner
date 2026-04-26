# Expenses Tab — Product Specification

## Purpose

The Expenses tab is where households track all their spending — both regular monthly costs and annual bills. It helps households understand where money goes, set limits on categories, compare spending across months, and catch budget overruns before they cause problems.

**Core problem it solves:** Most households don't know their true monthly spending until the bank statement arrives. By tracking expenses in advance — including annual bills broken down to a monthly provision — the Expenses tab makes the budget visible and manageable before money is spent.

---

## User Value

> "Know exactly where your money goes — and catch budget overruns early."

| Persona | How they benefit |
|---|---|
| **Couple** | Both partners see the same budget limits; no surprise overspending |
| **Freelancer** | Annual expenses (accountant, equipment) spread as monthly provisions |
| **Family** | School fees, insurance, and property tax tracked on one screen |
| **Goal-oriented saver** | Budget limits prevent lifestyle creep; savings category links to accounts |

---

## Features

### 1. Expense List

The central list of all household expenses. Each expense is a named line item with a category, amount, and period.

- Grouped by category with subtotals
- Total monthly spending shown at the top
- Annual expenses normalised to a monthly figure (÷ 12) for easy comparison

**Acceptance criteria:**
- [ ] All expenses are listed, grouped under their category
- [ ] Category subtotals are correct (monthly-normalised)
- [ ] Grand total matches the sum of all category subtotals
- [ ] List updates immediately when an expense is added, edited, or deleted

---

### 2. Category Grouping with Totals

Expenses are grouped under 11 categories: Housing, Food, Transport, Education, Leisure, Health, Utilities, Clothing, Insurance, Savings, Other.

- Each category shows its total monthly spend
- Categories with no expenses are hidden (not shown as empty groups)

**Acceptance criteria:**
- [ ] Categories with no expenses are not shown
- [ ] Expenses appear under exactly one category
- [ ] Subtotals are correct

---

### 3. Fixed vs Variable Classification

Each expense is classified as either **Fixed** or **Variable**. This classification is used in the Overview tab's Budget Health Gauge and in historical analysis.

| Type | Icon | Meaning | Examples |
|---|---|---|---|
| Fixed | Lock badge | Does not change month-to-month | Rent, mortgage, subscriptions |
| Variable | Waves badge | Fluctuates month-to-month | Groceries, fuel, dining out |

The classification is optional — expenses without a type are treated as variable.

**Acceptance criteria:**
- [ ] Each expense row shows a Lock or Waves badge if a type is set
- [ ] The type can be set or changed at any time
- [ ] Fixed expenses are pre-populated in stub snapshot `categoryActuals` (for past month entry)

---

### 4. Annual Expense Sinking Funds

Large annual expenses (insurance, school fees, car registration, property tax) can be recorded with a `dueMonth`. The app then:

- Shows a monthly provision badge: "₪X/mo provision" (amount ÷ 12)
- Shows a countdown badge: "Due in N months"
- Displays the expense in the Overview tab's Upcoming Bills timeline

This is a "sinking fund" concept — setting aside money monthly so a large bill doesn't arrive as a surprise.

**Acceptance criteria:**
- [ ] Yearly expenses with `dueMonth` show the provision/mo badge and countdown
- [ ] Countdown is calculated from today to the next occurrence of `dueMonth`
- [ ] If the due month has already passed this year, the countdown wraps to next year
- [ ] The Overview tab's Upcoming Bills section reflects these expenses

---

### 5. Budget Limits per Category

Each expense category can have a monthly budget limit. Progress bars on the expense list show how much of that limit has been consumed.

| Progress level | Colour | Condition |
|---|---|---|
| On track | Green | Spent < 80% of budget |
| Warning | Amber | Spent 80–100% of budget |
| Over budget | Red | Spent > 100% of budget |

Budget limits are set via a "Set Budget Limits" button that opens a category-by-category editor.

**Acceptance criteria:**
- [ ] Budget editor shows all 11 categories with current limits
- [ ] Progress bar colour changes dynamically as expenses change
- [ ] Categories without a limit show no progress bar
- [ ] Changes to budget limits update the Overview Budget Health Gauge immediately

---

### 6. Month-over-Month Comparison

A "Compare" toggle activates a column showing the change in spending per category versus the previous month's snapshot.

- ▲ red: spending increased vs last month
- ▼ green: spending decreased vs last month
- `=` neutral: no change

Comparison is against the most recent non-stub historical snapshot.

**Acceptance criteria:**
- [ ] Compare toggle is hidden if there are no historical snapshots
- [ ] Delta badges show percentage change (not absolute amount)
- [ ] Zero-change categories show `=` in a neutral style
- [ ] Comparison is against the most recent snapshot with `totalIncome > 0`

---

### 7. Receipt Scan with AI

When the AI feature is enabled (VITE_ANTHROPIC_API_KEY is configured), a camera icon appears in the Add Expense dialog. Tapping it lets users photograph a receipt — the AI reads the receipt and automatically fills in the expense name, amount, and category.

1. User taps camera icon → device camera or file picker opens
2. User takes or selects a photo of a receipt
3. AI analyses the image and returns: name, amount, category
4. Form fields are auto-filled; user reviews and can change any field before saving
5. If the AI cannot read the receipt, a red error banner appears with instructions to fill manually

**Acceptance criteria:**
- [ ] Camera button only appears when `VITE_ANTHROPIC_API_KEY` is set
- [ ] The image is never stored — it is discarded after the API call returns
- [ ] If the category returned by AI is not valid, it defaults to "Other"
- [ ] Error state shows a clear inline message — never a blank form or silent failure
- [ ] Works on mobile (uses `capture="environment"` to open device camera)

---

### 8. Add to Past Month

An expense can be recorded retroactively against a past month — for a bill that arrived late, or an expense the user forgot to log at the time.

- The "When?" toggle in the Add Expense dialog switches between "Current budget" and "Past month"
- In past month mode: select month and year (past only, up to 3 years back)
- The expense is saved as a `HistoricalExpense` in the snapshot for that month
- If no snapshot exists for that month, a stub is created and pre-populated with fixed recurring expenses
- FCF for that month is recomputed immediately

**Acceptance criteria:**
- [ ] Only past months can be selected (not current or future)
- [ ] The expense appears in the History tab under the correct month
- [ ] Fixed recurring expenses are pre-populated in stub snapshots
- [ ] FCF for the target month updates after the entry is saved

---

### 9. Savings Category → Link to Savings Account

When an expense is categorised as "Savings" (e.g. a monthly transfer to an investment account), it can be linked to a specific savings account. This creates an automatic sync: the linked account's `monthlyContribution` field is updated to match the expense amount.

- An account selector dropdown appears in the dialog when category = "Savings"
- If no savings accounts exist yet, a hint is shown: "Add a savings account first"
- The linked account name is shown as a badge on the expense row
- Deleting the expense resets the account's `monthlyContribution` to 0
- Changing the linked account correctly resets the old account and sets the new one

**Acceptance criteria:**
- [ ] Account selector only shows `savings`-type accounts (or all accounts if none are savings-type)
- [ ] Changing the linked account in `updateExpense` resets old account and sets new account — atomically
- [ ] Deleting a savings expense with a link resets `account.monthlyContribution = 0`
- [ ] The account badge on the expense row shows the linked account name

---

## Out of Scope

- **Recurring reminders** — the app does not send push notifications for upcoming bills
- **Bank import** — CSV or open-banking import is not supported (on the roadmap for v3)
- **Split expenses** — an expense cannot be split across multiple categories
- **Receipt storage** — scanned receipt images are never persisted
- **Bill payment tracking** — the app tracks planned expenses, not whether a specific bill was actually paid

---

## Acceptance Criteria Summary

| # | Criterion |
|---|---|
| 1 | All expenses shown, grouped by category with correct subtotals |
| 2 | Annual expenses normalised to monthly (÷ 12) for display and calculation |
| 3 | Fixed/variable badge appears on each expense row |
| 4 | Sinking fund badge shows provision/mo and countdown for yearly expenses |
| 5 | Budget progress bars update in real time |
| 6 | Compare toggle shows MoM delta vs last non-stub snapshot |
| 7 | Receipt scan fills name/amount/category; gracefully handles failure |
| 8 | Past month expenses saved to correct snapshot, FCF recomputed |
| 9 | Savings linkage syncs `monthlyContribution` atomically |
| 10 | All UI works in Hebrew RTL and on mobile |

---

## Success Metrics

| Metric | Target |
|---|---|
| % of users who set at least one budget limit | > 50% within first month |
| % of yearly expenses with a `dueMonth` set | > 70% of yearly expenses |
| Receipt scan success rate | > 85% of clear receipt photos |
| Budget overrun discovery rate | Users notice overruns before month end in > 70% of cases |
