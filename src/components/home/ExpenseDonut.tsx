import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { PieChart as PieIcon, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { EmptyState } from '@/components/ui/empty-state'
import { ChartTooltip } from '@/components/ui/chart-tooltip'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { formatCurrency, t } from '@/lib/utils'
import type { DonutData, DonutSlice } from '@/lib/insights'
import type { Currency, Locale } from '@/types'
import { CHART_ANIMATION_MS, useAnimateOnMount } from './useAnimateOnMount'

const SIZE = 176

interface ExpenseDonutProps {
  donut: DonutData
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onAddExpense: () => void
}

function sliceLabel(s: DonutSlice, lang: 'en' | 'he'): string {
  if (s.grouped) return t(`Other (${s.categories.length})`, `אחר (${s.categories.length})`, lang)
  const c = EXPENSE_CATEGORIES.find((x) => x.value === s.key)
  return c ? c[lang] : s.key
}

/** Monthly expense breakdown: donut with centre total + legend list (no outside labels). */
export function ExpenseDonut({ donut, currency, locale, lang, onAddExpense }: ExpenseDonutProps) {
  const animate = useAnimateOnMount()
  const chartData = donut.slices.map((s) => ({ name: sliceLabel(s, lang), value: s.value, fill: s.color }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieIcon className="h-4 w-4 text-primary-strong" aria-hidden="true" />
          {t('Where the money goes', 'לאן הולך הכסף', lang)}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('Monthly, yearly bills ÷ 12', 'חודשי, חשבונות שנתיים ÷ 12', lang)}</p>
      </CardHeader>
      <CardContent>
        {donut.slices.length === 0 ? (
          <EmptyState
            compact
            icon={ShoppingCart}
            title={t('No expenses yet', 'אין הוצאות עדיין', lang)}
            actionLabel={t('Add expense', 'הוסף הוצאה', lang)}
            onAction={onAddExpense}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
              <PieChart width={SIZE} height={SIZE}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={chartData.length > 1 ? 1.5 : 0}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  isAnimationActive={animate}
                  animationDuration={CHART_ANIMATION_MS}
                >
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltip formatValue={(v) => formatCurrency(v, currency, locale)} hideLabel />}
                />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-muted-foreground">{t('Total / mo', 'סה"כ לחודש', lang)}</span>
                <Money value={donut.total} currency={currency} locale={locale} className="text-base font-bold" />
              </div>
            </div>

            <ul className="w-full min-w-0 flex-1 space-y-1.5" aria-label={t('Expenses by category', 'הוצאות לפי קטגוריה', lang)}>
              {donut.slices.map((s) => (
                <li key={s.grouped ? 'other-group' : s.key} className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{sliceLabel(s, lang)}</span>
                  <Money value={s.value} currency={currency} locale={locale} className="font-medium" />
                  <bdi dir="ltr" className="w-11 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                    {Math.round(s.pct)}%
                  </bdi>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
