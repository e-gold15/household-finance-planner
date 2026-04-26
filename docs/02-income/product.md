# Income Tab — Product Specification

## Purpose

The Income tab is where household members record and manage all their income sources. It computes real take-home pay — accounting for Israeli income tax, social insurance, health tax, pension, and education fund — so the household knows exactly how much money actually reaches their bank account each month.

**Core problem it solves:** Pay slips are confusing. Gross salary looks very different from net pay after deductions. The Income tab makes this calculation transparent and accurate, so the household can plan with the number that actually matters: what hits the bank.

---

## User Value

> "Finally understand your actual pay slip."

| Persona | How they benefit |
|---|---|
| **Salaried employee in Israel** | Full IL tax engine computes net automatically — no spreadsheet needed |
| **Freelancer** | Track multiple income sources (clients, business, rental) in one place |
| **Couple** | Each partner has their own panel; household total is always visible |
| **Expat** | Switch to a simplified foreign-country bracket for US, UK, DE, FR, or CA |
| **"Just tell me the number" user** | Manual net override — skip the tax engine, type what lands in the account |

---

## Features

### 1. Multi-Member Support

Each household member has their own income panel. Members are added and managed in the Household Settings tab. The Income tab displays one collapsible section per member.

- Member name shown as the panel header
- All sources for that member are listed inside the panel
- The household total income is shown at the top of the tab

**Acceptance criteria:**
- [ ] Each member shows their own panel, collapsed by default
- [ ] Household total reflects the sum of all members' net income
- [ ] Adding or removing a member updates the tab immediately

---

### 2. Multiple Income Sources per Member

A single person can have many income streams. Each source is tracked independently with its own tax profile.

Supported income types:
- **Salary** — regular employment income
- **Freelance** — self-employed or consulting income
- **Business** — business ownership distributions
- **Rental** — property rental income
- **Investment** — dividends, interest, capital gains
- **Pension** — pension drawdowns
- **Other** — any income not covered above

**Acceptance criteria:**
- [ ] A member can have any number of sources
- [ ] Each source has its own type, gross amount, period, and tax settings
- [ ] Sources are listed with their computed net amount

---

### 3. Gross → Net Computation (Israeli Tax Engine)

For sources marked as "gross salary," the app applies the full Israeli tax calculation chain:

1. Progressive income tax (7 brackets, up to 50%)
2. Tax credit point deduction (reduces tax liability; default 2.25 points)
3. Bituach Leumi (social insurance) — tiered, capped at ₪49,030/month
4. Health Tax (Mas Briut) — tiered, capped at ₪49,030/month
5. Pension employee contribution — deducted from gross (user-configured %)
6. Education fund (Keren Hishtalmut) employee contribution — deducted from gross (user-configured %)

Result: the net monthly take-home amount displayed in the source row.

**Acceptance criteria:**
- [ ] Tax computation matches expected values for standard Israeli payslips
- [ ] Credit points are configurable (default 2.25, common range 1.5–5)
- [ ] Bituach Leumi and Health Tax are each capped correctly at the monthly ceiling
- [ ] Toggling "use contributions" includes or excludes pension/education fund from deductions

---

### 4. Manual Net Override

For users who do not want the tax engine — or whose situation is non-standard — a manual override lets them enter the exact net amount that arrives in their bank account.

- Toggle: "I know my net pay" (switches to manual override mode)
- In override mode, the gross amount and tax fields are hidden
- Pension/education fund contributions can still be optionally deducted from the override amount

**Acceptance criteria:**
- [ ] When manual override is active, the displayed net equals the entered override amount (minus contributions if enabled)
- [ ] Switching back to gross mode restores tax engine computation
- [ ] Override field only accepts positive numbers

---

### 5. Employee Contributions

Pension and education fund contributions reduce take-home pay. These are configured as percentages of gross income.

| Field | Description | Typical range |
|---|---|---|
| Pension (employee) | % of gross deducted for pension | 6–7% |
| Education fund (employee) | % of gross deducted for Keren Hishtalmut | 2.5% |

**Acceptance criteria:**
- [ ] When `useContributions = true`, both percentages are deducted from the computed (or manual) net
- [ ] When `useContributions = false`, contributions appear in the tax breakdown for reference but are not deducted from displayed net

---

### 6. Employer Contributions (Informational)

The employer also contributes to pension and severance funds. These are shown for total compensation visibility but are **not** added to the household income figure — they never reach the employee's bank account.

| Field | Description |
|---|---|
| Pension (employer) | % of gross contributed by employer |
| Education fund (employer) | % of gross contributed by employer |
| Severance (employer) | % of gross set aside by employer |

**Acceptance criteria:**
- [ ] Employer contributions are shown in the tax summary expand/collapse section
- [ ] They do NOT add to the member's net income or the household total
- [ ] They can be set to 0 without affecting any calculation

---

### 7. Add Income to a Past Month

A user can record a one-time income payment that occurred in a past month — a bonus, a freelance project, or a delayed payment — directly from the Income tab.

- Click "Add Income Entry" with the "When?" toggle set to "Past month"
- Select month and year (past months only; up to 3 years back; defaults to previous month)
- Enter member name (autocomplete from household members), amount, and an optional note
- The entry is saved as a `HistoricalIncome` item in the relevant month's snapshot
- Free Cash Flow for that month is recomputed immediately

**Acceptance criteria:**
- [ ] Month/year pickers only allow past months (not current or future)
- [ ] Member name autocomplete shows all current household members
- [ ] The income appears in the History tab under the correct month
- [ ] FCF for the target month is recalculated as: `totalIncome - totalExpenses - totalSavings`
- [ ] If the target month has no snapshot yet, a stub is created and the income is recorded in it

---

## What This Tab Does NOT Do

- Does **not** show investment returns or account interest — those are configured in the Savings tab
- Does **not** handle expense reimbursements — record those as a separate income source of type "Other"
- Does **not** file or estimate taxes in the legal sense — this is a planning tool, not tax software
- Does **not** connect to payroll systems or bank feeds — all data is entered manually
- Does **not** support income projections or forecasts — that is handled by the Overview tab's savings forecast

---

## Acceptance Criteria Summary

| # | Criterion |
|---|---|
| 1 | Net income for each source is computed correctly using the IL tax engine or manual override |
| 2 | Credit points, BL cap, and HT cap are applied correctly |
| 3 | Employee contributions reduce net pay when toggled on |
| 4 | Employer contributions are visible but excluded from household income |
| 5 | Past income entries appear in History tab under the correct month |
| 6 | FCF is recomputed immediately after any income change |
| 7 | All UI works in Hebrew RTL and on mobile (375px) |
| 8 | All strings use `t(en, he, lang)` — no hardcoded English |

---

## Success Metrics

| Metric | Target |
|---|---|
| % of users who configure at least one income source | > 95% |
| Net income accuracy vs real payslip (for IL sources) | < 1% deviation |
| Time to add a new income source | < 60 seconds |
| % of users who use manual override | < 20% (most should trust the engine) |
