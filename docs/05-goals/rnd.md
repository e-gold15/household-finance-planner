# Goals — Engineering Reference

## Key Files

| File | Responsibility |
|------|---------------|
| `src/components/Goals.tsx` | Goals tab UI — goal cards, Add/Edit dialog, Allocation Plan card, AI Explain card |
| `src/lib/savingsEngine.ts` | `allocateGoals()` and `autoAllocateSavings()` — pure allocation logic; no side effects |
| `src/lib/aiAdvisor.ts` | `explainGoalPlan()` — calls Claude Haiku API; returns plain-language assessment |

---

## `allocateGoals` Algorithm

Full step-by-step description of the engine in `savingsEngine.ts`:

### Step 1 — Compute available liquid savings

```
liquidBalance = sum of account.balance for all accounts where
                account.liquidity === 'immediate' OR account.liquidity === 'short'

liquidAvail = max(0, liquidBalance - (monthlyExpenses * emergencyBufferMonths))
```

The `emergencyBufferMonths` value is stored in `FinanceData` and defaults to 3.

### Step 2 — Process each goal in order

For each goal:

```
needed = goal.targetAmount - goal.currentAmount

if goal.useLiquidSavings:
    liquidHelp = min(liquidAvail, needed)
    liquidAvail -= liquidHelp          // consume liquid so it isn't double-counted
    stillNeeded = needed - liquidHelp
else:
    stillNeeded = needed

monthsLeft = monthsUntil(goal.deadline)   // returns 0 if deadline has passed

if monthsLeft === 0:
    status = 'blocked'
    monthlyRecommended = stillNeeded      // full amount immediately needed
else:
    monthlyRecommended = stillNeeded / monthsLeft
```

### Step 3 — Assign status

```
if monthsLeft === 0 OR remainingSurplus <= 0:
    status = 'blocked'
    monthlyAllocated = 0

else if monthlyRecommended <= remainingSurplus * 0.5 OR monthsLeft >= 24:
    status = 'realistic'
    monthlyAllocated = monthlyRecommended

else if monthlyRecommended <= remainingSurplus:
    status = 'tight'
    monthlyAllocated = monthlyRecommended

else if remainingSurplus > 0:
    status = 'unrealistic'
    monthlyAllocated = remainingSurplus   // partial funding
    // gap = monthlyRecommended - monthlyAllocated

else:
    status = 'blocked'
    monthlyAllocated = 0
```

### Step 4 — Carry forward

```
remainingSurplus -= monthlyAllocated
```

Advance to the next goal with the reduced `remainingSurplus`.

---

## `autoAllocateSavings` Algorithm

`autoAllocateSavings` is the simplified wrapper used by the Goals tab. It groups goals by priority tier and applies pro-rata allocation within each tier.

```
tiers = ['high', 'medium', 'low']

for each tier:
    tierGoals = goals.filter(g => g.priority === tier)
    tierNeeded = sum(g.monthlyRecommended for g in tierGoals)

    if tierNeeded <= remainingFCF:
        // Full funding for this tier
        for each goal in tier:
            monthlyAllocated = monthlyRecommended
            status = 'realistic' or 'tight' (based on share of remainingFCF)
        remainingFCF -= tierNeeded

    else if remainingFCF > 0:
        // Pro-rata funding within tier
        for each goal in tier:
            share = monthlyRecommended / tierNeeded
            monthlyAllocated = share * remainingFCF
            status = 'unrealistic'
        remainingFCF = 0

    else:
        // No FCF left
        for each goal in tier:
            monthlyAllocated = 0
            status = 'blocked'
```

Goal order within the output array is preserved from the input. This means the Goals tab can render results in the same visual order the user set.

---

## AI Explain — `explainGoalPlan()`

### Located in: `src/lib/aiAdvisor.ts`

### Payload type

```typescript
interface GoalPlanPayload {
  goals: GoalAllocation[]   // full allocation results including status and amounts
  freeCashFlow: number      // FCF figure used by the engine
  currency: string          // e.g. 'ILS', 'USD'
  lang: 'en' | 'he'        // app language — AI responds in the same language
}
```

### API call

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: buildPrompt(payload) }],
  }),
})
```

### Prompt structure

The prompt instructs the model to:

1. Assess the overall health of the household's savings plan in plain language.
2. Call out any goals that are at risk (Unrealistic or Blocked) and briefly explain why.
3. Offer exactly two concrete, actionable suggestions to improve the plan.
4. Respond in the same language as `payload.lang` (English or Hebrew).
5. Keep the response under 200 words.

### Error handling

- Network errors and non-2xx HTTP responses are caught and displayed as an inline error message inside the AI Explain card.
- The `explainGoalPlan` function never throws — it returns `{ ok: false, error: string }` on failure.
- The Goals tab continues to function fully whether or not the AI call succeeds.

---

## Stub Filter Bug — Fixed in v2.8

**Symptom:** All goals showed as Blocked even when the household had positive planned income.

**Root cause:** The FCF source selection code used:
```typescript
// WRONG — stubs have totalExpenses > 0 (pre-populated fixed expenses)
snapshots.find(s => s.totalIncome > 0 || s.totalExpenses > 0)
```

Stub snapshots auto-populate fixed recurring expenses (`totalExpenses > 0`) but have `totalIncome = 0`. The old condition selected stubs, which produced a negative FCF (0 - expenses = negative). A negative FCF causes the engine to mark every goal as Blocked.

**Fix:**
```typescript
// CORRECT — only real snapshots have income
snapshots.find(s => s.totalIncome > 0)
```

This ensures only snapshots with real income data are used as the FCF source. If no real snapshot exists, the engine falls back to current planned data.

---

## Test Coverage

| Test file | Tests | What is covered |
|-----------|-------|----------------|
| `src/test/savingsEngine.test.ts` | 22 | `allocateGoals()` — realistic/tight/unrealistic/blocked outcomes; liquid savings offset; emergency buffer calculation; zero FCF; past deadline |
| `src/test/autoAllocateSavings.test.ts` | 19 | Pro-rata within tiers; full tier funding; tier blocking; status transitions; order preservation; negative FCF guard; immutability (no mutation of input array) |

### Running the tests

```bash
npm test                      # Run all 300 tests once
npm run test:watch            # Watch mode during development
npm run test:coverage         # Coverage report
```

All 300 tests must pass before any commit. Run `npm run build` as well — it catches TypeScript errors that `tsc --noEmit` may miss due to Vite-specific config.

---

## Adding a New Goal Field

1. Add the field to the `Goal` interface in `src/types/index.ts`.
2. Add it to the Add/Edit dialog in `src/components/Goals.tsx`.
3. Ensure `addGoal` and `updateGoal` in `FinanceContext` pass the field through.
4. If the field affects allocation (e.g. a new weighting factor), update `savingsEngine.ts` and add test cases in `src/test/savingsEngine.test.ts`.
5. Document the new field in `docs/05-goals/data.md`.
6. Run `npm test` and `npm run build` before committing.
