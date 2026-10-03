import { useState } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Money } from '../ui/money'
import { ListRow } from '../ui/list-row'
import { ActionMenu } from '../ui/action-menu'
import { ConfirmDelete } from '../ui/confirm-delete'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { HistoricalExpense, HistoricalIncome } from '@/types'
import { HistoricalExpenseDialog } from './HistoricalExpenseDialog'
import { HistoricalIncomeDialog } from './HistoricalIncomeDialog'

export function RecordedIncomeRow({
  item,
  snapshotId,
  monthLabel,
  memberNames,
  lang,
}: {
  item: HistoricalIncome
  snapshotId: string
  monthLabel: string
  memberNames: string[]
  lang: 'en' | 'he'
}) {
  const { data, deleteHistoricalIncome } = useFinance()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <li>
      <ListRow
        title={item.memberName}
        meta={item.note ? <span className="min-w-0 truncate" dir="auto">{item.note}</span> : undefined}
        trailing={<Money value={item.amount} currency={data.currency} locale={data.locale} tone="positive" className="text-sm font-semibold" />}
        actions={
          <ActionMenu
            label={t(`Actions for ${item.memberName}`, `פעולות עבור ${item.memberName}`, lang)}
            items={[
              { key: 'edit', label: t('Edit recorded income', 'ערוך הכנסה שנרשמה', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
              'separator',
              { key: 'delete', label: t('Delete recorded income', 'מחק הכנסה שנרשמה', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        }
      />
      <HistoricalIncomeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        snapshotId={snapshotId}
        monthLabel={monthLabel}
        existing={item}
        lang={lang}
        memberNames={memberNames}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={item.memberName || t('this income', 'ההכנסה הזו', lang)}
        lang={lang}
        onConfirm={() => deleteHistoricalIncome(snapshotId, item.id)}
      />
    </li>
  )
}

export function RecordedExpenseRow({
  item,
  snapshotId,
  monthLabel,
  lang,
}: {
  item: HistoricalExpense
  snapshotId: string
  monthLabel: string
  lang: 'en' | 'he'
}) {
  const { data, deleteHistoricalExpense } = useFinance()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const catLabel = CATEGORIES.find((c) => c.value === item.category)

  return (
    <li>
      <ListRow
        title={item.name}
        meta={
          <>
            {catLabel && (
              <Badge variant="outline" className="py-0 text-xs">
                {lang === 'he' ? catLabel.he : catLabel.en}
              </Badge>
            )}
            {item.note && <span className="min-w-0 truncate" dir="auto">{item.note}</span>}
          </>
        }
        trailing={<Money value={item.amount} currency={data.currency} locale={data.locale} className="text-sm font-semibold" />}
        actions={
          <ActionMenu
            label={t(`Actions for ${item.name}`, `פעולות עבור ${item.name}`, lang)}
            items={[
              { key: 'edit', label: t('Edit recorded expense', 'ערוך הוצאה שנרשמה', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
              'separator',
              { key: 'delete', label: t('Delete recorded expense', 'מחק הוצאה שנרשמה', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        }
      />
      <HistoricalExpenseDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        snapshotId={snapshotId}
        monthLabel={monthLabel}
        existing={item}
        lang={lang}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={item.name || t('this expense', 'ההוצאה הזו', lang)}
        lang={lang}
        onConfirm={() => deleteHistoricalExpense(snapshotId, item.id)}
      />
    </li>
  )
}
