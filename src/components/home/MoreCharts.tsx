import { useId } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, AreaChart, Area,
} from 'recharts'
import {
  AlertTriangle, BarChart2, CheckCircle2, ChevronDown, Lock, Minus, Target, TrendingUp, XCircle, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { Progress } from '@/components/ui/progress'
import { StatusChip, type StatusTone } from '@/components/ui/status-chip'
import { ChartTooltip } from '@/components/ui/chart-tooltip'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { cn, formatCurrency, t } from '@/lib/utils'
import type { BudgetHealth, SavingsProjection } from '@/lib/insights'
import type { Currency, GoalAllocation, GoalStatus, Locale, SavingsAccount } from '@/types'
import { CHART_ANIMATION_MS, useAnimateOnMount } from './useAnimateOnMount'

type Lang = 'en' | 'he'
const DONUT_SIZE = 132

// ─── Collapsible wrapper ─────────────────────────────────────────────────────

interface MoreChartsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lang: Lang
  children: React.ReactNode
}

/** "More charts" — collapsed < 768px, expanded ≥ 768px by default (UI state only). */
export function MoreCharts({ open, onOpenChange, lang, children }: MoreChartsProps) {
  const contentId = useId()
  return (
    <section aria-label={t('More charts', 'גרפים נוספים', lang)} className="space-y-4">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-start text-sm font-semibold shadow-sm transition-colors duration-fast hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <BarChart2 className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block">{t('More charts', 'גרפים נוספים', lang)}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {t('Budgets, goals, forecast, briefing', 'תקציבים, יעדים, תחזית, סיכום', lang)}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-base motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={contentId} className="grid gap-4 md:grid-cols-2">
          {children}
        </div>
      )}
    </section>
  )
}

// ─── Small status donut (fixed size, zero slices dropped, centre label) ──────

interface StatusSlice {
  key: string
  label: string
  count: number
  fill: string
  icon: LucideIcon
  iconClass: string
}

function StatusDonut({
  slices, centerValue, centerLabel, unit, lang,
}: { slices: StatusSlice[]; centerValue: string; centerLabel: string; unit: string; lang: Lang }) {
  const animate = useAnimateOnMount()
  const data = slices.filter((s) => s.count > 0).map((s) => ({ name: s.label, value: s.count, fill: s.fill }))
  return (
    <div className="flex flex-col items-center gap-4 min-[420px]:flex-row min-[420px]:items-center">
      <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
        <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={62}
            startAngle={90}
            endAngle={-270}
            paddingAngle={data.length > 1 ? 2 : 0}
            strokeWidth={0}
            isAnimationActive={animate}
            animationDuration={CHART_ANIMATION_MS}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip hideLabel formatValue={(v) => `${Math.round(v)} ${unit}`} />} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <bdi dir="ltr" className="text-xl font-bold tabular-nums">{centerValue}</bdi>
          <span className="max-w-[5.5rem] text-xs leading-tight text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2 text-sm" aria-label={t('Legend', 'מקרא', lang)}>
        {slices.map((s) => {
          const Icon = s.icon
          return (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
                <Icon className={cn('h-4 w-4 shrink-0', s.iconClass)} aria-hidden="true" />
                <span className="truncate text-muted-foreground">{s.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {s.count} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const FILL = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--danger))',
  neutral: 'hsl(var(--chart-neutral))',
}

// ─── Budget health ───────────────────────────────────────────────────────────

export function BudgetHealthCard({ health, lang }: { health: BudgetHealth; lang: Lang }) {
  const unit = t('cat.', 'קטג׳', lang)
  const total = health.under + health.warning + health.over + health.none
  const budgeted = health.under + health.warning + health.over
  const slices: StatusSlice[] = [
    { key: 'under', label: t('On track', 'בתקציב', lang), count: health.under, fill: FILL.success, icon: CheckCircle2, iconClass: 'text-success-strong' },
    { key: 'warning', label: t('Warning (>80%)', 'אזהרה (מעל 80%)', lang), count: health.warning, fill: FILL.warning, icon: AlertTriangle, iconClass: 'text-warning-strong' },
    { key: 'over', label: t('Over budget', 'חריגה', lang), count: health.over, fill: FILL.danger, icon: XCircle, iconClass: 'text-danger-strong' },
    { key: 'none', label: t('No budget set', 'ללא תקציב', lang), count: health.none, fill: FILL.neutral, icon: Minus, iconClass: 'text-muted-foreground' },
  ]
  const header =
    health.over > 0 ? <StatusChip tone="danger" label={t(`${health.over} over budget`, `${health.over} בחריגה`, lang)} />
    : health.warning > 0 ? <StatusChip tone="warning" label={t(`${health.warning} warnings`, `${health.warning} אזהרות`, lang)} />
    : <StatusChip tone="success" label={t('All on track', 'הכל בתקציב', lang)} />
  const worstLabel = health.worstCategory
    ? EXPENSE_CATEGORIES.find((c) => c.value === health.worstCategory)?.[lang] ?? health.worstCategory
    : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-primary-strong" aria-hidden="true" />
            {t('Budget Health', 'בריאות תקציב', lang)}
          </CardTitle>
          {header}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusDonut
          slices={slices}
          centerValue={budgeted > 0 ? `${health.under}/${budgeted}` : `${total}`}
          centerLabel={budgeted > 0 ? t('on track', 'בתקציב', lang) : t('no budgets', 'ללא תקציב', lang)}
          unit={unit}
          lang={lang}
        />
        {worstLabel && (
          <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span>{t('Worst offender', 'החריגה הגדולה', lang)}</span>
            <StatusChip tone="danger" label={`${worstLabel} · ${Math.round(health.worstPct)}%`} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Goals ───────────────────────────────────────────────────────────────────

function goalTone(status: GoalStatus): StatusTone {
  if (status === 'realistic') return 'success'
  if (status === 'tight') return 'warning'
  if (status === 'unrealistic') return 'danger'
  return 'neutral'
}

function goalLabel(status: GoalStatus, lang: Lang): string {
  if (status === 'realistic') return t('Realistic', 'ריאלי', lang)
  if (status === 'tight') return t('Tight', 'צפוף', lang)
  if (status === 'unrealistic') return t('Unrealistic', 'לא ריאלי', lang)
  return t('Blocked', 'חסום', lang)
}

const GOAL_BAR: Record<GoalStatus, string> = {
  realistic: 'bg-success',
  tight: 'bg-warning',
  unrealistic: 'bg-danger',
  blocked: 'bg-muted-foreground',
}

export function GoalsCard({
  allocations, currency, locale, lang,
}: { allocations: GoalAllocation[]; currency: Currency; locale: Locale; lang: Lang }) {
  const counts = { realistic: 0, tight: 0, unrealistic: 0, blocked: 0 }
  allocations.forEach((g) => { counts[g.status]++ })
  const slices: StatusSlice[] = [
    { key: 'realistic', label: goalLabel('realistic', lang), count: counts.realistic, fill: FILL.success, icon: CheckCircle2, iconClass: 'text-success-strong' },
    { key: 'tight', label: goalLabel('tight', lang), count: counts.tight, fill: FILL.warning, icon: AlertTriangle, iconClass: 'text-warning-strong' },
    { key: 'unrealistic', label: goalLabel('unrealistic', lang), count: counts.unrealistic, fill: FILL.danger, icon: XCircle, iconClass: 'text-danger-strong' },
    { key: 'blocked', label: goalLabel('blocked', lang), count: counts.blocked, fill: FILL.neutral, icon: Lock, iconClass: 'text-muted-foreground' },
  ]
  const header =
    counts.realistic > 0 ? <StatusChip tone="success" label={t(`${counts.realistic} on track`, `${counts.realistic} במסלול`, lang)} />
    : counts.tight > 0 ? <StatusChip tone="warning" label={t(`${counts.tight} tight`, `${counts.tight} צפופים`, lang)} />
    : counts.unrealistic > 0 ? <StatusChip tone="danger" label={t(`${counts.unrealistic} at risk`, `${counts.unrealistic} בסיכון`, lang)} />
    : <StatusChip tone="neutral" icon={Lock} label={t('Blocked', 'חסום', lang)} />

  const nearest = [...allocations].sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
  const order = { high: 0, medium: 1, low: 2 }
  const top = [...allocations].sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary-strong" aria-hidden="true" />
            {t('Goals Overview', 'סקירת יעדים', lang)}
          </CardTitle>
          {header}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusDonut
          slices={slices}
          centerValue={String(allocations.length)}
          centerLabel={t('goals', 'יעדים', lang)}
          unit={t('goals', 'יעדים', lang)}
          lang={lang}
        />
        {nearest && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
            <span>{t('Nearest deadline', 'מועד קרוב', lang)}:</span>
            <strong className="min-w-0 truncate text-foreground">{nearest.name}</strong>
            <StatusChip tone={goalTone(nearest.status)} label={goalLabel(nearest.status, lang)} />
          </div>
        )}
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">{t('Top Priority Goals', 'יעדים בעדיפות גבוהה', lang)}</p>
          {top.map((goal) => {
            const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)
            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{goal.name}</span>
                  <StatusChip tone={goalTone(goal.status)} label={goalLabel(goal.status, lang)} className="shrink-0" />
                </div>
                <Progress value={pct} indicatorClassName={GOAL_BAR[goal.status]} />
                <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <bdi dir="ltr" className="tabular-nums">{pct.toFixed(0)}%</bdi> ·
                  <Money value={goal.currentAmount} currency={currency} locale={locale} /> /
                  <Money value={goal.targetAmount} currency={currency} locale={locale} />
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── 12-month savings forecast ───────────────────────────────────────────────

export function SavingsForecastCard({
  projection, totalAssets, totalSavingsFlow, currency, locale, lang,
}: {
  projection: SavingsProjection
  totalAssets: number
  totalSavingsFlow: number
  currency: Currency
  locale: Locale
  lang: Lang
}) {
  const animate = useAnimateOnMount()
  const gradId = useId().replace(/:/g, '')
  const growth = projection.projected - totalAssets
  const points = projection.points.map((p) => ({
    ...p,
    label: p.month === 0 ? t('Now', 'עכשיו', lang) : t(`+${p.month}m`, `+${p.month} ח׳`, lang),
  }))

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary-strong" aria-hidden="true" />
            {t('12-Month Savings Forecast', 'תחזית חיסכון 12 חודשים', lang)}
          </CardTitle>
          <StatusChip
            tone={growth > 0 ? 'success' : 'neutral'}
            icon={growth > 0 ? TrendingUp : Minus}
            label={
              <>
                <Money value={growth} currency={currency} locale={locale} showSign /> {t('projected', 'צפוי', lang)}
              </>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="mb-4 grid grid-cols-3 divide-x text-center rtl:divide-x-reverse">
          <div className="min-w-0 px-2 py-1">
            <dt className="mb-1 text-xs text-muted-foreground">{t('Today', 'היום', lang)}</dt>
            <dd><Money value={totalAssets} currency={currency} locale={locale} className="text-sm font-bold sm:text-lg" /></dd>
          </div>
          <div className="min-w-0 px-2 py-1">
            <dt className="mb-1 text-xs text-muted-foreground">{t('Monthly adding', 'הוספה חודשית', lang)}</dt>
            <dd><Money value={totalSavingsFlow} currency={currency} locale={locale} showSign className="text-sm font-bold sm:text-lg" /></dd>
          </div>
          <div className="min-w-0 px-2 py-1">
            <dt className="mb-1 text-xs text-muted-foreground">{t('In 12 months', 'בעוד 12 חודשים', lang)}</dt>
            <dd><Money value={projection.projected} currency={currency} locale={locale} className="text-sm font-bold sm:text-lg" /></dd>
          </div>
        </dl>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 20, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={2} tickLine={false} reversed={lang === 'he'} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={40}
                tickLine={false}
                axisLine={false}
                orientation={lang === 'he' ? 'right' : 'left'}
              />
              <Tooltip content={<ChartTooltip formatValue={(v) => formatCurrency(v, currency, locale)} />} />
              <Area
                type="monotone"
                dataKey="balance"
                name={t('Balance', 'יתרה', lang)}
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill={`url(#${gradId})`}
                isAnimationActive={animate}
                animationDuration={CHART_ANIMATION_MS}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('Assumes avg', 'מניח תשואה ממוצעת', lang)}{' '}
          <bdi dir="ltr" className="tabular-nums">{projection.weightedReturn.toFixed(1)}%</bdi>{' '}
          {t('annual return · contributions included', 'תשואה שנתית · כולל הפקדות', lang)}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Savings by liquidity ────────────────────────────────────────────────────

export function SavingsLiquidityCard({
  accounts, currency, locale, lang,
}: { accounts: SavingsAccount[]; currency: Currency; locale: Locale; lang: Lang }) {
  const animate = useAnimateOnMount()
  const data = [
    {
      name: t('Liquid', 'נזיל', lang),
      value: accounts.filter((a) => a.liquidity === 'immediate' || a.liquidity === 'short').reduce((s, a) => s + a.balance, 0),
    },
    {
      name: t('Locked', 'נעול', lang),
      value: accounts.filter((a) => a.liquidity === 'medium' || a.liquidity === 'locked').reduce((s, a) => s + a.balance, 0),
    },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('Savings by Liquidity', 'חיסכון לפי נזילות', lang)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {data.map((d) => (
            <div key={d.name} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{d.name}</dt>
              <dd><Money value={d.value} currency={currency} locale={locale} className="font-semibold" /></dd>
            </div>
          ))}
        </dl>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} reversed={lang === 'he'} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={40}
                tickLine={false}
                axisLine={false}
                orientation={lang === 'he' ? 'right' : 'left'}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltip formatValue={(v) => formatCurrency(v, currency, locale)} />}
              />
              <Bar
                dataKey="value"
                name={t('Balance', 'יתרה', lang)}
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
                animationDuration={CHART_ANIMATION_MS}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
