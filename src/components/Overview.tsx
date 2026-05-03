import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Target, PiggyBank, AlertTriangle,
  CalendarDays, BarChart2,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
  AreaChart, Area,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { SurplusBanner } from './SurplusBanner'
import { useFinance } from '@/context/FinanceContext'
import { getNetMonthly } from '@/lib/taxEstimation'
import { allocateGoals } from '@/lib/savingsEngine'
import { formatCurrency, t } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

// ─── Chart colour tokens ─────────────────────────────────────────────────────
const CHART_COLORS = [
  'hsl(var(--chart-1))',  'hsl(var(--chart-2))',  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',  'hsl(var(--chart-5))',  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',  'hsl(var(--chart-8))',  'hsl(var(--chart-9))',
  'hsl(var(--chart-10))',
]

// Status-specific fills (semantic, not chart-N slots)
const STATUS_FILL = {
  under:   'hsl(var(--chart-2))',     // green/teal accent
  warning: 'hsl(var(--warning))',     // amber
  over:    'hsl(var(--destructive))', // red
  none:    'hsl(var(--muted))',       // muted grey
  realistic:   'hsl(var(--chart-2))',
  tight:       'hsl(var(--warning))',
  unrealistic: 'hsl(var(--destructive))',
  blocked:     'hsl(var(--muted))',
}

const MONTH_SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_SHORT_HE = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']

// ─── Category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<ExpenseCategory, { en: string; he: string }> = {
  housing:   { en: 'Housing',   he: 'דיור' },
  food:      { en: 'Food',      he: 'מזון' },
  transport: { en: 'Transport', he: 'תחבורה' },
  education: { en: 'Education', he: 'חינוך' },
  leisure:   { en: 'Leisure',   he: 'פנאי' },
  health:    { en: 'Health',    he: 'בריאות' },
  utilities: { en: 'Utilities', he: 'שירותים' },
  clothing:  { en: 'Clothing',  he: 'ביגוד' },
  insurance: { en: 'Insurance', he: 'ביטוח' },
  savings:   { en: 'Savings',   he: 'חיסכון' },
  work:      { en: 'Work',      he: 'עבודה' },
  other:     { en: 'Other',     he: 'אחר' },
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface TrendInfo { pct: number; positiveIsGood: boolean }

function KpiCard({
  icon: Icon, label, value, sub, positive, trend, lang,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  positive?: boolean
  trend?: TrendInfo
  lang: 'en' | 'he'
}) {
  let trendEl: React.ReactNode = null
  if (trend !== undefined) {
    const { pct, positiveIsGood } = trend
    if (Math.abs(pct) < 0.05) {
      // neutral
      trendEl = (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">
          — {t('No change', 'אין שינוי', lang)}
        </span>
      )
    } else {
      const isGood = positiveIsGood ? pct > 0 : pct < 0
      const arrow = pct > 0 ? '▲' : '▼'
      trendEl = (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${isGood ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
          {arrow} {Math.abs(pct).toFixed(1)}%
        </span>
      )
    }
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-primary">{value}</p>
          {sub && (
            <p className={`text-xs ${positive ? 'text-primary' : 'text-destructive'}`}>{sub}</p>
          )}
          {trendEl}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Overview() {
  const { data } = useFinance()
  const lang = data.language
  const monthShort = lang === 'he' ? MONTH_SHORT_HE : MONTH_SHORT_EN

  // ── Base financials ──────────────────────────────────────────────────────
  const totalIncome = useMemo(
    () => data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0),
    [data.members]
  )
  const totalExpenses = useMemo(
    () => data.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0),
    [data.expenses]
  )
  // Accounts whose contribution is already captured by a linked savings expense
  // must not be counted again in FCF — that would double-count the same money.
  const totalContributions = useMemo(() => {
    const linkedIds = new Set(
      data.expenses
        .filter(e => e.linkedAccountId && e.category === 'savings')
        .map(e => e.linkedAccountId!)
    )
    return data.accounts
      .filter(a => !linkedIds.has(a.id) && !a.deductedFromSalary)
      .reduce((s, a) => s + a.monthlyContribution, 0)
  }, [data.accounts, data.expenses])
  const freeCashFlow = totalIncome - totalExpenses - totalContributions
  const totalAssets = useMemo(
    () => data.accounts.reduce((s, a) => s + a.balance, 0),
    [data.accounts]
  )

  // ── 28.5 — MoM trend ────────────────────────────────────────────────────
  const momTrend = useMemo(() => {
    const nonStubs = data.history.filter(h => h.totalIncome > 0)
    if (nonStubs.length < 2) return null
    const prev = nonStubs[nonStubs.length - 2]
    const curr = nonStubs[nonStubs.length - 1]
    const incomePct  = prev.totalIncome   > 0 ? ((curr.totalIncome   - prev.totalIncome)   / prev.totalIncome)   * 100 : null
    const expensesPct = prev.totalExpenses > 0 ? ((curr.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100 : null
    return { incomePct, expensesPct }
  }, [data.history])

  // ── 28.1 — Budget health ─────────────────────────────────────────────────
  const budgetHealth = useMemo(() => {
    const budgets = data.categoryBudgets
    if (Object.keys(budgets).length === 0) return null

    const spentByCategory: Partial<Record<ExpenseCategory, number>> = {}
    data.expenses.forEach(e => {
      const monthly = e.period === 'yearly' ? e.amount / 12 : e.amount
      spentByCategory[e.category] = (spentByCategory[e.category] ?? 0) + monthly
    })

    let under = 0, warning = 0, over = 0, none = 0
    let worstCategory: ExpenseCategory | null = null
    let worstPct = 0

    // Evaluate each budgeted category
    for (const [cat, budget] of Object.entries(budgets) as [ExpenseCategory, number | undefined][]) {
      if (!budget) { none++; continue }
      const spent = spentByCategory[cat] ?? 0
      const pct = (spent / budget) * 100
      if (pct > 100) {
        over++
        if (pct > worstPct) { worstPct = pct; worstCategory = cat }
      } else if (pct >= 80) {
        warning++
      } else {
        under++
      }
    }

    // Spending categories that have no budget
    for (const cat of Object.keys(spentByCategory) as ExpenseCategory[]) {
      if (!(cat in budgets)) none++
    }

    const gaugeData = [
      { name: t('On track', 'בתקציב', lang),       value: under   || 0.001, fill: STATUS_FILL.under },
      { name: t('Warning',  'אזהרה',   lang),       value: warning || 0.001, fill: STATUS_FILL.warning },
      { name: t('Over budget', 'חריגה', lang),      value: over    || 0.001, fill: STATUS_FILL.over },
      { name: t('No budget', 'ללא תקציב', lang),   value: none    || 0.001, fill: STATUS_FILL.none },
    ]

    return { under, warning, over, none, worstCategory, worstPct, gaugeData }
  }, [data.categoryBudgets, data.expenses, lang])

  // ── 28.2 — Upcoming annual bills ─────────────────────────────────────────
  const upcomingBills = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear  = today.getFullYear()
    const sixMonthsLater = new Date(today)
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

    return data.expenses
      .filter(e => e.period === 'yearly' && e.dueMonth != null)
      .map(e => {
        const dm = e.dueMonth!
        const year = dm >= currentMonth ? currentYear : currentYear + 1
        const dueDate = new Date(year, dm - 1, 1)
        const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { expense: e, dueDate, daysUntil, month: dm - 1 }
      })
      .filter(b => b.dueDate <= sixMonthsLater && b.daysUntil >= 0)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [data.expenses])

  const upcomingTotal = useMemo(
    () => upcomingBills.reduce((s, b) => s + b.expense.amount, 0),
    [upcomingBills]
  )

  // ── 28.3 — Goal allocations ──────────────────────────────────────────────
  const goalAllocations = useMemo(() => {
    if (data.goals.length === 0) return []
    return allocateGoals({
      goals: data.goals,
      monthlySurplus: freeCashFlow,
      accounts: data.accounts,
      emergencyBufferMonths: data.emergencyBufferMonths,
      monthlyExpenses: totalExpenses,
    })
  }, [data.goals, freeCashFlow, data.accounts, data.emergencyBufferMonths, totalExpenses])

  const goalStatusCounts = useMemo(() => {
    const counts = { realistic: 0, tight: 0, unrealistic: 0, blocked: 0 }
    goalAllocations.forEach(g => { counts[g.status]++ })
    return counts
  }, [goalAllocations])

  const goalDonutData = useMemo(() => [
    { name: t('Realistic',   'ריאלי',      lang), value: goalStatusCounts.realistic   || 0.001, fill: STATUS_FILL.realistic },
    { name: t('Tight',       'צפוף',        lang), value: goalStatusCounts.tight       || 0.001, fill: STATUS_FILL.tight },
    { name: t('Unrealistic', 'לא ריאלי',   lang), value: goalStatusCounts.unrealistic || 0.001, fill: STATUS_FILL.unrealistic },
    { name: t('Blocked',     'חסום',        lang), value: goalStatusCounts.blocked     || 0.001, fill: STATUS_FILL.blocked },
  ], [goalStatusCounts, lang])

  const nearestGoal = useMemo(() => {
    if (goalAllocations.length === 0) return null
    return [...goalAllocations].sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
  }, [goalAllocations])

  // Top 3 by priority
  const topGoals = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 }
    return [...goalAllocations].sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3)
  }, [goalAllocations])

  // ── 28.4 — Savings projection ────────────────────────────────────────────
  const savingsProjection = useMemo(() => {
    if (data.accounts.length === 0) return null
    const MONTHS = 12
    // Track each account separately for compound accuracy
    const balances = data.accounts.map(a => a.balance)
    const points: { month: number; balance: number; label: string }[] = [
      { month: 0, balance: Math.round(balances.reduce((s, b) => s + b, 0)), label: t('Now', 'עכשיו', lang) },
    ]
    for (let m = 1; m <= MONTHS; m++) {
      data.accounts.forEach((acc, i) => {
        balances[i] = balances[i] * (1 + acc.annualReturnPercent / 100 / 12) + acc.monthlyContribution
      })
      points.push({
        month: m,
        balance: Math.round(balances.reduce((s, b) => s + b, 0)),
        label: `+${m}m`,
      })
    }

    const projected12 = points[MONTHS].balance
    const weightedReturn = totalAssets > 0
      ? data.accounts.reduce((s, a) => s + a.balance * a.annualReturnPercent, 0) / totalAssets
      : 0

    return { points, projected12, weightedReturn }
  }, [data.accounts, lang, totalAssets])

  // ── Existing breakdown charts ────────────────────────────────────────────
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

  // ── Status badge helper ──────────────────────────────────────────────────
  function statusBadgeVariant(status: 'realistic' | 'tight' | 'unrealistic' | 'blocked') {
    if (status === 'realistic')   return 'success' as const
    if (status === 'tight')       return 'warning' as const
    if (status === 'unrealistic') return 'destructive' as const
    return 'secondary' as const
  }
  function statusLabel(status: 'realistic' | 'tight' | 'unrealistic' | 'blocked') {
    if (status === 'realistic')   return t('Realistic',   'ריאלי',    lang)
    if (status === 'tight')       return t('Tight',       'צפוף',     lang)
    if (status === 'unrealistic') return t('Unrealistic', 'לא ריאלי', lang)
    return t('Blocked', 'חסום', lang)
  }

  // ── Upcoming bill countdown badge ────────────────────────────────────────
  function countdownBadge(daysUntil: number) {
    if (daysUntil < 30) return { label: `${t('In', 'בעוד', lang)} ${daysUntil} ${t('days', 'ימים', lang)}`, variant: 'warning' as const }
    if (daysUntil < 90) return { label: `${Math.ceil(daysUntil / 7)} ${t('weeks', 'שבועות', lang)}`, variant: 'outline' as const }
    return { label: `${Math.ceil(daysUntil / 30)} ${t('months', 'חודשים', lang)}`, variant: 'secondary' as const }
  }

  // ── Budget health badge ──────────────────────────────────────────────────
  function budgetHeaderBadge() {
    if (!budgetHealth) return null
    if (budgetHealth.over > 0) return <Badge variant="destructive">{budgetHealth.over} {t('over budget', 'חריגות', lang)}</Badge>
    if (budgetHealth.warning > 0) return <Badge variant="warning">{budgetHealth.warning} {t('warnings', 'אזהרות', lang)}</Badge>
    return <Badge variant="success">{t('All on track', 'הכל בתקציב', lang)}</Badge>
  }

  // ── Goal header badge ────────────────────────────────────────────────────
  function goalHeaderBadge() {
    if (goalStatusCounts.realistic > 0) return <Badge variant="success">{goalStatusCounts.realistic} {t('on track', 'בתקציב', lang)}</Badge>
    if (goalStatusCounts.tight > 0)     return <Badge variant="warning">{goalStatusCounts.tight} {t('tight', 'צפופים', lang)}</Badge>
    if (goalStatusCounts.unrealistic > 0) return <Badge variant="destructive">{goalStatusCounts.unrealistic} {t('at risk', 'בסיכון', lang)}</Badge>
    return <Badge variant="secondary">{t('Blocked', 'חסום', lang)}</Badge>
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── 1. KPI row with MoM trend arrows (28.5) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label={t('Monthly Income', 'הכנסה חודשית', lang)}
          value={formatCurrency(totalIncome, data.currency, data.locale)}
          trend={momTrend?.incomePct != null ? { pct: momTrend.incomePct, positiveIsGood: true } : undefined}
          lang={lang}
        />
        <KpiCard
          icon={TrendingDown}
          label={t('Monthly Expenses', 'הוצאות חודשיות', lang)}
          value={formatCurrency(totalExpenses, data.currency, data.locale)}
          trend={momTrend?.expensesPct != null ? { pct: momTrend.expensesPct, positiveIsGood: false } : undefined}
          lang={lang}
        />
        <KpiCard
          icon={Wallet}
          label={t('Free Cash Flow', 'תזרים חופשי', lang)}
          value={formatCurrency(freeCashFlow, data.currency, data.locale)}
          positive={freeCashFlow >= 0}
          sub={freeCashFlow >= 0 ? t('surplus', 'עודף', lang) : t('deficit', 'גירעון', lang)}
          lang={lang}
        />
        <KpiCard
          icon={PiggyBank}
          label={t('Total Assets', 'סך נכסים', lang)}
          value={formatCurrency(totalAssets, data.currency, data.locale)}
          lang={lang}
        />
      </div>

      {/* ── 2. End-of-month surplus action banner (v3.0) ── */}
      <SurplusBanner />

      {/* ── 3. Deficit warning banner — suppressed when budget health gauge already shows 'over' ── */}
      {freeCashFlow < 0 && !(budgetHealth && budgetHealth.over > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('Your expenses exceed income. Review your budget.', 'ההוצאות עולות על ההכנסות. בדוק את התקציב.', lang)}
        </div>
      )}

      {/* ── 3. Budget Health Gauge (28.1) ── */}
      {budgetHealth && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                {t('Budget Health', 'בריאות תקציב', lang)}
              </CardTitle>
              {budgetHeaderBadge()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={budgetHealth.gaugeData}
                      dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius="65%" outerRadius="90%"
                      startAngle={90} endAngle={-270}
                      strokeWidth={0}
                    >
                      {budgetHealth.gaugeData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Math.round(Number(value))} ${t('cat.', 'קטג.', lang)}`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 text-sm">
                {[
                  { label: t('On track', 'בתקציב', lang),         count: budgetHealth.under,   fill: STATUS_FILL.under },
                  { label: t('Warning (>80%)', 'אזהרה (>80%)', lang), count: budgetHealth.warning, fill: STATUS_FILL.warning },
                  { label: t('Over budget', 'חריגה', lang),       count: budgetHealth.over,    fill: STATUS_FILL.over },
                  { label: t('No budget set', 'ללא תקציב', lang), count: budgetHealth.none,    fill: STATUS_FILL.none },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.fill }} />
                      <span className="text-muted-foreground">{row.label}</span>
                    </div>
                    <span className="font-semibold">{row.count} <span className="font-normal text-muted-foreground text-xs">{t('cat.', 'קטג.', lang)}</span></span>
                  </div>
                ))}
                {budgetHealth.worstCategory && (
                  <div className="border-t pt-2 mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('Worst offender', 'החריגה הגדולה', lang)}</span>
                    <Badge variant="destructive">
                      {CATEGORY_LABELS[budgetHealth.worstCategory]?.[lang]} · {Math.round(budgetHealth.worstPct)}%
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4. Upcoming Annual Bills (28.2) ── */}
      {upcomingBills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('Upcoming Bills', 'חשבונות קרובים', lang)}
              </CardTitle>
              <Badge variant="outline">{t('Next 6 months', '6 חודשים הבאים', lang)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {upcomingBills.map(b => {
              const cb = countdownBadge(b.daysUntil)
              return (
                <div key={b.expense.id} className="flex items-center justify-between py-2.5 border-b last:border-b-0">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{monthShort[b.month]}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium px-3">{b.expense.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={cb.variant}>{cb.label}</Badge>
                    <span className="text-sm font-semibold text-destructive">
                      {formatCurrency(b.expense.amount, data.currency, data.locale)}
                    </span>
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground pt-2 text-end">
              {t('Total in next 6 months:', 'סה"כ ב-6 חודשים הבאים:', lang)}{' '}
              <strong className="text-foreground">{formatCurrency(upcomingTotal, data.currency, data.locale)}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── 5. Existing breakdown charts ── */}
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
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
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
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 6. Goal Status Donut 2-col grid (28.3) ── */}
      {goalAllocations.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left — donut + legend */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {t('Goals Overview', 'סקירת יעדים', lang)}
                </CardTitle>
                {goalHeaderBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-[130px] h-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={goalDonutData}
                        dataKey="value"
                        cx="50%" cy="50%"
                        innerRadius="65%" outerRadius="90%"
                        startAngle={90} endAngle={-270}
                        strokeWidth={0}
                      >
                        {goalDonutData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${Math.round(Number(value))} ${t('goals', 'יעדים', lang)}`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  {[
                    { label: t('Realistic',   'ריאלי',    lang), count: goalStatusCounts.realistic,   fill: STATUS_FILL.realistic },
                    { label: t('Tight',       'צפוף',     lang), count: goalStatusCounts.tight,       fill: STATUS_FILL.tight },
                    { label: t('Unrealistic', 'לא ריאלי', lang), count: goalStatusCounts.unrealistic, fill: STATUS_FILL.unrealistic },
                    { label: t('Blocked',     'חסום',     lang), count: goalStatusCounts.blocked,     fill: STATUS_FILL.blocked },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.fill }} />
                        <span className="text-muted-foreground">{row.label}</span>
                      </div>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                  ))}
                  {nearestGoal && (
                    <div className="border-t pt-2 mt-1 text-xs text-muted-foreground">
                      <span>{t('Nearest deadline', 'מועד קרוב', lang)}: </span>
                      <strong className="text-foreground">{nearestGoal.name}</strong>
                      {' '}
                      <Badge variant={statusBadgeVariant(nearestGoal.status)} className="text-[10px] px-1.5">
                        {statusLabel(nearestGoal.status)}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right — top priority goals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('Top Priority Goals', 'יעדים בעדיפות גבוהה', lang)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topGoals.map(goal => {
                const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)
                const barClass =
                  goal.status === 'realistic'   ? 'bg-primary' :
                  goal.status === 'tight'        ? 'bg-warning' :
                  goal.status === 'unrealistic'  ? 'bg-destructive' : 'bg-muted-foreground'
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium truncate me-2">{goal.name}</span>
                      <Badge variant={statusBadgeVariant(goal.status)} className="shrink-0">
                        {statusLabel(goal.status)}
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pct.toFixed(0)}% · {formatCurrency(goal.currentAmount, data.currency, data.locale)} / {formatCurrency(goal.targetAmount, data.currency, data.locale)}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 7. Savings Growth Projection (28.4) ── */}
      {savingsProjection && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('12-Month Savings Forecast', 'תחזית חיסכון 12 חודשים', lang)}
              </CardTitle>
              <Badge variant={savingsProjection.projected12 - totalAssets > 0 ? 'success' : 'secondary'}>
                {savingsProjection.projected12 - totalAssets > 0 ? '+' : ''}{formatCurrency(savingsProjection.projected12 - totalAssets, data.currency, data.locale)}{' '}
                {t('projected', 'צפוי', lang)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* 3-col summary */}
            <div className="grid grid-cols-3 divide-x rtl:divide-x-reverse mb-4 text-center">
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">{t('Today', 'היום', lang)}</p>
                <p className="text-lg font-bold">{formatCurrency(totalAssets, data.currency, data.locale)}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">{t('Monthly adding', 'הוספה חודשית', lang)}</p>
                <p className="text-lg font-bold text-primary">+{formatCurrency(totalContributions, data.currency, data.locale)}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">{t('In 12 months', 'בעוד 12 חודשים', lang)}</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(savingsProjection.projected12, data.currency, data.locale)}
                </p>
              </div>
            </div>
            {/* Area chart */}
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={savingsProjection.points} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
                <Tooltip formatter={(v) => formatCurrency(Number(v), data.currency, data.locale)} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#savingsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('Assumes avg', 'מניח תשואה ממוצעת', lang)}{' '}
              {savingsProjection.weightedReturn.toFixed(1)}%{' '}
              {t('annual return · contributions included', 'תשואה שנתית · כולל הפקדות', lang)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
