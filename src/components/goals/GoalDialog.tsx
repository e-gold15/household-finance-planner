import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { MoneyInput } from '../ui/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { generateId, t } from '@/lib/utils'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import type { Currency, Goal, GoalPriority, Locale } from '@/types'

interface GoalForm {
  name: string
  targetAmount: string
  currentAmount: string
  usedAmount: string
  deadline: string
  priority: GoalPriority
  notes: string
  useLiquidSavings: boolean
}

function formFrom(existing?: Goal): GoalForm {
  return {
    name: existing?.name ?? '',
    targetAmount: existing ? toMoneyInputValue(existing.targetAmount) : '',
    currentAmount: existing ? toMoneyInputValue(existing.currentAmount) : '',
    usedAmount: existing?.usedAmount ? toMoneyInputValue(existing.usedAmount) : '',
    deadline: existing?.deadline ?? '',
    priority: existing?.priority ?? 'medium',
    notes: existing?.notes ?? '',
    useLiquidSavings: existing?.useLiquidSavings ?? false,
  }
}

export interface GoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The stored goal (from `data.goals`) in edit mode; omit to add. */
  existing?: Goal
  onSave: (g: Goal) => void
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
}

/** Add / edit a goal. Controlled — the trigger lives with the caller. */
export function GoalDialog({ open, onOpenChange, existing, onSave, currency, locale, lang }: GoalDialogProps) {
  const [form, setForm] = useState<GoalForm>(() => formFrom(existing))
  const set = <K extends keyof GoalForm>(k: K, v: GoalForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Re-seed from the latest stored goal every time the dialog opens.
  useEffect(() => {
    if (open) setForm(formFrom(existing))
  }, [open])

  // Empty / invalid numeric fields count as 0 — never NaN.
  const targetAmount = parseMoneyInput(form.targetAmount, { allowNegative: false }) ?? 0
  const currentAmount = parseMoneyInput(form.currentAmount, { allowNegative: false }) ?? 0
  const usedAmount = parseMoneyInput(form.usedAmount, { allowNegative: false }) ?? 0

  // Data safety: a non-empty value that fails to parse blocks Save — a typo
  // must never silently zero a stored target / saved amount.
  const isInvalid = (s: string) => s.trim() !== '' && parseMoneyInput(s, { allowNegative: false }) === null
  const invalidNumber = isInvalid(form.targetAmount) || isInvalid(form.currentAmount) || isInvalid(form.usedAmount)

  const usedAmountError = invalidNumber
    ? t('Enter a valid number', 'יש להזין מספר תקין', lang)
    : usedAmount > currentAmount ? t('Cannot exceed amount already saved', 'לא יכול לעלות על הסכום שנחסך', lang) : null

  const handleSave = () => {
    if (usedAmountError) return
    const base: Goal = existing ?? {
      id: generateId(),
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      usedAmount: 0,
      deadline: '',
      priority: 'medium',
      notes: '',
      useLiquidSavings: false,
    }
    onSave({
      ...base,
      name: form.name,
      targetAmount,
      currentAmount,
      usedAmount,
      deadline: form.deadline,
      priority: form.priority,
      notes: form.notes,
      useLiquidSavings: form.useLiquidSavings,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? t('Edit Goal', 'ערוך יעד', lang) : t('Add Goal', 'הוסף יעד', lang)}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">{t('Goal Name', 'שם היעד', lang)}</Label>
            <Input
              id="goal-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('e.g. Emergency Fund', 'למשל: קרן חירום', lang)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">{t('Target Amount', 'סכום יעד', lang)}</Label>
              <MoneyInput
                id="goal-target"
                value={form.targetAmount}
                onValueChange={(v) => set('targetAmount', v)}
                currency={currency}
                locale={locale}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-saved">{t('Already Saved', 'כבר חסכת', lang)}</Label>
              <MoneyInput
                id="goal-saved"
                value={form.currentAmount}
                onValueChange={(v) => set('currentAmount', v)}
                currency={currency}
                locale={locale}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-used">{t('Amount Used', 'סכום שנוצל', lang)}</Label>
            <MoneyInput
              id="goal-used"
              value={form.usedAmount}
              onValueChange={(v) => set('usedAmount', v)}
              currency={currency}
              locale={locale}
              placeholder="0"
              aria-invalid={usedAmountError ? true : undefined}
              aria-describedby={usedAmountError ? 'goal-used-error' : undefined}
              className={usedAmountError ? 'border-destructive' : undefined}
            />
            {usedAmountError && (
              <p id="goal-used-error" className="text-xs text-danger-strong" role="alert">{usedAmountError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-deadline">{t('Deadline', 'תאריך יעד', lang)}</Label>
            {/* <input type="date"> only accepts yyyy-MM-dd; full ISO deadlines (demo data, older imports)
                rendered blank. Display-only slice — the stored value is untouched unless the user edits it. */}
            <Input id="goal-deadline" type="date" value={form.deadline.slice(0, 10)} onChange={(e) => set('deadline', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-priority">{t('Priority', 'עדיפות', lang)}</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v as GoalPriority)}>
              <SelectTrigger id="goal-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t('High', 'גבוה', lang)}</SelectItem>
                <SelectItem value="medium">{t('Medium', 'בינוני', lang)}</SelectItem>
                <SelectItem value="low">{t('Low', 'נמוך', lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-notes">{t('Notes', 'הערות', lang)}</Label>
            <Input
              id="goal-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('Optional notes…', 'הערות אופציונליות…', lang)}
            />
          </div>
          <div className="flex min-h-[44px] items-center gap-3">
            <Switch
              id="goal-liquid"
              checked={form.useLiquidSavings}
              onCheckedChange={(v) => set('useLiquidSavings', v)}
            />
            <Label htmlFor="goal-liquid" className="cursor-pointer leading-snug">
              {t('Use liquid savings toward this goal', 'השתמש בחסכונות נזילים לעבר יעד זה', lang)}
            </Label>
          </div>
          <Button className="w-full" disabled={!!usedAmountError} onClick={handleSave}>
            {t('Save', 'שמור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
