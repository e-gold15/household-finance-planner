import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { MoneyInput } from '../ui/money-input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import { parseMoneyInput } from '@/lib/moneyInput'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { ExpenseCategory, MonthSnapshot } from '@/types'

export interface ActualsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snap: MonthSnapshot
  monthLabel: string
  lang: 'en' | 'he'
}

/** Record or edit what was actually spent per category in a past month. */
export function ActualsDialog({ open, onOpenChange, snap, monthLabel, lang }: ActualsDialogProps) {
  const { data, updateSnapshotActuals } = useFinance()
  const [form, setForm] = useState<Record<string, string>>({})

  // Seed from existing actuals each time the dialog opens (blank when unset).
  useEffect(() => {
    if (!open) return
    const init: Record<string, string> = {}
    CATEGORIES.forEach(({ value }) => {
      const existing = snap.categoryActuals?.[value]
      init[value] = existing != null ? existing.toFixed(0) : ''
    })
    setForm(init)
  }, [open]) // seeded once per open

  const handleSave = () => {
    const actuals: Partial<Record<ExpenseCategory, number>> = {}
    CATEGORIES.forEach(({ value }) => {
      const n = parseMoneyInput(form[value] ?? '', { allowNegative: false })
      if (n !== null && n >= 0) actuals[value] = n
    })
    updateSnapshotActuals(snap.id, actuals)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{monthLabel} — {t('Actual Spending', 'הוצאות בפועל', lang)}</span>
          </DialogTitle>
          <DialogDescription>
            {t(
              'Enter what you actually spent per category. Pre-filled with your planned amounts — edit only what changed.',
              'הזן כמה הוצאת בפועל לכל קטגוריה. ערכים ממולאים לפי תכנון — ערוך רק מה שהשתנה.',
              lang
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 space-y-3">
          {CATEGORIES.map(({ value, en, he }) => {
            const id = `actual-${snap.id}-${value}`
            return (
              <div key={value} className="flex items-center gap-3">
                <Label htmlFor={id} className="w-24 shrink-0 text-sm">{lang === 'he' ? he : en}</Label>
                <MoneyInput
                  id={id}
                  wrapperClassName="min-w-0 flex-1"
                  value={form[value] ?? ''}
                  onValueChange={(v) => setForm((f) => ({ ...f, [value]: v }))}
                  currency={data.currency}
                  locale={data.locale}
                  placeholder="0"
                />
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={handleSave}>
            {t('Save Actuals', 'שמור בפועל', lang)}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('Cancel', 'ביטול', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
