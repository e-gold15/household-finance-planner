import { useCallback, useEffect, useRef, useState } from 'react'
import { buildTabUrl, parseHash, tabToHash, type Tab } from '@/lib/navigation'

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash
}

/**
 * Replaces an unknown/empty hash with the canonical one for `tab`, without
 * adding a history entry. Path and query string (e.g. `?inv=`) are preserved.
 */
function canonicaliseHash(tab: Tab): void {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', buildTabUrl(tab, pathname, search))
}

/**
 * Hash-based tab routing (`#/overview`, `#/expenses`, …).
 *
 * - The tab is derived from `location.hash`; unknown/empty → `overview` via `replaceState`.
 * - `navigate(tab)` pushes a history entry, so Back returns to the previous tab.
 * - Listens to `hashchange` and `popstate` (Back/forward, manual hash edits).
 * - Scrolls to the top whenever the tab changes.
 * - Never touches `location.search`, so invite query params are left intact.
 */
export function useHashTab(): { tab: Tab; navigate: (tab: Tab) => void } {
  const [tab, setTab] = useState<Tab>(() => parseHash(currentHash()))
  const tabRef = useRef(tab)
  tabRef.current = tab

  // Sync from the URL (initial canonicalisation + Back/forward + manual edits).
  useEffect(() => {
    const syncFromLocation = () => {
      const hash = window.location.hash
      const next = parseHash(hash)
      // Unknown, empty or non-canonical (e.g. `#expenses`) → rewrite in place.
      if (hash !== tabToHash(next)) canonicaliseHash(next)
      setTab(next)
    }
    syncFromLocation()
    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  // Scroll to top on tab change (skip the initial render).
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo({ top: 0, left: 0 })
  }, [tab])

  const navigate = useCallback((next: Tab) => {
    if (next === tabRef.current) {
      // Re-selecting the active tab just scrolls back to the top.
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      return
    }
    const { pathname, search } = window.location
    // pushState does not fire hashchange, so update state directly.
    window.history.pushState(null, '', buildTabUrl(next, pathname, search))
    setTab(next)
  }, [])

  return { tab, navigate }
}
