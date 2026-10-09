import { useId, useState } from 'react'
import { ChevronDown, TrendingUp, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, t } from '@/lib/utils'
import type { Currency, Locale, MonthlyPlan } from '@/types'
import { PaceBar } from './PaceBar'

interface HeroCardProps {
  plan: MonthlyPlan
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onAddIncome: () => void
}

export function HeroSkeleton() {
  return (
    <Card className="rounded-2xl p-5 space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-full rounded-full" />
    </Card>
  )
}

export function HeroCard({ plan, currency, locale, lang, onAddIncome }: HeroCardProps) {
  const [expanded, setExpanded] = useState(false)
  const breakdownId = useId()
  const m = (value: number, extra?: { className?: string; showSign?: boolean }) => (
    <Money value={value} currency={currency} locale={locale} className={extra?.className} showSign={extra?.showSign} />
  )
  /** A deduction line: "−" + absolute amount, isolated LTR so it never splits from the number. */
  const minus = (value: number) => (
    <bdi dir="ltr" className="inline-flex items-baseline font-medium">
      <span aria-hidden="true">−</span>
      <span className="sr-only">{t('minus', 'פחות', lang)} </span>
      {m(Math.abs(value))}
    </bdi>
  )

  // ── No income: empty state, pace bar hidden ────────────────────────────
  if (plan.status === 'no-income') {
    return (
      <Card className="rounded-2xl">
        <EmptyState
          compact
          icon={Wallet}
          title={t('Left to spend this month', 'נשאר להוציא החודש', lang)}
          description={t(
            'Add your income to see how much is left to spend each day.',
            'הוסיפו הכנסה כדי לראות כמה נשאר להוציא בכל יום.',
            lang
          )}
          actionLabel={t('Add income', 'הוסף הכנסה', lang)}
          actionIcon={TrendingUp}
          onAction={onAddIncome}
        />
      </Card>
    )
  }

  const structural = plan.spendable <= 0
  const over = plan.leftToSpend < 0
  const overBy = Math.max(0, -plan.leftToSpend)

  const statusChip =
    plan.status === 'over' ? (
      <StatusChip tone="danger" label={t('Over budget', 'חריגה מהתקציב', lang)} />
    ) : plan.status === 'ahead' ? (
      <StatusChip tone="warning" label={t('Spending fast', 'קצב הוצאה מהיר', lang)} />
    ) : (
      <StatusChip tone="success" label={t('On track', 'בקצב טוב', lang)} />
    )

  const daysLine =
    plan.daysLeft === 1
      ? t('Last day of the month', 'היום האחרון בחודש', lang)
      : t(`${plan.daysLeft} days left`, `נותרו ${plan.daysLeft} ימים`, lang)

  return (
    <Card className="rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={breakdownId}
        className="block w-full p-5 text-start transition-colors duration-fast hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {t('Left to spend this month', 'נשאר להוציא החודש', lang)}
          </p>
          {statusChip}
        </div>

        {/* Headline value */}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          {over ? (
            (() => {
              const overLabel = (
                <span className="text-2xl font-bold text-danger-strong">{t('over', 'חריגה של', lang)}</span>
              )
              const overValue = (
                <Money value={overBy} currency={currency} locale={locale} size="display" tone="negative" />
              )
              // EN: "₪500 over" · HE: "חריגה של ₪500"
              return lang === 'he' ? <>{overLabel}{overValue}</> : <>{overValue}{overLabel}</>
            })()
          ) : (
            <Money
              value={plan.leftToSpend}
              currency={currency}
              locale={locale}
              size="display"
              tone={structural ? 'negative' : 'neutral'}
            />
          )}
        </div>

        {/* Sub-line */}
        {structural ? (
          <p className="mt-1 text-sm font-medium text-danger-strong">
            {plan.spendable < 0 ? (
              <>
                {t('Fixed costs and savings exceed income by', 'ההוצאות הקבועות והחיסכון עולים על ההכנסה ב-', lang)}{' '}
                {m(-plan.spendable)}
              </>
            ) : (
              t('Fixed costs and savings use all of your income', 'ההוצאות הקבועות והחיסכון מנצלים את כל ההכנסה', lang)
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {daysLine}
            {plan.dailyAllowance > 0 && (
              <>
                {' · '}
                {m(plan.dailyAllowance)}{t('/day', ' ליום', lang)}
              </>
            )}
          </p>
        )}

        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-strong">
          {expanded ? t('Hide breakdown', 'הסתר פירוט', lang) : t('Show breakdown', 'הצג פירוט', lang)}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-base motion-reduce:transition-none', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Pace bar — hidden when fixed costs + savings already consume income */}
      {!structural && plan.spentPct !== null && (
        <div className="px-5 pb-5">
          <PaceBar spentPct={plan.spentPct} elapsedPct={plan.elapsedPct} status={plan.status} lang={lang} />
        </div>
      )}

      {/* Breakdown: income − fixed − savings − variable = left */}
      {expanded && (
        <div id={breakdownId} className="border-t bg-muted/30 px-5 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                {plan.income !== plan.plannedIncome ? t('Net income this month', 'הכנסה נטו החודש', lang) : t('Net income', 'הכנסה נטו', lang)}
                {plan.income !== plan.plannedIncome && (
                  <span className="block text-xs">
                    {t('Actual · planned', 'בפועל · מתוכנן', lang)} {m(plan.plannedIncome)}
                  </span>
                )}
              </dt>
              <dd>{m(plan.income, { className: 'font-medium' })}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                {t('Fixed expenses', 'הוצאות קבועות', lang)}
                <span className="block text-xs">{t('incl. yearly bills ÷ 12', 'כולל חשבונות שנתיים ÷ 12', lang)}</span>
              </dt>
              <dd>{minus(plan.fixed)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('Savings contributions', 'הפקדות לחיסכון', lang)}</dt>
              <dd>{minus(plan.savingsContrib)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('Variable spent so far', 'הוצאות משתנות עד כה', lang)}</dt>
              <dd>{minus(plan.variableSpent)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <dt className="font-semibold">{t('Left to spend', 'נשאר להוציא', lang)}</dt>
              <dd>
                <Money
                  value={plan.leftToSpend}
                  currency={currency}
                  locale={locale}
                  tone={plan.leftToSpend < 0 ? 'negative' : 'neutral'}
                  className="font-bold"
                />
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  )
}
