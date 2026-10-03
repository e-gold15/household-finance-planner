import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, CirclePlus, Edit2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Money } from '../ui/money'
import { Progress } from '../ui/progress'
import { StatusChip } from '../ui/status-chip'
import { ActionMenu, type ActionMenuEntry } from '../ui/action-menu'
import { ConfirmDelete } from '../ui/confirm-delete'
import { t } from '@/lib/utils'
import type { Currency, Goal, GoalAllocation, Locale, SavingsAccount } from '@/types'
import { GoalDialog } from './GoalDialog'
import { FundGoalDialog } from './FundGoalDialog'
import {
  GOAL_PROGRESS_FILL,
  GOAL_STATUS_TONE,
  PRIORITY_BADGE,
  computeGoalProgress,
  goalPriorityLabel,
  goalStatusLabel,
} from './goalMeta'

export interface GoalCardProps {
  /** Allocation view of the goal (status, recommended, gap…). */
  goal: GoalAllocation
  /** The stored goal from `data.goals` — what the edit form reads and saves. */
  storedGoal: Goal
  isFirst: boolean
  isLast: boolean
  accounts: SavingsAccount[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onUpdate: (g: Goal) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onFund: (goalId: string, accountId: string, amount: number) => void
  /** v4.1 — mark the stored goal as done (sets `completedAt` only). */
  onMarkDone: (storedGoal: Goal) => void
}

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ?? 'rounded-md bg-muted/50 p-2'}>
      <p className="text-muted-foreground">{label}</p>
      <div className="font-semibold">{children}</div>
    </div>
  )
}

export function GoalCard({
  goal,
  storedGoal,
  isFirst,
  isLast,
  accounts,
  currency,
  locale,
  lang,
  onUpdate,
  onDelete,
  onMove,
  onFund,
  onMarkDone,
}: GoalCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [fundOpen, setFundOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { used, available, effectiveTarget, pct, stillNeeded } = computeGoalProgress(goal)
  const hasAccounts = accounts.length > 0
  const name = goal.name || t('this goal', 'היעד הזה', lang)
  // Reached = saved at least the target (the user still decides — never auto-done).
  const reached = storedGoal.targetAmount > 0 && storedGoal.currentAmount >= storedGoal.targetAmount

  const menuItems: ActionMenuEntry[] = [
    { key: 'edit', label: t('Edit goal', 'ערוך יעד', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
    { key: 'up', label: t('Move up', 'הזז למעלה', lang), icon: ArrowUp, disabled: isFirst, onSelect: () => onMove(goal.id, 'up') },
    { key: 'down', label: t('Move down', 'הזז למטה', lang), icon: ArrowDown, disabled: isLast, onSelect: () => onMove(goal.id, 'down') },
    { key: 'done', label: t('Mark as done', 'סמן כהושלם', lang), icon: CheckCircle2, onSelect: () => onMarkDone(storedGoal) },
    'separator',
    { key: 'delete', label: t('Delete goal', 'מחק יעד', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="truncate text-base" title={goal.name}>{goal.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone={GOAL_STATUS_TONE[goal.status]} label={goalStatusLabel(goal.status, lang)} />
              <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-xs">
                {goalPriorityLabel(goal.priority, lang)}
              </Badge>
            </div>
          </div>
          <ActionMenu
            items={menuItems}
            label={t(`Actions for ${goal.name}`, `פעולות עבור ${goal.name}`, lang)}
            triggerClassName="-me-2 -mt-1"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Saved / Used / Available / Still needed */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('Saved', 'חסכנו', lang)}</dt>
          <dd className="text-end"><Money value={goal.currentAmount} currency={currency} locale={locale} className="font-medium" /></dd>
          {used > 0 && (
            <>
              <dt className="text-muted-foreground">{t('Used', 'נוצל', lang)}</dt>
              <dd className="text-end"><Money value={used} currency={currency} locale={locale} tone="negative" className="font-medium" /></dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('Available', 'זמין', lang)}</dt>
          <dd className="text-end"><Money value={available} currency={currency} locale={locale} className="font-semibold text-primary-strong" /></dd>
          {stillNeeded > 0 && (
            <>
              <dt className="text-muted-foreground">{t('Still needed', 'נשאר לחסוך', lang)}</dt>
              <dd className="text-end"><Money value={stillNeeded} currency={currency} locale={locale} className="font-medium" /></dd>
            </>
          )}
        </dl>

        {/* Progress: available / effective target */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Money value={available} currency={currency} locale={locale} />
              <span>/</span>
              <Money value={effectiveTarget} currency={currency} locale={locale} />
            </span>
            <bdi className="num tabular-nums">{pct.toFixed(0)}%</bdi>
          </div>
          <Progress value={pct} indicatorClassName={GOAL_PROGRESS_FILL[goal.status]} aria-label={`${goal.name} – ${pct.toFixed(0)}%`} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label={t('Recommended/mo', 'מומלץ/חודש', lang)}>
            <Money value={goal.monthlyRecommended} currency={currency} locale={locale} />
          </Stat>
          <Stat label={t('Deadline', 'מועד יעד', lang)}>
            {goal.deadline ? new Date(goal.deadline).toLocaleDateString(locale) : '—'}
          </Stat>
          {goal.monthlyAllocated !== undefined && goal.monthlyAllocated !== goal.monthlyRecommended && (
            <Stat label={t('Allocated/mo', 'מוקצה/חודש', lang)}>
              <Money value={goal.monthlyAllocated} currency={currency} locale={locale} />
            </Stat>
          )}
          {goal.gap > 0 && (
            <div className="col-span-2 rounded-md bg-danger-subtle p-2 text-danger-strong">
              {t('Monthly gap:', 'פער חודשי:', lang)} <Money value={goal.gap} currency={currency} locale={locale} />
            </div>
          )}
        </div>
        {goal.notes && <p className="text-xs text-muted-foreground" dir="auto">{goal.notes}</p>}

        {/* Add funds from savings (+ inline "Mark as done" once the target is reached) */}
        <div className="flex flex-wrap items-center gap-2">
          {reached && (
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 flex-1"
              onClick={() => onMarkDone(storedGoal)}
              aria-label={t(`Mark ${goal.name} as done`, `סמן את ${goal.name} כהושלם`, lang)}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t('Mark as done', 'סמן כהושלם', lang)}
            </Button>
          )}
          <Button
            size="sm"
            className="min-w-0 flex-1"
            disabled={!hasAccounts}
            onClick={() => setFundOpen(true)}
            title={!hasAccounts ? t('Add a savings account first', 'הוסף חשבון חיסכון תחילה', lang) : undefined}
            aria-label={t(`Add funds to ${goal.name}`, `הוסף כסף ל${goal.name}`, lang)}
          >
            <CirclePlus className="h-4 w-4" aria-hidden="true" />
            {t('Add Funds', 'הוסף כסף', lang)}
          </Button>
          {!hasAccounts && (
            <p className="text-xs text-muted-foreground">{t('Add a savings account first', 'הוסף חשבון חיסכון תחילה', lang)}</p>
          )}
        </div>
      </CardContent>

      <FundGoalDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
        goal={goal}
        accounts={accounts}
        currency={currency}
        locale={locale}
        lang={lang}
        onFund={(accountId, amount) => onFund(goal.id, accountId, amount)}
      />
      <GoalDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={storedGoal}
        onSave={onUpdate}
        currency={currency}
        locale={locale}
        lang={lang}
      />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen} itemName={name} lang={lang} onConfirm={() => onDelete(goal.id)} />
    </Card>
  )
}
