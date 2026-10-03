import { cn, t } from '@/lib/utils'
import type { PaceStatus } from '@/types'

interface PaceBarProps {
  /** variableSpent ÷ spendable × 100 (uncapped). */
  spentPct: number
  /** Share of the month elapsed before today, 0–100. */
  elapsedPct: number
  status: PaceStatus
  lang: 'en' | 'he'
}

const FILL_CLASS: Record<PaceStatus, string> = {
  'on-track': 'bg-primary',
  ahead: 'bg-warning',
  over: 'bg-danger',
  'no-income': 'bg-muted-foreground',
}

/**
 * Spending pace: fill = share of spendable money already spent, marker = today.
 * Fills from the inline-start edge, so it mirrors in RTL.
 */
export function PaceBar({ spentPct, elapsedPct, status, lang }: PaceBarProps) {
  const fill = status === 'over' ? 100 : Math.min(100, Math.max(0, spentPct))
  const marker = Math.min(100, Math.max(0, elapsedPct))
  const spentShown = Math.round(Math.max(0, spentPct))
  const monthLeft = Math.round(100 - elapsedPct)

  const sentence = t(
    `You've spent ${spentShown}%, ${monthLeft}% of the month left`,
    `הוצאת ${spentShown}%, נותרו ${monthLeft}% מהחודש`,
    lang
  )

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={sentence}
        aria-label={t('Spending pace', 'קצב הוצאות', lang)}
        className="relative h-3 w-full rounded-full bg-muted"
      >
        <div
          className={cn(
            'absolute inset-y-0 start-0 rounded-full transition-[width] duration-slow ease-standard motion-reduce:transition-none',
            FILL_CLASS[status]
          )}
          style={{ width: `${fill}%` }}
        />
        {/* Today marker */}
        <div
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground rtl:translate-x-1/2"
          style={{ insetInlineStart: `${marker}%` }}
        />
      </div>
      <div className="relative h-4 text-xs text-muted-foreground" aria-hidden="true">
        <span
          className="absolute top-0 whitespace-nowrap"
          style={
            marker > 85
              ? { insetInlineEnd: 0 }
              : marker < 15
                ? { insetInlineStart: 0 }
                : { insetInlineStart: `${marker}%`, transform: lang === 'he' ? 'translateX(50%)' : 'translateX(-50%)' }
          }
        >
          {t('Today', 'היום', lang)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{sentence}</p>
    </div>
  )
}
