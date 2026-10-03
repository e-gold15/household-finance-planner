import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { MoneyInput } from '../ui/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { generateId, t } from '@/lib/utils'
import { parseMoneyInput, sanitizeMoneyTyping, toMoneyInputValue } from '@/lib/moneyInput'
import type { AccountType, Currency, Liquidity, Locale, SavingsAccount } from '@/types'
import { ACCOUNT_TYPES, LIQUIDITIES } from './savingsMeta'

interface AccountForm {
  name: string
  type: AccountType
  liquidity: Liquidity
  balance: string
  annualReturnPercent: string
  monthlyContribution: string
  deductedFromSalary: boolean
}

function formFrom(existing?: SavingsAccount): AccountForm {
  return {
    name: existing?.name ?? '',
    type: existing?.type ?? 'checking',
    liquidity: existing?.liquidity ?? 'immediate',
    balance: existing ? toMoneyInputValue(existing.balance) : '',
    annualReturnPercent: existing ? toMoneyInputValue(existing.annualReturnPercent) : '',
    monthlyContribution: existing ? toMoneyInputValue(existing.monthlyContribution) : '',
    deductedFromSalary: !!existing?.deductedFromSalary,
  }
}

export interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode when set; add mode otherwise. */
  existing?: SavingsAccount
  onSave: (a: SavingsAccount) => void
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
}

/** Add / edit a savings account. Controlled — the trigger lives with the caller. */
export function AccountDialog({ open, onOpenChange, existing, onSave, currency, locale, lang }: AccountDialogProps) {
  const [form, setForm] = useState<AccountForm>(() => formFrom(existing))
  const set = <K extends keyof AccountForm>(k: K, v: AccountForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Re-seed from the latest account values every time the dialog opens.
  useEffect(() => {
    if (open) setForm(formFrom(existing))
  }, [open])

  // Data safety: an empty field saves as 0, but a non-empty value that fails to
  // parse blocks Save — a typo must never silently zero a stored balance.
  const isInvalid = (s: string) => s.trim() !== '' && parseMoneyInput(s) === null
  const invalidNumber = isInvalid(form.balance) || isInvalid(form.annualReturnPercent) || isInvalid(form.monthlyContribution)

  const handleSave = () => {
    if (invalidNumber) return
    // Empty numeric fields save as 0 — never NaN (same as the v3 `+''` behaviour).
    const balance = parseMoneyInput(form.balance) ?? 0
    const annualReturnPercent = parseMoneyInput(form.annualReturnPercent) ?? 0
    const monthlyContribution = parseMoneyInput(form.monthlyContribution) ?? 0
    const base: SavingsAccount = existing ?? {
      id: generateId(),
      name: '',
      type: 'checking',
      balance: 0,
      liquidity: 'immediate',
      annualReturnPercent: 0,
      monthlyContribution: 0,
      deductedFromSalary: false,
    }
    onSave({
      ...base,
      name: form.name,
      type: form.type,
      liquidity: form.liquidity,
      balance,
      annualReturnPercent,
      monthlyContribution,
      deductedFromSalary: form.deductedFromSalary,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? t('Edit Account', 'ערוך חשבון', lang) : t('Add Account', 'הוסף חשבון', lang)}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acct-name">{t('Name', 'שם', lang)}</Label>
            <Input
              id="acct-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('e.g. Emergency Fund', 'למשל: קרן חירום', lang)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acct-type">{t('Type', 'סוג', lang)}</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v as AccountType)}>
                <SelectTrigger id="acct-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{lang === 'he' ? a.he : a.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-liquidity">{t('Liquidity', 'נזילות', lang)}</Label>
              <Select value={form.liquidity} onValueChange={(v) => set('liquidity', v as Liquidity)}>
                <SelectTrigger id="acct-liquidity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIQUIDITIES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{lang === 'he' ? l.he : l.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-balance">{t('Current Balance', 'יתרה נוכחית', lang)}</Label>
            <MoneyInput
              id="acct-balance"
              value={form.balance}
              onValueChange={(v) => set('balance', v)}
              currency={currency}
              locale={locale}
              allowNegative
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acct-return">{t('Annual Return %', 'תשואה שנתית %', lang)}</Label>
              <Input
                id="acct-return"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="num tabular-nums"
                value={form.annualReturnPercent}
                onChange={(e) => set('annualReturnPercent', sanitizeMoneyTyping(e.target.value, true))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-contrib">{t('Monthly Contribution', 'הפקדה חודשית', lang)}</Label>
              <MoneyInput
                id="acct-contrib"
                value={form.monthlyContribution}
                onValueChange={(v) => set('monthlyContribution', v)}
                currency={currency}
                locale={locale}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex min-h-[44px] items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <Switch
              id="acct-deducted"
              checked={form.deductedFromSalary}
              onCheckedChange={(checked) => set('deductedFromSalary', checked)}
            />
            <Label htmlFor="acct-deducted" className="cursor-pointer leading-snug">
              {t('Deducted from salary (e.g. pension, study fund)', 'מנוכה מהשכר (למשל פנסיה, קרן השתלמות)', lang)}
            </Label>
          </div>
          {invalidNumber && (
            <p role="alert" className="text-sm text-destructive">
              {t('Enter a valid number', 'יש להזין מספר תקין', lang)}
            </p>
          )}
          <Button className="w-full" disabled={invalidNumber} onClick={handleSave}>
            {t('Save', 'שמור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
