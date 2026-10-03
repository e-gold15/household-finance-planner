import { Lock, Waves } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'

/** Monthly budget total (neutral — P1-8) with fixed / variable split. */
export function ExpensesSummary({
  total,
  fixedTotal,
  variableTotal,
  lang,
}: {
  total: number
  fixedTotal: number
  variableTotal: number
  lang: 'en' | 'he'
}) {
  const { data } = useFinance()
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-muted-foreground">{t('Monthly budget', 'תקציב חודשי', lang)}</span>
        <Money value={total} currency={data.currency} locale={data.locale} size="lg" className="text-2xl font-bold" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('Fixed', 'קבוע', lang)} <Money value={fixedTotal} currency={data.currency} locale={data.locale} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-subtle px-2.5 py-1 text-xs font-semibold text-warning-strong">
          <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('Variable', 'משתנה', lang)} <Money value={variableTotal} currency={data.currency} locale={data.locale} />
        </span>
      </div>
    </Card>
  )
}
