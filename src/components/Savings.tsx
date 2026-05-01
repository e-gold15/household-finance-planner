import { useState, useEffect } from 'react'
import { Plus, Trash2, PiggyBank, Edit2 } from 'lucide-react'
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
import type { SavingsAccount, AccountType, Liquidity } from '@/types'

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

export function Savings() {
  const { data, addAccount, updateAccount, deleteAccount } = useFinance()
  const lang = data.language

  const liquid = data.accounts.filter((a) => a.liquidity === 'immediate' || a.liquidity === 'short')
  const locked = data.accounts.filter((a) => a.liquidity === 'medium' || a.liquidity === 'locked')
  const liquidTotal = liquid.reduce((s, a) => s + a.balance, 0)
  const lockedTotal = locked.reduce((s, a) => s + a.balance, 0)
  const totalContrib = data.accounts.reduce((s, a) => s + a.monthlyContribution, 0)

  const getLiquidityInfo = (l: Liquidity) => LIQUIDITIES.find((x) => x.value === l)!

  const AccountCard = ({ account }: { account: SavingsAccount }) => {
    const liq = getLiquidityInfo(account.liquidity)
    const typeLabel = ACCOUNT_TYPES.find((t) => t.value === account.type)
    return (
      <div className="flex items-center justify-between py-2 border-b last:border-0">
        <div>
          <p className="font-medium text-sm">{account.name}</p>
          <div className="flex gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs py-0">{lang === 'he' ? typeLabel?.he : typeLabel?.en}</Badge>
            <Badge variant={liq.color as any} className="text-xs py-0">{lang === 'he' ? liq.he : liq.en}</Badge>
            {account.annualReturnPercent > 0 && (
              <Badge variant="secondary" className="text-xs py-0">{account.annualReturnPercent}%/yr</Badge>
            )}
          </div>
          {account.monthlyContribution > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              +{formatCurrency(account.monthlyContribution, data.currency, data.locale)}/mo
            </p>
          )}
          {account.deductedFromSalary && (
            <Badge variant="secondary" className="text-xs py-0 mt-0.5">
              {t('Salary deducted', 'מנוכה מהשכר', lang)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold tabular-nums">{formatCurrency(account.balance, data.currency, data.locale)}</span>
          <AccountDialog existing={account} onSave={(a) => updateAccount(a)} lang={lang} />
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
                  onClick={() => deleteAccount(account.id)}
                >
                  {t('Delete', 'מחק', lang)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    )
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
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <PiggyBank className="h-10 w-10" />
          <p>{t('Add your savings accounts and assets', 'הוסף חשבונות חיסכון ונכסים', lang)}</p>
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
                {liquid.map((a) => <AccountCard key={a.id} account={a} />)}
              </CardContent>
            </Card>
          )}

          {locked.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('Locked / Long-term', 'נעול / ארוך טווח', lang)}</CardTitle>
              </CardHeader>
              <CardContent>
                {locked.map((a) => <AccountCard key={a.id} account={a} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
