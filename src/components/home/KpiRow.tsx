import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Money } from '@/components/ui/money'
import { StatusChip } from '@/components/ui/status-chip'
import { t } from '@/lib/utils'
import type { Currency, Locale } from '@/types'

interface Trend {
  pct: number
  positiveIsGood: boolean
}

interface KpiItem {
  key: string
  label: string
  value: number
  trend?: Trend
  onClick: () => void
  goLabel: string
}

interface KpiRowProps {
  income: number
  expenses: number
  assets: number
  incomeTrend?: Trend
  expensesTrend?: Trend
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onIncome: () => void
  onExpenses: () => void
  onAssets: () => void
}

function TrendChip({ trend, lang }: { trend: Trend; lang: 'en' | 'he' }) {
  if (Math.abs(trend.pct) < 0.05) {
    return <StatusChip tone="neutral" icon={Minus} label={t('No change', 'ללא שינוי', lang)} />
  }
  const up = trend.pct > 0
  const good = trend.positiveIsGood ? up : !up
  return (
    <StatusChip
      tone={good ? 'success' : 'danger'}
      icon={up ? ArrowUp : ArrowDown}
      label={<bdi dir="ltr" className="tabular-nums">{Math.abs(trend.pct).toFixed(1)}%</bdi>}
      aria-label={
        up
          ? t(`Up ${Math.abs(trend.pct).toFixed(1)}% vs last month`, `עלייה של ${Math.abs(trend.pct).toFixed(1)}% מהחודש הקודם`, lang)
          : t(`Down ${Math.abs(trend.pct).toFixed(1)}% vs last month`, `ירידה של ${Math.abs(trend.pct).toFixed(1)}% מהחודש הקודם`, lang)
      }
    />
  )
}

/** Compact 3-up KPI row. Values are neutral; colour lives only in the MoM chip. */
export function KpiRow(props: KpiRowProps) {
  const { currency, locale, lang } = props
  const items: KpiItem[] = [
    {
      key: 'income',
      label: t('Income', 'הכנסות', lang),
      value: props.income,
      trend: props.incomeTrend,
      onClick: props.onIncome,
      goLabel: t('Open Income', 'פתח הכנסות', lang),
    },
    {
      key: 'expenses',
      label: t('Expenses', 'הוצאות', lang),
      value: props.expenses,
      trend: props.expensesTrend,
      onClick: props.onExpenses,
      goLabel: t('Open Expenses', 'פתח הוצאות', lang),
    },
    {
      key: 'assets',
      label: t('Assets', 'נכסים', lang),
      value: props.assets,
      onClick: props.onAssets,
      goLabel: t('Open Savings', 'פתח חסכונות', lang),
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.onClick}
          title={it.goLabel}
          className="flex min-h-[44px] min-w-0 flex-col items-start gap-1 rounded-lg border bg-card p-3 text-start shadow-sm transition-colors duration-fast hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-xs text-muted-foreground">{it.label}</span>
          <Money
            value={it.value}
            currency={currency}
            locale={locale}
            className="max-w-full overflow-hidden text-ellipsis text-base font-semibold sm:text-lg"
          />
          {it.trend && <TrendChip trend={it.trend} lang={lang} />}
        </button>
      ))}
    </div>
  )
}
