import { useState } from 'react'
import { Camera, History as HistoryIcon, Trash2, ClipboardList, Edit2, Plus, Receipt, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, t } from '@/lib/utils'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { ExpenseCategory, MonthSnapshot, HistoricalExpense, HistoricalIncome } from '@/types'

// ── ActualsDialog ─────────────────────────────────────────────────────────────
// Lets the user record or edit what they actually spent per category in a past month.

function ActualsDialog({
  snap,
  lang,
}: {
  snap: MonthSnapshot
  lang: 'en' | 'he'
}) {
  const { data, updateSnapshotActuals } = useFinance()
  const [open, setOpen] = useState(false)

  // Initialise form from existing actuals (or empty strings so inputs are blank)
  const [form, setForm] = useState<Record<string, string>>({})

  const handleOpen = (o: boolean) => {
    if (o) {
      const init: Record<string, string> = {}
      CATEGORIES.forEach(({ value }) => {
        const existing = snap.categoryActuals?.[value]
        init[value] = existing != null ? existing.toFixed(0) : ''
      })
      setForm(init)
    }
    setOpen(o)
  }

  const handleSave = () => {
    const actuals: Partial<Record<ExpenseCategory, number>> = {}
    CATEGORIES.forEach(({ value }) => {
      const n = parseFloat(form[value] ?? '')
      if (!isNaN(n) && n >= 0) actuals[value] = n
    })
    updateSnapshotActuals(snap.id, actuals)
    setOpen(false)
  }

  const hasActuals = snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 min-h-[44px]"
          title={t('Log actual spending for this month', 'רשום הוצאות בפועל לחודש זה', lang)}>
          <ClipboardList className="h-3.5 w-3.5" />
          {hasActuals ? t('Edit Actuals', 'ערוך בפועל', lang) : t('Log Actuals', 'רשום בפועל', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {snap.label} — {t('Actual Spending', 'הוצאות בפועל', lang)}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            'Enter what you actually spent per category. Pre-filled with your planned amounts — edit only what changed.',
            'הזן כמה הוצאת בפועל לכל קטגוריה. ערכים ממולאים לפי תכנון — ערוך רק מה שהשתנה.',
            lang
          )}
        </p>
        <div className="space-y-3 mt-3">
          {CATEGORIES.map(({ value, en, he }) => (
            <div key={value} className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-sm">{lang === 'he' ? he : en}</Label>
              <Input
                type="number"
                min="0"
                value={form[value] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [value]: e.target.value }))}
                placeholder="0"
                className="flex-1"
                aria-label={`${lang === 'he' ? he : en} — ${t('actual amount', 'סכום בפועל', lang)}`}
              />
              <span className="text-xs text-muted-foreground shrink-0">
                {formatCurrency(0, data.currency, data.locale).replace('0', '').trim()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={handleSave}>
            {t('Save Actuals', 'שמור בפועל', lang)}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('Cancel', 'ביטול', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── HistoricalExpenseDialog ───────────────────────────────────────────────────
// Lets the user add or edit a named expense line item on a past month snapshot.

function HistoricalExpenseDialog({
  snapshotId,
  snapLabel,
  existing,
  lang,
}: {
  snapshotId: string
  snapLabel: string
  existing?: HistoricalExpense
  lang: 'en' | 'he'
}) {
  const { addHistoricalExpense, updateHistoricalExpense } = useFinance()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('other')
  const [note, setNote] = useState('')

  const handleOpen = (o: boolean) => {
    if (o) {
      setName(existing?.name ?? '')
      setAmount(existing?.amount.toString() ?? '')
      setCategory(existing?.category ?? 'other')
      setNote(existing?.note ?? '')
    }
    setOpen(o)
  }

  const isValid = name.trim().length > 0 && parseFloat(amount) > 0

  const handleSave = () => {
    const amt = parseFloat(amount)
    if (!isValid) return
    if (existing) {
      updateHistoricalExpense(snapshotId, {
        ...existing,
        name: name.trim(),
        amount: amt,
        category,
        note: note.trim() || undefined,
      })
    } else {
      addHistoricalExpense(snapshotId, {
        name: name.trim(),
        amount: amt,
        category,
        note: note.trim() || undefined,
      })
    }
    setOpen(false)
  }

  const dialogTitle = existing
    ? t(`Edit Expense — ${snapLabel}`, `ערוך הוצאה — ${snapLabel}`, lang)
    : t(`Add Expense — ${snapLabel}`, `הוסף הוצאה — ${snapLabel}`, lang)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button
            variant="ghost" size="icon"
            className="min-h-[44px] min-w-[44px]"
            title={t('Edit recorded expense', 'ערוך הוצאה שנרשמה', lang)}
            aria-label={t('Edit recorded expense', 'ערוך הוצאה שנרשמה', lang)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline" size="sm"
            className="text-xs gap-1.5 min-h-[44px]"
            title={t(`Add expense to ${snapLabel}`, `הוסף הוצאה ל${snapLabel}`, lang)}
            aria-label={t(`Add expense to ${snapLabel}`, `הוסף הוצאה ל${snapLabel}`, lang)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Add Expense', 'הוסף הוצאה', lang)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="hist-exp-name">{t('Name', 'שם', lang)}</Label>
            <Input
              id="hist-exp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Dentist visit', 'למשל: ביקור אצל רופא שיניים', lang)}
              aria-label={t('Expense name', 'שם הוצאה', lang)}
            />
            {name.length > 0 && name.trim().length === 0 && (
              <p className="text-xs text-destructive mt-1">{t('Name is required', 'שם חובה', lang)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="hist-exp-amount">{t('Amount', 'סכום', lang)}</Label>
              <Input
                id="hist-exp-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={t('Amount', 'סכום', lang)}
              />
              {amount.length > 0 && !(parseFloat(amount) > 0) && (
                <p className="text-xs text-destructive mt-1">{t('Amount must be greater than 0', 'הסכום חייב להיות גדול מ-0', lang)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="hist-exp-category">{t('Category', 'קטגוריה', lang)}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger id="hist-exp-category" aria-label={t('Category', 'קטגוריה', lang)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {lang === 'he' ? c.he : c.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="hist-exp-note">{t('Note (optional)', 'הערה (אופציונלי)', lang)}</Label>
            <Input
              id="hist-exp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('Any extra detail…', 'פרטים נוספים…', lang)}
              aria-label={t('Note', 'הערה', lang)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={!isValid}>
              {t('Save Expense', 'שמור הוצאה', lang)}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── HistoricalIncomeDialog ────────────────────────────────────────────────────
// Lets the user add or edit a net income entry on a past month snapshot.

function HistoricalIncomeDialog({
  snapshotId,
  snapLabel,
  existing,
  lang,
  memberNames,
}: {
  snapshotId: string
  snapLabel: string
  existing?: HistoricalIncome
  lang: 'en' | 'he'
  memberNames: string[]
}) {
  const { addHistoricalIncome, updateHistoricalIncome } = useFinance()
  const [open, setOpen] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const handleOpen = (o: boolean) => {
    if (o) {
      setMemberName(existing?.memberName ?? (memberNames[0] ?? ''))
      setAmount(existing?.amount.toString() ?? '')
      setNote(existing?.note ?? '')
    }
    setOpen(o)
  }

  const isValid = memberName.trim().length > 0 && parseFloat(amount) > 0

  const handleSave = () => {
    const amt = parseFloat(amount)
    if (!isValid) return
    if (existing) {
      updateHistoricalIncome(snapshotId, {
        ...existing,
        memberName: memberName.trim(),
        amount: amt,
        note: note.trim() || undefined,
      })
    } else {
      addHistoricalIncome(snapshotId, {
        memberName: memberName.trim(),
        amount: amt,
        note: note.trim() || undefined,
      })
    }
    setOpen(false)
  }

  const dialogTitle = existing
    ? t(`Edit Income — ${snapLabel}`, `ערוך הכנסה — ${snapLabel}`, lang)
    : t(`Add Income — ${snapLabel}`, `הוסף הכנסה — ${snapLabel}`, lang)

  const listId = `members-${snapshotId}`

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button
            variant="ghost" size="icon"
            className="min-h-[44px] min-w-[44px]"
            title={t('Edit recorded income', 'ערוך הכנסה שנרשמה', lang)}
            aria-label={t('Edit recorded income', 'ערוך הכנסה שנרשמה', lang)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs gap-1.5 min-h-[44px]">
            <Plus className="h-3.5 w-3.5" />
            {t('Add Income', 'הוסף הכנסה', lang)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Member name — datalist for autocomplete from existing members */}
          <datalist id={listId}>
            {memberNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div>
            <Label htmlFor={`${snapshotId}-member`}>{t('Person', 'אדם', lang)}</Label>
            <Input
              id={`${snapshotId}-member`}
              list={listId}
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder={memberNames[0] ?? t('Name', 'שם', lang)}
              aria-label={t('Person', 'אדם', lang)}
            />
          </div>

          <div>
            <Label htmlFor={`${snapshotId}-income-amount`}>{t('Net amount received', 'סכום נטו שהתקבל', lang)}</Label>
            <Input
              id={`${snapshotId}-income-amount`}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={t('Net amount received', 'סכום נטו שהתקבל', lang)}
            />
            {amount.length > 0 && !(parseFloat(amount) > 0) && (
              <p className="text-xs text-destructive mt-1">{t('Amount must be greater than 0', 'הסכום חייב להיות גדול מ-0', lang)}</p>
            )}
          </div>

          <div>
            <Label htmlFor={`${snapshotId}-income-note`}>{t('Note (optional)', 'הערה (אופציונלי)', lang)}</Label>
            <Input
              id={`${snapshotId}-income-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. Monthly salary, Bonus…', 'למשל: משכורת חודשית, בונוס…', lang)}
              aria-label={t('Note', 'הערה', lang)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={!isValid}>
              {t('Save Income', 'שמור הכנסה', lang)}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main History component ────────────────────────────────────────────────────

export function History() {
  const { data, snapshotMonth, setData, deleteHistoricalExpense, deleteHistoricalIncome } = useFinance()
  const lang = data.language

  const deleteSnapshot = (id: string) =>
    setData((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.history.length} {t('snapshots recorded', 'תמונות מצב שנרשמו', lang)}
        </p>
        <Button size="sm" onClick={snapshotMonth}>
          <Camera className="h-4 w-4 me-1" />
          {t('Snapshot This Month', 'צלם חודש זה', lang)}
        </Button>
      </div>

      {data.history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <HistoryIcon className="h-10 w-10" />
          <p>{t('Take your first monthly snapshot to start tracking trends', 'צלם את תמונת המצב החודשית הראשונה כדי להתחיל לעקוב', lang)}</p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('Monthly Trend', 'מגמה חודשית', lang)}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), data.currency, data.locale)} />
                  <Legend />
                  <Line type="monotone" dataKey="totalIncome"   name={t('Income',     'הכנסה',       lang)} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalExpenses" name={t('Expenses',    'הוצאות',      lang)} stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="freeCashFlow"  name={t('Free Cash',   'תזרים חופשי', lang)} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {[...data.history].reverse().map((snap) => {
              const hasActuals = snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0
              return (
                <Card key={snap.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{snap.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(snap.date).toLocaleDateString(data.locale)}</p>
                        {snap.totalIncome === 0 && snap.totalExpenses > 0 && (
                          <p className="text-xs text-muted-foreground/70 italic mt-0.5">
                            {t('fixed expenses only', 'הוצאות קבועות בלבד', lang)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {snap.totalIncome === 0 && snap.totalExpenses > 0 ? (
                          <Badge variant="secondary" title={t('Income unknown — stub snapshot', 'הכנסה לא ידועה — תמונת מצב חלקית', lang)}>
                            —
                          </Badge>
                        ) : (
                          <Badge variant={snap.freeCashFlow >= 0 ? 'success' : 'destructive'}>
                            {snap.freeCashFlow >= 0 ? '+' : ''}{formatCurrency(snap.freeCashFlow, data.currency, data.locale)}
                          </Badge>
                        )}
                        {/* Actuals indicator */}
                        {hasActuals && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {t('Actuals logged', 'נרשם בפועל', lang)}
                          </Badge>
                        )}
                        <ActualsDialog snap={snap} lang={lang} />
                        <Button
                          variant="ghost" size="icon"
                          className="min-h-[44px] min-w-[44px] text-destructive"
                          onClick={() => deleteSnapshot(snap.id)}
                          title={t('Delete snapshot', 'מחק תמונת מצב', lang)}
                          aria-label={t('Delete snapshot', 'מחק תמונת מצב', lang)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Summary totals */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Income', 'הכנסה', lang)}</p>
                        <p className="font-semibold text-primary">{formatCurrency(snap.totalIncome, data.currency, data.locale)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Expenses', 'הוצאות', lang)}</p>
                        <p className="font-semibold text-destructive">{formatCurrency(snap.totalExpenses, data.currency, data.locale)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Savings', 'חיסכון', lang)}</p>
                        <p className="font-semibold">{formatCurrency(snap.totalSavings, data.currency, data.locale)}</p>
                      </div>
                    </div>

                    {/* Recorded historical incomes — above actuals and expenses */}
                    <div className="mt-3 border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        {(snap.historicalIncomes ?? []).length > 0 && (
                          <p className="text-xs font-medium text-muted-foreground">
                            {t(
                              `Recorded income (${snap.historicalIncomes!.length})`,
                              `הכנסות שנרשמו (${snap.historicalIncomes!.length})`,
                              lang
                            )}
                          </p>
                        )}
                        <HistoricalIncomeDialog
                          snapshotId={snap.id}
                          snapLabel={snap.label}
                          lang={lang}
                          memberNames={data.members.map((m) => m.name)}
                        />
                      </div>
                      {(snap.historicalIncomes ?? []).length > 0 && (
                        <div className="space-y-1">
                          {snap.historicalIncomes!.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium">{item.memberName}</span>
                                {item.note && (
                                  <span className="text-muted-foreground ms-2 truncate">{item.note}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-semibold tabular-nums text-primary">
                                  {formatCurrency(item.amount, data.currency, data.locale)}
                                </span>
                                <HistoricalIncomeDialog
                                  snapshotId={snap.id}
                                  snapLabel={snap.label}
                                  existing={item}
                                  lang={lang}
                                  memberNames={data.members.map((m) => m.name)}
                                />
                                <Button
                                  variant="ghost" size="icon"
                                  className="min-h-[44px] min-w-[44px] text-destructive"
                                  onClick={() => deleteHistoricalIncome(snap.id, item.id)}
                                  title={t('Delete recorded income', 'מחק הכנסה שנרשמה', lang)}
                                  aria-label={t('Delete recorded income', 'מחק הכנסה שנרשמה', lang)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category actuals breakdown — shown when logged */}
                    {hasActuals && snap.categoryActuals && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{t('Actual spending by category', 'הוצאות בפועל לפי קטגוריה', lang)}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {CATEGORIES.filter(({ value }) => snap.categoryActuals![value] != null).map(({ value, en, he }) => (
                            <div key={value} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{lang === 'he' ? he : en}</span>
                              <span className="font-medium">{formatCurrency(snap.categoryActuals![value]!, data.currency, data.locale)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recorded historical expenses */}
                    {(snap.historicalExpenses ?? []).length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t(
                              `Recorded expenses (${snap.historicalExpenses!.length})`,
                              `הוצאות שנרשמו (${snap.historicalExpenses!.length})`,
                              lang
                            )}
                          </p>
                          <HistoricalExpenseDialog snapshotId={snap.id} snapLabel={snap.label} lang={lang} />
                        </div>
                        <div className="space-y-1">
                          {snap.historicalExpenses!.map((item) => {
                            const catLabel = CATEGORIES.find((c) => c.value === item.category)
                            return (
                              <div key={item.id} className="flex items-start justify-between text-xs gap-2 flex-wrap">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium">{item.name}</span>
                                    {/* Category badge — hidden on very narrow screens to prevent overflow */}
                                    <Badge variant="outline" className="text-xs py-0 hidden sm:inline-flex">
                                      {lang === 'he' ? catLabel?.he : catLabel?.en}
                                    </Badge>
                                  </div>
                                  {item.note && (
                                    <p className="text-muted-foreground text-xs truncate">{item.note}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="font-semibold tabular-nums me-1">
                                    {formatCurrency(item.amount, data.currency, data.locale)}
                                  </span>
                                  <HistoricalExpenseDialog
                                    snapshotId={snap.id}
                                    snapLabel={snap.label}
                                    existing={item}
                                    lang={lang}
                                  />
                                  <Button
                                    variant="ghost" size="icon"
                                    className="min-h-[44px] min-w-[44px] text-destructive"
                                    onClick={() => deleteHistoricalExpense(snap.id, item.id)}
                                    title={t('Delete recorded expense', 'מחק הוצאה שנרשמה', lang)}
                                    aria-label={t('Delete recorded expense', 'מחק הוצאה שנרשמה', lang)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add expense button — always shown */}
                    <div className={(snap.historicalExpenses ?? []).length > 0 ? 'mt-2' : 'mt-3 border-t pt-3'}>
                      <HistoricalExpenseDialog snapshotId={snap.id} snapLabel={snap.label} lang={lang} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
