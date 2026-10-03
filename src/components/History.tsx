import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, History as HistoryIcon } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { useFinance } from '@/context/FinanceContext'
import { cn, t } from '@/lib/utils'
import { SnapshotRow } from './history/SnapshotRow'
import { TrendChart } from './history/TrendChart'
import { HISTORY_VISIBLE_COUNT, isCurrentMonthSnapshot, sortSnapshotsNewestFirst, splitVisibleSnapshots } from './history/historyUtils'

export function History() {
  const { data, snapshotMonth, setData } = useFinance()
  const lang = data.language
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  // UI-only state: per-row expand overrides (the newest row defaults to open) and "Show older".
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState(false)

  // Auto-hide the warning after 4 seconds
  useEffect(() => {
    if (!showDuplicateWarning) return
    const timer = setTimeout(() => setShowDuplicateWarning(false), 4000)
    return () => clearTimeout(timer)
  }, [showDuplicateWarning])

  const sorted = useMemo(() => sortSnapshotsNewestFirst(data.history), [data.history])
  const newestId = sorted[0]?.id
  const { visible, hiddenCount } = splitVisibleSnapshots(sorted, showAll)

  const isExpanded = (id: string) => expandOverrides[id] ?? id === newestId
  const toggle = (id: string) => setExpandOverrides((prev) => ({ ...prev, [id]: !isExpanded(id) }))

  const deleteSnapshot = (id: string) => {
    setShowDuplicateWarning(false)
    setData((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }))
  }

  const handleSnapshot = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const alreadyExists = data.history.some((h) => {
      const d = new Date(h.date)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    })
    setShowDuplicateWarning(alreadyExists)
    snapshotMonth()
  }

  const canSnapshot = !data.history.some((s) => s.autoSnapshot && isCurrentMonthSnapshot(s))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <bdi className="num tabular-nums">{data.history.length}</bdi> {t('snapshots recorded', 'תמונות מצב שנרשמו', lang)}
        </p>
        {data.history.length > 0 && canSnapshot && (
          <Button size="sm" onClick={handleSnapshot}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t('Snapshot This Month', 'צלם חודש זה', lang)}
          </Button>
        )}
      </div>
      {showDuplicateWarning && (
        <div role="status" className="flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-strong">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('A snapshot for this month already exists.', 'קיים כבר תמונת מצב לחודש זה.', lang)}
        </div>
      )}

      {data.history.length === 0 ? (
        <Card>
          <EmptyState
            icon={HistoryIcon}
            title={t('No history yet', 'אין היסטוריה עדיין', lang)}
            description={t('Snapshot this month to start tracking trends.', 'צלם תמונת מצב לחודש זה כדי להתחיל לעקוב אחר מגמות.', lang)}
            actionLabel={t('Snapshot this month', 'צלם חודש זה', lang)}
            actionIcon={Camera}
            onAction={handleSnapshot}
          />
        </Card>
      ) : (
        <>
          <TrendChart history={data.history} currency={data.currency} locale={data.locale} lang={lang} />

          <div className="space-y-2">
            {visible.map((snap) => (
              <SnapshotRow
                key={snap.id}
                snap={snap}
                expanded={isExpanded(snap.id)}
                onToggle={() => toggle(snap.id)}
                onDelete={deleteSnapshot}
                lang={lang}
              />
            ))}
          </div>

          {sorted.length > HISTORY_VISIBLE_COUNT && (
            <Button variant="outline" className="w-full" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-fast', showAll && 'rotate-180')} aria-hidden="true" />
              {showAll
                ? t('Show fewer', 'הצג פחות', lang)
                : t(`Show older (${hiddenCount})`, `הצג ישנים יותר (${hiddenCount})`, lang)}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
