import type { MonthSnapshot } from '@/types'

/** How many month rows are listed before "Show older (N)". */
export const HISTORY_VISIBLE_COUNT = 6

const EN_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Newest first (by `date`). Does not mutate the input. */
export function sortSnapshotsNewestFirst(history: ReadonlyArray<MonthSnapshot>): MonthSnapshot[] {
  return [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** Oldest first (chart order). Does not mutate the input. */
export function sortSnapshotsOldestFirst(history: ReadonlyArray<MonthSnapshot>): MonthSnapshot[] {
  return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function isCurrentMonthSnapshot(s: Pick<MonthSnapshot, 'date'>, now: Date = new Date()): boolean {
  const d = new Date(s.date)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/** Retroactive stub: income unknown, only fixed / recorded expenses. */
export function isStubSnapshot(s: Pick<MonthSnapshot, 'totalIncome' | 'totalExpenses'>): boolean {
  return s.totalIncome === 0 && s.totalExpenses > 0
}

/**
 * Month/year of a snapshot. Prefers the stored English label ("March 2026" —
 * always written by FinanceContext) so the month never shifts across time
 * zones; falls back to the snapshot date.
 */
export function snapshotYearMonth(s: Pick<MonthSnapshot, 'label' | 'date'>): { year: number; month: number } | null {
  const m = /^\s*([A-Za-z]+)\s+(\d{4})\s*$/.exec(s.label ?? '')
  if (m) {
    const idx = EN_MONTHS.indexOf(m[1].toLowerCase())
    if (idx !== -1) return { year: Number(m[2]), month: idx }
  }
  const d = new Date(s.date)
  if (Number.isNaN(d.getTime())) return null
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Localised month label, e.g. "March 2026" / "מרץ 2026". Falls back to the raw label. */
export function snapshotMonthLabel(
  s: Pick<MonthSnapshot, 'label' | 'date'>,
  lang: 'en' | 'he',
  format: 'long' | 'short' = 'long'
): string {
  const ym = snapshotYearMonth(s)
  if (!ym) return s.label
  const d = new Date(ym.year, ym.month, 1)
  const locale = lang === 'he' ? 'he-IL' : 'en-US'
  return format === 'long'
    ? d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : d.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}

/** Snapshots with something to plot (same filter as v3). */
export function trendChartSnapshots(history: ReadonlyArray<MonthSnapshot>): MonthSnapshot[] {
  return sortSnapshotsOldestFirst(history).filter(
    (snap) => snap.totalIncome > 0 || snap.totalExpenses > 0 || (snap.historicalIncomes && snap.historicalIncomes.length > 0)
  )
}

/** Split a newest-first list into the visible rows and the hidden-older count. */
export function splitVisibleSnapshots<T>(
  sorted: ReadonlyArray<T>,
  showAll: boolean,
  limit: number = HISTORY_VISIBLE_COUNT
): { visible: T[]; hiddenCount: number } {
  if (showAll || sorted.length <= limit) return { visible: [...sorted], hiddenCount: 0 }
  return { visible: sorted.slice(0, limit), hiddenCount: sorted.length - limit }
}
