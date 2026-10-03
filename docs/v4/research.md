# v4 Product Research — Competitive, Mobile UX & Visual Design

*Researched 2026-10-03. Scope: inputs for the v4 redesign of Household Finance Planner (HFP). Written for the Product role; no code changes.*

---

## 1. Competitive landscape

| App | Core value prop | Signature UX patterns | Praise / complaints |
|---|---|---|---|
| **YNAB** | Zero-based "give every shekel a job" | Category-first budget screen, not an account overview | Praise: discipline. Complaints: steep learning curve, price, flaky bank sync. The June 2026 v26.20 redesign swapped a one-tap Inflow/Outflow toggle for a dropdown and hid "cleared" behind "Show more". The iOS rating fell from about 2.9 to 2.0 ([mwm.ai](https://mwm.ai/articles/ynab-v26-20-adds-ceo-book-ads-sparks-user-outrage-over-ui-changes-in-june-2026), [pocketclear](https://pocketclear.app/blog/ynab-complaints-problems.html)). **Lesson: never add taps to transaction entry.** |
| **Monarch Money** | All-in-one dashboard, best for couples | Customizable widget dashboard (net worth, cash flow, budgets, upcoming bills, goals). **Shared Views** (Oct 2025) label accounts and transactions *mine / theirs / ours*, with an Owners filter that switches between personal, partner and household views. Transactions inherit the account owner's label ([Monarch blog](https://www.monarch.com/blog/shared-views), [help](https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch)) | Praise: clean and dense, free partner seat ([envelopebudgeting](https://envelopebudgeting.com/articles/monarch-money-review)). Gap: there are no separate per-partner budgets. |
| **Copilot Money** | Beautiful, daily-open budgeting | The home screen opens with a **"Free to Spend" number on a pace chart**: a dotted "ideal" line against a solid "actual" line. Below it sit To Review, Budgets, Upcoming recurrings, and Net this month vs last month ([Copilot help](https://intercom.help/copilotmoney/en/articles/6045480-dashboard-tab-overview)). Haptics on every tap and smooth categorize animations ([subscrybe](https://subscrybe.com/copilot-shows-the-importance-of-ux-design-and-gamification/)) | Praise: "the only finance app I open daily". Complaints: Apple-only, no free tier ([Penny Hoarder](https://www.thepennyhoarder.com/budgeting/budgeting-copilot-money-review/)). |
| **Rocket Money** | Find and cancel subscriptions | Dashboard of upcoming payments plus a recurring list | Praise: surfaces forgotten subscriptions. Complaints: dark-pattern cancellation, and paying a subscription to cancel subscriptions ([fincomparelab](https://www.fincomparelab.com/reviews/rocket-money-review/)). |
| **Lunch Money** | Power-user web budgeting | Multi-currency with a home currency and daily FX, custom budget periods (paycheck or quarterly), split transactions, recurring detection ([features](https://lunchmoney.app/features)) | Praise: good fit for **freelancers and expats**, privacy. Complaints: web-first and dense ([College Investor](https://thecollegeinvestor.com/45433/lunch-money-review/)). |
| **Emma** (UK) | Spending overview and subscriptions | Auto-categorized feed, subscription list, Autosave | Complaints: the free tier is limited, and there is no easy month-over-month comparison ([Finder](https://www.finder.com/uk/budgeting/emma-review)). |
| **RiseUp / רייזאפ** | **"המספר האחד"** (the single number): what is left to spend this month after all income and expenses, run through bank open-banking | One number plus a monthly cash-flow view. Started with WhatsApp-based coaching. About ₪45/month ([Jewish Insider](https://jewishinsider.com/2020/05/the-startup-working-to-help-israelis-balance-their-budgets/), [Walla](https://finance.walla.co.il/item/3509449)) | The closest local benchmark. Proves Israelis respond to a single headline number. Note: merchant names stay in Hebrew even in the English UI. |
| **Caspion** | Open-source scraper for Israeli banks and cards | Exports to Sheets, YNAB, CSV, JSON, with rule-based categories ([GitHub](https://github.com/brafdlog/caspion)) | A possible import path (built on `israeli-bank-scrapers`) for v4+ CSV/JSON import. |
| **Pepper (Leumi) / One Zero** | Mobile-native banks | Pepper has a personal AI "Money Feed" with daily, weekly and monthly spend analysis, peer comparison and duplicate-charge alerts ([RBI](https://www.retailbankerinternational.com/news/leumi-rolls-mobile-banking-platform-pepper/)). One Zero has an AI banker, "Ella", that scans daily for duplicate charges and opportunities ([mwm](https://mwm.ai/apps/one-zero/1554109300)) | Sets Israeli expectations: an **insight feed** and **duplicate-charge alerts** are table stakes. |

**Where HFP is ahead:** the Israeli gross-to-net tax engine, the goal allocation engine, a free household with no bank linking, and Claude scan and briefing. **Gaps:** no "single number", no spending pace, no mine/ours attribution, and quick-add is not fast enough.

## 2. Mobile UX best practices (2025–26)

- **Bottom tab bar, 3–5 items.** Both Material 3 and Apple HIG cap phones at 5. Seven top text tabs breaks both guidelines and sits outside the thumb zone ([babich](https://babich.biz/blog/bottom-tab-bar-design/), [9to5google M3 Expressive](https://9to5google.com/2025/05/14/material-3-expressive-navigation/), [uxcel HIG](https://uxcel.com/glossary/tab-bar)). M3 Expressive also moved to a *shorter* nav bar.
- **Central "+" quick-add.** Entry must take at most 3 taps: amount, then category chip, then save. YNAB's backlash shows the cost of getting this wrong.
- **Bottom sheets** for repeat, short tasks (add expense, filters, quick edits), with swipe-down to dismiss. **Centered dialogs** only for destructive or high-stakes confirmations ([dolfy](https://www.dolfy.ai/blog/bottom-sheet-or-modal-mobile-interruption-pattern), [eleken](https://www.eleken.co/blog-posts/bottom-sheet-ui)).
- **Number entry:** use `type="text" inputmode="decimal"`, not `type="number"`, which rounds on scroll and shows spinners. Show the amount large, with a live ₪ preview ([Brad Frost](https://bradfrost.com/?p=2664), [etch](https://etch.co/blog/money-input)).
- **Swipe actions** (edit/delete on list rows) need a one-time "peek" hint and a non-gesture fallback such as a ⋯ menu or long-press ([dolfy](https://www.dolfy.ai/blog/swipe-to-delete-gesture-discoverability-mobile-apps)). In RTL, swipe directions must mirror.
- **Loading:** skip indicators under 1 s. Use skeletons for full-page loads of 2–10 s and spinners for single modules ([NN/g](https://www.nngroup.com/articles/skeleton-screens/)). This replaces the current full-screen spinner during the cloud pull.
- **Pull-to-refresh:** triggers a cloud re-pull (Realtime already exists). Set `overscroll-behavior-y: contain` to stop the browser's own refresh.
- **PWA constraints:** iOS has **no Vibration API** in any browser ([progressier](https://progressier.com/pwa-capabilities/vibration-api)). Haptics on iOS need the Safari 17.4+ `<input switch>` hack, so treat them as progressive enhancement only. Use `viewport-fit=cover` plus `env(safe-area-inset-*)` padding on the bottom nav and the FAB ([progressier safe-area](https://progressier.com/ios-safe-area-simulator)).

## 3. Dashboard and insight patterns that drive engagement

**Helpful (adopt):**
- **One headline number.** Copilot's "Free to Spend" and RiseUp's "המספר האחד" are proven. For HFP this is *income − fixed − budgeted variable spent − planned savings*, shown as "₪X left · Y days left".
- **Spending pace.** Plot the ideal line against actual. Use plain language: "62% spent with 40% of the month left".
- **Upcoming bills** for the next 30 days, including sinking-fund provisions. HFP already has annual bills in the Overview.
- **Net-worth or savings trend** as a sparkline, with a tap to expand.
- **Actionable insight cards**, at most 3, each with one CTA. Examples: "Surplus ₪1,200 → move to Goal", "Dining 22% over last month", "Possible duplicate". The 2026 fintech trend is moving "from data-heavy to decision-friendly", with charts explained in a sentence ([procreator](https://procreator.design/blog/ux-design-for-fintech-ux-design-trends/), [Alien](https://www.thealien.design/insights/fintech-ux-design-trends)).
- **Health score (0–100)** with a "how to improve" next step. The existing AI briefing score can drive it.

**Overwhelming (avoid):** stacking 8+ charts on Home (today's Overview has gauges, donuts, projection and more). Use generic streaks: they burn out ([sahha](https://sahha.ai/blog/gamification-behavioral-nudges-health-apps/)). Use them only for "snapshot logged N months in a row". Avoid red everywhere and pie charts with more than 6 slices. About 30% of wellness-app users abandon an app that is confusing. **Progressive disclosure:** Home answers "am I OK?" and the tabs answer "why?".

## 4. Couples and household specifics

- **Attribution:** Monarch's *mine / theirs / ours* labels with an owner filter are the 2025–26 standard ([Monarch](https://www.monarch.com/blog/shared-views)). Zeta adds tagging a partner on a transaction, split tallies and memos ([College Investor](https://thecollegeinvestor.com/24184/zeta-review/)).
- **Privacy granularity:** Honeydue lets each partner choose to share everything, balances only, or hide an account ([NerdWallet](https://www.nerdwallet.com/finance/learn/honeydue-app-review)). Honeydue also shows that a free app with weak sync loses trust ([fincomparelab](https://www.fincomparelab.com/reviews/honeydue-review/)).
- **Shared alerts:** both partners are notified when a category hits its limit (Honeydue).
- **For HFP:** add an `owner: memberId | 'shared'` field to expenses and accounts, show an avatar chip on each row, and add a "Me / Partner / Household" segmented filter. Note: a new field touches sync, so the Data Safety Protocol applies (additive and backward-compatible).

## 5. RTL and Hebrew design

- **Fonts:** **Heebo + Inter** is the recommended pairing for SaaS and dashboards. Heebo's Latin is Roboto-based, so it sits well next to Inter. Rubik + Source Sans suits playful consumer apps, and Assistant suits formal and government apps ([israeli-ui-design-system](https://claudeskills.info/skills/skills-il/localization/israeli-ui-design-system/), [Heebo](https://github.com/meirsadan/heebo)). **Recommendation:** use Heebo for Hebrew UI text and Inter for all numerals and English. Inter has excellent `tnum`. Use the stack `font-family: Inter, Heebo, sans-serif` with `unicode-range` so Hebrew falls through to Heebo. Set Hebrew body text at 16px or larger with line-height of about 1.6.
- **Numbers:** format with `Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'})`, then **isolate** with `dir="ltr"` / `unicode-bidi: isolate`. Signs and ₪ otherwise flip in bidi text ([hebrew-rtl-best-practices](https://claudeskills.info/skills/skills-il/localization/hebrew-rtl-best-practices/)). Keep the minus sign attached ("‎-₪250").
- **Charts:** use the library's `reversed` option, not a CSS flip. Recommendation: **keep time axes left-to-right** (the common Israeli finance convention, matching bank apps) and mirror only legends, labels and the tooltip side. Mirror directional icons (chevrons, back, progress). Never mirror logos, checkmarks or ▲▼.
- **Dates:** `Intl.DateTimeFormat('he-IL')`, using DD/MM.

## 6. Visual design trends 2025–26

- **Tabular figures everywhere** numbers align: `font-variant-numeric: tabular-nums` on amounts, tables and KPIs. Use proportional figures only in prose.
- **The big number is the hero.** Show the amount at 32–40px semibold with a muted currency symbol and decimals. Drop decimals for ₪ amounts of 1,000 or more.
- **Semantic colour, used sparingly:** teal or green for positive, red only for overspend or negative, amber for warning. Always pair colour with ▲▼ and text (already a project rule). Use a neutral tone for "expense", which is normal rather than bad.
- **Dark mode** with true-neutral surfaces (not pure black) and lighter, desaturated tints for semantic colours.
- **Density:** comfortable on Home, compact (44px rows) in lists. Cards with soft radius (16px) and minimal borders. Charts get one sentence of explanation.

---

## Top 15 recommendations for v4 (ranked by impact ÷ effort)

| # | Recommendation | Impact | Effort | Mobile-critical |
|---|---|---|---|---|
| 1 | **Bottom nav with 5 items: Home · Spending · ➕ Add · Goals · More.** More holds Income, Savings, History, Members and Settings as a sheet. Respect `safe-area-inset-bottom`. Keep the top tabs on desktop of 768px or wider. | Very high | M | **Yes** |
| 2 | **"Left to spend" hero number** on Home (RiseUp/Copilot pattern): "₪3,420 left · 12 days", with tap-through to the breakdown. | Very high | S | **Yes** |
| 3 | **3-tap quick-add bottom sheet** from ➕: big `inputmode="decimal"` amount, then recent/top category chips, then Save. "More details" expands to the full form. Receipt scan is an icon inside the sheet. | Very high | M | **Yes** |
| 4 | **Convert add/edit dialogs to bottom sheets** on mobile (drag handle, swipe-down dismiss). Keep centered dialogs for destructive confirmations. | High | M | **Yes** |
| 5 | **Spending pace bar/chart:** ideal vs actual line, plus a sentence ("62% spent, 40% of month left"). Per category on the Spending tab. | High | S | Yes |
| 6 | **Slim the Home screen to 4 blocks:** hero number, pace, up to 3 insight cards, upcoming bills (30 days). Move gauges, donuts and projection into their tabs. | High | S | **Yes** |
| 7 | **Tabular numerals + Inter for digits, Heebo for Hebrew**, with all amounts bidi-isolated through one `<Money>` component. | High | S | Yes |
| 8 | **Actionable insight cards** (at most 3, each with a CTA), merging SurplusBanner, AI briefing bullets, budget-over alerts and duplicate-expense detection. | High | M | No |
| 9 | **Mine / Partner / Shared attribution:** `owner` on expenses and accounts, an avatar chip per row, and a Me/Partner/Household filter. *Requires a spec and the Data Safety Protocol (additive field).* | High | M–L | No |
| 10 | **Skeleton screens** in place of the full-screen cloud-pull spinner, plus **pull-to-refresh** for a cloud re-pull. | Med | S | **Yes** |
| 11 | **Swipe actions on expense/income rows** (edit, delete with undo toast), RTL-mirrored, with a one-time peek hint and a ⋯ fallback. | Med | M | **Yes** |
| 12 | **Household health score (0–100)** with one "improve by…" next step, driven by the existing briefing score. Streak only for "monthly snapshot logged". | Med | S | No |
| 13 | **Upcoming bills and recurring view** (next 30 days and annual), combining fixed expenses and sinking funds, with a "possible duplicate" flag. | Med | S | No |
| 14 | **Desaturated, semantic colour system:** neutral for expenses, red only for overspend, ▲▼ always paired. Re-tune dark-mode surfaces. | Med | S | No |
| 15 | **Freelancer/expat extras:** a multi-currency home-currency view (Lunch Money pattern) and Caspion/`israeli-bank-scrapers` JSON import. Both are v4.x. | Med | L | No |

**Sequencing:** ship 1–7 as the v4.0 "mobile shell" release, 8–13 as v4.1 "insights & household", and 14–15 as v4.2.
