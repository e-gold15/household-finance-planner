import { Bot, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Money } from '../ui/money'
import { Progress } from '../ui/progress'
import { StatusChip } from '../ui/status-chip'
import { t } from '@/lib/utils'
import type { Currency, GoalAllocation, Locale } from '@/types'
import {
  GOAL_PROGRESS_FILL,
  GOAL_STATUS_TONE,
  PRIORITY_BADGE,
  computeGoalProgress,
  goalPriorityLabel,
  goalStatusLabel,
} from './goalMeta'

export interface AllocationPlanProps {
  allocations: GoalAllocation[]
  totalAllocated: number
  freeCashFlow: number
  isOverBudget: boolean
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  aiEnabled: boolean
  aiLoading: boolean
  onExplain: () => void
  onRecalculate: () => void
  showAiCard: boolean
  aiExplanation: string | null
  aiError: string | null
}

function PlanProgress({ goal, currency, locale }: { goal: GoalAllocation; currency: Currency; locale: Locale }) {
  const { available, effectiveTarget, pct } = computeGoalProgress(goal)
  return (
    <div className="space-y-1">
      <Progress value={pct} indicatorClassName={GOAL_PROGRESS_FILL[goal.status]} aria-label={`${goal.name} – ${pct.toFixed(0)}%`} />
      <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
        <bdi className="num tabular-nums">{pct.toFixed(0)}%</bdi>
        <span>
          (<Money value={available} currency={currency} locale={locale} /> /{' '}
          <Money value={effectiveTarget} currency={currency} locale={locale} />)
        </span>
      </div>
    </div>
  )
}

/**
 * Goals allocation plan (P0-7). Below 640px each goal is a stacked card
 * (goal · status chip · needed/allocated · progress); the 6-column table is
 * kept from 640px up.
 */
export function AllocationPlan({
  allocations,
  totalAllocated,
  freeCashFlow,
  isOverBudget,
  currency,
  locale,
  lang,
  aiEnabled,
  aiLoading,
  onExplain,
  onRecalculate,
  showAiCard,
  aiExplanation,
  aiError,
}: AllocationPlanProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t('Allocation Plan', 'תוכנית הקצאה', lang)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {aiEnabled && (
              <Button variant="outline" size="sm" onClick={onExplain} disabled={aiLoading} aria-busy={aiLoading || undefined}>
                <Bot className="h-4 w-4" aria-hidden="true" />
                {aiLoading ? t('Thinking…', 'חושב…', lang) : t('Explain my plan', 'הסבר את התוכנית', lang)}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onRecalculate}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('Recalculate', 'חשב מחדש', lang)}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* < 640px: stacked cards */}
        <ul className="space-y-2 sm:hidden">
          {allocations.map((goal) => {
            const allocated = goal.monthlyAllocated ?? goal.monthlyRecommended
            return (
              <li key={goal.id} className="space-y-2 rounded-lg border p-3 text-xs">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{goal.name}</p>
                    <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-xs">
                      {goalPriorityLabel(goal.priority, lang)}
                    </Badge>
                  </div>
                  <StatusChip tone={GOAL_STATUS_TONE[goal.status]} label={goalStatusLabel(goal.status, lang)} />
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">{t('Needed/mo', 'נדרש/חודש', lang)}</dt>
                    <dd><Money value={goal.monthlyRecommended} currency={currency} locale={locale} className="text-sm font-medium" /></dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">{t('Allocated', 'מוקצה', lang)}</dt>
                    <dd><Money value={allocated} currency={currency} locale={locale} className="text-sm font-semibold" /></dd>
                  </div>
                </dl>
                <PlanProgress goal={goal} currency={currency} locale={locale} />
              </li>
            )
          })}
        </ul>

        {/* ≥ 640px: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pe-2 text-start font-medium">{t('Goal', 'יעד', lang)}</th>
                <th scope="col" className="py-2 pe-2 text-start font-medium">{t('Priority', 'עדיפות', lang)}</th>
                <th scope="col" className="py-2 pe-2 text-start font-medium">{t('Needed/mo', 'נדרש/חודש', lang)}</th>
                <th scope="col" className="py-2 pe-2 text-start font-medium">{t('Allocated', 'מוקצה', lang)}</th>
                <th scope="col" className="py-2 pe-2 text-start font-medium">{t('Status', 'סטטוס', lang)}</th>
                <th scope="col" className="py-2 text-start font-medium">{t('Progress', 'התקדמות', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((goal) => {
                const allocated = goal.monthlyAllocated ?? goal.monthlyRecommended
                return (
                  <tr key={goal.id} className="border-b last:border-0">
                    <td className="py-2 pe-2 font-medium">{goal.name}</td>
                    <td className="py-2 pe-2">
                      <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-xs">
                        {goalPriorityLabel(goal.priority, lang)}
                      </Badge>
                    </td>
                    <td className="py-2 pe-2"><Money value={goal.monthlyRecommended} currency={currency} locale={locale} /></td>
                    <td className="py-2 pe-2 font-semibold"><Money value={allocated} currency={currency} locale={locale} /></td>
                    <td className="py-2 pe-2">
                      <StatusChip tone={GOAL_STATUS_TONE[goal.status]} label={goalStatusLabel(goal.status, lang)} />
                    </td>
                    <td className="min-w-[140px] py-2">
                      <PlanProgress goal={goal} currency={currency} locale={locale} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals (shared by both layouts) */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2 text-xs">
          <span className="text-muted-foreground">{t('Total allocated:', 'סה"כ מוקצה:', lang)}</span>
          <Money
            value={totalAllocated}
            currency={currency}
            locale={locale}
            tone={isOverBudget ? 'negative' : 'neutral'}
            className="font-semibold"
          />
          <span className="text-muted-foreground" aria-hidden="true">/</span>
          <span className="text-muted-foreground">
            {t('FCF:', 'תזרים:', lang)}{' '}
            <Money value={Math.max(0, freeCashFlow)} currency={currency} locale={locale} />
          </span>
          {isOverBudget && <StatusChip tone="danger" label={t('Over budget', 'חריגה מתקציב', lang)} />}
        </div>

        {/* AI explanation */}
        {showAiCard && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4" aria-live="polite">
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary-strong" aria-hidden="true" />
              <p className="text-sm font-semibold">{t('AI Plan Assessment', 'הערכת תוכנית AI', lang)}</p>
            </div>
            <div className="max-h-[40vh] overflow-y-auto">
              {aiLoading && (
                <p className="text-sm text-muted-foreground">{t('Analyzing your plan…', 'מנתח את התוכנית שלך…', lang)}</p>
              )}
              {aiError && <p className="text-sm text-danger-strong">{aiError}</p>}
              {aiExplanation && !aiLoading && <p className="whitespace-pre-wrap text-sm" dir="auto">{aiExplanation}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
