import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  TABS,
  NAV_ITEMS,
  PRIMARY_MOBILE_TABS,
  MORE_TABS,
  DEFAULT_TAB,
  parseHash,
  tabToHash,
  isTab,
  isKnownHash,
  isMoreTab,
  getNavItem,
  buildTabUrl,
  type Tab,
} from '@/lib/navigation'
import { useHashTab } from '@/hooks/useHashTab'

// ─── parseHash() ──────────────────────────────────────────────────────────────

describe('parseHash()', () => {
  it('parses every canonical tab hash', () => {
    for (const tab of TABS) {
      expect(parseHash(`#/${tab}`)).toBe(tab)
    }
  })

  it('falls back to overview for an empty hash', () => {
    expect(parseHash('')).toBe('overview')
    expect(parseHash('#')).toBe('overview')
    expect(parseHash('#/')).toBe('overview')
  })

  it('falls back to overview for an unknown hash', () => {
    expect(parseHash('#/nope')).toBe('overview')
    expect(parseHash('#/expenses/extra')).toBe('overview')
    expect(parseHash('#access_token=abc')).toBe('overview')
  })

  it('accepts lenient forms (no slash, trailing slash, no #, mixed case)', () => {
    expect(parseHash('#expenses')).toBe('expenses')
    expect(parseHash('#/goals/')).toBe('goals')
    expect(parseHash('/history')).toBe('history')
    expect(parseHash('savings')).toBe('savings')
    expect(parseHash('#/Members')).toBe('members')
  })

  it('ignores a query string inside the hash', () => {
    expect(parseHash('#/income?x=1')).toBe('income')
  })

  it('tolerates undefined-like input at runtime', () => {
    expect(parseHash(undefined as unknown as string)).toBe(DEFAULT_TAB)
  })
})

// ─── tabToHash() / round trip ─────────────────────────────────────────────────

describe('tabToHash()', () => {
  it('serialises to #/<tab>', () => {
    expect(tabToHash('expenses')).toBe('#/expenses')
    expect(tabToHash('overview')).toBe('#/overview')
  })

  it('round-trips with parseHash for every tab', () => {
    for (const tab of TABS) {
      expect(parseHash(tabToHash(tab))).toBe(tab)
    }
  })
})

describe('isTab() / isKnownHash()', () => {
  it('recognises valid tab ids only', () => {
    expect(isTab('goals')).toBe(true)
    expect(isTab('settings')).toBe(false)
    expect(isTab('')).toBe(false)
  })

  it('reports whether a hash maps to a real tab without fallback', () => {
    expect(isKnownHash('#/history')).toBe(true)
    expect(isKnownHash('#history')).toBe(true)
    expect(isKnownHash('')).toBe(false)
    expect(isKnownHash('#/unknown')).toBe(false)
  })
})

describe('buildTabUrl()', () => {
  it('preserves path and query string', () => {
    expect(buildTabUrl('goals', '/', '?inv=abc')).toBe('/?inv=abc#/goals')
    expect(buildTabUrl('overview', '/app', '')).toBe('/app#/overview')
  })
})

// ─── Nav item definitions ─────────────────────────────────────────────────────

describe('NAV_ITEMS', () => {
  it('covers all 7 tabs exactly once, in canonical order', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([...TABS])
    expect(TABS).toHaveLength(7)
  })

  it('has English and Hebrew labels and an icon for every item', () => {
    for (const item of NAV_ITEMS) {
      expect(item.en.length).toBeGreaterThan(0)
      expect(item.he.length).toBeGreaterThan(0)
      expect(item.icon).toBeTruthy()
    }
  })

  it('puts Home, Expenses, Goals in the mobile bottom nav (in that order)', () => {
    expect(PRIMARY_MOBILE_TABS).toEqual(['overview', 'expenses', 'goals'])
    expect(getNavItem('overview').shortEn).toBe('Home')
  })

  it('puts Income, Savings, History, Members in the More sheet', () => {
    expect(MORE_TABS).toEqual(['income', 'savings', 'history', 'members'])
  })

  it('primary and More tabs partition the full tab set', () => {
    const all = [...PRIMARY_MOBILE_TABS, ...MORE_TABS].sort()
    expect(all).toEqual([...TABS].sort())
  })

  it('isMoreTab() is true only for tabs in the More sheet', () => {
    const expected: Record<Tab, boolean> = {
      overview: false, income: true, expenses: false, savings: true,
      goals: false, history: true, members: true,
    }
    for (const tab of TABS) expect(isMoreTab(tab)).toBe(expected[tab])
  })
})

// ─── useHashTab() ─────────────────────────────────────────────────────────────
// Minimal renderHook (avoids depending on @testing-library/dom, which is not installed).

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderHook<T>(hook: () => T): { result: { current: T }; unmount: () => void } {
  const result = { current: undefined as unknown as T }
  function Probe() {
    result.current = hook()
    return null
  }
  const container = document.createElement('div')
  const root: Root = createRoot(container)
  act(() => root.render(createElement(Probe)))
  return { result, unmount: () => act(() => root.unmount()) }
}

describe('useHashTab()', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('defaults to overview and canonicalises an empty hash via replaceState', () => {
    const lengthBefore = window.history.length
    const { result } = renderHook(() => useHashTab())
    expect(result.current.tab).toBe('overview')
    expect(window.location.hash).toBe('#/overview')
    expect(window.history.length).toBe(lengthBefore) // no new entry
  })

  it('reads a deep link from the hash', () => {
    window.history.replaceState(null, '', '/#/history')
    const { result } = renderHook(() => useHashTab())
    expect(result.current.tab).toBe('history')
  })

  it('replaces an unknown hash with #/overview', () => {
    window.history.replaceState(null, '', '/#/bogus')
    const { result } = renderHook(() => useHashTab())
    expect(result.current.tab).toBe('overview')
    expect(window.location.hash).toBe('#/overview')
  })

  it('navigate() pushes a history entry and updates the tab', () => {
    const { result } = renderHook(() => useHashTab())
    const pushSpy = vi.spyOn(window.history, 'pushState')
    act(() => result.current.navigate('expenses'))
    expect(result.current.tab).toBe('expenses')
    expect(window.location.hash).toBe('#/expenses')
    expect(pushSpy).toHaveBeenCalledTimes(1)
  })

  it('navigate() to the current tab does not push a new entry', () => {
    const { result } = renderHook(() => useHashTab())
    const pushSpy = vi.spyOn(window.history, 'pushState')
    act(() => result.current.navigate('overview'))
    expect(pushSpy).not.toHaveBeenCalled()
    expect(result.current.tab).toBe('overview')
  })

  it('preserves the query string (e.g. ?inv=) when navigating', () => {
    window.history.replaceState(null, '', '/?inv=abc123')
    const { result } = renderHook(() => useHashTab())
    expect(window.location.search).toBe('?inv=abc123')
    act(() => result.current.navigate('goals'))
    expect(window.location.search).toBe('?inv=abc123')
    expect(window.location.hash).toBe('#/goals')
  })

  it('follows hashchange events (manual edits / Back)', () => {
    const { result } = renderHook(() => useHashTab())
    act(() => {
      window.history.replaceState(null, '', '/#/savings')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current.tab).toBe('savings')
  })

  it('follows popstate events (Back/forward)', () => {
    const { result } = renderHook(() => useHashTab())
    act(() => {
      window.history.replaceState(null, '', '/#/members')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.tab).toBe('members')
  })

  it('scrolls to the top when the tab changes', () => {
    const { result } = renderHook(() => useHashTab())
    const scrollSpy = vi.mocked(window.scrollTo)
    scrollSpy.mockClear()
    act(() => result.current.navigate('income'))
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('removes its listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useHashTab())
    unmount()
    const events = removeSpy.mock.calls.map((c) => c[0])
    expect(events).toContain('hashchange')
    expect(events).toContain('popstate')
  })
})
