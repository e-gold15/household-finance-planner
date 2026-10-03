import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Money } from '../ui/money'
import { MoneyInput } from '../ui/money-input'
import { DirIcon } from '../ui/dir-icon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { formatCurrency, t } from '@/lib/utils'
import { parseMoneyInput } from '@/lib/moneyInput'
import { toast } from 'sonner'
import type { Currency, Locale, SavingsAccount } from '@/types'

export interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: SavingsAccount
  allAccounts: SavingsAccount[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onTransfer: (fromId: string, toId: string, amount: number) => void
}

function BalanceChange({ from, to, currency, locale, tone }: {
  from: number
  to: number
  currency: Currency
  locale: Locale
  tone: 'positive' | 'negative'
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Money value={from} currency={currency} locale={locale} tone="muted" />
      <DirIcon icon={ArrowRight} className="h-3 w-3 text-muted-foreground" />
      <Money value={to} currency={currency} locale={locale} tone={tone} className="font-semibold" />
    </span>
  )
}

/** Move money between two savings accounts (calls `transferBetweenAccounts`). */
export function TransferDialog({ open, onOpenChange, account, allAccounts, currency, locale, lang, onTransfer }: TransferDialogProps) {
  const [toId, setToId] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const destinations = allAccounts.filter((a) => a.id !== account.id)

  const parsed = parseMoneyInput(amountStr, { allowNegative: false })
  const parsedAmount = parsed ?? 0
  const validAmount = parsed !== null && parsedAmount > 0 && parsedAmount <= account.balance
  const exceedsBalance = parsed !== null && parsedAmount > account.balance
  const destination = destinations.find((a) => a.id === toId)
  const canConfirm = toId !== '' && validAmount

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setToId('')
      setAmountStr('')
    }
  }

  const handleConfirm = () => {
    if (!canConfirm || !destination) return
    onTransfer(account.id, toId, parsedAmount)
    toast.success(
      lang === 'he'
        ? `${formatCurrency(parsedAmount, currency, locale)} הועבר מ-"${account.name}" ל-"${destination.name}" ✓`
        : `${formatCurrency(parsedAmount, currency, locale)} transferred from "${account.name}" to "${destination.name}" ✓`
    )
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Transfer funds', 'העבר כסף', lang)}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {/* Source — read-only */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('From', 'מ-', lang)}</p>
            <div className="flex min-h-[44px] items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{account.name}</span>
              <Money value={account.balance} currency={currency} locale={locale} className="text-sm text-muted-foreground" />
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <Label htmlFor="transfer-to">{t('To account', 'לחשבון', lang)}</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger id="transfer-to" className="min-h-[44px]">
                <SelectValue placeholder={t('Select account…', 'בחר חשבון...', lang)} />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {formatCurrency(a.balance, currency, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount">{t('Amount', 'סכום', lang)}</Label>
            <MoneyInput
              id="transfer-amount"
              value={amountStr}
              onValueChange={(v) => setAmountStr(v)}
              currency={currency}
              locale={locale}
              placeholder="0"
              aria-invalid={exceedsBalance || undefined}
              aria-describedby="transfer-available"
              className={exceedsBalance ? 'border-destructive' : undefined}
            />
            <p id="transfer-available" className="text-xs text-muted-foreground">
              {t('Available:', 'זמין:', lang)}{' '}
              <Money value={account.balance} currency={currency} locale={locale} className="font-medium" />
            </p>
            {exceedsBalance && (
              <p className="text-xs text-danger-strong" role="alert">
                {t('Amount exceeds available balance.', 'הסכום עולה על היתרה הזמינה.', lang)}
              </p>
            )}
          </div>

          {/* Live preview */}
          {destination && validAmount && (
            <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary-subtle/50 p-3">
              <p className="text-xs font-semibold text-primary-strong">
                {t('Preview', 'תצוגה מקדימה', lang)} — {t('after transfer', 'אחרי ההעברה', lang)}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{account.name}</span>
                <BalanceChange
                  from={account.balance}
                  to={Math.max(0, account.balance - parsedAmount)}
                  currency={currency}
                  locale={locale}
                  tone="negative"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{destination.name}</span>
                <BalanceChange
                  from={destination.balance}
                  to={destination.balance + parsedAmount}
                  currency={currency}
                  locale={locale}
                  tone="positive"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="min-h-[44px] flex-1" onClick={() => handleOpenChange(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
            <Button className="min-h-[44px] flex-1" disabled={!canConfirm} onClick={handleConfirm}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
