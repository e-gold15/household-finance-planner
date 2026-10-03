import { useState } from 'react'
import { CalendarDays, Edit2, Link2, Lock, Trash2, Waves } from 'lucide-react'
import { ActionMenu } from '@/components/ui/action-menu'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { ListRow } from '@/components/ui/list-row'
import { Money } from '@/components/ui/money'
import { StatusChip } from '@/components/ui/status-chip'
import { useFinance } from '@/context/FinanceContext'
import { categoryLabel, monthName } from '@/lib/quickAdd'
import { t } from '@/lib/utils'
import type { Expense } from '@/types'
import { CategoryIcon } from './CategoryChips'
import { ExpenseDialog } from './ExpenseDialog'
import { formatAddedDate, isFixedExpense, monthsUntilDue } from './format'

/** One expense: ListRow with meta, amount and a ⋯ menu (Edit / Delete). Tapping the row edits. */
export function ExpenseRow({
  expense,
  lang,
  showCategory = false,
}: {
  expense: Expense
  lang: 'en' | 'he'
  /** Show the category icon + label (By-date view). */
  showCategory?: boolean
}) {
  const { data, updateExpense, deleteExpense } = useFinance()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const name = expense.name || categoryLabel(expense.category, lang)
  const isFixed = isFixedExpense(expense)
  const isYearly = expense.period === 'yearly'
  const dueIn = isYearly && expense.dueMonth != null ? monthsUntilDue(expense.dueMonth) : null
  const linkedAccount = expense.linkedAccountId
    ? data.accounts.find((a) => a.id === expense.linkedAccountId)
    : undefined
  const addedDate = expense.createdAt ? formatAddedDate(expense.createdAt, lang) : ''

  const meta = (
    <>
      {showCategory && <span>{categoryLabel(expense.category, lang)}</span>}
      <span className="inline-flex items-center gap-1">
        {isFixed ? <Lock className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />}
        {isFixed ? t('Fixed', 'קבוע', lang) : t('Variable', 'משתנה', lang)}
      </span>
      {linkedAccount && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t('Linked to', 'מקושר ל', lang)}</span>
          <bdi className="truncate">{linkedAccount.name}</bdi>
        </span>
      )}
      {isYearly && (
        <span className="inline-flex items-center gap-1">
          <Money value={expense.amount / 12} currency={data.currency} locale={data.locale} />
          {t('/mo', '/חודש', lang)}
        </span>
      )}
      {dueIn === 0 && (
        <StatusChip tone="danger" icon={CalendarDays} label={t('Due this month!', 'לתשלום החודש!', lang)} />
      )}
      {dueIn === 1 && expense.dueMonth != null && (
        <StatusChip
          tone="warning"
          icon={CalendarDays}
          label={t(
            `Due next month (${monthName(expense.dueMonth, lang)})`,
            `לתשלום בחודש הבא (${monthName(expense.dueMonth, lang)})`,
            lang
          )}
        />
      )}
      {dueIn != null && dueIn > 1 && (
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t(`Due in ${dueIn} mo`, `לתשלום בעוד ${dueIn} חודשים`, lang)}
        </span>
      )}
      {addedDate && <span className="text-muted-foreground/80">{t(`Added ${addedDate}`, `נוסף ${addedDate}`, lang)}</span>}
    </>
  )

  return (
    <>
      <ListRow
        as="li"
        className="px-2"
        leading={showCategory ? <CategoryIcon category={expense.category} /> : undefined}
        title={<bdi>{name}</bdi>}
        meta={meta}
        trailing={
          <div className="flex flex-col items-end">
            <Money value={expense.amount} currency={data.currency} locale={data.locale} className="text-sm font-semibold" />
            <span className="text-xs text-muted-foreground">
              {isYearly ? t('/year', '/שנה', lang) : t('/month', '/חודש', lang)}
            </span>
          </div>
        }
        onClick={() => setEditOpen(true)}
        actions={
          <ActionMenu
            label={t(`Actions for ${name}`, `פעולות עבור ${name}`, lang)}
            items={[
              { key: 'edit', label: t('Edit', 'עריכה', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
              'separator',
              { key: 'delete', label: t('Delete', 'מחיקה', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        }
      />
      <ExpenseDialog existing={expense} onSave={(e) => updateExpense(e)} lang={lang} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDelete
        itemName={name}
        lang={lang}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteExpense(expense.id)}
      />
    </>
  )
}
