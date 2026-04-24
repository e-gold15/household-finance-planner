# Savings Allocation Engine

**File:** `src/lib/savingsEngine.ts`

The savings engine takes the household's monthly surplus and a list of goals, then tells the user how much to allocate to each goal and whether they're on track.

---

## API

### `allocateGoals(input: EngineInput): GoalAllocation[]`

```typescript
interface EngineInput {
  goals: Goal[]
  monthlySurplus: number         // income − expenses − contributions
  accounts: SavingsAccount[]
  emergencyBufferMonths: number  // minimum months of expenses to keep liquid
  monthlyExpenses: number
}
```

Returns one `GoalAllocation` per goal, in the same order as the input (user-defined priority).

---

## `GoalAllocation`

```typescript
interface GoalAllocation extends Goal {
  status: GoalStatus
  monthlyRecommended: number    // how much to save per month toward this goal
  monthsNeeded: number          // months to reach target at the recommended rate
  gap: number                   // monthly shortfall (0 if fully funded or realistic)
}

type GoalStatus = 'realistic' | 'tight' | 'unrealistic' | 'blocked'
```

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| `realistic` | Surplus covers this goal comfortably |
| `tight` | Surplus covers this goal but leaves little headroom |
| `unrealistic` | Not enough surplus — this goal has a gap |
| `blocked` | Deadline has already passed, or there is zero surplus |

---

## Allocation Algorithm

Goals are processed **in array order** — the first goal has first priority. Surplus is consumed sequentially.

```
For each goal (in priority order):
  1. Calculate months until deadline (monthsUntil)
  2. Calculate remaining amount needed (target - current)
  3. Calculate required monthly = remaining / months
  4. If deadline already passed → status = 'blocked', skip
  5. If required monthly ≤ remaining surplus → status = 'realistic'/'tight'
     allocate required monthly from surplus
  6. If required monthly > remaining surplus → status = 'unrealistic'
     gap = required - remaining surplus
     allocate what's left (may be 0)
```

---

## Liquid Savings

Goals with `useLiquidSavings = true` can draw from liquid savings accounts:

```typescript
liquidSavings = accounts
  .filter(a => a.liquidity === 'immediate' || a.liquidity === 'short')
  .reduce((sum, a) => sum + a.balance, 0)
```

When `useLiquidSavings` is enabled, the `currentAmount` effectively includes the available liquid savings when computing the gap.

---

## Emergency Buffer

Before allocating to goals, the engine reserves liquid savings for the emergency buffer:

```
emergencyReserve = emergencyBufferMonths × monthlyExpenses
availableLiquid  = liquidSavings − emergencyReserve
```

Liquid savings below the reserve line are not counted toward any goal.

---

## Input Types

```typescript
interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string            // ISO date string
  priority: 'high' | 'medium' | 'low'
  notes: string
  useLiquidSavings: boolean
}

interface SavingsAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  liquidity: 'immediate' | 'short' | 'medium' | 'locked'
  annualReturnPercent: number
  monthlyContribution: number
}
```

---

## Tests

See `src/test/savingsEngine.test.ts` — 22 tests covering:
- Fully funded goal (target already reached)
- Realistic allocation with surplus to spare
- Tight allocation (surplus barely covers goal)
- Unrealistic allocation with gap
- Blocked goal (deadline passed)
- Blocked goal (zero surplus)
- Liquid savings counted toward current amount
- Emergency buffer reduces available liquid savings
- Locked accounts excluded from liquid savings
- Multiple goals with sequential surplus consumption
- Empty goals array
- Zero surplus edge case
