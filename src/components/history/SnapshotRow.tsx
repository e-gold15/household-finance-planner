import { useState, type ReactNode } from 'react'
import { ChevronDown, ClipboardList, PiggyBank, Plus, Target, Trash2 } from 'lucide-react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Money } from '../ui/money'
import { StatusChip } from '../ui/status-chip'
import { ActionMenu } from '../ui/action-menu'
import { ConfirmDelete } from '../ui/confirm-delete'
import { useFinance } from '@/context/FinanceContext'
import { cn, t } from '@/lib/utils'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { MonthSnapshot } from '@/types'
import { ActualsDialog } from './ActualsDialog'
import { HistoricalExpenseDialog } from './HistoricalExpenseDialog'
import { HistoricalIncomeDialog } from './HistoricalIncomeDialog'
import { RecordedExpenseRow, RecordedIncomeRow } from './RecordedItems'
import { isCurrentMonthSnapshot, isStubSnapshot, snapshotMonthLabel } from './historyUtils'

export interface SnapshotRowProps {
  snap: MonthSnapshot
  expanded: boolean
  onToggle: () => void
  onDelete: (id: string) => void
  lang: 'en' | 'he'
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2">
      <p className="truncate text-muted-foreground">{label}</p>
      <div className="truncate font-semibold">{children}</div>
    </div>
  )
}

/**
 * One month in History (P1-2): a collapsed header row (month · FCF chip ·
 * chevron) that expands into the full snapshot with every per-month action.
 */
export function SnapshotRow({ snap, expanded, onToggle, onDelete, lang }: SnapshotRowProps) {
  const { data } = useFinance()
  const { currency, locale } = data

  const [actualsOpen, setActualsOpen] = useState(false)
  const [addIncomeOpen, setAddIncomeOpen] = useState(false)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const monthLabel = snapshotMonthLabel(snap, lang)
  const isStub = isStubSnapshot(snap)
  const isLive = !!snap.autoSnapshot && isCurrentMonthSnapshot(snap)
  const hasActuals = !!snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0
  const incomes = snap.historicalIncomes ?? []
  const expenses = snap.historicalExpenses ?? []
  const memberNames = data.members.map((m) => m.name)
  const bodyId = `snapshot-body-${snap.id}`
  const headerId = `snapshot-header-${snap.id}`

  const fcfChip = isStub ? (
    <StatusChip
      tone="neutral"
      label="—"
      title={t('Income unknown — stub snapshot', 'הכנסה לא ידועה — תמונת מצב חלקית', lang)}
      aria-label={t('Income unknown — stub snapshot', 'הכנסה לא ידועה — תמונת מצב חלקית', lang)}
    />
  ) : (
    <StatusChip
      tone={snap.freeCashFlow >= 0 ? 'success' : 'danger'}
      label={
        <>
          <span className="sr-only">{t('Free cash flow', 'תזרים חופשי', lang)}: </span>
          <Money value={snap.freeCashFlow} currency={currency} locale={locale} showSign />
        </>
      }
    />
  )

  return (
    <Card className="overflow-hidden">
      {/* Collapsed header — a single keyboard-operable button */}
      <h3 className="m-0">
        <button
          type="button"
          id={headerId}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-h-14 w-full items-center gap-2 px-4 py-2 text-start transition-colors duration-fast hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate font-semibold">{monthLabel}</span>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary-strong">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden="true" />
                  {t('Live', 'חי', lang)}
                </span>
              )}
              {hasActuals && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ClipboardList className="h-3 w-3" aria-hidden="true" />
                  {t('Actuals logged', 'נרשם בפועל', lang)}
                </span>
              )}
            </span>
            {isStub && (
              <span className="block text-xs font-normal italic text-muted-foreground">
                {t('fixed expenses only', 'הוצאות קבועות בלבד', lang)}
              </span>
            )}
          </span>
          {fcfChip}
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-fast', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>

      {expanded && (
        <div id={bodyId} role="region" aria-labelledby={headerId} className="space-y-3 border-t px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">{new Date(snap.date).toLocaleDateString(locale)}</p>

          {/* Summary totals */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            <Tile label={t('Income', 'הכנסה', lang)}>
              <Money value={snap.totalIncome} currency={currency} locale={locale} />
            </Tile>
            <Tile label={t('Expenses', 'הוצאות', lang)}>
              <Money value={snap.totalExpenses} currency={currency} locale={locale} />
            </Tile>
            <Tile label={t('Savings', 'חיסכון', lang)}>
              <Money value={snap.totalSavings} currency={currency} locale={locale} />
            </Tile>
            <Tile label={t('Free Cash', 'תזרים חופשי', lang)}>
              {snap.totalIncome === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Money value={snap.freeCashFlow} currency={currency} locale={locale} tone="auto" showSign />
              )}
            </Tile>
          </div>

          {/* Per-month actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setActualsOpen(true)}
              title={t('Log actual spending for this month', 'רשום הוצאות בפועל לחודש זה', lang)}
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              {hasActuals ? t('Edit Actuals', 'ערוך בפועל', lang) : t('Log Actuals', 'רשום בפועל', lang)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setAddIncomeOpen(true)}
              aria-label={t(`Add income to ${monthLabel}`, `הוסף הכנסה ל${monthLabel}`, lang)}
              title={t(`Add income to ${monthLabel}`, `הוסף הכנסה ל${monthLabel}`, lang)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Add Income', 'הוסף הכנסה', lang)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setAddExpenseOpen(true)}
              aria-label={t(`Add expense to ${monthLabel}`, `הוסף הוצאה ל${monthLabel}`, lang)}
              title={t(`Add expense to ${monthLabel}`, `הוסף הוצאה ל${monthLabel}`, lang)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Add Expense', 'הוסף הוצאה', lang)}
            </Button>
            <ActionMenu
              label={t(`More actions for ${monthLabel}`, `פעולות נוספות עבור ${monthLabel}`, lang)}
              triggerClassName="ms-auto"
              items={[
                { key: 'delete', label: t('Delete snapshot', 'מחק תמונת מצב', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
              ]}
            />
          </div>

          {/* Surplus allocations */}
          {snap.surplusAllocations && snap.surplusAllocations.length > 0 && (
            <section className="space-y-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">{t('Allocated from surplus', 'שויך מהעודף', lang)}</p>
              {snap.surplusAllocations.map((alloc, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    {alloc.type === 'savings'
                      ? <PiggyBank className="h-3 w-3 shrink-0" aria-hidden="true" />
                      : <Target className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{alloc.destinationName}</span>
                  </span>
                  <Money value={alloc.amount} currency={currency} locale={locale} tone="positive" showSign className="font-medium" />
                </div>
              ))}
            </section>
          )}

          {/* Recorded incomes */}
          {incomes.length > 0 && (
            <section className="border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`Recorded income (${incomes.length})`, `הכנסות שנרשמו (${incomes.length})`, lang)}
              </p>
              <ul className="divide-y">
                {incomes.map((item) => (
                  <RecordedIncomeRow
                    key={item.id}
                    item={item}
                    snapshotId={snap.id}
                    monthLabel={monthLabel}
                    memberNames={memberNames}
                    lang={lang}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Category actuals */}
          {hasActuals && snap.categoryActuals && (
            <section className="border-t pt-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('Actual spending by category', 'הוצאות בפועל לפי קטגוריה', lang)}
              </p>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 min-[400px]:grid-cols-2">
                {CATEGORIES.filter(({ value }) => snap.categoryActuals![value] != null).map(({ value, en, he }) => (
                  <div key={value} className="flex min-w-0 justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{lang === 'he' ? he : en}</span>
                    <Money value={snap.categoryActuals![value]!} currency={currency} locale={locale} className="font-medium" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recorded expenses */}
          {expenses.length > 0 && (
            <section className="border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`Recorded expenses (${expenses.length})`, `הוצאות שנרשמו (${expenses.length})`, lang)}
              </p>
              <ul className="divide-y">
                {expenses.map((item) => (
                  <RecordedExpenseRow key={item.id} item={item} snapshotId={snap.id} monthLabel={monthLabel} lang={lang} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ActualsDialog open={actualsOpen} onOpenChange={setActualsOpen} snap={snap} monthLabel={monthLabel} lang={lang} />
      <HistoricalIncomeDialog
        open={addIncomeOpen}
        onOpenChange={setAddIncomeOpen}
        snapshotId={snap.id}
        monthLabel={monthLabel}
        lang={lang}
        memberNames={memberNames}
      />
      <HistoricalExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        snapshotId={snap.id}
        monthLabel={monthLabel}
        lang={lang}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={monthLabel}
        title={t(`Delete the ${monthLabel} snapshot?`, `למחוק את תמונת המצב של ${monthLabel}?`, lang)}
        lang={lang}
        onConfirm={() => onDelete(snap.id)}
      />
    </Card>
  )
}
