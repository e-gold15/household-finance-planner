# Tax Engine

**File:** `src/lib/taxEstimation.ts`

The tax engine computes the monthly net income for a single income source. It supports Israeli tax law in full and simplified bracket estimates for US, UK, DE, FR, and CA.

---

## Main API

### `estimateTax(source: IncomeSource): TaxBreakdown`

Computes the complete tax and deductions breakdown.

**Three calculation paths:**

| Condition | Result |
|-----------|--------|
| `useManualNet = true` | Returns `manualNetOverride` as net; all deductions = 0 |
| `isGross = false` | Input amount treated as already-net; no deductions |
| `isGross = true` | Full calculation — brackets, Bituach Leumi, health tax, contributions |

### `getNetMonthly(source: IncomeSource): number`

Convenience wrapper — returns `estimateTax(source).netMonthly`.

---

## `TaxBreakdown` Shape

```typescript
interface TaxBreakdown {
  // Input
  grossMonthly: number

  // Employee deductions
  incomeTax: number
  bituachLeumi: number
  healthTax: number
  pensionEmployee: number
  educationFundEmployee: number
  totalEmployeeContrib: number
  totalDeductions: number

  // Result
  netMonthly: number
  effectiveRate: number       // totalDeductions / gross × 100

  // Metadata
  isManual: boolean
  hasContributions: boolean

  // Employer (informational only — not deducted from net)
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
  totalEmployerContrib: number
}
```

---

## Israeli Tax Calculation Chain

Monthly calculation for `country = 'IL'` with `isGross = true`:

1. **Progressive income tax** — 7 brackets (up to 47%), applied monthly
2. **Tax credit points** — `taxCreditPoints × ₪242/month` deducted from income tax (min 0)
3. **Bituach Leumi** — tiered rates on `insuredSalary`, capped at ₪49,030/month
4. **Health Tax** — tiered rates on `insuredSalary`, capped at ₪49,030/month
5. **Employee pension** — `pensionEmployee%` of gross
6. **Education fund** — `educationFundEmployee%` of gross
7. **Net** = gross − incomeTax − bituachLeumi − healthTax − pension − educationFund

Where `insuredSalary = gross × (insuredSalaryRatio / 100)`.

---

## `IncomeSource` — Tax-relevant fields

```typescript
interface IncomeSource {
  country: Country              // 'IL' | 'US' | 'UK' | 'DE' | 'FR' | 'CA'
  isGross: boolean
  useManualNet: boolean
  manualNetOverride?: number

  // Israeli tax
  taxCreditPoints: number       // default 2.25
  insuredSalaryRatio: number    // 0–100%, default 100

  // Employee contributions
  useContributions: boolean
  pensionEmployee: number       // % of gross
  educationFundEmployee: number // % of gross

  // Employer contributions (informational — shown on UI, not deducted)
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
}
```

---

## Foreign Countries

US, UK, DE, FR, CA use simplified **annual bracket estimates** converted to monthly. These are approximations — the IL engine is the only fully accurate one.

| Country | Method |
|---------|--------|
| `IL` | Full monthly calculation (7 brackets + BL + HT + contributions) |
| `US` | Annual federal brackets / 12 |
| `UK` | Annual PAYE brackets / 12 |
| `DE` | Annual Einkommensteuer brackets / 12 |
| `FR` | Annual IR brackets / 12 |
| `CA` | Annual federal brackets / 12 |

---

## Legacy Compatibility

Old data may include deprecated field names. The engine handles them transparently:

| Old field | New field | Conversion |
|-----------|-----------|------------|
| `insuredRatio` (0–1) | `insuredSalaryRatio` (0–100) | × 100 |
| `pensionEmployeePercent` | `pensionEmployee` | direct alias |
| `period: 'yearly'` | — | amount ÷ 12 before calculation |

---

## Tests

See `src/test/taxEstimation.test.ts` — 22 tests covering:
- Manual override path
- Net-as-is path
- IL brackets at various income levels
- Credit points deduction (including hitting zero)
- Bituach Leumi cap (₪49,030)
- Health Tax cap
- `insuredSalaryRatio` scaling
- Pension + education fund contributions
- Employer cost breakdown
- Foreign country estimates
- `getNetMonthly` convenience wrapper
