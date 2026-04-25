import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Target, PiggyBank, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useFinance } from '@/context/FinanceContext'
import { getNetMonthly } from '@/lib/taxEstimation'
import { formatCurrency, t } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

// Use CSS custom properties so chart colours respond to dark mode automatically.
// Values are defined in src/index.css under :root and .dark selectors.
const CHART_COLORS = [
  'hsl(var(--chart-1))',  'hsl(var(--chart-2))',  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',  'hsl(var(--chart-5))',  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',  'hsl(var(--chart-8))',  'hsl(var(--chart-9))',
  'hsl(var(--chart-10))',
]

function KpiCard({
  icon: Icon, label, value, sub, positive,
}: { icon: React.ElementType; label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          {sub && (
            <p className={`text-xs ${positive ? 'text-primary' : 'text-destructive'}`}>{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const CATEGORY_LABELS: Record<ExpenseCategory, { en: string; he: string }> = {
  housing: { en: 'Housing', he: 'דיור' },
  food: { en: 'Food', he: 'מזון' },
  transport: { en: 'Transport', he: 'תחבורה' },
  education: { en: 'Education', he: 'חינוך' },
  leisure: { en: 'Leisure', he: 'פנאי' },
  health: { en: 'Health', he: 'בריאות' },
  utilities: { en: 'Utilities', he: 'שירותים' },
  clothing: { en: 'Clothing', he: 'ביגוד' },
  insurance: { en: 'Insurance', he: 'ביטוח' },
  savings: { en: 'Savings', he: 'חיסכון' },
  other: { en: 'Other', he: 'אחר' },
}

export function Overview() {
  const { data } = useFinance()
  const lang = data.language

  const totalIncome = useMemo(
    () => data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0),
    [data.members]
  )
  const totalExpenses = useMemo(
    () => data.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0),
    [data.expenses]
  )
  const totalContributions = useMemo(
    () => data.accounts.reduce((s, a) => s + a.monthlyContribution, 0),
    [data.accounts]
  )
  const freeCashFlow = totalIncome - totalExpenses - totalContributions
  const totalAssets = useMemo(
    () => data.accounts.reduce((s, a) => s + a.balance, 0),
    [data.accounts]
  )

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    data.expenses.forEach((e) => {
      const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
      map[e.category] = (map[e.category] ?? 0) + monthly
    })
    return Object.entries(map).map(([cat, val]) => ({
      name: CATEGORY_LABELS[cat as ExpenseCategory]?.[lang] ?? cat,
      value: Math.round(val),
    }))
  }, [data.expenses, lang])

  const savingsBreakdown = useMemo(() => [
    {
      name: t('Liquid', 'נזיל', lang),
      value: data.accounts
        .filter((a) => a.liquidity === 'immediate' || a.liquidity === 'short')
        .reduce((s, a) => s + a.balance, 0),
    },
    {
      name: t('Locked', 'נעול', lang),
      value: data.accounts
        .filter((a) => a.liquidity === 'medium' || a.liquidity === 'locked')
        .reduce((s, a) => s + a.balance, 0),
    },
  ], [data.accounts, lang])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label={t('Monthly Income', 'הכנסה חודשית', lang)}
          value={formatCurrency(totalIncome, data.currency, data.locale)}
        />
        <KpiCard
          icon={TrendingDown}
          label={t('Monthly Expenses', 'הוצאות חודשיות', lang)}
          value={formatCurrency(totalExpenses, data.currency, data.locale)}
        />
        <KpiCard
          icon={Wallet}
          label={t('Free Cash Flow', 'תזרים חופשי', lang)}
          value={formatCurrency(freeCashFlow, data.currency, data.locale)}
          positive={freeCashFlow >= 0}
          sub={freeCashFlow >= 0 ? t('surplus', 'עודף', lang) : t('deficit', 'גירעון', lang)}
        />
        <KpiCard
          icon={PiggyBank}
          label={t('Total Assets', 'סך נכסים', lang)}
          value={formatCurrency(totalAssets, data.currency, data.locale)}
        />
      </div>

      {freeCashFlow < 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('Your expenses exceed income. Review your budget.', 'ההוצאות עולות על ההכנסות. בדוק את התקציב.', lang)}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('Expense Breakdown', 'פירוט הוצאות', lang)}</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('No expenses yet', 'אין הוצאות עדיין', lang)}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v), data.currency, data.locale)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('Savings by Liquidity', 'חיסכון לפי נזילות', lang)}</CardTitle>
          </CardHeader>
          <CardContent>
            {totalAssets === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('No accounts yet', 'אין חשבונות עדיין', lang)}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={savingsBreakdown}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), data.currency, data.locale)} />
                  <Bar dataKey="value" fill="hsl(162,63%,41%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {data.goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {t('Top Goals', 'יעדים עיקריים', lang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.goals.slice(0, 3).map((goal) => {
              const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.name}</span>
                    <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
