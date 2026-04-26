# Savings Tab — Product Specification

## Purpose

The Savings tab is where households track all their savings and investment accounts. It gives a clear picture of how much money is available, how accessible it is, and how much is being contributed each month — the foundation for realistic financial goal-setting.

**Core problem it solves:** Most households have money in several places — a current account, a savings account, a pension fund, maybe stocks. Without a single view, it's hard to know your true net worth, how much is liquid (accessible in an emergency), and whether your monthly savings rate is on track to hit your goals.

---

## User Value

| Persona | How they benefit |
|---|---|
| **Couple** | One shared view of all accounts — no more "I thought we had more saved" |
| **Goal-oriented saver** | Liquidity tiers show whether savings are available for goals or locked up |
| **Employee with pension** | Pension and education fund visible alongside liquid savings |
| **Investor** | Return % feeds the 12-month savings forecast on the Overview tab |

---

## Features

### 1. Account List

A list of all the household's savings and investment accounts. Each account is a card showing its current balance, type, and contribution.

- Total assets shown at the top (sum of all account balances)
- Accounts sorted by liquidity (most liquid first)
- Add, edit, and delete accounts at any time

**Acceptance criteria:**
- [ ] All accounts are shown with correct balance, type, and contribution
- [ ] Total assets at the top matches the sum of all account balances
- [ ] Balance, contribution, and return % can be edited inline

---

### 2. Account Types

Nine account types cover the full range of savings and investment vehicles:

| Type | Examples |
|---|---|
| Checking | Current account, day-to-day banking |
| Savings | High-yield savings account, online savings |
| Deposit | Fixed-term deposit, time deposit |
| Pension | Keren Pensia, 401(k), SIPP |
| Study Fund | Keren Hishtalmut (Israeli education fund) |
| Stocks | Brokerage account, shares portfolio |
| Crypto | Cryptocurrency holdings |
| Real Estate | Property value (as an asset) |
| Other | Any account that doesn't fit above |

The account type is a label — it does not change how the account is calculated. It affects the type badge shown on the card.

**Acceptance criteria:**
- [ ] All 9 types are available in the Add/Edit dialog
- [ ] Type badge is shown on each account card

---

### 3. Liquidity Tiers

Liquidity describes how quickly money can be accessed. This is the most important classification for goal planning.

| Tier | Meaning | Examples |
|---|---|---|
| Immediate | Can be spent today | Checking account, savings account with no lock-up |
| Short-term | Accessible within weeks/months | Notice account, short-term deposit |
| Medium-term | Accessible within 1–2 years | Investment portfolio (without penalties) |
| Locked | Not accessible without penalty | Pension (before retirement age), locked deposit |

**How liquidity affects goals:**
- Only **Immediate** and **Short-term** accounts count as "liquid savings" for goal allocation
- The emergency buffer is subtracted from liquid savings first (e.g. 3 months × monthly expenses)
- Any remaining liquid savings above the buffer can offset goal shortfalls (even when FCF is negative)

**Acceptance criteria:**
- [ ] Each account has a liquidity tier
- [ ] Liquidity badge is colour-coded on the account card
- [ ] The goal allocation engine uses liquid savings correctly (immediate + short, minus emergency buffer)

---

### 4. Monthly Contribution Tracking

Each account can have a monthly contribution amount — how much money is deposited into it each month.

There are two ways this field is set:

1. **Manual entry:** User types the monthly contribution directly in the account dialog
2. **Auto-sync from expense:** If a "Savings" expense is linked to this account, the contribution field is automatically updated to match the expense amount (and becomes read-only in the account dialog)

Monthly contributions are used in:
- Free Cash Flow: `FCF = income - expenses - Σ contributions`
- 12-Month Savings Forecast on the Overview tab

**Acceptance criteria:**
- [ ] Manual contributions can be set and edited freely
- [ ] When a linked savings expense exists, the contribution field is read-only and shows the linked expense name
- [ ] Unlinking the expense (deleting it or changing its category) resets contribution to 0
- [ ] Contribution changes update the Overview FCF and savings forecast immediately

---

### 5. Annual Return %

Each account can have an annual return percentage — the expected rate of growth per year.

- Default: 0% (no growth assumed unless set)
- Used in the 12-Month Savings Forecast to model compound interest
- Does not affect actual account balances — only the forecast

**Acceptance criteria:**
- [ ] Return % can be set to 0 (no growth) or any positive percentage
- [ ] Changing the return % updates the Overview savings forecast immediately
- [ ] Return % is per-account — different accounts can have different rates

---

### 6. Emergency Buffer

The emergency buffer is a household-level setting (configured in Household Settings, displayed in the Savings tab for reference).

It defines how many months of expenses should be kept as liquid savings before any surplus is allocated to goals.

- Example: 3 months × ₪8,000/month expenses = ₪24,000 emergency buffer
- If liquid savings < ₪24,000, the goal allocation engine treats zero liquid savings as available

**Acceptance criteria:**
- [ ] Emergency buffer is shown on the Savings tab (read-only reference; configured in Settings)
- [ ] Buffer is factored into `liquidBalance` used by `allocateGoals`
- [ ] Buffer does not affect actual account balances — only the goal allocation calculation

---

## Out of Scope

- **Real-time market data:** Return % is entered manually — no live stock prices or fund NAVs
- **Transaction history per account:** The Savings tab shows balances, not individual transactions
- **Bank feed integration:** No open banking or CSV import at this stage (roadmap v3)
- **Multi-currency per account:** All accounts are in the household's selected currency
- **Account sharing across households:** Each account belongs to one household

---

## Acceptance Criteria Summary

| # | Criterion |
|---|---|
| 1 | All accounts listed with balance, type badge, liquidity badge, return %, contribution |
| 2 | Total assets = sum of all balances |
| 3 | Liquidity tier drives goal allocation engine behaviour |
| 4 | Monthly contribution auto-synced from linked savings expense |
| 5 | Return % drives Overview savings forecast |
| 6 | Emergency buffer shown for reference; drives goal allocation |
| 7 | All UI works in Hebrew RTL and on mobile |
| 8 | Empty state prompts to add first account |

---

## Success Metrics

| Metric | Target |
|---|---|
| % of users with at least one account entered | > 80% within first week |
| % of savings-category expenses linked to an account | > 60% |
| % of users who set a return % > 0% on at least one account | > 50% |
| Savings forecast vs actual balance deviation (12 months) | Within 5% for standard accounts |
