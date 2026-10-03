import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { MoneyInput } from '../ui/money-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import type { HistoricalIncome } from '@/types'

export interface HistoricalIncomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshotId: string
  monthLabel: string
  existing?: HistoricalIncome
  lang: 'en' | 'he'
  memberNames: string[]
}

/** Add or edit a net income entry on a past month snapshot. */
export function HistoricalIncomeDialog({
  open,
  onOpenChange,
  snapshotId,
  monthLabel,
  existing,
  lang,
  memberNames,
}: HistoricalIncomeDialogProps) {
  const { data, addHistoricalIncome, updateHistoricalIncome } = useFinance()
  const [memberName, setMemberName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setMemberName(existing?.memberName ?? (memberNames[0] ?? ''))
    setAmount(existing ? toMoneyInputValue(existing.amount) : '')
    setNote(existing?.note ?? '')
  }, [open]) // seeded once per open

  const parsedAmount = parseMoneyInput(amount, { allowNegative: false })
  const amountValid = parsedAmount !== null && parsedAmount > 0
  const isValid = memberName.trim().length > 0 && amountValid

  const handleSave = () => {
    if (!isValid || parsedAmount === null) return
    if (existing) {
      updateHistoricalIncome(snapshotId, {
        ...existing,
        memberName: memberName.trim(),
        amount: parsedAmount,
        note: note.trim() || undefined,
      })
    } else {
      addHistoricalIncome(snapshotId, {
        memberName: memberName.trim(),
        amount: parsedAmount,
        note: note.trim() || undefined,
      })
    }
    onOpenChange(false)
  }

  const dialogTitle = existing
    ? t(`Edit Income — ${monthLabel}`, `ערוך הכנסה — ${monthLabel}`, lang)
    : t(`Add Income — ${monthLabel}`, `הוסף הכנסה — ${monthLabel}`, lang)

  const idPrefix = `hist-inc-${existing?.id ?? snapshotId}`
  const listId = `${idPrefix}-members`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{dialogTitle}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {/* Member name — datalist for autocomplete from existing members */}
          <datalist id={listId}>
            {memberNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-member`}>{t('Person', 'אדם', lang)}</Label>
            <Input
              id={`${idPrefix}-member`}
              list={listId}
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder={memberNames[0] ?? t('Name', 'שם', lang)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-amount`}>{t('Net amount received', 'סכום נטו שהתקבל', lang)}</Label>
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
            <Label htmlFor={`${idPrefix}-note`}>{t('Note (optional)', 'הערה (אופציונלי)', lang)}</Label>
            <Input
              id={`${idPrefix}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. Monthly salary, Bonus…', 'למשל: משכורת חודשית, בונוס…', lang)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={!isValid}>
              {t('Save Income', 'שמור הכנסה', lang)}
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
