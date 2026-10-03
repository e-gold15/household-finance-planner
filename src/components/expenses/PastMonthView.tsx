import { useState } from 'react'
import { CalendarCheck, ExternalLink, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ListRow } from '@/components/ui/list-row'
import { Money } from '@/components/ui/money'
import { useFinance } from '@/context/FinanceContext'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { t } from '@/lib/utils'
import type { ExpenseCategory, MonthSnapshot } from '@/types'
import { CategoryGroup } from './CategoryGroup'

/** Read-only view of a past month's actuals inside the Expenses tab. Editing lives in History. */
export function PastMonthView({
  snapshot,
  lang,
  onGoToHistory,
}: {
  snapshot: MonthSnapshot
  lang: 'en' | 'he'
  onGoToHistory?: () => void
}) {
  const { data } = useFinance()
  const [expanded, setExpanded] = useState<Set<ExpenseCategory>>(new Set())
  const toggle = (cat: ExpenseCategory) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  const items = snapshot.historicalExpenses ?? []
  const hasActuals = !!snapshot.categoryActuals && Object.keys(snapshot.categoryActuals).length > 0
  const hasItems = items.length > 0
  const categoriesWithData = EXPENSE_CATEGORIES.filter(
    (cat) => (snapshot.categoryActuals?.[cat.value] ?? 0) > 0 || items.some((i) => i.category === cat.value)
  )
  const money = (v: number) => <Money value={v} currency={data.currency} locale={data.locale} />

  return (
    <div className="space-y-4">
      {/* Read-only notice */}
      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-subtle px-4 py-3 text-sm text-info-strong">
        <Receipt className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p>
            <span className="font-medium">
              {t(`Viewing actuals for ${snapshot.label}`, `צפייה בנתוני ${snapshot.label}`, lang)}
            </span>
            <span className="ms-1 opacity-80">· {t('Read only', 'קריאה בלבד', lang)}</span>
          </p>
          {onGoToHistory && (
            <Button variant="link" size="sm" onClick={onGoToHistory} className="-ms-3 gap-1 text-xs">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Edit in History tab', 'עריכה בלשונית היסטוריה', lang)}
            </Button>
          )}
        </div>
      </div>

      {/* KPI banner — neutral totals (P1-8); FCF keeps sign colour + sign */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm font-medium text-muted-foreground">{t('Actual spending', 'הוצאות בפועל', lang)}</span>
          <Money value={snapshot.totalExpenses} currency={data.currency} locale={data.locale} className="text-2xl font-bold" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-xs text-muted-foreground">{t('Income', 'הכנסה', lang)}</p>
            <p className="text-sm font-bold">{money(snapshot.totalIncome)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-xs text-muted-foreground">{t('Savings', 'חיסכון', lang)}</p>
            <p className="text-sm font-bold">{money(snapshot.totalSavings)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-xs text-muted-foreground">{t('FCF', 'תזרים חופשי', lang)}</p>
            <p className="text-sm font-bold">
              <Money value={snapshot.freeCashFlow} currency={data.currency} locale={data.locale} tone="auto" />
            </p>
          </div>
        </div>
      </Card>

      {!hasActuals && !hasItems ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title={t('No actuals recorded for this month', 'לא נרשמו נתונים לחודש זה', lang)}
            actionLabel={onGoToHistory ? t('Record expenses in History', 'רישום הוצאות בהיסטוריה', lang) : undefined}
            onAction={onGoToHistory}
            actionIcon={ExternalLink}
          />
        </Card>
      ) : (
        categoriesWithData.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.value)
          const label = t(cat.en, cat.he, lang)
          return (
            <CategoryGroup
              key={cat.value}
              category={cat.value}
              label={label}
              total={snapshot.categoryActuals?.[cat.value] ?? 0}
              itemCount={catItems.length}
              budget={data.categoryBudgets[cat.value]}
              expanded={expanded.has(cat.value)}
              onToggle={catItems.length > 0 ? () => toggle(cat.value) : undefined}
              lang={lang}
            >
              {catItems.length > 0 && (
                <ul className="divide-y">
                  {catItems.map((item) => (
                    <ListRow
                      key={item.id}
                      as="li"
                      className="px-2"
                      title={<bdi>{item.name}</bdi>}
                      meta={item.note ? <bdi className="truncate">{item.note}</bdi> : undefined}
                      trailing={money(item.amount)}
                    />
                  ))}
                </ul>
              )}
            </CategoryGroup>
          )
        })
      )}
    </div>
  )
}
