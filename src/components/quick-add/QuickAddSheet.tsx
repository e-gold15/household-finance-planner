import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarCheck, Camera, History, Loader2, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useFinance } from '@/context/FinanceContext'
import { aiEnabled } from '@/lib/aiAdvisor'
import { EXPENSE_CATEGORIES } from '@/lib/categories'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import {
  buildQuickAddExpense,
  categoryLabel,
  defaultPastMonth,
  monthName,
  rankQuickAddCategories,
} from '@/lib/quickAdd'
import { formatCurrency, t } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'
import { CategoryChips } from '@/components/expenses/CategoryChips'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { PastMonthPicker } from '@/components/expenses/PastMonthPicker'
import { useReceiptScan } from '@/components/expenses/useReceiptScan'

type When = 'current' | 'past'

// ─── Quick Add sheet (PRD v4 §2.D) ────────────────────────────────────────────
// amount → category chip → Save. Saves through the existing context methods
// (`addExpense` / `addExpenseToMonth`) with the same shapes as ExpenseDialog.
// The public signature below is the contract mounted by App.tsx.

export function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, addExpense, addExpenseToMonth } = useFinance()
  const lang = data.language

  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [name, setName] = useState('')
  const [when, setWhen] = useState<When>('current')
  const [past, setPast] = useState(() => defaultPastMonth())

  // "More details" hand-off to the full form
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsInitial, setDetailsInitial] = useState<Partial<Expense>>({})
  const [detailsPast, setDetailsPast] = useState<{ year: number; month: number } | undefined>(undefined)
  const handingOffRef = useRef(false)
  const amountRef = useRef<HTMLInputElement | null>(null)

  const scan = useReceiptScan(lang, (result) => {
    if (result.name) setName(result.name)
    if (result.amount > 0) setAmountStr(toMoneyInputValue(result.amount))
    const cat = EXPENSE_CATEGORIES.find((c) => c.value === result.category)
    if (cat) setCategory(cat.value)
  })

  const reset = () => {
    setAmountStr('')
    setCategory(null)
    setName('')
    setWhen('current')
    setPast(defaultPastMonth())
    scan.reset()
  }

  // Fresh form every time the sheet opens.
  useEffect(() => {
    if (open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const chips = useMemo(() => rankQuickAddCategories(data.expenses, EXPENSE_CATEGORIES), [data.expenses])

  const parsedAmount = parseMoneyInput(amountStr, { allowNegative: false })
  const amountInvalid = amountStr.trim() !== '' && (parsedAmount === null || parsedAmount <= 0)
  const payload = buildQuickAddExpense({
    amount: parsedAmount,
    category,
    name,
    when,
    pastYear: past.year,
    pastMonth: past.month,
    lang,
  })

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!payload) return
    const cat = categoryLabel(payload.kind === 'current' ? payload.expense.category : payload.item.category, lang)
    const amount = payload.kind === 'current' ? payload.expense.amount : payload.item.amount
    const amountText = formatCurrency(amount, data.currency, data.locale)
    if (payload.kind === 'current') {
      addExpense(payload.expense)
      toast.success(t(`${amountText} added to ${cat}`, `${amountText} נוסף ל${cat}`, lang))
    } else {
      addExpenseToMonth(payload.year, payload.month, payload.item)
      const monthLabel = `${monthName(payload.month, lang)} ${payload.year}`
      toast.success(t(`${amountText} added to ${cat} · ${monthLabel}`, `${amountText} נוסף ל${cat} · ${monthLabel}`, lang))
    }
    onOpenChange(false)
    reset()
  }

  const openDetails = () => {
    const initial: Partial<Expense> = {}
    if (parsedAmount !== null && parsedAmount > 0) initial.amount = parsedAmount
    if (category) initial.category = category
    if (name.trim()) initial.name = name.trim()
    setDetailsInitial(initial)
    setDetailsPast(when === 'past' ? past : undefined)
    handingOffRef.current = true
    onOpenChange(false)
    setDetailsOpen(true)
  }

  const amountErrorId = 'qa-amount-error'
  const scanLabel = scan.scanning ? t('Scanning receipt…', 'סורק קבלה…', lang) : t('Scan a receipt', 'סריקת קבלה', lang)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(e) => {
            // Amount first: focus it instead of the first button in the header.
            e.preventDefault()
            amountRef.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            // Handing off to the full form — don't pull focus back to the "+" trigger.
            if (handingOffRef.current) {
              e.preventDefault()
              handingOffRef.current = false
            }
          }}
        >
          <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="flex-1">{t('Add expense', 'הוספת הוצאה', lang)}</DialogTitle>
                {aiEnabled && (
                  <>
                    <input {...scan.inputProps} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={scan.openPicker}
                      disabled={scan.scanning}
                      aria-busy={scan.scanning || undefined}
                      title={scanLabel}
                      aria-label={scanLabel}
                    >
                      {scan.scanning ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Camera className="h-5 w-5" aria-hidden="true" />
                      )}
                    </Button>
                  </>
                )}
              </div>
              <DialogDescription className="sr-only">
                {t('Enter an amount, pick a category and save.', 'הזינו סכום, בחרו קטגוריה ושמרו.', lang)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {scan.scanError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger-strong"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{scan.scanError}</span>
                </div>
              )}

              {/* 1. Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="qa-amount">{t('Amount', 'סכום', lang)}</Label>
                <MoneyInput
                  ref={amountRef}
                  id="qa-amount"
                  size="lg"
                  value={amountStr}
                  onValueChange={(v) => setAmountStr(v)}
                  currency={data.currency}
                  locale={data.locale}
                  placeholder="0"
                  className="h-16 text-4xl font-bold"
                  aria-invalid={amountInvalid || undefined}
                  aria-describedby={amountInvalid ? amountErrorId : undefined}
                />
                {amountInvalid && (
                  <p id={amountErrorId} className="text-xs text-danger-strong">
                    {t('Enter an amount greater than 0', 'יש להזין סכום גדול מ-0', lang)}
                  </p>
                )}
              </div>

              {/* 2. Category chips (recent first) */}
              <div className="space-y-2">
                <p id="qa-category-label" className="text-sm font-medium leading-none">
                  {t('Category', 'קטגוריה', lang)}
                </p>
                <CategoryChips
                  labelledBy="qa-category-label"
                  options={chips}
                  value={category}
                  onChange={setCategory}
                  lang={lang}
                />
              </div>

              {/* 3. Name (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="qa-name">
                  {t('Name', 'שם', lang)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">({t('optional', 'אופציונלי', lang)})</span>
                </Label>
                <Input
                  id="qa-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={category ? categoryLabel(category, lang) : t('e.g. Groceries', 'למשל: קניות בסופר', lang)}
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </div>

              {/* 4. When */}
              <div className="space-y-2">
                <p id="qa-when-label" className="text-sm font-medium leading-none">
                  {t('When?', 'מתי?', lang)}
                </p>
                <SegmentedControl<When>
                  aria-labelledby="qa-when-label"
                  value={when}
                  onValueChange={setWhen}
                  options={[
                    { value: 'current', label: t('This month', 'החודש', lang), icon: CalendarCheck },
                    { value: 'past', label: t('Earlier month…', 'חודש קודם…', lang), icon: History },
                  ]}
                />
                {when === 'past' && (
                  <PastMonthPicker year={past.year} month={past.month} onChange={setPast} lang={lang} idPrefix="qa" />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={openDetails} className="gap-2">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {t('More details', 'פרטים נוספים', lang)}
              </Button>
              <Button type="submit" disabled={!payload} className="sm:min-w-28">
                {t('Save', 'שמור', lang)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ExpenseDialog
        lang={lang}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        initial={detailsInitial}
        initialPast={detailsPast}
        onSave={(e) => addExpense(e)}
      />
    </>
  )
}
