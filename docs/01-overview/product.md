# Overview Tab — Product Specification

## Purpose

The Overview tab is the home screen of the Household Finance Planner. It gives every household member a complete financial health snapshot in a single view — without needing to click into individual tabs.

**Core problem it solves:** Most households have money scattered across income sources, bank accounts, savings plans, and recurring bills. Understanding the full picture requires looking at multiple apps or spreadsheets. The Overview tab pulls everything together so a household can answer — at a glance — "Are we on track this month?"

---

## User Value

| Persona | How they benefit |
|---|---|
| **Couple managing shared finances** | Both partners see the same snapshot; no more "where did all the money go?" conversations |
| **Freelancer with variable income** | Free Cash Flow KPI and MoM trend highlight income swings immediately |
| **Family with big annual bills** | Upcoming Bills timeline warns of car insurance or property tax before it arrives |
| **Goal-oriented saver** | Goal Status section shows at a glance whether savings are realistic or at risk |

---

## Features

### 1. Monthly Income KPI Card

Displays total net household income for the current month — after tax and after employee contributions (pension, education fund). A trend arrow shows whether income is up or down compared with the previous month.

- **Label:** "Monthly Income"
- **Value:** Sum of all members' net monthly income (computed via the Israeli or foreign tax engine)
- **Trend pill:** ▲ green if income increased vs last month; ▼ red if decreased; hidden if no history

**Acceptance criteria:**
- [ ] Value reflects all household members' sources after tax
- [ ] Trend arrow appears only when at least two non-stub historical snapshots exist
- [ ] Value updates within 1 second of editing an income source

---

### 2. Monthly Expenses KPI Card

Displays total planned monthly spending — annual expenses are normalised to a monthly figure (divided by 12).

- **Label:** "Monthly Expenses"
- **Value:** Sum of all expenses (monthly amounts + yearly ÷ 12)
- **Trend pill:** ▲ red if spending increased; ▼ green if spending decreased

**Acceptance criteria:**
- [ ] Yearly expenses are divided by 12 before summing
- [ ] Trend compares to last non-stub snapshot's total expenses
- [ ] Value updates immediately when an expense is added, edited, or deleted

---

### 3. Free Cash Flow KPI Card

Displays the household's monthly surplus or deficit: income minus expenses minus savings contributions.

- **Formula:** `Net Income − Total Expenses − Total Savings Contributions`
- **Surplus label (positive):** "Surplus" in green
- **Deficit label (negative):** "Deficit" in red

**Acceptance criteria:**
- [ ] Correctly reflects all three components (income, expenses, contributions)
- [ ] Positive FCF shows a green "Surplus" badge; negative shows red "Deficit"
- [ ] Updates instantly when any component changes

---

### 4. Total Assets KPI Card

Displays the combined balance of all savings and investment accounts.

- **Value:** Sum of `balance` across all savings accounts
- **No trend arrow** (balances are updated manually, not month-by-month)

**Acceptance criteria:**
- [ ] Reflects the current balance field from all savings accounts
- [ ] Updates when an account balance is edited

---

### 5. Budget Health Gauge

A donut chart that shows how well the household is sticking to category budgets. Each slice represents the share of categories in each health state.

| State | Condition | Colour |
|---|---|---|
| On track | Spent < 80% of budget limit | Green |
| Warning | Spent 80–100% of budget | Amber |
| Over budget | Spent > 100% of budget | Red |
| No budget set | Category has spending but no limit | Grey |

A "worst offender" callout below the chart highlights the single most over-budget category and its percentage.

**Acceptance criteria:**
- [ ] Categories without a budget limit appear in the "No budget" slice (not on-track)
- [ ] Worst offender footer shows the category name and overage percentage
- [ ] Chart updates when budget limits or expenses are changed
- [ ] If no budgets are set, the entire donut is grey with a prompt to set limits

---

### 6. Upcoming Annual Bills

A timeline of yearly expenses whose due month falls within the next 6 months. Helps households plan for predictable large costs (insurance, registration, school fees, etc.).

- Sorted by due date ascending (soonest first)
- Each row shows: month label, expense name, countdown badge, and amount
- Countdown badge thresholds: "In N days" (< 30 days), "In N weeks" (< 8 weeks), "In N months" (≥ 8 weeks)
- If no annual bills are due within 6 months, the section is hidden

**Acceptance criteria:**
- [ ] Only yearly-period expenses with a `dueMonth` field appear
- [ ] If a due month has already passed this year, the next year's date is used
- [ ] Empty state is hidden (section disappears) rather than showing a blank list
- [ ] Amounts display in the household's selected currency

---

### 7. Expense Breakdown Pie Chart

A pie chart showing what percentage of total spending goes to each expense category (housing, food, transport, etc.).

- Labels show category name and percentage
- Categories with zero spending are excluded
- Clicking a slice does nothing (read-only visualisation)

**Acceptance criteria:**
- [ ] Percentages sum to 100%
- [ ] Uses the same monthly-normalised amounts as the Expenses KPI card
- [ ] Hidden if there are no expenses

---

### 8. Savings by Liquidity Bar Chart

A bar chart comparing account balances across the four liquidity tiers: Immediate, Short-term, Medium-term, and Locked.

- Each bar represents total balance in that tier
- Helps households see how much is accessible quickly vs locked in long-term accounts
- Colour-coded by tier (green → teal → amber → red/locked)

**Acceptance criteria:**
- [ ] Only liquidity tiers with at least one account appear
- [ ] Balances are summed per tier across all accounts in that tier
- [ ] Hidden if there are no savings accounts

---

### 9. Goal Status Section

Shows the savings goals for the household and whether each is on track to be funded given the current Free Cash Flow.

- **Donut chart:** shows the proportion of goals by status (Realistic / Tight / Unrealistic / Blocked)
- **Top-3 goals list:** the three most important goals with progress bars and status badges
- Status is determined by the allocation engine (`allocateGoals`), not entered manually

| Status | Meaning |
|---|---|
| Realistic | Goal can be fully funded with available surplus |
| Tight | Goal is partially funded; shortfall is small |
| Unrealistic | Goal cannot be funded given current surplus |
| Blocked | FCF is negative; no surplus to allocate |

**Acceptance criteria:**
- [ ] Status reflects the output of the goal allocation engine in real time
- [ ] Progress bar colour matches status (green / amber / red / grey)
- [ ] Shows up to 3 goals; if more exist, a "View all" link leads to the Goals tab

---

### 10. 12-Month Savings Forecast

An area chart projecting the total balance across all savings accounts over the next 12 months, accounting for monthly contributions and annual return rates (compound interest).

- X-axis: months (current month to month +12)
- Y-axis: total savings balance
- Summary row below: Today's balance / Monthly net addition / Projected balance in 12 months

**Acceptance criteria:**
- [ ] Projection uses compound interest: each month's balance grows by `(balance × annualReturn / 12)`
- [ ] Accounts for monthly contributions from all accounts
- [ ] Chart starts at current total balance (month 0)
- [ ] Summary row matches the chart's start and end values

---

### 11. End-of-Month Surplus Banner

When the previous calendar month had a positive Free Cash Flow, a dismissible banner appears prompting the household to put that surplus to work.

- Shows the surplus amount with a success badge
- Two action buttons: "Add to Goal" and "Add to Savings"
- Session dismiss (X button): hides for the current browser session
- Permanent dismiss ("Don't ask again"): never shows for this month again

**Acceptance criteria:**
- [ ] Appears only when last month's FCF was positive and `totalIncome > 0`
- [ ] Does not appear for stub snapshots (months with no recorded income)
- [ ] Dismiss (X) hides it for the session; permanent dismiss stores a flag so it never returns for that surplus month
- [ ] "Add to Goal" / "Add to Savings" buttons open the respective dialog pre-filled with the surplus amount

---

## Out of Scope

- The Overview tab does **not** allow editing income, expenses, savings accounts, or goals — all data entry happens in their dedicated tabs.
- The Overview tab does **not** show historical trends beyond month-over-month comparison — the History tab handles multi-month charts.
- The Overview tab does **not** show individual transaction-level data.
- The Overview tab does **not** send notifications or reminders — it is a passive display.

---

## Success Metrics

| Metric | Target |
|---|---|
| Time to understand financial health | < 30 seconds from login |
| KPI cards load time | < 200 ms after data is ready |
| Users who set at least one budget | > 60% within first week of use |
| Surplus banner conversion rate | > 40% of surplus events lead to an allocation action |
| Goal status accuracy | 100% match with allocation engine output |
