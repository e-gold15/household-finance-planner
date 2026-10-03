import { useState } from 'react'
import { CheckCircle2, ChevronDown, Edit2, RotateCcw, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Money } from '../ui/money'
import { ActionMenu, type ActionMenuEntry } from '../ui/action-menu'
import { ConfirmDelete } from '../ui/confirm-delete'
import { cn, t } from '@/lib/utils'
import type { Currency, Goal, Locale } from '@/types'
import { GoalDialog } from './GoalDialog'

interface CompletedGoalRowProps {
  goal: Goal
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onReopen: (g: Goal) => void
  onUpdate: (g: Goal) => void
  onDelete: (id: string) => void
}

function formatCompletedDate(iso: string | undefined, locale: Locale): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale)
}

function CompletedGoalRow({ goal, currency, locale, lang, onReopen, onUpdate, onDelete }: CompletedGoalRowProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const name = goal.name || t('this goal', 'היעד הזה', lang)

  const items: ActionMenuEntry[] = [
    { key: 'reopen', label: t('Reopen', 'פתח מחדש', lang), icon: RotateCcw, onSelect: () => onReopen(goal) },
    { key: 'edit', label: t('Edit goal', 'ערוך יעד', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
    'separator',
    { key: 'delete', label: t('Delete goal', 'מחק יעד', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
  ]

  return (
    <li className="flex min-h-[56px] items-center gap-3 py-2">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-success-strong" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={goal.name} dir="auto">{goal.name}</p>
        <p className="text-xs text-muted-foreground">
          {t('Completed', 'הושלם', lang)}{' '}
          <bdi className="num tabular-nums">{formatCompletedDate(goal.completedAt, locale)}</bdi>
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-xs text-muted-foreground">{t('Saved', 'חסכנו', lang)}</p>
        <Money value={goal.currentAmount} currency={currency} locale={locale} className="text-sm font-semibold" />
      </div>
      <ActionMenu
        items={items}
        label={t(`Actions for ${goal.name}`, `פעולות עבור ${goal.name}`, lang)}
        triggerClassName="-me-2"
      />
      <GoalDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={goal}
        onSave={onUpdate}
        currency={currency}
        locale={locale}
        lang={lang}
      />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen} itemName={name} lang={lang} onConfirm={() => onDelete(goal.id)} />
    </li>
  )
}

export interface CompletedGoalsProps {
  /** Stored done goals (from `data.goals`, `completedAt` set). */
  goals: Goal[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onReopen: (g: Goal) => void
  onUpdate: (g: Goal) => void
  onDelete: (id: string) => void
}

/** v4.1 — collapsible "Completed (N)" section at the bottom of the Goals tab. Collapsed by default. */
export function CompletedGoals({ goals, currency, locale, lang, onReopen, onUpdate, onDelete }: CompletedGoalsProps) {
  const [expanded, setExpanded] = useState(false)
  if (goals.length === 0) return null
  const panelId = 'completed-goals-panel'

  return (
    <Card>
      <h2 className="m-0">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-4 py-3 text-start text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-strong" aria-hidden="true" />
          <span className="flex-1">
            {t('Completed', 'הושלמו', lang)} (<bdi className="num tabular-nums">{goals.length}</bdi>)
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={panelId} hidden={!expanded}>
        <CardContent className="px-4 pb-2 pt-0">
          <ul className="divide-y">
            {goals.map((g) => (
              <CompletedGoalRow
                key={g.id}
                goal={g}
                currency={currency}
                locale={locale}
                lang={lang}
                onReopen={onReopen}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  )
}
