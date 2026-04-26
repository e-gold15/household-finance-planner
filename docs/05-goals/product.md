# Goals — Product Overview

## Purpose

The Goals tab helps households define financial targets, understand whether those targets are achievable with their current cash flow, and receive a smart, prioritised plan for how to get there.

Whether you are saving for a summer holiday, building a six-month emergency fund, or working toward a house deposit, the Goals tab answers two critical questions:

1. **Is this realistic given what we earn and spend today?**
2. **If it is not, what should we do about it?**

---

## User Value

> "Know if your dream holiday, emergency fund, or house deposit is realistic — and what to do if it isn't."

Most budgeting tools stop at tracking. This feature goes further: it takes your actual free cash flow, runs an allocation engine across all your goals in priority order, and tells you whether each goal is on track, stretched, or simply not fundable without changes.

---

## Features

### 1. Goal List

Each goal you define captures:

| Field | Description |
|-------|-------------|
| **Name** | A friendly label, e.g. "Japan trip 2026" |
| **Target amount** | The total amount you want to reach |
| **Current progress** | How much is already saved toward this goal |
| **Deadline** | The date by which you want to hit the target |
| **Priority** | High / Medium / Low — controls allocation order |
| **Notes** | Optional free-text for reminders or context |
| **Use liquid savings** | Toggle — lets this goal draw on immediately available savings to reduce the monthly requirement |

Goals are listed in priority order. You can reorder them at any time using the up/down buttons.

---

### 2. Progress Bar per Goal

Each goal card shows a visual progress bar indicating how much of the target amount has been saved so far. The fill colour reflects the goal's current status (green for realistic, amber for tight, red for unrealistic, muted for blocked).

This gives an at-a-glance read of overall progress without needing to do arithmetic.

---

### 3. Smart Allocation Plan

The allocation engine is the centrepiece of the Goals tab. It runs automatically using your current free cash flow (FCF) — the money left over after income, expenses, and planned savings — and determines how much of that surplus should go to each goal each month.

The engine processes goals in priority order:

- High-priority goals are funded first.
- Once high-priority goals absorb their share, medium-priority goals are considered.
- Low-priority goals receive whatever remains.

Within each priority tier, if there is not enough FCF to fully fund all goals at that tier, the available amount is split proportionally based on how much each goal needs per month.

---

### 4. Goal Status

Each goal is assigned one of four statuses after the engine runs:

#### Realistic
The goal can be fully funded with the current FCF, and there is comfortable room to spare. This means the monthly amount required is less than or equal to half of the remaining surplus at the time the goal is evaluated. Think of this as "we can comfortably afford this."

#### Tight
The goal can be fully funded, but doing so will consume most of the available surplus for that priority tier. The goal is achievable, but there is little margin for error. Think of this as "we can afford this, but it will be close."

#### Unrealistic
The goal cannot be fully funded with the current FCF. The engine will allocate as much as it can (partial funding), but at the current rate you will not reach the target by the deadline. Think of this as "we need to adjust: either reduce the goal, extend the deadline, or find more income."

#### Blocked
No FCF remains to allocate to this goal — either because higher-priority goals have consumed all available surplus, or because the deadline has already passed. The goal receives zero monthly allocation. Think of this as "this goal is not actionable right now."

---

### 5. Liquid Savings Offset

If you have money sitting in liquid savings accounts (accounts tagged as immediately accessible or short-term liquidity), those funds can be used to offset a goal's remaining balance.

When the "Use liquid savings" toggle is on for a goal, the engine calculates how much liquid savings are available above your emergency buffer and applies that amount to reduce the gap before computing the monthly requirement. This can move a goal from Unrealistic to Realistic without any change in monthly spending.

---

### 6. Goal Reordering

Goals are processed in the order they appear in the list. You can move any goal up or down using the arrow buttons on each card. Changing the order immediately affects which goals are funded first and can change statuses for goals further down the list.

---

### 7. Allocation Plan Card

A dedicated card at the bottom of the Goals tab shows a summary table of the full allocation plan:

| Column | Description |
|--------|-------------|
| **Goal** | Goal name |
| **Priority** | High / Medium / Low badge |
| **Needed/mo** | Monthly amount required to hit the target by the deadline |
| **Allocated** | Monthly amount the engine has assigned to this goal |
| **Status** | Realistic / Tight / Unrealistic / Blocked badge |
| **Progress** | Mini progress bar |

This table lets you see the full picture at once — where your surplus is going and which goals are competing for the same pool of money.

---

### 8. Recalculate Button

The Recalculate button reruns the allocation engine using the most recent FCF figure. Use this after changing goal priorities, adding a new goal, or after updating your income or expenses. The table updates live with no page reload.

---

### 9. AI Explain Button

The AI Explain button sends your allocation plan to an AI assistant (Claude Haiku) and receives a plain-language assessment in under 200 words. The assessment covers:

- Overall health of the plan
- Which goals are at risk and why
- Two concrete, actionable suggestions for improving the plan

The response appears in a collapsible card below the Allocation Plan table. If the app language is set to Hebrew, the explanation is returned in Hebrew.

This feature requires an Anthropic API key configured in the deployment environment. If no key is present, the button is hidden and the app works fully without it.

---

## Out of Scope

The Goals feature does not:

- Automatically transfer money to bank accounts or savings products
- Make investment recommendations (e.g. which fund to buy)
- Connect to any external financial institution
- Guarantee that allocations will be followed — it is a planning tool, not an enforcement mechanism

---

## Glossary

| Term | Meaning |
|------|---------|
| **FCF** | Free Cash Flow — income minus expenses minus planned savings |
| **Liquid savings** | Money in accounts that can be accessed immediately or within a short period |
| **Emergency buffer** | A reserved portion of liquid savings that is never allocated to goals |
| **Allocation engine** | The algorithm that assigns monthly amounts to each goal based on FCF and priority |
| **Stub snapshot** | An auto-created historical month record with no real income data — excluded from FCF calculations |
