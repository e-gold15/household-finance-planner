import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  PiggyBank,
  Target,
  History,
  Users,
  type LucideIcon,
} from 'lucide-react'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
// The active tab lives in the URL hash (`#/expenses`). This is pure UI state —
// nothing here is persisted to localStorage or synced.

export type Tab = 'overview' | 'income' | 'expenses' | 'savings' | 'goals' | 'history' | 'members'

/** Canonical tab order (desktop nav order). */
export const TABS: readonly Tab[] = [
  'overview',
  'income',
  'expenses',
  'savings',
  'goals',
  'history',
  'members',
] as const

export const DEFAULT_TAB: Tab = 'overview'

export function isTab(value: string): value is Tab {
  return (TABS as readonly string[]).includes(value)
}

/**
 * Normalises a raw hash into a candidate tab id.
 * Accepts `#/expenses`, `#expenses`, `/expenses`, `expenses`, `#/expenses/`
 * and ignores anything after `?` (e.g. `#/expenses?x=1`). Case-insensitive.
 */
function normaliseHash(hash: string): string {
  let s = (hash ?? '').trim()
  if (s.startsWith('#')) s = s.slice(1)
  const q = s.indexOf('?')
  if (q !== -1) s = s.slice(0, q)
  s = s.replace(/^\/+/, '').replace(/\/+$/, '')
  return s.toLowerCase()
}

/** Returns true when the hash maps exactly to a known tab (no fallback needed). */
export function isKnownHash(hash: string): boolean {
  return isTab(normaliseHash(hash))
}

/** Parses `location.hash` into a tab. Unknown or empty → `'overview'`. */
export function parseHash(hash: string): Tab {
  const candidate = normaliseHash(hash)
  return isTab(candidate) ? candidate : DEFAULT_TAB
}

/** Serialises a tab into its canonical hash, e.g. `'expenses'` → `'#/expenses'`. */
export function tabToHash(tab: Tab): string {
  return `#/${tab}`
}

// ─── Nav item definitions ─────────────────────────────────────────────────────

export type NavPlacement = 'primary' | 'more'

export interface NavItem {
  id: Tab
  icon: LucideIcon
  /** Full label (desktop nav, More sheet). */
  en: string
  he: string
  /** Optional shorter label used in the mobile bottom nav. */
  shortEn?: string
  shortHe?: string
  /** `primary` → own slot in the mobile bottom nav; `more` → inside the More sheet. */
  placement: NavPlacement
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', icon: LayoutDashboard, en: 'Overview', he: 'סקירה', shortEn: 'Home', shortHe: 'בית', placement: 'primary' },
  { id: 'income',   icon: TrendingUp,      en: 'Income',   he: 'הכנסות',   placement: 'primary' },
  { id: 'expenses', icon: ShoppingCart,    en: 'Expenses', he: 'הוצאות',   placement: 'primary' },
  { id: 'savings',  icon: PiggyBank,       en: 'Savings',  he: 'חיסכון',   placement: 'more' },
  { id: 'goals',    icon: Target,          en: 'Goals',    he: 'יעדים',    placement: 'more' },
  { id: 'history',  icon: History,         en: 'History',  he: 'היסטוריה', placement: 'more' },
  { id: 'members',  icon: Users,           en: 'Members',  he: 'חברים',    placement: 'more' },
] as const

export function getNavItem(tab: Tab): NavItem {
  // NAV_ITEMS covers every Tab, so the fallback is unreachable in practice.
  return NAV_ITEMS.find((i) => i.id === tab) ?? NAV_ITEMS[0]
}

/** Tabs with their own bottom-nav slot on mobile, in display order (Home · Expenses · Goals). */
export const PRIMARY_MOBILE_TABS: readonly Tab[] = NAV_ITEMS.filter((i) => i.placement === 'primary').map((i) => i.id)

/** Tabs listed inside the mobile More sheet, in display order. */
export const MORE_TABS: readonly Tab[] = NAV_ITEMS.filter((i) => i.placement === 'more').map((i) => i.id)

/** True when the tab is reached through the More sheet (so "More" shows as active). */
export function isMoreTab(tab: Tab): boolean {
  return MORE_TABS.includes(tab)
}

/** Builds a full URL (path + search + hash) for a tab, preserving query params. */
export function buildTabUrl(tab: Tab, pathname: string, search: string): string {
  return `${pathname}${search}${tabToHash(tab)}`
}
