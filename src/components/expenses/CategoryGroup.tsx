import { useId, type ReactNode } from 'react'
import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { Progress } from '@/components/ui/progress'
import { StatusChip } from '@/components/ui/status-chip'
import { useFinance } from '@/context/FinanceContext'
import { cn, t } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'
import { CategoryIcon } from './CategoryChips'
import { BudgetEditor } from './BudgetEditor'

/**
 * Collapsible category card used by the current-budget and past-month views.
 * The header row is a real <button> (keyboard-operable, aria-expanded — P1-21);
 * the budget editor sits outside it so interactive elements never nest.
 */
export function CategoryGroup({
  category,
  label,
  total,
  itemCount,
  budget,
  delta = null,
  editableBudget = false,
  expanded,
  onToggle,
  lang,
  children,
}: {
  category: ExpenseCategory
  label: string
  total: number
  itemCount: number
  budget: number | undefined
  /** Month-over-month delta (Compare mode), null = hidden. */
  delta?: number | null
  editableBudget?: boolean
  expanded: boolean
  /** Omit to render a non-collapsible header (e.g. a past month with no line items). */
  onToggle?: () => void
  lang: 'en' | 'he'
  children?: ReactNode
}) {
  const { data } = useFinance()
  const bodyId = useId()
  const budgetPct = budget ? Math.min(100, (total / budget) * 100) : null
  const money = (v: number) => <Money value={v} currency={data.currency} locale={data.locale} />

  const countLabel =
    itemCount === 1 ? t('1 item', 'פריט אחד', lang) : t(`${itemCount} items`, `${itemCount} פריטים`, lang)

  const headerInner = (
    <>
      <CategoryIcon category={category} />
      <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
      {itemCount > 0 && (
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-xs">
          {countLabel}
        </Badge>
      )}
      <span className="ms-auto shrink-0">
        <Money value={total} currency={data.currency} locale={data.locale} className="text-base font-bold" />
      </span>
      {onToggle && (
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-base', expanded && 'rotate-180')}
        />
      )}
    </>
  )

  const progressTone = budgetPct === null ? '' : budgetPct >= 100 ? 'bg-danger' : budgetPct >= 80 ? 'bg-warning' : 'bg-primary'

  return (
    <Card className="overflow-hidden">
      <div className="px-3 pb-3 pt-2">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={expanded ? bodyId : undefined}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-start transition-colors duration-fast hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {headerInner}
          </button>
        ) : (
          <div className="flex min-h-11 w-full items-center gap-2 px-1">{headerInner}</div>
        )}

        {/* Budget status + delta + editor */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
          {budget !== undefined ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t('Budget', 'תקציב', lang)} {money(budget)}
              </span>
              {total > budget ? (
                <StatusChip tone="danger" label={<>{money(total - budget)} {t('over', 'מעל', lang)}</>} />
              ) : (
                <StatusChip
                  tone={budgetPct !== null && budgetPct >= 80 ? 'warning' : 'success'}
                  label={<>{money(budget - total)} {t('remaining', 'נותר', lang)}</>}
                />
              )}
            </>
          ) : (
            <span className="text-xs italic text-muted-foreground">{t('No budget set', 'לא הוגדר תקציב', lang)}</span>
          )}

          {delta !== null && (
            <StatusChip
              tone={delta > 0 ? 'danger' : delta < 0 ? 'success' : 'neutral'}
              icon={delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus}
              label={
                delta === 0 ? (
                  t('unchanged', 'ללא שינוי', lang)
                ) : (
                  <>
                    {money(Math.abs(delta))}
                    <span className="sr-only">
                      {' '}
                      {delta > 0 ? t('more than last month', 'יותר מהחודש שעבר', lang) : t('less than last month', 'פחות מהחודש שעבר', lang)}
                    </span>
                  </>
                )
              }
            />
          )}

          {editableBudget && (
            <span className="ms-auto">
              <BudgetEditor category={category} lang={lang} />
            </span>
          )}
        </div>

        {budgetPct !== null && (
          <div className="mt-2 px-1">
            <Progress
              value={budgetPct}
              indicatorClassName={progressTone}
              aria-label={`${label} ${t('budget', 'תקציב', lang)} ${budgetPct.toFixed(0)}%`}
            />
          </div>
        )}
      </div>

      {expanded && children && (
        <div id={bodyId} className="border-t">
          {children}
        </div>
      )}
    </Card>
  )
}
