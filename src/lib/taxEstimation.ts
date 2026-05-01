import type { IncomeSource, Country } from '@/types'

export interface TaxBreakdown {
  grossMonthly: number
  incomeTax: number
  bituachLeumi: number
  healthTax: number
  pensionEmployee: number
  educationFundEmployee: number
  totalEmployeeContrib: number
  totalDeductions: number
  netMonthly: number
  effectiveRate: number      // percentage taken off gross
  isManual: boolean
  hasContributions: boolean
  // employer — informational only
  pensionEmployer: number
  educationFundEmployer: number
  severanceEmployer: number
  totalEmployerContrib: number
}

// ── Israeli monthly progressive brackets ──────────────────────────────────────
const IL_MONTHLY_BRACKETS = [
  { upTo: 7_010,  rate: 0.10 },
  { upTo: 10_060, rate: 0.14 },
  { upTo: 16_150, rate: 0.20 },
  { upTo: 22_440, rate: 0.31 },
  { upTo: 46_690, rate: 0.35 },
  { upTo: Infinity, rate: 0.47 },
]

const IL_CREDIT_VALUE = 242       // ILS per credit point per month
const IL_BL_LOW_THRESHOLD = 7_522
const IL_BL_CAP            = 49_030
const IL_BL_LOW_RATE        = 0.035
const IL_BL_HIGH_RATE       = 0.12
const IL_HT_LOW_RATE        = 0.031
const IL_HT_HIGH_RATE       = 0.05

// ── Simplified annual brackets for other countries ────────────────────────────
const FOREIGN_BRACKETS: Record<Country, Array<{ upTo: number; rate: number }>> = {
  IL: [],  // handled above
  US: [
    { upTo: 11_000,  rate: 0.10 },
    { upTo: 44_725,  rate: 0.12 },
    { upTo: 95_375,  rate: 0.22 },
    { upTo: 182_050, rate: 0.24 },
    { upTo: 231_250, rate: 0.32 },
    { upTo: 578_125, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  UK: [
    { upTo: 12_570,  rate: 0 },
    { upTo: 50_270,  rate: 0.20 },
    { upTo: 125_140, rate: 0.40 },
    { upTo: Infinity, rate: 0.45 },
  ],
  DE: [
    { upTo: 10_908,  rate: 0 },
    { upTo: 62_810,  rate: 0.42 },
    { upTo: Infinity, rate: 0.45 },
  ],
  FR: [
    { upTo: 10_777,  rate: 0 },
    { upTo: 27_478,  rate: 0.11 },
    { upTo: 78_570,  rate: 0.30 },
    { upTo: 168_994, rate: 0.41 },
    { upTo: Infinity, rate: 0.45 },
  ],
  CA: [
    { upTo: 15_000,  rate: 0 },
    { upTo: 53_359,  rate: 0.15 },
    { upTo: 106_717, rate: 0.205 },
    { upTo: 165_430, rate: 0.26 },
    { upTo: 235_675, rate: 0.29 },
    { upTo: Infinity, rate: 0.33 },
  ],
}

function applyBrackets(amount: number, brackets: Array<{ upTo: number; rate: number }>): number {
  let tax = 0
  let prev = 0
  for (const { upTo, rate } of brackets) {
    if (amount <= prev) break
    tax += (Math.min(amount, upTo) - prev) * rate
    prev = upTo
  }
  return tax
}

function calcBituachLeumi(insuredSalary: number): number {
  if (insuredSalary <= 0) return 0
  const capped = Math.min(insuredSalary, IL_BL_CAP)
  if (capped <= IL_BL_LOW_THRESHOLD) return capped * IL_BL_LOW_RATE
  return IL_BL_LOW_THRESHOLD * IL_BL_LOW_RATE + (capped - IL_BL_LOW_THRESHOLD) * IL_BL_HIGH_RATE
}

function calcHealthTax(insuredSalary: number): number {
  if (insuredSalary <= 0) return 0
  const capped = Math.min(insuredSalary, IL_BL_CAP)
  if (capped <= IL_BL_LOW_THRESHOLD) return capped * IL_HT_LOW_RATE
  return IL_BL_LOW_THRESHOLD * IL_HT_LOW_RATE + (capped - IL_BL_LOW_THRESHOLD) * IL_HT_HIGH_RATE
}

// Resolve fields with legacy fallbacks so old stored data still calculates
function resolve(src: IncomeSource) {
  const gross = src.period === 'yearly' ? src.amount / 12 : src.amount
  const taxCreditPoints   = src.taxCreditPoints   ?? 2.25
  // Legacy: old data stored insuredRatio as decimal (0-1). New data stores insuredSalaryRatio as % (0-100).
  const insuredSalaryRatio = src.insuredSalaryRatio != null
    ? src.insuredSalaryRatio
    : ((src as any).insuredRatio != null ? (src as any).insuredRatio * 100 : 100)
  const useContributions  = src.useContributions  ?? false
  const pensionEmployee       = src.pensionEmployee       ?? (src as any).pensionEmployeePercent ?? 6
  const educationFundEmployee = src.educationFundEmployee ?? (src as any).educationFundPercent   ?? 0
  const pensionEmployer       = src.pensionEmployer       ?? 6.5
  const educationFundEmployer = src.educationFundEmployer ?? 7.5
  const severanceEmployer     = src.severanceEmployer     ?? 8.33
  return {
    gross, taxCreditPoints, insuredSalaryRatio, useContributions,
    pensionEmployee, educationFundEmployee,
    pensionEmployer, educationFundEmployer, severanceEmployer,
  }
}

export function estimateTax(source: IncomeSource): TaxBreakdown {
  const r = resolve(source)
  const g = r.gross

  const pensionBase    = source.pensionBase    ?? g
  const studyFundBase  = source.studyFundBase  ?? g
  const employerPension     = pensionBase   * (r.pensionEmployer / 100)
  const employerEducation   = studyFundBase * (r.educationFundEmployer / 100)
  const employerSeverance   = pensionBase    * (r.severanceEmployer / 100)
  const totalEmployerContrib = employerPension + employerEducation + employerSeverance

  // ── Manual override ────────────────────────────────────────────────────────
  if (source.useManualNet && source.manualNetOverride != null) {
    const net = source.manualNetOverride
    return {
      grossMonthly: g,
      incomeTax: g - net,
      bituachLeumi: 0, healthTax: 0,
      pensionEmployee: 0, educationFundEmployee: 0,
      totalEmployeeContrib: 0, totalDeductions: g - net,
      netMonthly: net,
      effectiveRate: g > 0 ? ((g - net) / g) * 100 : 0,
      isManual: true, hasContributions: false,
      pensionEmployer: employerPension, educationFundEmployer: employerEducation,
      severanceEmployer: employerSeverance, totalEmployerContrib,
    }
  }

  // ── Net as-is ──────────────────────────────────────────────────────────────
  if (!source.isGross) {
    return {
      grossMonthly: g,
      incomeTax: 0, bituachLeumi: 0, healthTax: 0,
      pensionEmployee: 0, educationFundEmployee: 0,
      totalEmployeeContrib: 0, totalDeductions: 0,
      netMonthly: g, effectiveRate: 0,
      isManual: false, hasContributions: false,
      pensionEmployer: employerPension, educationFundEmployer: employerEducation,
      severanceEmployer: employerSeverance, totalEmployerContrib,
    }
  }

  // ── Gross → Net calculation ────────────────────────────────────────────────
  let incomeTax = 0
  let bituachLeumi = 0
  let healthTax = 0

  if (source.country === 'IL') {
    const rawTax = applyBrackets(g, IL_MONTHLY_BRACKETS)
    incomeTax = Math.max(0, rawTax - r.taxCreditPoints * IL_CREDIT_VALUE)

    const insuredSalary = g * (r.insuredSalaryRatio / 100)
    bituachLeumi = calcBituachLeumi(insuredSalary)
    healthTax    = calcHealthTax(insuredSalary)
  } else {
    const annualTax = applyBrackets(g * 12, FOREIGN_BRACKETS[source.country])
    incomeTax = annualTax / 12
  }

  const pensionEmp   = r.useContributions ? pensionBase   * (r.pensionEmployee / 100) : 0
  const eduFundEmp   = r.useContributions ? studyFundBase * (r.educationFundEmployee / 100) : 0
  const totalEmpContrib = pensionEmp + eduFundEmp

  const totalDeductions = incomeTax + bituachLeumi + healthTax + totalEmpContrib
  const net = Math.max(0, g - totalDeductions)

  return {
    grossMonthly: g,
    incomeTax, bituachLeumi, healthTax,
    pensionEmployee: pensionEmp, educationFundEmployee: eduFundEmp,
    totalEmployeeContrib: totalEmpContrib, totalDeductions,
    netMonthly: net,
    effectiveRate: g > 0 ? (totalDeductions / g) * 100 : 0,
    isManual: false, hasContributions: r.useContributions,
    pensionEmployer: employerPension, educationFundEmployer: employerEducation,
    severanceEmployer: employerSeverance, totalEmployerContrib,
  }
}

export function getNetMonthly(source: IncomeSource): number {
  const net = estimateTax(source).netMonthly
  const components = source.payslipComponents
  // Imputed income (שווי מס) is added to taxable gross so the tax engine computes
  // the correct tax, but it is never paid as cash. Subtract it from net so the
  // take-home figure reflects only real money received.
  const imputedIncome = components?.imputedIncome ?? 0
  // Non-taxable reimbursements (e.g. travel) are real cash but were excluded from
  // the taxable gross, so add them back to net.
  const reimbursements = components?.nonTaxableReimbursements ?? 0
  return net - imputedIncome + reimbursements
}
