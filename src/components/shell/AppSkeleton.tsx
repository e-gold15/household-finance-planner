import { cn, t } from '@/lib/utils'

/** Plain pulse bar — intentionally local (no dependency on the new Skeleton primitive). */
function Bar({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/**
 * Loading placeholder shown while the household's shared data is fetched from
 * the cloud (same `isLoading` condition as the old full-screen spinner).
 * Mimics the Home layout: hero card, KPI grid, two list cards.
 */
export function AppSkeleton({ lang }: { lang: 'en' | 'he' }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t('Loading household data…', 'טוען נתוני משק הבית…', lang)}</span>

      {/* Hero card */}
      <div aria-hidden="true" className="rounded-xl border bg-card p-6 space-y-4">
        <Bar className="h-4 w-32" />
        <Bar className="h-10 w-48" />
        <Bar className="h-3 w-full rounded-full" />
        <div className="flex gap-3">
          <Bar className="h-3 w-24" />
          <Bar className="h-3 w-20" />
        </div>
      </div>

      {/* KPI grid */}
      <div aria-hidden="true" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Bar className="h-3 w-16" />
            <Bar className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* List cards */}
      {[0, 1].map((card) => (
        <div key={card} aria-hidden="true" className="rounded-xl border bg-card p-6 space-y-4">
          <Bar className="h-5 w-40" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Bar className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3 w-3/5" />
                <Bar className="h-3 w-2/5" />
              </div>
              <Bar className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
