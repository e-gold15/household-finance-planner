# Household Finance Planner — Documentation Hub

> **Live app:** https://household-finance-planner.com  
> **Version:** 3.1 · Last updated: April 2026  
> **Audience:** This documentation is written for all stakeholders — product managers, designers, engineers, investors, and new team members.

---

## What is this product?

**Household Finance Planner** is a free, private web app that helps Israeli (and multi-country) households understand their real financial picture. It connects gross salary → actual take-home pay → expenses → savings → goals in one place, and lets two partners collaborate on the same household from any device.

**Core promise:** *"Enter your gross salary. Know your real financial picture in five minutes."*

**Live app:** https://household-finance-planner.com  
**GitHub:** https://github.com/e-gold15/household-finance-planner

---

## How to use this documentation

Each tab of the app has its own folder with four documents:

| Document | Audience | What it answers |
|----------|----------|-----------------|
| `product.md` | PMs, stakeholders, investors | What does this feature do? Who is it for? Why does it exist? |
| `ux.md` | Designers, PMs | How does it look and feel? What are the interaction patterns? |
| `data.md` | Engineers, data analysts | What data does it use? What types? What are the rules? |
| `rnd.md` | Engineers | How is it implemented? What are the algorithms? What can go wrong? |

---

## Tab Documentation

| # | Tab | Folder | What it covers |
|---|-----|--------|----------------|
| 1 | **Overview** | [`01-overview/`](01-overview/) | Financial dashboard — KPI cards, budget gauge, upcoming bills, goal donut, savings forecast, MoM trends, surplus action banner |
| 2 | **Income** | [`02-income/`](02-income/) | Multi-member income tracking, gross→net tax engine, add to past month |
| 3 | **Expenses** | [`03-expenses/`](03-expenses/) | Categorised expenses, fixed/variable, annual sinking funds, budget limits, receipt scan AI, add to past month |
| 4 | **Savings** | [`04-savings/`](04-savings/) | Account tracking by type and liquidity, contribution tracking, expense linkage, emergency buffer |
| 5 | **Goals** | [`05-goals/`](05-goals/) | Priority-ordered goals, smart allocation engine, AI plan explanation |
| 6 | **History** | [`06-history/`](06-history/) | Monthly snapshots, FCF trend chart, historical expense/income entry, category actuals |
| 7 | **Auth & Household** | [`07-auth-and-household/`](07-auth-and-household/) | Google Sign-In, email auth, household model, invite links, cross-device sync |

---

## Shared Reference

| Document | What it covers |
|----------|----------------|
| [`_shared/architecture.md`](_shared/architecture.md) | System design, data flow, key decisions, security model |
| [`_shared/design-system.md`](_shared/design-system.md) | Colour tokens, components, spacing, RTL, dark mode, accessibility |
| [`_shared/ai-features.md`](_shared/ai-features.md) | Claude AI integration — receipt scan, goal plan explanation |
| [`_shared/deployment.md`](_shared/deployment.md) | Vercel, environment variables, database setup, Google OAuth |

---

## Product at a Glance

### Features shipped (v3.1)

| Version | Feature |
|---------|---------|
| v2.0 | Google Sign-In, household model, invite links |
| v2.1 | Cloud finance sync, cross-device recovery, Members tab, session expiry |
| v2.2 | Fixed/Variable expense types, category budgets, MoM comparison, annual sinking funds, monthly actuals |
| v2.3 | Historical expense entry on past snapshots |
| v2.4 | Add expenses to past months from Expenses tab, stub snapshots |
| v2.5 | Historical income entry on past snapshots |
| v2.6 | Add income to past months from Income tab |
| v2.7 | Savings expense → account linkage (auto-syncs monthly contributions) |
| v2.8 | AI savings allocation engine, AI goal plan explanation (Claude Haiku) |
| v2.9 | Overview tab: Budget gauge, upcoming bills, goal donut, savings forecast, MoM trend arrows |
| v3.0 | End-of-month surplus action prompt (allocate leftover cash to goal or savings) |
| v3.1 | Receipt scan → auto-populate expense (Claude Vision) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| AI | Claude Haiku (Anthropic) |
| Cloud DB | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Tests | Vitest — **375 tests** |

### User Personas

| Persona | Description |
|---------|-------------|
| **Israeli Dual-Income Couple** | Salaried employees, confused by pay slips, have mortgage + pension + kids |
| **Freelancer / Self-Employed** | Variable income, needs tax estimation and goal tracking |
| **Expat / Multi-Country Household** | One partner earns in ILS, one in USD or EUR |

---

## Quick Start for Engineers

```bash
git clone https://github.com/e-gold15/household-finance-planner
npm install
cp .env.local.example .env.local   # fill in your keys (see _shared/deployment.md)
npm run dev                         # → http://localhost:5173
npm test                            # 375 tests
npm run build                       # TypeScript check + bundle
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Supabase public key |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google Sign-In |
| `VITE_ANTHROPIC_API_KEY` | Optional | AI features (receipt scan + goal explanation) |

---

## Test Coverage

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `utils.test.ts` | 16 | Formatting, translation, ID generation |
| `taxEstimation.test.ts` | 22 | IL tax brackets, BL/HT caps, credit points, foreign |
| `savingsEngine.test.ts` | 22 | Allocation algorithm, status, liquid savings |
| `localAuth.test.ts` | 15 | Sign-up, sign-in, sessions, migration |
| `cloudInvites.test.ts` | 57 | Token security, invite lifecycle, recovery |
| `cloudFinance.test.ts` | 24 | Merge logic, push/pull, conflict resolution |
| `expenseFeatures.test.ts` | 35 | F1–F5: fixed/variable, budgets, deltas, sinking funds, actuals |
| `historicalExpenses.test.ts` | 11 | Add/delete/update items, FCF recompute |
| `addExpenseToMonth.test.ts` | 20 | Stub creation, fixed pre-pop, year boundary |
| `historicalIncome.test.ts` | 13 | Add/delete/update, FCF recompute, clamp |
| `addIncomeToMonth.test.ts` | 26 | Stub creation, FCF computed, immutability |
| `savingsLinkage.test.ts` | 20 | Expense→account sync, ghost IDs, isolation |
| `autoAllocateSavings.test.ts` | 19 | Pro-rata, tier blocking, status transitions |
| `overviewUtils.test.ts` | 31 | Upcoming bills, budget health, projection, MoM |
| `surplusAction.test.ts` | 24 | Snapshot detection, markActioned, top-up, deposit |
| `receiptScan.test.ts` | 20 | JSON parsing, category validation, safe defaults |
| **Total** | **375** | |

---

*Documentation maintained by the development team. Last full update: v3.1, April 2026.*
