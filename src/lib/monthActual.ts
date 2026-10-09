/**
 * v4.2 — "This month's actual" net income per source.
 *
 * Pure helpers used by the Income tab. The actual lives on the source
 * (`IncomeSource.monthActual`) and travels inside the member, so the members
 * `mergeById` sync strategy is unchanged. Nothing here ever adds or removes a
 * member or a source.
 */
import { getNetForMonth, getNetMonthly, toYearMonth } from '@/lib/taxEstimation'
import type { HouseholdMember, IncomeMonthActual, IncomeSource, MonthSnapshot } from '@/types'

/** The source's actual for `yearMonth`, or null when none is set for that month. */
export function activeMonthActual(source: IncomeSource, yearMonth: string): IncomeMonthActual | null {
  const a = source.monthActual
  // Same validity rule as getNetForMonth, so display and totals always agree.
  return a && a.month === yearMonth && Number.isFinite(a.amount) && a.amount >= 0 ? a : null
}

/**
 * Returns the source with `monthActual` set (actual given) or removed (null).
 * Every other field is kept exactly as it is.
 */
export function withMonthActual(source: IncomeSource, actual: IncomeMonthActual | null): IncomeSource {
  if (actual) return { ...source, monthActual: actual }
  const rest: IncomeSource = { ...source }
  delete rest.monthActual
  return rest
}

/**
 * Returns the member with one source's actual set or cleared.
 * The member is returned unchanged (same reference) when the source isn't found.
 */
export function setMemberSourceMonthActual(
  member: HouseholdMember,
  sourceId: string,
  actual: IncomeMonthActual | null,
): HouseholdMember {
  if (!member.sources.some((s) => s.id === sourceId)) return member
  return {
    ...member,
    sources: member.sources.map((s) => (s.id === sourceId ? withMonthActual(s, actual) : s)),
  }
}

/** Household income for `yearMonth`: actual (with overrides) vs planned. */
export function householdIncomeForMonth(
  members: HouseholdMember[],
  yearMonth: string,
): { actual: number; planned: number; hasActuals: boolean } {
  let actual = 0
  let planned = 0
  let hasActuals = false
  for (const m of members) {
    for (const src of m.sources) {
      actual += getNetForMonth(src, yearMonth)
      planned += getNetMonthly(src)
      if (activeMonthActual(src, yearMonth)) hasActuals = true
    }
  }
  return { actual, planned, hasActuals }
}

/**
 * Free cash flow for goal planning (Goals tab): the most recent non-stub
 * snapshot's FCF, falling back to `surplus`. The current-month snapshot carries
 * this month's actuals, so that delta is taken back out — goals always plan on
 * the planned income. The current month is found by date, not by income, so a
 * 0 actual (unpaid leave) isn't mistaken for a stub.
 */
export function plannedFreeCashFlow(
  history: MonthSnapshot[],
  members: HouseholdMember[],
  surplus: number,
  now: Date,
): number {
  const { actual, planned } = householdIncomeForMonth(members, toYearMonth(now))
  const delta = actual - planned
  const isCurrentMonth = (iso: string) => {
    const d = new Date(iso)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  const nonStub = [...history]
    .filter((s) => s.totalIncome > 0 || (delta !== 0 && isCurrentMonth(s.date)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  if (nonStub.length === 0) return surplus
  const latest = nonStub[0]
  return isCurrentMonth(latest.date) ? latest.freeCashFlow - delta : latest.freeCashFlow
}
