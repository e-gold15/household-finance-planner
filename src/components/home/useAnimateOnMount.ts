import { useEffect, useState } from 'react'

/** Animation length used by Home charts (ms). */
export const CHART_ANIMATION_MS = 700

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * `true` only for the first mount's animation window, then `false` for good —
 * so Recharts does not replay its entry animation on resize / re-render.
 * Always `false` when the user prefers reduced motion.
 */
export function useAnimateOnMount(durationMs: number = CHART_ANIMATION_MS): boolean {
  const [active, setActive] = useState(() => !prefersReducedMotion())
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setActive(false), durationMs + 100)
    return () => window.clearTimeout(id)
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return active
}
