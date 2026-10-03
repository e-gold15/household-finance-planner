import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { t } from '@/lib/utils'
import type { Expense } from '@/types'
import { ExpenseRow } from './ExpenseRow'
import { dateSeparatorLabel } from './format'

/** Flat list of all expenses, newest first, grouped under day separators. */
export function DateView({ expenses, lang }: { expenses: Expense[]; lang: 'en' | 'he' }) {
  const groups = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1 // no date → bottom
      if (!b.createdAt) return -1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    const out: { key: string; iso?: string; items: Expense[] }[] = []
    for (const e of sorted) {
      const key = e.createdAt ? e.createdAt.slice(0, 10) : '__none__'
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(e)
      else out.push({ key, iso: e.createdAt, items: [e] })
    }
    return out
  }, [expenses])

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const headingId = `exp-day-${g.key}`
        return (
          <section key={g.key} aria-labelledby={headingId} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.iso ? dateSeparatorLabel(g.iso, lang) : t('No date', 'ללא תאריך', lang)}
              </h3>
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>
            <Card className="overflow-hidden">
              <ul className="divide-y">
                {g.items.map((e) => (
                  <ExpenseRow key={e.id} expense={e} lang={lang} showCategory />
                ))}
              </ul>
            </Card>
          </section>
        )
      })}
    </div>
  )
}
