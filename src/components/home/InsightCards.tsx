import { useState } from 'react'
import {
  AlertTriangle, Bot, CalendarClock, ChevronRight, Gauge, PieChart as PieIcon, Sparkles, X, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/ui/money'
import { StatusChip } from '@/components/ui/status-chip'
import { DirIcon } from '@/components/ui/dir-icon'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { cn, t } from '@/lib/utils'
import type { Currency, ExpenseCategory, Insight, InsightTone, Locale } from '@/types'

// Session-only dismissals: survive tab switches, reset on reload. Never persisted.
const sessionDismissed = new Set<string>()

/** Stable key per insight instance (a new surplus month / briefing re-surfaces). */
export function insightKey(i: Insight): string {
  switch (i.id) {
    case 'surplus': return `surplus:${i.snapshotId}`
    case 'briefing': return `briefing:${i.snapshotId}`
    case 'bill-due': return `bill-due:${i.bills.map((b) => b.expenseId).join(',')}`
    case 'over-budget': return `over-budget:${i.categories.join(',')}`
    default: return i.id
  }
}

const TONE_STYLES: Record<InsightTone, { card: string; tile: string }> = {
  danger:  { card: 'border-danger/30 bg-danger-subtle',   tile: 'bg-card text-danger-strong' },
  success: { card: 'border-success/30 bg-success-subtle', tile: 'bg-card text-success-strong' },
  warning: { card: 'border-warning/40 bg-warning-subtle', tile: 'bg-card text-warning-strong' },
  info:    { card: 'border-info/30 bg-info-subtle',       tile: 'bg-card text-info-strong' },
  neutral: { card: 'border-border bg-card',               tile: 'bg-primary-subtle text-primary-strong' },
}

const ICONS: Record<Insight['id'], LucideIcon> = {
  deficit: AlertTriangle,
  surplus: Sparkles,
  'over-budget': Gauge,
  'bill-due': CalendarClock,
  'pace-ahead': PieIcon,
  briefing: Bot,
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

/** Month name in the UI language (labels are stored in the language they were created in). */
export function snapshotMonth(date: string | undefined, fallback: string, lang: 'en' | 'he') {
  const d = date ? new Date(date) : null
  if (!d || Number.isNaN(d.getTime())) return <bdi>{fallback}</bdi>
  return <bdi>{d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' })}</bdi>
}

function categoryLabel(cat: ExpenseCategory, lang: 'en' | 'he'): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.value === cat)
  return c ? c[lang] : cat
}

export interface InsightCardsProps {
  insights: Insight[]
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
  onNavigateExpenses: () => void
  onAllocateSurplus: () => void
  onReadBriefing: () => void
}

export function InsightCards({
  insights, lang, currency, locale, onNavigateExpenses, onAllocateSurplus, onReadBriefing,
}: InsightCardsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(sessionDismissed))
  const visible = insights.filter((i) => !dismissed.has(insightKey(i)))
  if (visible.length === 0) return null

  const dismiss = (key: string) => {
    sessionDismissed.add(key)
    setDismissed(new Set(sessionDismissed))
  }

  const money = (v: number, className?: string) => (
    <Money value={v} currency={currency} locale={locale} className={cn('font-semibold', className)} />
  )

  function content(i: Insight): { title: React.ReactNode; body: React.ReactNode; cta: string; onCta: () => void; chip?: React.ReactNode } {
    switch (i.id) {
      case 'deficit':
        return {
          title: i.structural
            ? t('Fixed costs exceed income', 'ההוצאות הקבועות עולות על ההכנסה', lang)
            : t('You’re over this month', 'חרגת החודש', lang),
          body: (
            <>
              {t('Expenses exceed income by', 'ההוצאות עולות על ההכנסות ב-', lang)} {money(i.amount)}.{' '}
              {t('Review your budget.', 'בדוק את התקציב.', lang)}
            </>
          ),
          cta: t('Review expenses', 'בדוק הוצאות', lang),
          onCta: onNavigateExpenses,
        }
      case 'surplus':
        return {
          title: t('You had a surplus last month', 'היה לך עודף בחודש שעבר', lang),
          body: <>{snapshotMonth(i.snapshotDate, i.snapshotLabel, lang)} · {t('Put it to work?', 'מה לעשות איתו?', lang)}</>,
          cta: t('Allocate', 'חלק', lang),
          onCta: onAllocateSurplus,
          chip: <Money value={i.amount} currency={currency} locale={locale} showSign className="font-semibold text-success-strong" />,
        }
      case 'over-budget': {
        const pct = Math.round((i.worst.spent / i.worst.budget) * 100)
        const extra = i.categories.length - 1
        return {
          title:
            i.categories.length === 1
              ? t(`${categoryLabel(i.worst.category, 'en')} is over budget`, `${categoryLabel(i.worst.category, 'he')} חורג מהתקציב`, lang)
              : t(`${i.categories.length} categories over budget`, `${i.categories.length} קטגוריות בחריגה`, lang),
          body: (
            <>
              {categoryLabel(i.worst.category, lang)}: {money(i.worst.spent)} / {money(i.worst.budget, 'font-normal')} ({pct}%)
              {extra > 0 && <> · {t(`+${extra} more`, `ועוד ${extra}`, lang)}</>}
            </>
          ),
          cta: t('See budgets', 'לתקציבים', lang),
          onCta: onNavigateExpenses,
        }
      }
      case 'bill-due': {
        const first = i.bills[0]
        const monthName = (lang === 'he' ? MONTHS_HE : MONTHS_EN)[first.dueMonth - 1]
        return {
          title: first.thisMonth
            ? t('Yearly bill due this month', 'חשבון שנתי לתשלום החודש', lang)
            : t('Yearly bill due next month', 'חשבון שנתי לתשלום בחודש הבא', lang),
          body: (
            <>
              {first.name} · {money(first.amount)} · {monthName}
              {i.bills.length > 1 && <> · {t(`+${i.bills.length - 1} more`, `ועוד ${i.bills.length - 1}`, lang)}</>}
            </>
          ),
          cta: t('View', 'הצג', lang),
          onCta: onNavigateExpenses,
        }
      }
      case 'pace-ahead': {
        const spent = Math.round(i.spentPct)
        const elapsed = Math.round(i.elapsedPct)
        return {
          title: t('Spending faster than usual', 'קצב ההוצאות מהיר מהרגיל', lang),
          body: t(
            `${spent}% of this month's spending money is gone, ${elapsed}% of the month has passed.`,
            `${spent}% מכסף ההוצאות של החודש כבר נוצל, ועברו ${elapsed}% מהחודש.`,
            lang
          ),
          cta: t('See spending', 'צפה בהוצאות', lang),
          onCta: onNavigateExpenses,
        }
      }
      case 'briefing': {
        const tone = i.score >= 75 ? 'success' : i.score >= 50 ? 'warning' : 'danger'
        return {
          title: t('Your monthly briefing is ready', 'הסיכום החודשי שלך מוכן', lang),
          body: i.headline,
          cta: t('Read', 'קרא', lang),
          onCta: onReadBriefing,
          chip: <StatusChip tone={tone} label={`${t('Score', 'ציון', lang)} ${i.score}`} />,
        }
      }
    }
  }

  return (
    <section aria-label={t('Insights', 'תובנות', lang)} className="grid gap-3 md:grid-cols-2">
      {visible.map((i) => {
        const key = insightKey(i)
        const Icon = ICONS[i.id]
        const style = TONE_STYLES[i.tone]
        const c = content(i)
        return (
          <article
            key={key}
            className={cn('relative flex flex-col gap-3 rounded-2xl border p-4', style.card, visible.length === 1 && 'md:col-span-2')}
          >
            <div className="flex items-start gap-3 pe-10">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.tile)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
                  {c.chip}
                </div>
                <p className="text-sm text-muted-foreground">{c.body}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={i.id === 'surplus' ? 'default' : 'outline'}
                className={i.id === 'surplus' ? undefined : 'bg-card'}
                onClick={c.onCta}
              >
                {c.cta}
                {i.id === 'surplus' && <Money value={i.amount} currency={currency} locale={locale} />}
                <DirIcon icon={ChevronRight} className="h-4 w-4" />
              </Button>
            </div>
            <button
              type="button"
              onClick={() => dismiss(key)}
              className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-card/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={t('Dismiss for now', 'הסתר לעת עתה', lang)}
              aria-label={t('Dismiss for now', 'הסתר לעת עתה', lang)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </article>
        )
      })}
    </section>
  )
}
