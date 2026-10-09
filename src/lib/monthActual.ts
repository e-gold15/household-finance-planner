/**
 * v4.2 — "This month's actual" net income per source.
 *
 * Pure helpers used by the Income tab. The actual lives on the source
 * (`IncomeSource.monthActual`) and travels inside the member, so the members
 * `mergeById` sync strategy is unchanged. Nothing here ever adds or removes a
 * member or a source.
 */
import { getNetForMonth, getNetMonthly } from '@/lib/taxEstimation'
import type { HouseholdMember, IncomeMonthActual, IncomeSource } from '@/types'

/** The source's actual for `yearMonth`, or null when none is set for that month. */
export function activeMonthActual(source: IncomeSource, yearMonth: string): IncomeMonthActual | null {
  const a = source.monthActual
  return a && a.month === yearMonth ? a : null
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
