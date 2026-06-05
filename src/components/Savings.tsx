import { useState, useEffect } from 'react'
import { Plus, Trash2, PiggyBank, Edit2, ChevronDown, ChevronUp, ArrowLeftRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, generateId, t } from '@/lib/utils'
import { toast } from 'sonner'
import type { SavingsAccount, AccountType, Liquidity, Currency, Locale } from '@/types'

const ACCOUNT_TYPES: { value: AccountType; en: string; he: string }[] = [
  { value: 'checking', en: 'Checking', he: 'עו"ש' },
  { value: 'savings', en: 'Savings', he: 'חיסכון' },
  { value: 'deposit', en: 'Deposit', he: 'פיקדון' },
  { value: 'pension', en: 'Pension', he: 'פנסיה' },
  { value: 'study_fund', en: 'Study Fund', he: 'קרן השתלמות' },
  { value: 'stocks', en: 'Stocks', he: 'מניות' },
  { value: 'crypto', en: 'Crypto', he: 'קריפטו' },
  { value: 'real_estate', en: 'Real Estate', he: 'נדל"ן' },
  { value: 'other', en: 'Other', he: 'אחר' },
]

const LIQUIDITIES: { value: Liquidity; en: string; he: string; color: string }[] = [
  { value: 'immediate', en: 'Immediate', he: 'מיידי', color: 'success' },
  { value: 'short', en: 'Short-term', he: 'קצר טווח', color: 'secondary' },
  { value: 'medium', en: 'Medium-term', he: 'בינוני', color: 'warning' },
  { value: 'locked', en: 'Locked', he: 'נעול', color: 'destructive' },
]

function AccountDialog({
  existing,
  onSave,
  lang,
}: {
  existing?: SavingsAccount
  onSave: (a: SavingsAccount) => void
  lang: 'en' | 'he'
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SavingsAccount>(
    existing ?? {
      id: generateId(),
      name: '',
      type: 'checking',
      balance: 0,
      liquidity: 'immediate',
      annualReturnPercent: 0,
      monthlyContribution: 0,
      deductedFromSalary: false,
    }
  )
  const set = <K extends keyof SavingsAccount>(k: K, v: SavingsAccount[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (open && !existing) {
      setForm({ id: generateId(), name: '', type: 'checking', balance: 0, liquidity: 'immediate', annualReturnPercent: 0, monthlyContribution: 0, deductedFromSalary: false })
    }
  }, [open, existing])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
            title={t('Edit account', 'ערוך חשבון', lang)}
            aria-label={t('Edit account', 'ערוך חשבון', lang)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 me-1" />
            {t('Add Account', 'הוסף חשבון', lang)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? t('Edit Account', 'ערוך חשבון', lang) : t('Add Account', 'הוסף חשבון', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="acct-name">{t('Name', 'שם', lang)}</Label>
            <Input id="acct-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('e.g. Emergency Fund', 'למשל: קרן חירום', lang)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Type', 'סוג', lang)}</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{lang === 'he' ? a.he : a.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('Liquidity', 'נזילות', lang)}</Label>
              <Select value={form.liquidity} onValueChange={(v) => set('liquidity', v as Liquidity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIQUIDITIES.map((l) => <SelectItem key={l.value} value={l.value}>{lang === 'he' ? l.he : l.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="acct-balance">{t('Current Balance', 'יתרה נוכחית', lang)}</Label>
            <Input id="acct-balance" type="number" value={form.balance} onChange={(e) => set('balance', +e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="acct-return">{t('Annual Return %', 'תשואה שנתית %', lang)}</Label>
              <Input id="acct-return" type="number" step="0.1" value={form.annualReturnPercent} onChange={(e) => set('annualReturnPercent', +e.target.value)} />
            </div>
            <div>
              <Label htmlFor="acct-contrib">{t('Monthly Contribution', 'הפקדה חודשית', lang)}</Label>
              <Input id="acct-contrib" type="number" value={form.monthlyContribution} onChange={(e) => set('monthlyContribution', +e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 min-h-[44px] rounded-md border px-3 py-2 bg-muted/30">
            <Switch
              id="acct-deducted"
              checked={!!form.deductedFromSalary}
              onCheckedChange={(checked) => set('deductedFromSalary', checked)}
            />
            <Label htmlFor="acct-deducted" className="cursor-pointer leading-snug">
              {t('Deducted from salary (e.g. pension, study fund)', 'מנוכה מהשכר (למשל פנסיה, קרן השתלמות)', lang)}
            </Label>
          </div>
          <Button className="w-full" onClick={() => { onSave(form); setOpen(false) }}>
            {t('Save', 'שמור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TransferDialog({
  account,
  allAccounts,
  currency,
  locale,
  lang,
  onTransfer,
}: {
  account: SavingsAccount
  allAccounts: SavingsAccount[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
  onTransfer: (fromId: string, toId: string, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [toId, setToId] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const destinations = allAccounts.filter((a) => a.id !== account.id)

  const parsedAmount = parseFloat(amountStr)
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= account.balance
  const exceedsBalance = !isNaN(parsedAmount) && parsedAmount > account.balance
  const destination = destinations.find((a) => a.id === toId)
  const canConfirm = toId !== '' && validAmount

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
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
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          title={t('Transfer funds', 'העבר כסף', lang)}
          aria-label={t('Transfer funds', 'העבר כסף', lang)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Transfer funds', 'העבר כסף', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Source — read-only */}
          <div>
            <Label>{t('From', 'מ-', lang)}</Label>
            <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border bg-muted/30 min-h-[44px]">
              <span className="font-medium text-sm flex-1">{account.name}</span>
              <Badge variant="secondary" className="tabular-nums text-xs">
                {formatCurrency(account.balance, currency, locale)}
              </Badge>
            </div>
          </div>

          {/* Destination */}
          <div>
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
          <div>
            <Label htmlFor="transfer-amount">{t('Amount', 'סכום', lang)}</Label>
            <Input
              id="transfer-amount"
              type="number"
              min={0}
              step={100}
              max={account.balance}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="min-h-[44px]"
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('Available:', 'זמין:', lang)}{' '}
              <span className="font-medium">{formatCurrency(account.balance, currency, locale)}</span>
            </p>
            {exceedsBalance && (
              <p className="text-xs text-destructive mt-1">
                {t('Amount exceeds available balance.', 'הסכום עולה על היתרה הזמינה.', lang)}
              </p>
            )}
          </div>

          {/* Live preview */}
          {destination && validAmount && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary">{t('Preview', 'תצוגה מקדימה', lang)} — {t('after transfer', 'אחרי ההעברה', lang)}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{account.name}</span>
                <span>
                  <span className="tabular-nums">{formatCurrency(account.balance, currency, locale)}</span>
                  {' → '}
                  <span className="font-semibold tabular-nums text-destructive">
                    {formatCurrency(Math.max(0, account.balance - parsedAmount), currency, locale)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{destination.name}</span>
                <span>
                  <span className="tabular-nums">{formatCurrency(destination.balance, currency, locale)}</span>
                  {' → '}
                  <span className="font-semibold tabular-nums text-primary">
                    {formatCurrency(destination.balance + parsedAmount, currency, locale)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => handleOpenChange(false)}
            >
              {t('Cancel', 'ביטול', lang)}
            </Button>
            <Button
              className="flex-1 min-h-[44px]"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function computeLastMonthBalance(account: SavingsAccount): number | null {
  const currentYearMonth = new Date().toISOString().slice(0, 7)
  const log = account.autoIncrementLog

  if (Array.isArray(log) && log.length > 0) {
    const thisMonthAdded = log
      .filter((e) => e.month === currentYearMonth)
      .reduce((s, e) => s + e.amount, 0)
    const lastMonthBalance = account.balance - thisMonthAdded
    return lastMonthBalance > 0 ? lastMonthBalance : null
  }

  // Fallback: rough estimate using monthlyContribution
  if (account.monthlyContribution > 0) {
    const lastMonthBalance = account.balance - account.monthlyContribution
    return lastMonthBalance > 0 ? lastMonthBalance : null
  }

  return null
}

// AccountCard props are passed explicitly so the component lives at module level
// (defining it inside Savings would remount it on every keystroke)
function AccountCard({
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
}: {
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
}) {
  const liq = LIQUIDITIES.find((x) => x.value === account.liquidity)!
  const typeLabel = ACCOUNT_TYPES.find((tt) => tt.value === account.type)
  const log = account.autoIncrementLog
  const hasLog = Array.isArray(log) && log.length > 0
  const recentEntries = hasLog ? [...log].reverse().slice(0, 6) : []
  const showTransfer = allAccounts.length >= 2

  const lastMonthBalance = computeLastMonthBalance(account)
  const delta = lastMonthBalance !== null ? account.balance - lastMonthBalance : null

  return (
    <div className="py-2 border-b last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{account.name}</p>
          <div className="flex gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs py-0">{lang === 'he' ? typeLabel?.he : typeLabel?.en}</Badge>
            <Badge variant={liq.color as 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'} className="text-xs py-0">{lang === 'he' ? liq.he : liq.en}</Badge>
            {account.annualReturnPercent > 0 && (
              <Badge variant="secondary" className="text-xs py-0">{account.annualReturnPercent}%/yr</Badge>
            )}
          </div>
          {account.monthlyContribution > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              +{formatCurrency(account.monthlyContribution, currency, locale)}/mo
            </p>
          )}
          {account.deductedFromSalary && (
            <Badge variant="secondary" className="text-xs py-0 mt-0.5">
              {t('Salary deducted', 'מנוכה מהשכר', lang)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold tabular-nums">{formatCurrency(account.balance, currency, locale)}</span>
          {showTransfer && (
            <TransferDialog
              account={account}
              allAccounts={allAccounts}
              currency={currency}
              locale={locale}
              lang={lang}
              onTransfer={onTransfer}
            />
          )}
          <AccountDialog existing={account} onSave={(a) => onUpdate(a)} lang={lang} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-destructive"
                title={t('Delete account', 'מחק חשבון', lang)}
                aria-label={t('Delete account', 'מחק חשבון', lang)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Are you sure?', 'האם אתה בטוח?', lang)}</AlertDialogTitle>
                <AlertDialogDescription>{t('This cannot be undone.', 'פעולה זו אינה הפיכה.', lang)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(account.id)}
                >
                  {t('Delete', 'מחק', lang)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {lastMonthBalance !== null && delta !== null && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-muted-foreground">
            {t('Last month:', 'חודש שעבר:', lang)}{' '}
            {formatCurrency(lastMonthBalance, currency, locale)}
          </span>
          {delta > 0 && (
            <span className="font-medium text-primary">
              ▲ +{formatCurrency(delta, currency, locale)}
            </span>
          )}
          {delta < 0 && (
            <span className="font-medium text-destructive">
              ▼ {formatCurrency(delta, currency, locale)}
            </span>
          )}
          {delta === 0 && (
            <span className="text-muted-foreground">
              = {formatCurrency(0, currency, locale)}
            </span>
          )}
        </div>
      )}

      {hasLog && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onToggleExpand(account.id)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] w-full text-start"
            aria-expanded={isExpanded}
          >
            <span>📈 {t('Contribution history', 'היסטוריית הפקדות', lang)} ({log!.length})</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ms-1" /> : <ChevronDown className="h-3.5 w-3.5 ms-1" />}
          </button>

          {isExpanded && (
            <div className="mt-1 space-y-1">
              {recentEntries.map((entry, idx) => {
                const monthLabel = new Date(entry.month + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                return (
                  <div key={idx} className="flex justify-between items-center text-xs px-1">
                    <span className="text-muted-foreground">{monthLabel}</span>
                    <span className="font-medium text-primary">+{formatCurrency(entry.amount, currency, locale)}</span>
                  </div>
                )
              })}
              {account.lastAutoIncrementMonth && (
                <p className="text-xs text-muted-foreground px-1 pt-1">
                  {t('Last updated:', 'עודכן לאחרונה:', lang)}{' '}
                  {new Date(account.lastAutoIncrementMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Savings() {
  const { data, addAccount, updateAccount, deleteAccount, transferBetweenAccounts } = useFinance()
  const lang = data.language

  const liquid = data.accounts.filter((a) => a.liquidity === 'immediate' || a.liquidity === 'short')
  const locked = data.accounts.filter((a) => a.liquidity === 'medium' || a.liquidity === 'locked')
  const liquidTotal = liquid.reduce((s, a) => s + a.balance, 0)
  const lockedTotal = locked.reduce((s, a) => s + a.balance, 0)
  const totalContrib = data.accounts.reduce((s, a) => s + a.monthlyContribution, 0)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('Monthly contributions:', 'הפקדות חודשיות:', lang)}{' '}
          <span className="font-semibold text-primary">{formatCurrency(totalContrib, data.currency, data.locale)}</span>
        </p>
        <AccountDialog onSave={(a) => addAccount(a)} lang={lang} />
      </div>

      {data.accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <PiggyBank className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{t('No savings accounts yet', 'אין חשבונות חיסכון עדיין', lang)}</p>
            <p className="text-sm text-muted-foreground">{t('Add an account to track your balance and contributions.', 'הוסף חשבון כדי לעקוב אחר היתרה וההפקדות.', lang)}</p>
          </div>
          <AccountDialog onSave={(a) => addAccount(a)} lang={lang} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t('Liquid Assets', 'נכסים נזילים', lang)}</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(liquidTotal, data.currency, data.locale)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t('Locked Assets', 'נכסים נעולים', lang)}</p>
                <p className="text-xl font-bold">{formatCurrency(lockedTotal, data.currency, data.locale)}</p>
              </CardContent>
            </Card>
          </div>

          {liquid.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('Liquid Accounts', 'חשבונות נזילים', lang)}</CardTitle>
              </CardHeader>
              <CardContent>
                {liquid.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    allAccounts={data.accounts}
                    currency={data.currency}
                    locale={data.locale}
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
          )}

          {locked.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('Locked / Long-term', 'נעול / ארוך טווח', lang)}</CardTitle>
              </CardHeader>
              <CardContent>
                {locked.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    allAccounts={data.accounts}
                    currency={data.currency}
                    locale={data.locale}
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
          )}
        </>
      )}
    </div>
  )
}
