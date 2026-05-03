import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, ShoppingCart, Edit2, Lock, Waves, ArrowLeftRight, CalendarDays, AlertTriangle, CalendarCheck, History, Link2, Camera, Loader2, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Switch } from './ui/switch'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, generateId, t } from '@/lib/utils'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import { scanReceipt, aiEnabled } from '@/lib/aiAdvisor'
import type { Expense, ExpenseCategory, HistoricalExpense } from '@/types'

const MONTHS: { value: number; en: string; he: string }[] = [
  { value: 1,  en: 'January',   he: 'ינואר' },
  { value: 2,  en: 'February',  he: 'פברואר' },
  { value: 3,  en: 'March',     he: 'מרץ' },
  { value: 4,  en: 'April',     he: 'אפריל' },
  { value: 5,  en: 'May',       he: 'מאי' },
  { value: 6,  en: 'June',      he: 'יוני' },
  { value: 7,  en: 'July',      he: 'יולי' },
  { value: 8,  en: 'August',    he: 'אוגוסט' },
  { value: 9,  en: 'September', he: 'ספטמבר' },
  { value: 10, en: 'October',   he: 'אוקטובר' },
  { value: 11, en: 'November',  he: 'נובמבר' },
  { value: 12, en: 'December',  he: 'דצמבר' },
]

function monthName(m: number, lang: 'en' | 'he'): string {
  const found = MONTHS.find((x) => x.value === m)
  return found ? (lang === 'he' ? found.he : found.en) : ''
}

/** Months until the next occurrence of a due month (0 = this month). */
function monthsUntilDue(dueMonth: number): number {
  const current = new Date().getMonth() + 1
  if (dueMonth === current) return 0
  if (dueMonth > current) return dueMonth - current
  return 12 - current + dueMonth
}

// ── ExpenseDialog ─────────────────────────────────────────────────────────────


function ExpenseDialog({
  existing,
  onSave,
  lang,
}: {
  existing?: Expense
  onSave: (e: Expense) => void
  lang: 'en' | 'he'
}) {
  const { addExpenseToMonth, data } = useFinance()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Expense>(
    existing ?? {
      id: generateId(),
      name: '',
      amount: 0,
      category: 'other',
      recurring: true,
      period: 'monthly',
      expenseType: 'fixed',
    }
  )
  const [mode, setMode] = useState<'budget' | 'past'>('budget')
  const [pastMonth, setPastMonth] = useState(
    new Date().getMonth() === 0 ? 12 : new Date().getMonth()  // previous month (1-indexed)
  )
  const [pastYear, setPastYear] = useState(
    new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()
  )
  const [savedLabel, setSavedLabel]   = useState<string | null>(null)
  const [scanning, setScanning]       = useState(false)
  const [scanError, setScanError]     = useState<string | null>(null)
  const closeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef   = useRef<HTMLInputElement | null>(null)

  // Clear the auto-close timer if the dialog unmounts while it is pending.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setForm((f) => ({ ...f, [k]: v }))

  /** Change the selected year and clamp pastMonth to a valid value for that year. */
  const handlePastYearChange = (y: number) => {
    setPastYear(y)
    const now = new Date()
    const curY = now.getFullYear()
    const curM = now.getMonth() + 1 // 1-indexed
    // When switching back to the current year, any month >= current month is invalid.
    if (y === curY && pastMonth >= curM) {
      // Clamp to the latest valid month (previous month, or December of prior year if Jan).
      setPastMonth(curM > 1 ? curM - 1 : 12)
    }
  }

  const handleOpen = (o: boolean) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    if (o && existing) setForm(existing)
    if (o) {
      setScanError(null)
      setScanning(false)
      setMode('budget')
      setSavedLabel(null)
      // default to previous month
      const now = new Date()
      if (now.getMonth() === 0) {
        setPastMonth(12); setPastYear(now.getFullYear() - 1)
      } else {
        setPastMonth(now.getMonth()); setPastYear(now.getFullYear())
      }
    }
    setOpen(o)
  }

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected after an error
    e.target.value = ''

    setScanError(null)
    setScanning(true)
    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip the "data:<mime>;base64," prefix
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await scanReceipt(base64, file.type || 'image/jpeg', lang)
      setForm((f) => ({
        ...f,
        name:     result.name                          || f.name,
        amount:   result.amount > 0 ? result.amount    : f.amount,
        category: (result.category as ExpenseCategory) || f.category,
      }))
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('[scanReceipt]', detail)
      setScanError(
        t('Could not read receipt.', 'לא ניתן לקרוא את הקבלה.', lang) + ` — ${detail}`
      )
    } finally {
      setScanning(false)
    }
  }

  const handleSave = () => {
    if (mode === 'past') {
      addExpenseToMonth(pastYear, pastMonth, {
        name: form.name,
        amount: form.amount,
        category: form.category,
      })
      setSavedLabel(`${monthName(pastMonth, lang)} ${pastYear}`)
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        setOpen(false)
        setSavedLabel(null)
      }, 1200)
    } else {
      onSave(form)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>
              {existing ? t('Edit Expense', 'ערוך הוצאה', lang) : t('Add Expense', 'הוסף הוצאה', lang)}
            </DialogTitle>
            {aiEnabled && (
              <>
                {/* Hidden file input — on mobile shows camera/gallery/files sheet; on desktop opens file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  aria-hidden="true"
                  onChange={handleReceiptFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={scanning}
                  onClick={() => { setScanError(null); fileInputRef.current?.click() }}
                  title={t('Scan receipt with AI', 'סרוק קבלה עם AI', lang)}
                  aria-label={t('Scan receipt', 'סרוק קבלה', lang)}
                  className="shrink-0 gap-1.5"
                >
                  {scanning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />
                  }
                  {scanning
                    ? t('Scanning…', 'סורק…', lang)
                    : t('Scan Receipt', 'סרוק קבלה', lang)
                  }
                </Button>
              </>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Scan error */}
          {scanError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {scanError}
            </div>
          )}

          {/* When? — only for new expenses, not editing existing ones */}
          {!existing && (
            <div>
              <Label className="mb-2 block">{t('When?', 'מתי?', lang)}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('budget')}
                  aria-pressed={mode === 'budget'}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    mode === 'budget'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  {t('Current budget', 'תקציב שוטף', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('past')}
                  aria-pressed={mode === 'past'}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    mode === 'past'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  {t('Past month', 'חודש קודם', lang)}
                </button>
              </div>

              {/* Month + Year pickers — only in past mode */}
              {mode === 'past' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="past-month">{t('Month', 'חודש', lang)}</Label>
                    <Select value={pastMonth.toString()} onValueChange={(v) => setPastMonth(+v)}>
                      <SelectTrigger id="past-month" aria-label={t('Month', 'חודש', lang)}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.filter((m) => {
                          const now = new Date()
                          const cur = now.getMonth() + 1
                          const curY = now.getFullYear()
                          // exclude current month and future months for the selected year
                          if (pastYear === curY) return m.value < cur
                          if (pastYear > curY) return false
                          return true
                        }).map((m) => (
                          <SelectItem key={m.value} value={m.value.toString()}>
                            {lang === 'he' ? m.he : m.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="past-year">{t('Year', 'שנה', lang)}</Label>
                    <Select value={pastYear.toString()} onValueChange={(v) => setPastYear(+v)}>
                      <SelectTrigger id="past-year" aria-label={t('Year', 'שנה', lang)}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <Label htmlFor="exp-name">{t('Name', 'שם', lang)}</Label>
            <Input
              id="exp-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('e.g. Rent', 'למשל: שכ"ד', lang)}
            />
          </div>

          {/* Amount + Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-amount">{t('Amount', 'סכום', lang)}</Label>
              <Input id="exp-amount" type="number" value={form.amount} onChange={(e) => set('amount', +e.target.value)} />
            </div>
            {mode === 'budget' && (
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
            )}
          </div>

          {/* Due month — only for yearly expenses */}
          {form.period === 'yearly' && (
            <div>
              <Label>{t('Due Month', 'חודש תשלום', lang)}</Label>
              <Select
                value={form.dueMonth?.toString() ?? ''}
                onValueChange={(v) => set('dueMonth', v ? +v : undefined)}
              >
                <SelectTrigger><SelectValue placeholder={t('Select month…', 'בחר חודש…', lang)} /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {lang === 'he' ? m.he : m.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div>
            <Label>{t('Category', 'קטגוריה', lang)}</Label>
            <Select
              value={form.category}
              onValueChange={(v) => {
                const newCat = v as ExpenseCategory
                setForm((f) => ({
                  ...f,
                  category: newCat,
                  // Clear the linked account when the category is no longer 'savings'
                  linkedAccountId: newCat === 'savings' ? f.linkedAccountId : undefined,
                }))
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{lang === 'he' ? c.he : c.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* When category is savings but no accounts have been created yet, show a hint */}
          {form.category === 'savings' && data.accounts.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t(
                'Add a savings account in the Accounts tab to link it here.',
                'הוסף חשבון חיסכון בלשונית חשבונות כדי לקשר אותו כאן.',
                lang
              )}
            </p>
          )}

          {/* Link to savings account — only visible when category is 'savings' and accounts exist */}
          {form.category === 'savings' && data.accounts.length > 0 && (
            <div>
              <Label htmlFor="linked-account">
                {t('Link to savings account', 'קשר לחשבון חיסכון', lang)}{' '}
                <span className="text-muted-foreground text-xs">({t('optional', 'אופציונלי', lang)})</span>
              </Label>
              <Select
                value={form.linkedAccountId ?? '__none__'}
                onValueChange={(v) => set('linkedAccountId', v === '__none__' ? undefined : v)}
              >
                <SelectTrigger id="linked-account" aria-label={t('Link to savings account', 'קשר לחשבון חיסכון', lang)} className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("None / Don't link", 'ללא קישור', lang)}</SelectItem>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fixed vs Variable — segmented toggle */}
          {mode === 'budget' && (
            <div>
              <Label className="mb-2 block">{t('Expense Type', 'סוג הוצאה', lang)}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set('expenseType', 'fixed')}
                  aria-pressed={(form.expenseType ?? 'fixed') === 'fixed'}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    (form.expenseType ?? 'fixed') === 'fixed'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t('Fixed', 'קבוע', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => set('expenseType', 'variable')}
                  aria-pressed={form.expenseType === 'variable'}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    form.expenseType === 'variable'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Waves className="h-3.5 w-3.5" />
                  {t('Variable', 'משתנה', lang)}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {(form.expenseType ?? 'fixed') === 'fixed'
                  ? t('Same amount every month — rent, subscriptions, insurance', 'אותו סכום כל חודש — שכ"ד, מנויים, ביטוח', lang)
                  : t('Amount changes month to month — food, dining, entertainment', 'הסכום משתנה — מזון, בילויים, בידור', lang)
                }
              </p>
            </div>
          )}

          {/* Recurring */}
          {mode === 'budget' && (
            <div className="flex items-center gap-3">
              <Switch checked={form.recurring} onCheckedChange={(v) => set('recurring', v)} />
              <Label>{t('Recurring expense', 'הוצאה קבועה', lang)}</Label>
            </div>
          )}

          <Button className="w-full" onClick={handleSave}>
            {t('Save', 'שמור', lang)}
          </Button>

          {savedLabel && (
            <p className="text-xs text-primary text-center flex items-center justify-center gap-1">
              <span>✓</span>
              {t(`Added to ${savedLabel} in History`, `נוסף ל${savedLabel} בהיסטוריה`, lang)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── BudgetEditor — inline budget limit per category ──────────────────────────

function BudgetEditor({
  category,
  lang,
}: {
  category: ExpenseCategory
  lang: 'en' | 'he'
}) {
  const { data, updateCategoryBudget } = useFinance()
  const budget = data.categoryBudgets[category]
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setValue(budget?.toString() ?? '')
    setEditing(true)
  }

  const commit = () => {
    const n = parseFloat(value)
    updateCategoryBudget(category, isNaN(n) || n <= 0 ? undefined : n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
        className="w-24 text-xs border border-input rounded px-1.5 py-0.5 bg-background"
        autoFocus
        aria-label={t('Monthly budget limit', 'תקציב חודשי', lang)}
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={t('Click to set budget limit', 'לחץ להגדרת תקציב', lang)}
      aria-label={budget
        ? t('Edit budget limit', 'ערוך תקציב', lang)
        : t('Set budget limit', 'הגדר תקציב', lang)
      }
    >
      {budget
        ? `${t('Budget:', 'תקציב:', lang)} ${formatCurrency(budget, data.currency, data.locale)}`
        : t('+ Set budget', '+ הגדר תקציב', lang)
      }
    </button>
  )
}

// ── Main Expenses component ───────────────────────────────────────────────────

export function Expenses() {
  const { data, addExpense, updateExpense, deleteExpense, clearVariableExpenses } = useFinance()
  const lang = data.language
  const [comparing, setComparing] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<ExpenseCategory>>(new Set())

  const toggleCategory = (cat: ExpenseCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const hasVariableExpenses = data.expenses.some((e) => (e.expenseType ?? 'fixed') === 'variable')

  // Stable current month value — avoids stale-capture if the tab is left open overnight
  const currentMonth = useMemo(() => new Date().getMonth() + 1, [])

  const monthly = (e: Expense) => (e.period === 'yearly' ? e.amount / 12 : e.amount)

  // Group expenses by category
  const grouped = useMemo(() =>
    CATEGORIES.reduce<Record<ExpenseCategory, Expense[]>>((acc, cat) => {
      acc[cat.value] = data.expenses.filter((e) => e.category === cat.value)
      return acc
    }, {} as Record<ExpenseCategory, Expense[]>),
    [data.expenses]
  )

  // Fixed vs variable totals (treat undefined expenseType as 'fixed')
  const fixedTotal = useMemo(
    () => data.expenses.filter((e) => (e.expenseType ?? 'fixed') === 'fixed').reduce((s, e) => s + monthly(e), 0),
    [data.expenses]
  )
  const variableTotal = useMemo(
    () => data.expenses.filter((e) => e.expenseType === 'variable').reduce((s, e) => s + monthly(e), 0),
    [data.expenses]
  )
  const total = fixedTotal + variableTotal

  // Last snapshot for month-over-month comparison
  // Last snapshot from a PREVIOUS month — excludes any snapshot taken this month
  // so "Compare" always means "vs last month", not "vs today's own snapshot".
  const lastSnapshot = useMemo(() => {
    const now = new Date()
    const curYear  = now.getFullYear()
    const curMonth = now.getMonth() + 1
    const previous = data.history.filter((h) => {
      const d = new Date(h.date)
      return d.getFullYear() < curYear || (d.getFullYear() === curYear && d.getMonth() + 1 < curMonth)
    })
    if (previous.length === 0) return null
    return [...previous].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
  }, [data.history])

  // Annual expenses due this month
  const dueThisMonth = useMemo(
    () => data.expenses.filter((e) => e.period === 'yearly' && e.dueMonth === currentMonth),
    [data.expenses, currentMonth]
  )

  const getDelta = (category: ExpenseCategory, currentTotal: number): number | null => {
    if (!comparing || !lastSnapshot?.categoryActuals) return null
    const last = lastSnapshot.categoryActuals[category] ?? 0
    return currentTotal - last
  }

  return (
    <div className="space-y-4">

      {/* Header: totals + compare toggle + add button */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">
            {t('Total monthly:', 'סה"כ חודשי:', lang)}{' '}
            <span className="font-semibold text-destructive">{formatCurrency(total, data.currency, data.locale)}</span>
          </p>
          {data.expenses.length > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {t('Fixed:', 'קבוע:', lang)} <span className="font-medium text-foreground">{formatCurrency(fixedTotal, data.currency, data.locale)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Waves className="h-3 w-3" />
                {t('Variable:', 'משתנה:', lang)} <span className="font-medium text-foreground">{formatCurrency(variableTotal, data.currency, data.locale)}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastSnapshot && (
            <Button
              variant={comparing ? 'default' : 'outline'}
              size="sm"
              onClick={() => setComparing((v) => !v)}
              title={t('Compare to last month', 'השווה לחודש קודם', lang)}
              aria-label={t('Compare to last month', 'השווה לחודש קודם', lang)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 me-1" />
              {t('Compare', 'השווה', lang)}
            </Button>
          )}
          {hasVariableExpenses && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => setClearConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t('Clear Variable', 'נקה משתנות', lang)}
            </Button>
          )}
          <ExpenseDialog onSave={(e) => addExpense(e)} lang={lang} />
        </div>

        {/* Clear variable expenses confirmation dialog */}
        <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Clear all variable expenses?', 'לנקות את כל ההוצאות המשתנות?', lang)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  'This removes all variable expenses from your budget. Fixed expenses are kept.',
                  'פעולה זו מסירה את כל ההוצאות המשתנות מהתקציב. הוצאות קבועות נשמרות.',
                  lang
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  clearVariableExpenses()
                  setClearConfirmOpen(false)
                }}
              >
                {t('Clear', 'נקה', lang)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Compare context label */}
      {comparing && lastSnapshot && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {t(`Comparing to: ${lastSnapshot.label}`, `משווה ל: ${lastSnapshot.label}`, lang)}
        </p>
      )}

      {/* Annual bills due this month */}
      {dueThisMonth.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t('Annual bills due this month:', 'חיובים שנתיים החודש:', lang)}</p>
            <p className="text-xs mt-0.5">
              {dueThisMonth.map((e) => `${e.name} (${formatCurrency(e.amount, data.currency, data.locale)})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ShoppingCart className="h-10 w-10" />
          <p>{t('No expenses yet. Add your first one!', 'אין הוצאות עדיין. הוסף את הראשונה!', lang)}</p>
        </div>
      ) : (
        CATEGORIES.filter((cat) => grouped[cat.value].length > 0).map((cat) => {
          const catTotal = grouped[cat.value].reduce((s, e) => s + monthly(e), 0)
          const budget = data.categoryBudgets[cat.value]
          const budgetPct = budget ? Math.min(100, (catTotal / budget) * 100) : null
          const delta = getDelta(cat.value, catTotal)

          const budgetColor =
            budgetPct === null ? '' :
            budgetPct >= 100 ? 'bg-destructive' :
            budgetPct >= 80  ? 'bg-warning' :
            'bg-primary'

          const isExpanded = expandedCategories.has(cat.value)
          const catExpenses = grouped[cat.value]

          return (
            <Card key={cat.value}>
              <CardHeader
                className="pb-2 cursor-pointer min-h-[44px]"
                onClick={() => toggleCategory(cat.value)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm">{lang === 'he' ? cat.he : cat.en}</CardTitle>
                    {/* Item count badge */}
                    <Badge variant="secondary">
                      {catExpenses.length === 1
                        ? t('1 item', 'פריט אחד', lang)
                        : t(`${catExpenses.length} items`, `${catExpenses.length} פריטים`, lang)
                      }
                    </Badge>
                    {/* Month-over-month delta badge */}
                    {delta !== null && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${
                        delta > 0 ? 'text-destructive' : delta < 0 ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '='}{' '}
                        {delta !== 0 && formatCurrency(Math.abs(delta), data.currency, data.locale)}
                        {delta === 0 && t('unchanged', 'ללא שינוי', lang)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <BudgetEditor category={cat.value} lang={lang} />
                    <Badge variant="outline" onClick={(e) => e.stopPropagation()}>
                      {formatCurrency(catTotal, data.currency, data.locale)}{t('/mo', '/חו׳', lang)}
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ms-auto shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Budget progress bar */}
                {budgetPct !== null && (
                  <div className="mt-2 space-y-1">
                    <Progress
                      value={budgetPct}
                      indicatorClassName={budgetColor}
                      aria-label={`${lang === 'he' ? cat.he : cat.en} ${t('budget', 'תקציב', lang)} ${budgetPct.toFixed(0)}%`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{budgetPct.toFixed(0)}% {t('used', 'בשימוש', lang)}</span>
                      {budget && catTotal > budget && (
                        <span className="text-destructive font-medium">
                          {formatCurrency(catTotal - budget, data.currency, data.locale)} {t('over budget', 'מעל התקציב', lang)}
                        </span>
                      )}
                      {budget && catTotal <= budget && (
                        <span className="text-primary">
                          {formatCurrency(budget - catTotal, data.currency, data.locale)} {t('remaining', 'נותר', lang)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardHeader>

              {isExpanded && (
              <CardContent className="space-y-0">
                {catExpenses.map((expense) => {
                  const isFixed = (expense.expenseType ?? 'fixed') === 'fixed'
                  const dueIn = expense.period === 'yearly' && expense.dueMonth != null
                    ? monthsUntilDue(expense.dueMonth)
                    : null

                  return (
                    <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium">
                            {expense.name}
                            {expense.expenseType === 'variable' && expense.createdAt && (
                              <span className="text-xs text-muted-foreground ms-1">
                                · {new Date(expense.createdAt).toLocaleDateString(data.locale)}
                              </span>
                            )}
                          </p>
                          {/* Fixed / Variable badge */}
                          <Badge
                            variant={isFixed ? 'secondary' : 'outline'}
                            className="text-xs py-0 flex items-center gap-0.5"
                          >
                            {isFixed
                              ? <><Lock className="h-2.5 w-2.5" />{t('Fixed', 'קבוע', lang)}</>
                              : <><Waves className="h-2.5 w-2.5" />{t('Variable', 'משתנה', lang)}</>
                            }
                          </Badge>
                        </div>

                        {/* Linked savings account badge */}
                        {expense.linkedAccountId && (() => {
                          const linkedAccount = data.accounts.find((a) => a.id === expense.linkedAccountId)
                          return linkedAccount ? (
                            <div className="mt-0.5">
                              <Badge variant="secondary" className="text-xs max-w-[160px] truncate inline-flex items-center gap-0.5">
                                <Link2 className="h-2.5 w-2.5 shrink-0" />
                                {linkedAccount.name}
                              </Badge>
                            </div>
                          ) : null
                        })()}

                        {/* Annual smoothing row */}
                        {expense.period === 'yearly' && (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-xs py-0">
                              {formatCurrency(expense.amount / 12, data.currency, data.locale)}{t('/mo', '/חו׳', lang)}
                            </Badge>
                            {expense.dueMonth != null && (
                              <span className={`text-xs flex items-center gap-0.5 ${
                                dueIn === 0 ? 'text-destructive font-medium' :
                                dueIn != null && dueIn <= 2 ? 'text-warning' :
                                'text-muted-foreground'
                              }`}>
                                <CalendarDays className="h-3 w-3" />
                                {dueIn === 0
                                  ? t('Due this month!', 'פג החודש!', lang)
                                  : dueIn === 1
                                  ? t(`Due next month (${monthName(expense.dueMonth, lang)})`, `פג בחודש הבא (${monthName(expense.dueMonth, lang)})`, lang)
                                  : t(`Due in ${dueIn}mo (${monthName(expense.dueMonth, lang)})`, `פג בעוד ${dueIn} חודשים (${monthName(expense.dueMonth, lang)})`, lang)
                                }
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(expense.amount, data.currency, data.locale)}
                          {expense.period === 'yearly' ? t('/yr', '/שנה', lang) : t('/mo', '/חו׳', lang)}
                        </span>
                        <ExpenseDialog existing={expense} onSave={(e) => updateExpense(e)} lang={lang} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="min-h-[44px] min-w-[44px] text-destructive"
                              title={t('Delete expense', 'מחק הוצאה', lang)}
                              aria-label={t('Delete expense', 'מחק הוצאה', lang)}
                            >
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
                                onClick={() => deleteExpense(expense.id)}
                              >
                                {t('Delete', 'מחק', lang)}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
