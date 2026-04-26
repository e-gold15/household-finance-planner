# Goals — Data Model & API

## TypeScript Types

### `GoalPriority`

```typescript
type GoalPriority = 'high' | 'medium' | 'low'
```

Controls the order in which the allocation engine funds goals. High-priority goals are funded first; low-priority goals receive only what remains after higher tiers are satisfied.

---

### `GoalStatus`

```typescript
type GoalStatus = 'realistic' | 'tight' | 'unrealistic' | 'blocked'
```

Computed by the allocation engine for each goal. Never set manually.

| Value | Meaning |
|-------|---------|
| `'realistic'` | Goal can be fully funded; monthly requirement ≤ 50% of remaining surplus at time of evaluation, OR there are 24 or more months until the deadline |
| `'tight'` | Goal can be fully funded but uses the majority of remaining surplus |
| `'unrealistic'` | Goal cannot be fully funded; receives partial allocation |
| `'blocked'` | No surplus remains to allocate, or the deadline has passed |

---

### `Goal`

The core data model for a financial goal, persisted in `FinanceData.goals[]`.

```typescript
interface Goal {
  id: string                  // crypto.randomUUID() — unique identifier
  name: string                // User-facing label, e.g. "Emergency Fund"
  targetAmount: number        // Total amount to reach (e.g. 50000)
  currentAmount: number       // Amount already saved toward this goal
  deadline: string            // ISO 8601 date string, e.g. "2026-12-31"
  priority: GoalPriority      // 'high' | 'medium' | 'low'
  notes?: string              // Optional free-text notes
  useLiquidSavings?: boolean  // If true, liquid savings offset the monthly requirement
}
```

Goals are stored as an ordered array. The array order determines processing order in the allocation engine — first element is funded first within its priority tier.

---

### `GoalAllocation`

The output type of the allocation engine. Extends `Goal` with computed fields.

```typescript
interface GoalAllocation extends Goal {
  status: GoalStatus          // Computed status
  monthlyRecommended: number  // Amount needed per month to hit target by deadline
  monthsNeeded: number        // Months remaining until deadline
  gap: number                 // Shortfall = monthlyRecommended - monthlyAllocated (0 if fully funded)
  monthlyAllocated?: number   // Actual amount the engine assigned (may be less than recommended)
}
```

`GoalAllocation` objects are ephemeral — they are computed on demand and never persisted. Only the base `Goal` fields are saved.

---

## Engine Functions

### `allocateGoals(input: EngineInput): GoalAllocation[]`

Located in `src/lib/savingsEngine.ts`.

Processes goals in the order they appear in the input array. For each goal:

1. Computes liquid savings available above the emergency buffer.
2. If `useLiquidSavings` is true, subtracts available liquid savings from the remaining balance.
3. Calculates `monthlyRecommended = stillNeeded / monthsUntil(deadline)`.
4. Determines status based on `monthlyRecommended` relative to the current `remainingSurplus`.
5. Subtracts the allocated amount from `remainingSurplus` before processing the next goal.

**Input type:**

```typescript
interface EngineInput {
  goals: Goal[]
  freeCashFlow: number
  accounts: SavingsAccount[]
  emergencyBufferMonths: number
}
```

**Returns:** `GoalAllocation[]` — one entry per goal, in the same order as the input.

---

### `autoAllocateSavings(goals: Goal[], freeCashFlow: number): GoalAllocation[]`

The simplified entry point used by `FinanceContext` and the Goals tab UI.

**Algorithm:**

1. Group goals into priority tiers: `high`, `medium`, `low`.
2. For each tier (in order):
   a. Compute each goal's `monthlyRecommended`.
   b. If the total recommended for the tier fits within remaining FCF, fund all goals at full recommended amount and mark each as `'realistic'` or `'tight'`.
   c. If not, pro-rate the available FCF across goals in the tier proportionally to `monthlyRecommended`. Mark under-funded goals as `'unrealistic'`.
3. If no FCF remains when a tier is reached, mark all goals in that tier (and below) as `'blocked'`.
4. Updates `monthlyAllocated` and `status` on each `GoalAllocation`.

**Returns:** `GoalAllocation[]` — one entry per goal, preserving original order.

---

## FinanceContext Methods

All goal mutations are performed through `FinanceContext`. Components must never write to `localStorage` or modify goals directly.

| Method | Signature | Description |
|--------|-----------|-------------|
| `addGoal` | `(goal: Omit<Goal, 'id'>) => void` | Creates a new goal with a generated ID and appends it to `goals[]` |
| `updateGoal` | `(id: string, updates: Partial<Goal>) => void` | Merges `updates` into the goal with the matching ID; also used by the Surplus Banner to increment `currentAmount` |
| `deleteGoal` | `(id: string) => void` | Removes the goal; does not affect savings accounts or snapshots |
| `moveGoal` | `(id: string, direction: 'up' \| 'down') => void` | Swaps the goal with its neighbour in the array; triggers re-render of all goal cards |

All methods call `setData()` which immediately writes to `localStorage` and triggers a debounced cloud sync after 1500ms.

---

## FCF Source for the Engine

The allocation engine needs a reliable FCF figure. The source is determined as follows:

1. **Preferred source:** The most recent `MonthSnapshot` where `totalIncome > 0` (i.e. a real snapshot, not a stub). The FCF from that snapshot is used.
2. **Fallback:** If no qualifying snapshot exists, the engine uses the current planned data: `plannedIncome - totalExpenses - totalSavings` from `FinanceData`.

**Why `totalIncome > 0`?** Stub snapshots are auto-created when retroactive data is added to a month with no real snapshot. Stubs pre-populate fixed expenses but have `totalIncome = 0`, which produces a negative FCF. Using stub FCF would cause every goal to appear as Blocked. The `totalIncome > 0` filter excludes stubs. (This bug was present in v2.7 and fixed in v2.8.)

---

## Surplus Banner Integration

When a month-end snapshot shows a positive FCF (free cash flow surplus), a Surplus Banner appears on the Overview tab. The banner prompts the user to direct the surplus toward one or more goals.

When the user confirms a surplus action:

- `updateGoal(goalId, { currentAmount: goal.currentAmount + appliedAmount })` is called.
- The snapshot is marked with `surplusActioned: true` so the banner does not reappear.
- The Goals tab progress bars update immediately to reflect the new `currentAmount`.

---

## Persistence

Goals are stored as part of `FinanceData` in `localStorage` under the key `hf-data-{householdId}`:

```json
{
  "goals": [
    {
      "id": "a1b2c3d4-...",
      "name": "Emergency Fund",
      "targetAmount": 30000,
      "currentAmount": 8500,
      "deadline": "2026-06-30",
      "priority": "high",
      "notes": "6 months of living expenses",
      "useLiquidSavings": false
    }
  ]
}
```

Goals are included in the `household_finance` cloud sync payload and overwritten on the cloud by the local device's data on every push (cloud wins on pull; local wins on push conflict resolution via `updated_at` timestamp).
