import { useState } from 'react'
import { Lock, PiggyBank, Plus, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Money } from './ui/money'
import { EmptyState } from './ui/empty-state'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import type { Currency, Locale, SavingsAccount } from '@/types'
import { AccountCard } from './savings/AccountCard'
import { AccountDialog } from './savings/AccountDialog'
import { isLiquid } from './savings/savingsMeta'

function TotalTile({ label, value, icon: Icon, currency, locale }: {
  label: string
  value: number
  icon: typeof Wallet
  currency: Currency
  locale: Locale
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </p>
        <Money value={value} currency={currency} locale={locale} size="lg" className="block max-w-full truncate" />
      </CardContent>
    </Card>
  )
}

export function Savings() {
  const { data, addAccount, updateAccount, deleteAccount, transferBetweenAccounts } = useFinance()
  const lang = data.language
  const { currency, locale } = data

  const liquid = data.accounts.filter(isLiquid)
  const locked = data.accounts.filter((a) => !isLiquid(a))
  const liquidTotal = liquid.reduce((s, a) => s + a.balance, 0)
  const lockedTotal = locked.reduce((s, a) => s + a.balance, 0)
  const totalContrib = data.accounts.reduce((s, a) => s + a.monthlyContribution, 0)

  const [addOpen, setAddOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderGroup = (title: string, accounts: SavingsAccount[]) =>
    accounts.length > 0 && (
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              allAccounts={data.accounts}
              currency={currency}
              locale={locale}
              lang={lang}
              isExpanded={expandedIds.has(a.id)}
              onToggleExpand={toggleExpanded}
              onUpdate={updateAccount}
              onDelete={deleteAccount}
              onTransfer={transferBetweenAccounts}
            />
          ))}
        </CardContent>
      </Card>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          {t('Monthly contributions:', 'הפקדות חודשיות:', lang)}{' '}
          <Money value={totalContrib} currency={currency} locale={locale} className="font-semibold text-foreground" />
        </p>
        {data.accounts.length > 0 && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('Add Account', 'הוסף חשבון', lang)}
          </Button>
        )}
      </div>

      {data.accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title={t('No savings accounts yet', 'אין חשבונות חיסכון עדיין', lang)}
            description={t('Add an account to track your balance and contributions.', 'הוסף חשבון כדי לעקוב אחר היתרה וההפקדות.', lang)}
            actionLabel={t('Add Account', 'הוסף חשבון', lang)}
            actionIcon={Plus}
            onAction={() => setAddOpen(true)}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TotalTile label={t('Liquid Assets', 'נכסים נזילים', lang)} value={liquidTotal} icon={Wallet} currency={currency} locale={locale} />
            <TotalTile label={t('Locked Assets', 'נכסים נעולים', lang)} value={lockedTotal} icon={Lock} currency={currency} locale={locale} />
          </div>

          {renderGroup(t('Liquid Accounts', 'חשבונות נזילים', lang), liquid)}
          {renderGroup(t('Locked / Long-term', 'נעול / ארוך טווח', lang), locked)}
        </>
      )}

      <AccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(a) => addAccount(a)}
        currency={currency}
        locale={locale}
        lang={lang}
      />
    </div>
  )
}
