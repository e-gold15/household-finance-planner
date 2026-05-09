/**
 * Demo Mode — static realistic FinanceData for the Cohen household.
 * This data is loaded in-memory only; it is never persisted to localStorage or Supabase.
 */

import type {
  FinanceData,
  HouseholdMember,
  Expense,
  SavingsAccount,
  Goal,
  MonthSnapshot,
} from '../types'

// ─── Helper: compute past month labels ────────────────────────────────────
const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function pastMonthLabel(monthsAgo: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsAgo)
  return `${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}`
}

function pastMonthDate(monthsAgo: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsAgo)
  return d.toISOString()
}

function futureDeadline(monthsFromNow: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + monthsFromNow)
  return d.toISOString()
}

// ─── Members ───────────────────────────────────────────────────────────────

const members: HouseholdMember[] = [
  {
    id: 'demo-member-1',
    name: 'דנה כהן',
    sources: [
      {
        id: 'demo-source-1',
        name: 'משכורת',
        amount: 28000,
        period: 'monthly',
        type: 'salary',
        isGross: true,
        useManualNet: true,
        manualNetOverride: 18200,
        country: 'IL',
        taxCreditPoints: 2.25,
        insuredSalaryRatio: 100,
        useContributions: true,
        pensionEmployee: 6.5,
        pensionEmployer: 7,
        educationFundEmployee: 2.5,
        educationFundEmployer: 7.5,
        severanceEmployer: 8.33,
        pensionBase: 28000,
        studyFundBase: 16000,
        payslipMode: 'advanced',
        payslipComponents: {
          base: 22000,
          overtime125: 3500,
          overtime150: 2500,
          otherTaxable: 0,
          imputedIncome: 0,
          nonTaxableReimbursements: 0,
        },
      },
    ],
  },
  {
    id: 'demo-member-2',
    name: 'יוסי כהן',
    sources: [
      {
        id: 'demo-source-2',
        name: 'משכורת',
        amount: 22000,
        period: 'monthly',
        type: 'salary',
        isGross: true,
        useManualNet: true,
        manualNetOverride: 14800,
        country: 'IL',
        taxCreditPoints: 2.75,
        insuredSalaryRatio: 100,
        useContributions: true,
        pensionEmployee: 6,
        pensionEmployer: 6.5,
        educationFundEmployee: 2.5,
        educationFundEmployer: 7.5,
        severanceEmployer: 8.33,
        payslipMode: 'simple',
      },
    ],
  },
]

// ─── Expenses ──────────────────────────────────────────────────────────────

const expenses: Expense[] = [
  {
    id: 'demo-exp-1',
    name: 'שכר דירה',
    amount: 7200,
    category: 'housing',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
  },
  {
    id: 'demo-exp-2',
    name: 'סופרמרקט',
    amount: 3800,
    category: 'food',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
  },
  {
    id: 'demo-exp-3',
    name: 'הלוואת רכב',
    amount: 1850,
    category: 'transport',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
  },
  {
    id: 'demo-exp-4',
    name: 'חשמל',
    amount: 420,
    category: 'utilities',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
  },
  {
    id: 'demo-exp-5',
    name: 'אינטרנט + סלולר',
    amount: 280,
    category: 'utilities',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
  },
  {
    id: 'demo-exp-6',
    name: 'חדר כושר',
    amount: 320,
    category: 'leisure',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
  },
  {
    id: 'demo-exp-7',
    name: 'חוגים לילדים',
    amount: 900,
    category: 'education',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
  },
  {
    id: 'demo-exp-8',
    name: 'שירותי סטרימינג',
    amount: 85,
    category: 'leisure',
    recurring: true,
    period: 'monthly',
    expenseType: 'fixed',
  },
  {
    id: 'demo-exp-9',
    name: 'ביטוח דירה',
    amount: 3600,
    category: 'insurance',
    recurring: true,
    period: 'yearly',
    expenseType: 'fixed',
    dueMonth: 3,
  },
  {
    id: 'demo-exp-10',
    name: 'ביטוח רכב',
    amount: 4800,
    category: 'insurance',
    recurring: true,
    period: 'yearly',
    expenseType: 'fixed',
    dueMonth: 9,
  },
  {
    id: 'demo-exp-11',
    name: 'ביגוד',
    amount: 600,
    category: 'clothing',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
  },
  {
    id: 'demo-exp-12',
    name: 'הוצאות עבודה (יוסי)',
    amount: 500,
    category: 'work',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
  },
]

// ─── Savings accounts ──────────────────────────────────────────────────────

const accounts: SavingsAccount[] = [
  {
    id: 'demo-acct-1',
    name: 'עו"ש משותף',
    type: 'checking',
    balance: 62000,
    liquidity: 'immediate',
    annualReturnPercent: 0.1,
    monthlyContribution: 0,
    deductedFromSalary: false,
  },
  {
    id: 'demo-acct-2',
    name: 'קרן השתלמות — דנה',
    type: 'study_fund',
    balance: 87400,
    liquidity: 'medium',
    annualReturnPercent: 7.2,
    monthlyContribution: 1178,
    deductedFromSalary: true,
    lastAutoIncrementMonth: '2026-04',
    autoIncrementLog: [
      { month: '2026-02', amount: 1178 },
      { month: '2026-03', amount: 1178 },
      { month: '2026-04', amount: 1178 },
    ],
  },
  {
    id: 'demo-acct-3',
    name: 'פנסיה — יוסי',
    type: 'pension',
    balance: 234000,
    liquidity: 'locked',
    annualReturnPercent: 5.8,
    monthlyContribution: 1980,
    deductedFromSalary: true,
  },
  {
    id: 'demo-acct-4',
    name: 'חיסכון לחופשה',
    type: 'savings',
    balance: 14200,
    liquidity: 'short',
    annualReturnPercent: 3.5,
    monthlyContribution: 800,
    deductedFromSalary: false,
  },
]

// ─── Goals ─────────────────────────────────────────────────────────────────

const goals: Goal[] = [
  {
    id: 'demo-goal-1',
    name: 'מקדמה לדירה',
    targetAmount: 600000,
    currentAmount: 87400,
    deadline: futureDeadline(36),
    priority: 'high',
    notes: 'חיסכון לרכישת דירה בתל אביב',
    useLiquidSavings: true,
  },
  {
    id: 'demo-goal-2',
    name: 'חופשה משפחתית',
    targetAmount: 18000,
    currentAmount: 14200,
    deadline: futureDeadline(8),
    priority: 'medium',
    notes: 'חופשה לאירופה עם הילדים',
    useLiquidSavings: true,
  },
  {
    id: 'demo-goal-3',
    name: 'קרן חירום',
    targetAmount: 100000,
    currentAmount: 62000,
    deadline: futureDeadline(18),
    priority: 'high',
    notes: 'יעד: 3 חודשי הוצאות',
    useLiquidSavings: true,
  },
]

// ─── History (6 past monthly snapshots) ───────────────────────────────────

// totalSavings for accounts NOT deducted from salary and NOT linked to an expense:
// demo-acct-4 (חיסכון לחופשה): 800/mo — the others are deductedFromSalary
const FIXED_SAVINGS = 800

function makeSnapshot(
  monthsAgo: number,
  totalIncome: number,
  foodActual: number,
  transportActual: number,
  utilitiesActual: number,
  leisureActual: number,
  educationActual: number,
  clothingActual: number,
  workActual: number,
  surplusActioned: boolean
): MonthSnapshot {
  const housing = 7200
  const insurance = (3600 + 4800) / 12   // ~700 smoothed

  const categoryActuals = {
    housing,
    food: foodActual,
    transport: transportActual,
    utilities: utilitiesActual,
    leisure: leisureActual,
    education: educationActual,
    clothing: clothingActual,
    insurance: Math.round(insurance),
    work: workActual,
  }

  const totalExpenses = Object.values(categoryActuals).reduce((s, v) => s + v, 0)
  const freeCashFlow = totalIncome - totalExpenses - FIXED_SAVINGS

  return {
    id: `demo-snap-${monthsAgo}`,
    label: pastMonthLabel(monthsAgo),
    date: pastMonthDate(monthsAgo),
    totalIncome,
    totalExpenses,
    totalSavings: FIXED_SAVINGS,
    freeCashFlow,
    categoryActuals,
    autoSnapshot: false,
    surplusActioned,
  }
}

const history: MonthSnapshot[] = [
  makeSnapshot(6, 32800, 3920, 1980, 680, 405, 870, 550, 480, true),
  makeSnapshot(5, 33200, 4050, 1850, 710, 405, 920, 620, 500, true),
  makeSnapshot(4, 32600, 3780, 1850, 640, 405, 950, 580, 495, true),
  makeSnapshot(3, 33500, 4180, 1950, 730, 405, 900, 600, 510, true),
  makeSnapshot(2, 33100, 3850, 1850, 690, 405, 910, 560, 490, false),
  makeSnapshot(1, 32900, 4020, 1850, 700, 405, 880, 590, 500, false),
]

// ─── Category budgets ──────────────────────────────────────────────────────

const categoryBudgets = {
  food: 4200,
  transport: 2500,
  leisure: 500,
  education: 1000,
  clothing: 700,
  utilities: 800,
  work: 600,
}

// ─── Full FinanceData export ───────────────────────────────────────────────

export const DEMO_FINANCE_DATA: FinanceData = {
  members,
  expenses,
  accounts,
  goals,
  history,
  emergencyBufferMonths: 3,
  currency: 'ILS',
  locale: 'he-IL',
  language: 'he',
  darkMode: false,
  categoryBudgets,
}
