import { useState } from 'react'
import { ArrowLeftRight, ChevronDown, Edit2, Trash2, TrendingDown, TrendingUp, Minus, History as HistoryIcon } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Money } from '../ui/money'
import { ActionMenu, type ActionMenuEntry } from '../ui/action-menu'
import { ConfirmDelete } from '../ui/confirm-delete'
import { cn, t } from '@/lib/utils'
import type { Currency, Locale, SavingsAccount } from '@/types'
import { ACCOUNT_TYPES, LIQUIDITIES, computeLastMonthBalance } from './savingsMeta'
import { AccountDialog } from './AccountDialog'
import { TransferDialog } from './TransferDialog'

export interface AccountCardProps {
  account: SavingsAccount
  allAccounts: SavingsAccount[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onUpdate: (a: SavingsAccount) => void
  onDelete: (id: string) => void
  onTransfer: (fromId: string, toId: string, amount: number) => void
}

function formatPercentNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

/**
 * Two-line savings account row (P0-6): name · balance · ⋯ on line 1, wrapping
 * badges on line 2. Transfer / Edit / Delete live in the ⋯ menu.
 */
export function AccountCard({
  account,
  allAccounts,
  currency,
  locale,
  lang,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onTransfer,
}: AccountCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const liq = LIQUIDITIES.find((x) => x.value === account.liquidity) ?? LIQUIDITIES[0]
  const typeLabel = ACCOUNT_TYPES.find((tt) => tt.value === account.type)
  const log = account.autoIncrementLog
  const hasLog = Array.isArray(log) && log.length > 0
  const recentEntries = hasLog ? [...log].reverse().slice(0, 6) : []
  const showTransfer = allAccounts.length >= 2

  const lastMonthBalance = computeLastMonthBalance(account)
  const delta = lastMonthBalance !== null ? account.balance - lastMonthBalance : null
  const historyId = `acct-history-${account.id}`

  const menuItems: ActionMenuEntry[] = [
    ...(showTransfer
      ? [{ key: 'transfer', label: t('Transfer funds', 'העבר כסף', lang), icon: ArrowLeftRight, onSelect: () => setTransferOpen(true) }]
      : []),
    { key: 'edit', label: t('Edit account', 'ערוך חשבון', lang), icon: Edit2, onSelect: () => setEditOpen(true) },
    'separator',
    { key: 'delete', label: t('Delete account', 'מחק חשבון', lang), icon: Trash2, destructive: true, onSelect: () => setDeleteOpen(true) },
  ]

  return (
    <div className="border-b py-3 last:border-0">
      {/* Line 1: name · balance · ⋯ */}
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={account.name}>{account.name}</p>
        <Money value={account.balance} currency={currency} locale={locale} className="font-semibold" />
        <ActionMenu
          items={menuItems}
          label={t(`Actions for ${account.name}`, `פעולות עבור ${account.name}`, lang)}
          triggerClassName="-me-2"
        />
      </div>

      {/* Line 2: wrapping badges */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="py-0 text-xs">{lang === 'he' ? typeLabel?.he : typeLabel?.en}</Badge>
        <Badge variant={liq.variant} className="py-0 text-xs">{lang === 'he' ? liq.he : liq.en}</Badge>
        {account.annualReturnPercent > 0 && (
          <Badge variant="secondary" className="py-0 text-xs">
            <bdi className="num tabular-nums">{formatPercentNumber(account.annualReturnPercent, locale)}%</bdi>
            {t('/yr', '\u00a0בשנה', lang)}
          </Badge>
        )}
        {account.deductedFromSalary && (
          <Badge variant="secondary" className="py-0 text-xs">
            {t('Salary deducted', 'מנוכה מהשכר', lang)}
          </Badge>
        )}
        {account.monthlyContribution > 0 && (
          <span className="text-xs text-muted-foreground">
            <Money value={account.monthlyContribution} currency={currency} locale={locale} showSign />
            {t('/mo', '\u00a0לחודש', lang)}
          </span>
        )}
      </div>

      {/* Last-month progress row (kept from v3.2) */}
      {lastMonthBalance !== null && delta !== null && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">
            {t('Last month:', 'חודש שעבר:', lang)}{' '}
            <Money value={lastMonthBalance} currency={currency} locale={locale} />
          </span>
          {delta > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-success-strong">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('Up', 'עלייה', lang)}</span>
              <Money value={delta} currency={currency} locale={locale} showSign />
            </span>
          )}
          {delta < 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-danger-strong">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('Down', 'ירידה', lang)}</span>
              <Money value={delta} currency={currency} locale={locale} />
            </span>
          )}
          {delta === 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              <Money value={0} currency={currency} locale={locale} />
            </span>
          )}
        </div>
      )}

      {/* Contribution history (expanded state is React state only) */}
      {hasLog && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => onToggleExpand(account.id)}
            className="flex min-h-[44px] w-full items-center gap-1.5 rounded-md text-start text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={isExpanded}
            aria-controls={historyId}
          >
            <HistoryIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t('Contribution history', 'היסטוריית הפקדות', lang)} ({log!.length})
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-fast', isExpanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {isExpanded && (
            <div id={historyId} className="space-y-1 pb-1">
              {recentEntries.map((entry, idx) => {
                const monthLabel = new Date(entry.month + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 px-1 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">{monthLabel}</span>
                    <Money value={entry.amount} currency={currency} locale={locale} tone="positive" showSign className="font-medium" />
                  </div>
                )
              })}
              {account.lastAutoIncrementMonth && (
                <p className="px-1 pt-1 text-xs text-muted-foreground">
                  {t('Last updated:', 'עודכן לאחרונה:', lang)}{' '}
                  {new Date(account.lastAutoIncrementMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showTransfer && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          account={account}
          allAccounts={allAccounts}
          currency={currency}
          locale={locale}
          lang={lang}
          onTransfer={onTransfer}
        />
      )}
      <AccountDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={account}
        onSave={onUpdate}
        currency={currency}
        locale={locale}
        lang={lang}
      />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={account.name || t('this account', 'החשבון הזה', lang)}
        lang={lang}
        onConfirm={() => onDelete(account.id)}
      />
    </div>
  )
}
