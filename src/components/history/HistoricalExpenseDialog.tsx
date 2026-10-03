import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { MoneyInput } from '../ui/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { ExpenseCategory, HistoricalExpense } from '@/types'

export interface HistoricalExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshotId: string
  monthLabel: string
  existing?: HistoricalExpense
  lang: 'en' | 'he'
}

/** Add or edit a named expense line item on a past month snapshot. */
export function HistoricalExpenseDialog({ open, onOpenChange, snapshotId, monthLabel, existing, lang }: HistoricalExpenseDialogProps) {
  const { data, addHistoricalExpense, updateHistoricalExpense } = useFinance()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('other')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setName(existing?.name ?? '')
    setAmount(existing ? toMoneyInputValue(existing.amount) : '')
    setCategory(existing?.category ?? 'other')
    setNote(existing?.note ?? '')
  }, [open]) // seeded once per open

  const parsedAmount = parseMoneyInput(amount, { allowNegative: false })
  const amountValid = parsedAmount !== null && parsedAmount > 0
  const isValid = name.trim().length > 0 && amountValid
  const idPrefix = `hist-exp-${existing?.id ?? snapshotId}`

  const handleSave = () => {
    if (!isValid || parsedAmount === null) return
    if (existing) {
      updateHistoricalExpense(snapshotId, {
        ...existing,
        name: name.trim(),
        amount: parsedAmount,
        category,
        note: note.trim() || undefined,
      })
    } else {
      addHistoricalExpense(snapshotId, {
        name: name.trim(),
        amount: parsedAmount,
        category,
        note: note.trim() || undefined,
      })
    }
    onOpenChange(false)
  }

  const dialogTitle = existing
    ? t(`Edit Expense — ${monthLabel}`, `ערוך הוצאה — ${monthLabel}`, lang)
    : t(`Add Expense — ${monthLabel}`, `הוסף הוצאה — ${monthLabel}`, lang)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{dialogTitle}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-name`}>{t('Name', 'שם', lang)}</Label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Dentist visit', 'למשל: ביקור אצל רופא שיניים', lang)}
            />
            {name.length > 0 && name.trim().length === 0 && (
              <p className="text-xs text-danger-strong">{t('Name is required', 'שם חובה', lang)}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-amount`}>{t('Amount', 'סכום', lang)}</Label>
              <MoneyInput
                id={`${idPrefix}-amount`}
                value={amount}
                onValueChange={(v) => setAmount(v)}
                currency={data.currency}
                locale={data.locale}
                placeholder="0"
                aria-invalid={amount.length > 0 && !amountValid ? true : undefined}
              />
              {amount.length > 0 && !amountValid && (
                <p className="text-xs text-danger-strong">{t('Amount must be greater than 0', 'הסכום חייב להיות גדול מ-0', lang)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-category`}>{t('Category', 'קטגוריה', lang)}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger id={`${idPrefix}-category`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {lang === 'he' ? c.he : c.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-note`}>{t('Note (optional)', 'הערה (אופציונלי)', lang)}</Label>
            <Input
              id={`${idPrefix}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('Any extra detail…', 'פרטים נוספים…', lang)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={!isValid}>
              {t('Save Expense', 'שמור הוצאה', lang)}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
