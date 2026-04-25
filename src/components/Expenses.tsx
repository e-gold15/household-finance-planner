import { useState } from 'react'
import { Plus, Trash2, ShoppingCart, Edit2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Switch } from './ui/switch'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, generateId, t } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'

const CATEGORIES: { value: ExpenseCategory; en: string; he: string }[] = [
  { value: 'housing', en: 'Housing', he: 'דיור' },
  { value: 'food', en: 'Food', he: 'מזון' },
  { value: 'transport', en: 'Transport', he: 'תחבורה' },
  { value: 'education', en: 'Education', he: 'חינוך' },
  { value: 'leisure', en: 'Leisure', he: 'פנאי' },
  { value: 'health', en: 'Health', he: 'בריאות' },
  { value: 'utilities', en: 'Utilities', he: 'שירותים' },
  { value: 'clothing', en: 'Clothing', he: 'ביגוד' },
  { value: 'insurance', en: 'Insurance', he: 'ביטוח' },
  { value: 'savings', en: 'Savings', he: 'חיסכון' },
  { value: 'other', en: 'Other', he: 'אחר' },
]

function ExpenseDialog({
  existing,
  onSave,
  lang,
}: {
  existing?: Expense
  onSave: (e: Expense) => void
  lang: 'en' | 'he'
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Expense>(
    existing ?? { id: generateId(), name: '', amount: 0, category: 'other', recurring: true, period: 'monthly' }
  )
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
            title={t('Edit expense', 'ערוך הוצאה', lang)}
            aria-label={t('Edit expense', 'ערוך הוצאה', lang)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 me-1" />
            {t('Add Expense', 'הוסף הוצאה', lang)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? t('Edit Expense', 'ערוך הוצאה', lang) : t('Add Expense', 'הוסף הוצאה', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t('Name', 'שם', lang)}</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('e.g. Rent', 'למשל: שכ"ד', lang)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Amount', 'סכום', lang)}</Label>
              <Input type="number" value={form.amount} onChange={(e) => set('amount', +e.target.value)} />
            </div>
            <div>
              <Label>{t('Period', 'תדירות', lang)}</Label>
              <Select value={form.period} onValueChange={(v) => set('period', v as 'monthly' | 'yearly')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('Monthly', 'חודשי', lang)}</SelectItem>
                  <SelectItem value="yearly">{t('Yearly', 'שנתי', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t('Category', 'קטגוריה', lang)}</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{lang === 'he' ? c.he : c.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.recurring} onCheckedChange={(v) => set('recurring', v)} />
            <Label>{t('Recurring expense', 'הוצאה קבועה', lang)}</Label>
          </div>
          <Button className="w-full" onClick={() => { onSave(form); setOpen(false) }}>
            {t('Save', 'שמור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Expenses() {
  const { data, addExpense, updateExpense, deleteExpense } = useFinance()
  const lang = data.language

  const grouped = CATEGORIES.reduce<Record<ExpenseCategory, Expense[]>>((acc, cat) => {
    acc[cat.value] = data.expenses.filter((e) => e.category === cat.value)
    return acc
  }, {} as Record<ExpenseCategory, Expense[]>)

  const monthly = (e: Expense) => (e.period === 'yearly' ? e.amount / 12 : e.amount)
  const total = data.expenses.reduce((s, e) => s + monthly(e), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('Total monthly:', 'סה"כ חודשי:', lang)}{' '}
          <span className="font-semibold text-destructive">{formatCurrency(total, data.currency, data.locale)}</span>
        </p>
        <ExpenseDialog onSave={(e) => addExpense(e)} lang={lang} />
      </div>

      {data.expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ShoppingCart className="h-10 w-10" />
          <p>{t('No expenses yet. Add your first one!', 'אין הוצאות עדיין. הוסף את הראשונה!', lang)}</p>
        </div>
      ) : (
        CATEGORIES.filter((cat) => grouped[cat.value].length > 0).map((cat) => {
          const catTotal = grouped[cat.value].reduce((s, e) => s + monthly(e), 0)
          return (
            <Card key={cat.value}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{lang === 'he' ? cat.he : cat.en}</CardTitle>
                  <Badge variant="outline">{formatCurrency(catTotal, data.currency, data.locale)}/mo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[cat.value].map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{expense.name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <Badge variant={expense.recurring ? 'secondary' : 'outline'} className="text-xs py-0">
                          {expense.recurring ? t('Recurring', 'קבוע', lang) : t('One-time', 'חד פעמי', lang)}
                        </Badge>
                        {expense.period === 'yearly' && (
                          <Badge variant="outline" className="text-xs py-0">
                            {formatCurrency(expense.amount / 12, data.currency, data.locale)}/mo
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(expense.amount, data.currency, data.locale)}{expense.period === 'yearly' ? '/yr' : '/mo'}
                      </span>
                      <ExpenseDialog existing={expense} onSave={(e) => updateExpense(e)} lang={lang} />
                      <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-destructive"
                        onClick={() => deleteExpense(expense.id)}
                        title={t('Delete expense', 'מחק הוצאה', lang)}
                        aria-label={t('Delete expense', 'מחק הוצאה', lang)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
