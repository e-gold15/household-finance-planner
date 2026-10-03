export type Country = 'IL' | 'US' | 'UK' | 'DE' | 'FR' | 'CA'

/**
 * Structured breakdown of an Israeli salary payslip (חשבון שכר).
 * Used when IncomeSource.payslipMode === 'advanced'.
 */
export interface PayslipComponents {
  /** שכר יסוד — fixed guaranteed base salary */
  base: number
  /** גלובאלי 125% — overtime at 125% rate */
  overtime125: number
  /** גלובאלי 150% — overtime at 150% rate */
  overtime150: number
  /** תוספות חייבות — other taxable additions */
  otherTaxable: number
  /** שווי מס — imputed income / taxable benefits (car, phone, meals) */
  imputedIncome: number
  /** החזרים — non-taxable reimbursements (travel, meals). Added to net after tax. */
  nonTaxableReimbursements: number
}
export type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD'
export type Locale = 'he-IL' | 'en-US' | 'en-GB' | 'de-DE' | 'fr-FR' | 'en-CA'
export type IncomeSourceType = 'salary' | 'freelance' | 'business' | 'rental' | 'investment' | 'pension' | 'other'

export interface IncomeSource {
  id: string
  name: string
  amount: number            // always monthly
  period: 'monthly' | 'yearly'  // legacy — new sources are always 'monthly'
  type: IncomeSourceType
  isGross: boolean
  useManualNet: boolean
  manualNetOverride?: number
  country: Country
  // IL income tax
  taxCreditPoints: number     // default 2.25
  insuredSalaryRatio: number  // percentage 0–100, default 100
  // Employee contributions (deducted from net)
  useContributions: boolean
  pensionEmployee: number     // % of gross
  educationFundEmployee: number
  // Employer contributions (informational only)
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
  // ── v3.2: Israeli payslip breakdown (IL salary only) ──────────────────────
  /** 'simple' = single amount field (default). 'advanced' = structured payslip breakdown. */
  payslipMode?: 'simple' | 'advanced'
  /** Payslip component breakdown. Only meaningful when payslipMode === 'advanced'. */
  payslipComponents?: PayslipComponents
  /**
   * Explicit pension contribution base (שכר מבוטח לפנסיה).
   * When set, pension employee/employer deductions use this instead of gross.
   * Absent = use gross (existing behaviour).
   */
  pensionBase?: number
  /**
   * Explicit study fund contribution base (בסיס חישוב קרן השתלמות).
   * When set, study fund employee/employer deductions use this instead of gross.
   * Absent = use gross (existing behaviour).
   */
  studyFundBase?: number
  /**
   * ISO 4217 currency code for this income source.
   * When absent or equal to FinanceData.currency, no conversion is needed.
   * When present and different, the amount is converted to the household
   * currency using the daily exchange rate before being included in totals.
   * amount is always stored in sourceCurrency — never converted at write time.
   */
  sourceCurrency?: Currency
  /**
   * Whether this income source is predictable (salary, rent) or irregular
   * (freelance, bonus, commission). Defaults to 'fixed' when absent —
   * backward-compatible with existing data.
   */
  incomeType?: 'fixed' | 'variable'
}

export interface HouseholdMember {
  id: string
  name: string
  sources: IncomeSource[]
}

export type ExpenseCategory =
  | 'housing'
  | 'food'
  | 'transport'
  | 'education'
  | 'leisure'
  | 'health'
  | 'utilities'
  | 'clothing'
  | 'insurance'
  | 'savings'
  | 'work'
  | 'other'

export interface Expense {
  id: string
  name: string
  amount: number
  category: ExpenseCategory
  recurring: boolean
  period: 'monthly' | 'yearly'
  /**
   * 'fixed'    = same amount every month (rent, mortgage, subscriptions, insurance).
   * 'variable' = amount changes month to month (food, entertainment, utilities).
   * Optional for backward compat — treat undefined as 'fixed'.
   */
  expenseType?: 'fixed' | 'variable'
  /**
   * For yearly expenses: which calendar month the bill is due (1 = Jan … 12 = Dec).
   * Used to show due-date countdown and annual smoothing display.
   */
  dueMonth?: number
  /**
   * ID of the SavingsAccount this expense contributes to.
   * Only meaningful when category === 'savings'.
   * When set, addExpense/updateExpense/deleteExpense will mirror the monthly
   * contribution amount onto the linked account's monthlyContribution field.
   */
  linkedAccountId?: string
  /**
   * ISO timestamp of when this expense was first created.
   * Set once by addExpense and never overwritten by updateExpense.
   * Optional for backward compat — old expenses without it show nothing.
   */
  createdAt?: string
}

export type AccountType =
  | 'checking'
  | 'savings'
  | 'deposit'
  | 'pension'
  | 'study_fund'
  | 'stocks'
  | 'crypto'
  | 'real_estate'
  | 'other'

export type Liquidity = 'immediate' | 'short' | 'medium' | 'locked'

export interface SavingsAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  liquidity: Liquidity
  annualReturnPercent: number
  monthlyContribution: number
  /**
   * When true, this account's contributions are already deducted from gross salary
   * before the net income figure the user enters (e.g. קרן השתלמות / study fund).
   * Such accounts must NOT be subtracted again from FCF — doing so would double-count.
   * Optional for backward compatibility — treat absence as false.
   */
  deductedFromSalary?: boolean
  /**
   * The "YYYY-MM" month in which the balance was last auto-incremented by
   * applyMonthlyContributions(). Used to prevent double-counting across sessions.
   * Absent on first run — treated as "no prior increment" (elapsed = 0).
   */
  lastAutoIncrementMonth?: string
  /**
   * Chronological log of every auto-increment applied to this account.
   * Capped at the 24 most-recent entries (oldest are dropped).
   */
  autoIncrementLog?: Array<{ month: string; amount: number }>
}

export type GoalPriority = 'high' | 'medium' | 'low'
export type GoalStatus = 'realistic' | 'tight' | 'unrealistic' | 'blocked'

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  /** Amount already spent/withdrawn from this goal. Optional for backward compat — treat absence as 0. */
  usedAmount?: number
  deadline: string
  priority: GoalPriority
  notes: string
  useLiquidSavings: boolean
  /** v4.1 — ISO date the user marked this goal done. Absent = active. Optional for backward compat. */
  completedAt?: string
}

export interface GoalAllocation extends Goal {
  status: GoalStatus
  monthlyRecommended: number
  monthsNeeded: number
  gap: number
  monthlyAllocated?: number
}

export interface HistoricalExpense {
  id: string               // generateId() — unique within the snapshot
  name: string             // "Dentist", "Car service", "Birthday gift"
  amount: number           // always a positive monetary amount for that month
  category: ExpenseCategory
  note?: string            // optional free-text annotation
}

export interface HistoricalIncome {
  id: string
  memberName: string   // who received this income (net amount — no tax calc needed)
  amount: number       // net amount received that month (always positive)
  note?: string        // optional: "Monthly salary", "Bonus", "Freelance project"
}

export type BriefingBulletType = 'positive' | 'warning' | 'urgent' | 'neutral'

export interface BriefingBullet {
  type: BriefingBulletType
  text: string
}

export interface BriefingResult {
  headline: string           // short summary title, max ~60 chars
  score: number              // 0–100 financial health score
  bullets: BriefingBullet[] // 3–6 bullets
  advice: string             // single actionable paragraph
  generatedAt: string        // ISO timestamp
}

export interface MonthSnapshot {
  id: string
  label: string
  date: string
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  freeCashFlow: number
  /**
   * Actual spending per category recorded after the month ends.
   * Pre-populated from planned amounts at snapshot time; editable retroactively.
   * Powers the month-over-month Δ comparison in the Expenses tab.
   */
  categoryActuals?: Partial<Record<ExpenseCategory, number>>
  /**
   * Individual named expense line items added retroactively to this snapshot.
   * When items exist for a category, their sum is reflected in categoryActuals[category].
   * Absence of this field (undefined or []) means no items have been added.
   */
  historicalExpenses?: HistoricalExpense[]
  historicalIncomes?: HistoricalIncome[]
  /**
   * Set to true after the user actions the end-of-month surplus
   * (allocates it to a goal or savings account).
   * Hides the SurplusBanner for this snapshot permanently.
   */
  surplusActioned?: boolean
  /**
   * Running total of surplus already allocated across all allocation actions.
   * Remaining surplus = freeCashFlow − (surplusAllocated ?? 0).
   * When remaining reaches 0 the banner auto-dismisses.
   * Absent / undefined is treated as 0 (backward-compatible).
   */
  surplusAllocated?: number
  /**
   * Record of where the surplus was allocated.
   * Each entry represents one allocation action the user confirmed.
   * Displayed in the History tab below the summary grid.
   */
  surplusAllocations?: Array<{
    amount: number
    type: 'savings' | 'goal'
    destinationId: string
    destinationName: string
  }>
  /**
   * When true, this snapshot was auto-created by the app on load.
   * Auto-snapshots are refreshed every load; manual snapshots are never touched.
   */
  autoSnapshot?: boolean
  /**
   * ISO timestamp of when the auto-snapshot was last refreshed.
   */
  autoSnapshotUpdatedAt?: string
  /**
   * AI-generated monthly financial briefing for this snapshot.
   * Set by the user triggering "Generate Briefing" in the History tab.
   * Optional for backward compatibility — older snapshots have no briefing.
   */
  aiBriefing?: BriefingResult
}

export interface FinanceData {
  members: HouseholdMember[]
  expenses: Expense[]
  accounts: SavingsAccount[]
  goals: Goal[]
  history: MonthSnapshot[]
  emergencyBufferMonths: number
  currency: Currency
  locale: Locale
  darkMode: boolean
  language: 'en' | 'he'
  /** Monthly spending limit per category. Powers the budget progress bars in the Expenses tab. */
  categoryBudgets: Partial<Record<ExpenseCategory, number>>
}

// ─── Auth / Household types ────────────────────────────────────────────────

export interface LocalUser {
  id: string
  name: string           // replaces legacy displayName
  email: string
  avatar?: string        // Google profile picture URL
  authProvider: 'google' | 'email'
  householdId: string
  createdAt: string
  passwordHash?: string  // email-auth only
}

/** One member's role inside a household (different from HouseholdMember which is the finance domain) */
export interface HouseholdMembership {
  userId: string
  role: 'owner' | 'member'
  joinedAt: string
}

export interface Household {
  id: string
  name: string
  createdBy: string
  memberships: HouseholdMembership[]
  createdAt: string
}

export interface Invitation {
  id: string
  email: string
  householdId: string
  invitedBy: string      // userId of the inviter
  status: 'pending' | 'accepted' | 'expired'
  createdAt: string
  expiresAt: string
}

export interface AppSession {
  userId: string
  householdId: string
  /** ISO timestamp. If set and in the past, the session is considered expired. */
  expiresAt?: string
}

// ─── Invite v2 types ────────────────────────────────────────────────────────

/** How the invite was created: targeted email or a reusable shareable link. */
export type InviteMethod = 'email' | 'link'

/** Lifecycle state of a household invite. */
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

/**
 * A row in `household_invites`.
 * The raw token is NEVER stored or returned after creation.
 * Only token_hash is persisted in the DB.
 */
export interface HouseholdInvite {
  id: string
  household_id: string
  /** Populated for 'email' invites; null for 'link' invites. */
  invited_email: string | null
  method: InviteMethod
  status: InviteStatus
  expires_at: string
  created_by: string
  created_at: string
}

/**
 * Returned only by `createHouseholdInvite()`.
 * Contains the raw token to embed in the URL — it is NOT stored.
 * Callers must treat it as a secret and not log it.
 */
export interface CreatedHouseholdInvite extends HouseholdInvite {
  token: string
}

// ─── v4.0 Home — derived (never persisted) ───────────────────────────────────
// Pure outputs of src/lib/insights.ts. Not part of FinanceData.

/** Spending pace for the current month (see computeMonthlyPlan). */
export type PaceStatus = 'no-income' | 'over' | 'ahead' | 'on-track'

/** "Left to spend this month" plan — every value is unrounded. */
export interface MonthlyPlan {
  /** Σ getNetMonthly over all members' sources (no FX — same as the Income KPI). */
  income: number
  /** Monthly-equivalent of fixed expenses (yearly ÷ 12 = sinking-fund provision). */
  fixed: number
  /** Monthly-equivalent of variable expenses logged in the live list. */
  variableSpent: number
  /** Contributions of accounts not linked by a savings expense and not deducted from salary. */
  savingsContrib: number
  /** income − fixed − savingsContrib */
  spendable: number
  /** spendable − variableSpent (≡ the legacy Overview free cash flow). */
  leftToSpend: number
  daysInMonth: number
  /** 1-based day of month of `today` (local time). */
  dayOfMonth: number
  /** Days left including today. */
  daysLeft: number
  /** Share of the month already elapsed before today, 0–100. */
  elapsedPct: number
  /** variableSpent ÷ spendable × 100, or null when spendable ≤ 0. Not capped. */
  spentPct: number | null
  /** leftToSpend ÷ daysLeft when leftToSpend > 0, else 0. */
  dailyAllowance: number
  status: PaceStatus
}

export type InsightTone = 'danger' | 'success' | 'warning' | 'info' | 'neutral'

/** One Home insight card (max 3 shown, sorted by `priority`, 1 = highest). */
export type Insight =
  | { id: 'deficit'; tone: 'danger'; priority: 1; /** Amount over (≥ 0). */ amount: number; /** True when fixed + savings alone exceed income. */ structural: boolean }
  | { id: 'surplus'; tone: 'success'; priority: 2; snapshotId: string; snapshotLabel: string; snapshotDate: string; /** Remaining (unallocated) surplus. */ amount: number }
  | { id: 'over-budget'; tone: 'warning'; priority: 3; categories: ExpenseCategory[]; worst: { category: ExpenseCategory; spent: number; budget: number } }
  | { id: 'bill-due'; tone: 'info'; priority: 4; bills: Array<{ expenseId: string; name: string; amount: number; dueMonth: number; thisMonth: boolean }> }
  | { id: 'pace-ahead'; tone: 'warning'; priority: 5; spentPct: number; elapsedPct: number }
  | { id: 'briefing'; tone: 'neutral'; priority: 6; snapshotId: string; score: number; headline: string }
