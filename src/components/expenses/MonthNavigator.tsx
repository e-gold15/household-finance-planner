import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DirIcon } from '@/components/ui/dir-icon'
import { t } from '@/lib/utils'

/**
 * Previous / next month stepper. Directional chevrons mirror in RTL (P1-4):
 * "previous" sits at the inline-start and points outward in both directions.
 */
export function MonthNavigator({
  label,
  canGoOlder,
  canGoNewer,
  onOlder,
  onNewer,
  onCurrent,
  lang,
}: {
  label: string
  canGoOlder: boolean
  canGoNewer: boolean
  onOlder: () => void
  onNewer: () => void
  /** Shown while viewing a past month. */
  onCurrent?: () => void
  lang: 'en' | 'he'
}) {
  const prev = t('Previous month', 'החודש הקודם', lang)
  const next = t('Next month', 'החודש הבא', lang)
  return (
    <nav aria-label={t('Month', 'חודש', lang)} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-1 py-1">
      <Button variant="ghost" size="icon" onClick={onOlder} disabled={!canGoOlder} title={prev} aria-label={prev}>
        <DirIcon icon={ChevronLeft} className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2">
        <span className="truncate text-sm font-semibold" aria-live="polite">
          {label}
        </span>
        {onCurrent && (
          <Button variant="link" size="sm" onClick={onCurrent} className="gap-1 px-2 text-xs">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Back to current', 'חזרה לנוכחי', lang)}
          </Button>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={onNewer} disabled={!canGoNewer} title={next} aria-label={next}>
        <DirIcon icon={ChevronRight} className="h-5 w-5" />
      </Button>
    </nav>
  )
}
