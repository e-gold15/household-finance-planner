# Testing

**Framework:** Vitest + @testing-library/react + jsdom

---

## Commands

```bash
npm test                  # run all tests once
npm run test:watch        # re-run on file save (dev mode)
npm run test:coverage     # run with V8 coverage report
```

---

## Test Files

| File | Tests | What's covered |
|------|-------|---------------|
| `utils.test.ts` | 16 | `cn`, `t`, `formatCurrency`, `formatPercent`, `generateId`, `monthsUntil` |
| `taxEstimation.test.ts` | 22 | Manual override, net-as-is, IL brackets, credit points, BL cap, health tax, `insuredSalaryRatio`, contributions, employer costs, foreign countries, `getNetMonthly` |
| `savingsEngine.test.ts` | 22 | Realistic/tight/unrealistic/blocked, liquid savings, emergency buffer, locked accounts, multi-goal, empty goals, zero surplus |
| `localAuth.test.ts` | 15 | signUp (success, duplicate, case-insensitive, hashing), signIn (success, wrong password, unknown), sessions, getUserById/getHouseholdById, invitations CRUD, acceptInvitation, migration |
| `cloudInvites.test.ts` | 20 | Token generation (64-char hex, getRandomValues not Math.random), hashing (deterministic, SHA-256, not in output), expired/revoked/used invite rejection, new-user flow, clipboard, owner-only guard |
| **Total** | **95** | |

---

## Test Setup (`src/test/setup.ts`)

Before each test:
- `localStorage` is cleared (in-memory mock, reset in `beforeEach`)

Global mocks:

### `crypto.getRandomValues`
```typescript
// Deterministic fill: arr[i] = (i * 7 + 13) % 256
// Verifiable with vi.spyOn — tests can confirm it was called
```

### `crypto.subtle.digest`
```typescript
// Deterministic fake SHA-256: XOR each byte with its index
// Same input → same output (deterministic, not crypto-secure)
// Used for: password hashing, token hashing
```

### `crypto.randomUUID`
```typescript
// Returns 'test-uuid-{n}' with incrementing counter
```

---

## Writing a New Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { myFunction } from '@/lib/myModule'

describe('myFunction()', () => {
  it('does X when Y', () => {
    // Arrange
    const input = { ... }
    // Act
    const result = myFunction(input)
    // Assert
    expect(result).toBe(expected)
  })
})
```

localStorage is automatically cleared before each test. No manual cleanup needed.

---

## Test Rules

- All 95 tests must pass before any commit (`npm test`)
- New business logic in `src/lib/` requires tests before merging
- Test file mirrors the lib file: `src/lib/foo.ts` → `src/test/foo.test.ts`
- Tests must be deterministic — mock `Date.now()` and `Math.random()` if used
- Use `vi.spyOn()` to verify which crypto functions are called
- Edge cases to cover for every new feature:
  1. Happy path
  2. Empty / zero input
  3. Boundary values (caps, limits, min/max)
  4. Error states (wrong input, expired token, missing field)
  5. Legacy data compatibility

---

## Testing Async Functions

```typescript
it('async function returns correct result', async () => {
  const result = await signUpEmail('test@test.com', 'pass', 'Test')
  expect('error' in result).toBe(false)
  if ('error' in result) return  // narrow type for TypeScript
  expect(result.user.email).toBe('test@test.com')
})
```

---

## Spying on Crypto

```typescript
import { vi } from 'vitest'

it('uses getRandomValues not Math.random', () => {
  const spy = vi.spyOn(crypto, 'getRandomValues')
  generateInviteToken()
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

it('never calls Math.random', () => {
  const spy = vi.spyOn(Math, 'random')
  generateInviteToken()
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
```
