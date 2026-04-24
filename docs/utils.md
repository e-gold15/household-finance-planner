# Utility Functions

**File:** `src/lib/utils.ts`

Small, pure utility functions shared across the app.

---

## API Reference

### `cn(...inputs: ClassValue[]): string`

Merges Tailwind CSS class names, resolving conflicts with `tailwind-merge` and conditional classes with `clsx`.

```tsx
cn('px-4 py-2', isActive && 'bg-primary text-primary-foreground', 'rounded-md')
```

### `t(en: string, he: string, lang: 'en' | 'he'): string`

Returns the correct string for the current language. Used for every user-facing string in JSX — no hardcoded English strings allowed outside of `t()`.

```tsx
const lang = data.language  // from useFinance()

<p>{t('Monthly Total', 'סה"כ חודשי', lang)}</p>
<Button>{t('Save', 'שמור', lang)}</Button>
```

### `formatCurrency(amount: number, currency: Currency, locale: Locale): string`

Formats a number as a localized currency string using `Intl.NumberFormat`.

```typescript
formatCurrency(5000, 'ILS', 'he-IL')  // → '₪5,000'
formatCurrency(1234.5, 'USD', 'en-US') // → '$1,234.50'
```

### `formatPercent(value: number): string`

Formats a number as a percentage with one decimal place.

```typescript
formatPercent(23.456)  // → '23.5%'
formatPercent(0)       // → '0.0%'
```

### `generateId(): string`

Returns an 8-character alphanumeric random ID. Used for all new entities (expenses, goals, accounts, households, invitations).

```typescript
generateId()  // → 'a3f7k2m9'
```

Uses `Math.random()` — not cryptographically secure. For invite tokens use `generateInviteToken()` from `cloudInvites.ts` instead.

### `monthsUntil(deadline: string): number`

Returns the number of months from now until the given ISO date string. Returns `0` if the date is in the past.

```typescript
monthsUntil('2027-01-01')  // → 20 (approx)
monthsUntil('2020-01-01')  // → 0
```

---

## Tests

See `src/test/utils.test.ts` — 16 tests covering:
- `cn`: conflict resolution, conditional classes, empty input
- `t`: English output, Hebrew output, edge cases
- `formatCurrency`: ILS, USD, with decimals, zero
- `formatPercent`: positive, zero, > 100
- `generateId`: length, alphanumeric characters, uniqueness
- `monthsUntil`: future date, past date, same month
