import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query. Returns `false` when `matchMedia` is
 * unavailable (SSR / jsdom), which means "mobile-first" defaults apply.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )

  const getSnapshot = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Tailwind `md` breakpoint (≥768px) — desktop shell (top nav, no bottom nav). */
export const DESKTOP_QUERY = '(min-width: 768px)'

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
