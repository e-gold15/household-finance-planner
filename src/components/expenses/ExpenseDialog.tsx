import { useEffect, useState, type ReactElement } from 'react'
import { AlertTriangle, CalendarCheck, Camera, History, Loader2, Lock, Waves } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useFinance } from '@/context/FinanceContext'
import { aiEnabled } from '@/lib/aiAdvisor'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import { categoryLabel, defaultPastMonth, MONTHS, monthName } from '@/lib/quickAdd'
import { formatCurrency, generateId, t } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'
import { CategoryChips } from './CategoryChips'
import { PastMonthPicker } from './PastMonthPicker'
import { useReceiptScan } from './useReceiptScan'

type Mode = 'budget' | 'past'

function newExpense(initial?: Partial<Expense>): Expense {
  return {
    name: '',
    amount: 0,
    category: 'other',
    recurring: true,
    period: 'monthly',
    expenseType: 'variable',
    createdAt: new Date().toISOString(),
    ...initial,
    id: generateId(),
  }
}

export interface ExpenseDialogProps {
  /** Edit mode when set. */
  existing?: Expense
  /** Prefill for a new expense (e.g. from Quick Add "More details"). Ignored when `existing` is set. */
  initial?: Partial<Expense>
  /** Open in "Past month" mode with this month preselected (new expenses only). */
  initialPast?: { year: number; month: number }
  /** Called with the full form when saving to the current budget (add or edit). */
  onSave: (e: Expense) => void
  lang: 'en' | 'he'
  /** Controlled open state (omit both to use `trigger`). */
  open?: boolean
  onOpenChange?: (o: boolean) => void
  /** Uncontrolled usage: element that opens the dialog. */
  trigger?: ReactElement
}

/**
 * Full add/edit expense form (extracted from Expenses.tsx in v4).
 * Saves through the same context calls as v3.x:
 *  - current budget → `onSave(form)` (caller passes it to addExpense / updateExpense)
 *  - past month     → `addExpenseToMonth(year, month, { name, amount, category })`
 */
export function ExpenseDialog({
  existing,
  initial,
  initialPast,
  onSave,
  lang,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: ExpenseDialogProps) {
  const { addExpenseToMonth, data } = useFinance()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const [form, setForm] = useState<Expense>(() => existing ?? newExpense(initial))
  const [amountStr, setAmountStr] = useState('')
  const [touched, setTouched] = useState(false)
  const [mode, setMode] = useState<Mode>('budget')
  const [past, setPast] = useState(() => defaultPastMonth())

  const scan = useReceiptScan(lang, (result) => {
    setForm((f) => ({
      ...f,
      name: result.name || f.name,
      category: (result.category as ExpenseCategory) || f.category,
    }))
    if (result.amount > 0) setAmountStr(toMoneyInputValue(result.amount))
  })

  // Reset the form every time the dialog opens (controlled or not).
  useEffect(() => {
    if (!open) return
    const base = existing ?? newExpense(initial)
    setForm(base)
    setAmountStr(existing || initial?.amount !== undefined ? toMoneyInputValue(base.amount) : '')
    setTouched(false)
    setMode(initialPast && !existing ? 'past' : 'budget')
    setPast(initialPast ?? defaultPastMonth())
    scan.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o)
    else setInternalOpen(o)
  }

  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setForm((f) => ({ ...f, [k]: v }))

  const parsedAmount = parseMoneyInput(amountStr, { allowNegative: false })
  // New entries need a positive amount; edits may keep a legacy 0.
  const amountValid = parsedAmount !== null && (existing ? parsedAmount >= 0 : parsedAmount > 0)
  const showAmountError = touched && !amountValid

  const handleSave = () => {
    if (!amountValid || parsedAmount === null) {
      setTouched(true)
      return
    }
    const name = form.name.trim() || categoryLabel(form.category, lang)
    if (mode === 'past' && !existing) {
      addExpenseToMonth(past.year, past.month, { name, amount: parsedAmount, category: form.category })
      const label = `${monthName(past.month, lang)} ${past.year}`
      toast.success(t(`Added to ${label} in History`, `נוסף ל${label} בהיסטוריה`, lang))
    } else {
      onSave({ ...form, name, amount: parsedAmount })
      if (!existing) {
        const amountText = formatCurrency(parsedAmount, data.currency, data.locale)
        const cat = categoryLabel(form.category, lang)
        toast.success(t(`${amountText} added to ${cat}`, `${amountText} נוסף ל${cat}`, lang))
      }
    }
    handleOpen(false)
  }

  const isPast = mode === 'past' && !existing
  const isFixed = (form.expenseType ?? 'fixed') === 'fixed'
  const amountErrorId = 'exp-amount-error'

  const content = (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {existing ? t('Edit expense', 'עריכת הוצאה', lang) : t('Add expense', 'הוספת הוצאה', lang)}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Receipt scan — new expenses in current-budget mode only (v3.1 behaviour) */}
        {aiEnabled && !existing && (
          <>
            <input {...scan.inputProps} />
            {mode === 'budget' && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 border-dashed border-primary text-primary-strong"
                onClick={scan.openPicker}
                disabled={scan.scanning}
              >
                {scan.scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden="true" />
                )}
                {scan.scanning ? t('Scanning…', 'סורק…', lang) : t('Scan a receipt', 'סריקת קבלה', lang)}
              </Button>
            )}
          </>
        )}

        {scan.scanError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{scan.scanError}</span>
          </div>
        )}

        {/* When? — new expenses only */}
        {!existing && (
          <div className="space-y-2">
            <Label id="exp-when-label">{t('When?', 'מתי?', lang)}</Label>
            <SegmentedControl<Mode>
              aria-labelledby="exp-when-label"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'budget', label: t('Current budget', 'תקציב שוטף', lang), icon: CalendarCheck },
                { value: 'past', label: t('Past month', 'חודש קודם', lang), icon: History },
              ]}
            />
            {mode === 'past' && (
              <PastMonthPicker year={past.year} month={past.month} onChange={setPast} lang={lang} idPrefix="exp" />
            )}
          </div>
        )}

        {/* Amount (most important field first — P1-14) */}
        <div className="space-y-1.5">
          <Label htmlFor="exp-amount">{t('Amount', 'סכום', lang)}</Label>
          <MoneyInput
            id="exp-amount"
            size="lg"
            value={amountStr}
            onValueChange={(v) => setAmountStr(v)}
            onBlur={() => setTouched(true)}
            currency={data.currency}
            locale={data.locale}
            placeholder="0"
            aria-invalid={showAmountError || undefined}
            aria-describedby={showAmountError ? amountErrorId : undefined}
          />
          {showAmountError && (
            <p id={amountErrorId} className="text-xs text-danger-strong">
              {t('Enter an amount greater than 0', 'יש להזין סכום גדול מ-0', lang)}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label id="exp-category-label">{t('Category', 'קטגוריה', lang)}</Label>
          <CategoryChips
            labelledBy="exp-category-label"
            options={EXPENSE_CATEGORIES}
            value={form.category}
            lang={lang}
            onChange={(newCat) =>
              setForm((f) => ({
                ...f,
                category: newCat,
                // Clear the linked account when the category is no longer 'savings'
                linkedAccountId: newCat === 'savings' ? f.linkedAccountId : undefined,
              }))
            }
          />
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="exp-name">
            {t('Name', 'שם', lang)}{' '}
            <span className="text-xs font-normal text-muted-foreground">({t('optional', 'אופציונלי', lang)})</span>
          </Label>
          <Input
            id="exp-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={categoryLabel(form.category, lang) || t('e.g. Rent', 'למשל: שכ"ד', lang)}
          />
        </div>

        {/* Period + due month — current budget only */}
        {!isPast && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-period">{t('Period', 'תדירות', lang)}</Label>
              <Select value={form.period} onValueChange={(v) => set('period', v as 'monthly' | 'yearly')}>
                <SelectTrigger id="exp-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('Monthly', 'חודשי', lang)}</SelectItem>
                  <SelectItem value="yearly">{t('Yearly', 'שנתי', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.period === 'yearly' && (
              <div className="space-y-1.5">
                <Label htmlFor="exp-due-month">{t('Due month', 'חודש תשלום', lang)}</Label>
                <Select
                  value={form.dueMonth?.toString() ?? ''}
                  onValueChange={(v) => set('dueMonth', v ? +v : undefined)}
                >
                  <SelectTrigger id="exp-due-month">
                    <SelectValue placeholder={t('Select month…', 'בחר חודש…', lang)} />
                  </SelectTrigger>
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
          </div>
        )}

        {/* Savings linkage */}
        {form.category === 'savings' && data.accounts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t(
              'Add a savings account in the Savings tab to link it here.',
              'הוסיפו חשבון חיסכון בלשונית "חיסכון" כדי לקשר אותו כאן.',
              lang
            )}
          </p>
        )}
        {form.category === 'savings' && data.accounts.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="linked-account">
              {t('Link to savings account', 'קשר לחשבון חיסכון', lang)}{' '}
              <span className="text-xs font-normal text-muted-foreground">({t('optional', 'אופציונלי', lang)})</span>
            </Label>
            <Select
              value={form.linkedAccountId ?? '__none__'}
              onValueChange={(v) => set('linkedAccountId', v === '__none__' ? undefined : v)}
            >
              <SelectTrigger id="linked-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("None / Don't link", 'ללא קישור', lang)}</SelectItem>
                {data.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Fixed vs Variable — current budget only */}
        {!isPast && (
          <div className="space-y-2">
            <Label id="exp-type-label">{t('Expense type', 'סוג הוצאה', lang)}</Label>
            <SegmentedControl<'fixed' | 'variable'>
              aria-labelledby="exp-type-label"
              value={isFixed ? 'fixed' : 'variable'}
              onValueChange={(v) => set('expenseType', v)}
              options={[
                { value: 'fixed', label: t('Fixed', 'קבוע', lang), icon: Lock },
                { value: 'variable', label: t('Variable', 'משתנה', lang), icon: Waves },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {isFixed
                ? t('Same amount every month — rent, subscriptions, insurance', 'אותו סכום כל חודש — שכ"ד, מנויים, ביטוח', lang)
                : t('Amount changes month to month — food, dining, entertainment', 'הסכום משתנה — מזון, בילויים, בידור', lang)}
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={touched && !amountValid}>
          {t('Save', 'שמור', lang)}
        </Button>
      </DialogFooter>
    </DialogContent>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!isControlled && trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {content}
    </Dialog>
  )
}
