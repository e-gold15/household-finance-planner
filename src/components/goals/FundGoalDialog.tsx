import { useState } from 'react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Money } from '../ui/money'
import { MoneyInput } from '../ui/money-input'
import { Progress } from '../ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { formatCurrency, t } from '@/lib/utils'
import { parseMoneyInput } from '@/lib/moneyInput'
import { toast } from 'sonner'
import type { Currency, Goal, Locale, SavingsAccount } from '@/types'

export interface FundGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal
  accounts: SavingsAccount[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onFund: (accountId: string, amount: number) => void
}

/** Move money from a savings account into a goal (calls `fundGoalFromSavings`). */
export function FundGoalDialog({ open, onOpenChange, goal, accounts, currency, locale, lang, onFund }: FundGoalDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [amountStr, setAmountStr] = useState('')

  const hasAccounts = accounts.length > 0
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null
  const parsedAmount = parseMoneyInput(amountStr, { allowNegative: false }) ?? 0

  const isOverBalance = selectedAccount !== null && parsedAmount > selectedAccount.balance
  const isValid = selectedAccount !== null && parsedAmount > 0 && !isOverBalance

  const newGoalAmount = goal.currentAmount + parsedAmount
  const newGoalPct = goal.targetAmount > 0 ? Math.min(100, (newGoalAmount / goal.targetAmount) * 100) : 0
  const newAccountBalance = selectedAccount ? Math.max(0, selectedAccount.balance - parsedAmount) : 0
  const showPreview = isValid

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setSelectedAccountId('')
      setAmountStr('')
    }
  }

  const handleConfirm = () => {
    if (!isValid || !selectedAccount) return
    onFund(selectedAccount.id, parsedAmount)
    const amountFmt = formatCurrency(parsedAmount, currency, locale)
    toast.success(
      t(
        `${amountFmt} transferred from "${selectedAccount.name}" to "${goal.name}" ✓`,
        `${amountFmt} הועבר מ-"${selectedAccount.name}" ל-"${goal.name}" ✓`,
        lang
      )
    )
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add Funds to Goal', 'הוסף כסף ליעד', lang)}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-1">
            <span className="min-w-0 truncate">{goal.name}</span>
            <span aria-hidden="true">·</span>
            <Money value={goal.currentAmount} currency={currency} locale={locale} />
            <span>/</span>
            <Money value={goal.targetAmount} currency={currency} locale={locale} />
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fund-account">{t('Source — Savings Account', 'מקור — חשבון חיסכון', lang)}</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={!hasAccounts}>
              <SelectTrigger id="fund-account" className="min-h-[44px]">
                <SelectValue placeholder={t('Select account…', 'בחר חשבון...', lang)} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {formatCurrency(a.balance, currency, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-xs text-muted-foreground">
                {t('Available:', 'זמין:', lang)}{' '}
                <Money value={selectedAccount.balance} currency={currency} locale={locale} className="font-medium" />
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fund-amount">{t('Amount', 'סכום', lang)}</Label>
            <MoneyInput
              id="fund-amount"
              value={amountStr}
              onValueChange={(v) => setAmountStr(v)}
              currency={currency}
              locale={locale}
              placeholder="0"
              aria-invalid={isOverBalance || undefined}
              className={isOverBalance ? 'border-destructive' : undefined}
            />
            {isOverBalance && (
              <p className="text-xs text-danger-strong" role="alert">
                {t('Amount exceeds available balance.', 'הסכום עולה על היתרה הזמינה.', lang)}
              </p>
            )}
          </div>

          {showPreview && selectedAccount && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary-subtle/50 p-3">
              <p className="text-xs font-semibold text-primary-strong">
                {t('Preview', 'תצוגה מקדימה', lang)} — {t('after transfer', 'אחרי ההעברה', lang)}
              </p>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{goal.name}</span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Money value={newGoalAmount} currency={currency} locale={locale} />
                    <bdi className="num tabular-nums text-muted-foreground">({newGoalPct.toFixed(0)}%)</bdi>
                  </span>
                </div>
                <Progress value={newGoalPct} className="h-2" aria-label={`${goal.name} – ${newGoalPct.toFixed(0)}%`} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm text-muted-foreground">
                <span className="min-w-0">
                  {selectedAccount.name} {t('balance after', 'יתרה אחרי', lang)}
                </span>
                <Money value={newAccountBalance} currency={currency} locale={locale} className="font-medium text-foreground" />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="min-h-[44px] flex-1" onClick={() => handleOpenChange(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
            <Button className="min-h-[44px] flex-1" disabled={!isValid} onClick={handleConfirm}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>

          {!hasAccounts && (
            <p className="text-center text-xs text-muted-foreground">
              {t('Add a savings account first', 'הוסף חשבון חיסכון תחילה', lang)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
