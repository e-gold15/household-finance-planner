import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ChartTooltip } from '../ui/chart-tooltip'
import { formatCurrency, t } from '@/lib/utils'
import type { Currency, Locale, MonthSnapshot } from '@/types'
import { snapshotMonthLabel, trendChartSnapshots } from './historyUtils'

interface TrendPoint {
  id: string
  short: string
  long: string
  totalIncome: number
  totalExpenses: number
  freeCashFlow: number
}

/** Income / Expenses / Free-cash lines over time. Short month ticks so nothing clips at 375px. */
export function TrendChart({ history, currency, locale, lang }: {
  history: ReadonlyArray<MonthSnapshot>
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
}) {
  const points: TrendPoint[] = useMemo(
    () =>
      trendChartSnapshots(history).map((s) => ({
        id: s.id,
        short: snapshotMonthLabel(s, lang, 'short'),
        long: snapshotMonthLabel(s, lang, 'long'),
        totalIncome: s.totalIncome,
        totalExpenses: s.totalExpenses,
        freeCashFlow: s.freeCashFlow,
      })),
    [history, lang]
  )
  const longById = useMemo(() => new Map(points.map((p) => [p.short, p.long])), [points])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('Monthly Trend', 'מגמה חודשית', lang)}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {/* Charts stay LTR (time runs left → right) in both languages. */}
        <div dir="ltr" className="w-full">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
                minTickGap={16}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                width={40}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatValue={(v) => formatCurrency(v, currency, locale)}
                    formatLabel={(label) => longById.get(String(label)) ?? label}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="totalIncome" name={t('Income', 'הכנסה', lang)} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalExpenses" name={t('Expenses', 'הוצאות', lang)} stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="freeCashFlow" name={t('Free Cash', 'תזרים חופשי', lang)} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
