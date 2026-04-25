export type Country = 'IL' | 'US' | 'UK' | 'DE' | 'FR' | 'CA'
export type Currency = 'ILS' | 'USD' | 'GBP' | 'EUR' | 'CAD'
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
  | 'other'

export interface Expense {
  id: string
  name: string
  amount: number
  category: ExpenseCategory
  recurring: boolean
  period: 'monthly' | 'yearly'
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
}

export type GoalPriority = 'high' | 'medium' | 'low'
export type GoalStatus = 'realistic' | 'tight' | 'unrealistic' | 'blocked'

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  priority: GoalPriority
  notes: string
  useLiquidSavings: boolean
}

export interface GoalAllocation extends Goal {
  status: GoalStatus
  monthlyRecommended: number
  monthsNeeded: number
  gap: number
}

export interface MonthSnapshot {
  id: string
  label: string
  date: string
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  freeCashFlow: number
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
