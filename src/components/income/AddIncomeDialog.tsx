import { useEffect, useId, useRef, useState } from 'react'
import { CalendarCheck, CheckCircle2, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinance } from '@/context/FinanceContext'
import { generateId, t } from '@/lib/utils'
import type { Currency, HouseholdMember, IncomeSource, Locale } from '@/types'
import { FieldRow } from './fields'
import {
  DEFAULT_SOURCE, MONTHS, clampPastMonth, monthName, parseNumericField, previousMonth,
  selectableMonths, selectableYears,
} from './incomeUtils'

type Mode = 'budget' | 'past'

/**
 * "Add Income Entry" — When? Current budget (saves an IncomeSource with a
 * manual net) or Past month (→ addIncomeToMonth, find-or-create snapshot).
 */
export function AddIncomeDialog({
  lang, currency, locale, members, onSaveBudget,
}: {
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
  members: HouseholdMember[]
  onSaveBudget: (memberId: string, src: IncomeSource) => void
}) {
  const { addIncomeToMonth } = useFinance()
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const [open, setOpen] = useState(false)

  const now = new Date()
  const prev = previousMonth(now)

  const [mode, setMode]                     = useState<Mode>('budget')
  const [pastMonth, setPastMonth]           = useState(prev.month)
  const [pastYear, setPastYear]             = useState(prev.year)
  const [pastMemberName, setPastMemberName] = useState('')
  const [pastAmount, setPastAmount]         = useState('')
  const [pastNote, setPastNote]             = useState('')

  // Budget mode fields
  const [budgetMemberId, setBudgetMemberId]     = useState('')
  const [budgetSourceName, setBudgetSourceName] = useState('')
  const [budgetAmount, setBudgetAmount]         = useState('')

  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handlePastYearChange = (y: number) => {
    setPastYear(y)
    setPastMonth((m) => clampPastMonth(y, m, new Date()))
  }

  const handleOpen = (o: boolean) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    if (o) {
      setMode('budget')
      setSavedLabel(null)
      setPastMemberName('')
      setPastAmount('')
      setPastNote('')
      setBudgetMemberId(members[0]?.id ?? '')
      setBudgetSourceName('')
      setBudgetAmount('')
      const p = previousMonth(new Date())
      setPastMonth(p.month)
      setPastYear(p.year)
    }
    setOpen(o)
  }

  // Parsed amounts — 0 when empty/invalid, so NaN can never be saved.
  const pastAmountValue   = parseNumericField(pastAmount, 0)
  const budgetAmountValue = parseNumericField(budgetAmount, 0)

  const canSavePast   = pastMemberName.trim().length > 0 && pastAmountValue > 0
  const canSaveBudget = budgetMemberId.length > 0 && budgetSourceName.trim().length > 0 && budgetAmountValue > 0

  const handleSave = () => {
    if (mode === 'past') {
      if (!canSavePast) return
      addIncomeToMonth(pastYear, pastMonth, {
        memberName: pastMemberName.trim(),
        amount: pastAmountValue,
        note: pastNote.trim() || undefined,
      })
      const label = `${monthName(pastMonth, lang)} ${pastYear}`
      setSavedLabel(label)
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        setOpen(false)
        setSavedLabel(null)
      }, 1200)
    } else {
      if (!canSaveBudget) return
      const src: IncomeSource = {
        ...DEFAULT_SOURCE,
        id: generateId(),
        name: budgetSourceName.trim(),
        amount: budgetAmountValue,
        useManualNet: true,
        manualNetOverride: budgetAmountValue,
      }
      onSaveBudget(budgetMemberId, src)
      setOpen(false)
    }
  }

  const monthOptions = selectableMonths(pastYear, now)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('Add Income Entry', 'הוסף רשומת הכנסה', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add Income Entry', 'הוסף רשומת הכנסה', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* When? toggle */}
          <div className="space-y-2">
            <p id={id('when')} className="text-sm font-medium">{t('When?', 'מתי?', lang)}</p>
            <SegmentedControl<Mode>
              aria-labelledby={id('when')}
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'budget', label: t('Current budget', 'תקציב שוטף', lang), icon: CalendarCheck },
                { value: 'past', label: t('Past month', 'חודש קודם', lang), icon: History },
              ]}
            />

            {/* Month + Year pickers — past mode only */}
            {mode === 'past' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <FieldRow label={t('Month', 'חודש', lang)} htmlFor={id('month')}>
                  <Select value={pastMonth.toString()} onValueChange={(v) => setPastMonth(+v)}>
                    <SelectTrigger id={id('month')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.filter((m) => monthOptions.includes(m.value)).map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {lang === 'he' ? m.he : m.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label={t('Year', 'שנה', lang)} htmlFor={id('year')}>
                  <Select value={pastYear.toString()} onValueChange={(v) => handlePastYearChange(+v)}>
                    <SelectTrigger id={id('year')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableYears(now).map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            )}
          </div>

          {/* ── Budget mode fields ── */}
          {mode === 'budget' && (
            <>
              {members.length > 0 && (
                <FieldRow label={t('Member', 'חבר', lang)} htmlFor={id('budget-member')}>
                  <Select value={budgetMemberId} onValueChange={setBudgetMemberId}>
                    <SelectTrigger id={id('budget-member')}>
                      <SelectValue placeholder={t('Select member', 'בחר חבר', lang)} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}
              <FieldRow label={t('Source Name', 'שם המקור', lang)} htmlFor={id('budget-name')}>
                <Input
                  id={id('budget-name')}
                  value={budgetSourceName}
                  onChange={(e) => setBudgetSourceName(e.target.value)}
                  placeholder={t('e.g. Main Salary', 'למשל: משכורת ראשית', lang)}
                />
              </FieldRow>
              <FieldRow label={t('Monthly Net Amount', 'סכום נטו חודשי', lang)} htmlFor={id('budget-amount')}>
                <MoneyInput
                  id={id('budget-amount')}
                  value={budgetAmount}
                  onValueChange={(v) => setBudgetAmount(v)}
                  currency={currency}
                  locale={locale}
                  placeholder="0"
                />
              </FieldRow>
            </>
          )}

          {/* ── Past mode fields ── */}
          {mode === 'past' && (
            <>
              <datalist id="income-dialog-members-list">
                {members.map((m) => <option key={m.id} value={m.name} />)}
              </datalist>
              <FieldRow label={t('Member Name', 'שם החבר', lang)} htmlFor={id('past-member')}>
                <Input
                  id={id('past-member')}
                  list="income-dialog-members-list"
                  value={pastMemberName}
                  onChange={(e) => setPastMemberName(e.target.value)}
                  placeholder={t('e.g. Alex', 'למשל: אלכס', lang)}
                />
              </FieldRow>
              <FieldRow label={t('Net Amount', 'סכום נטו', lang)} htmlFor={id('past-amount')}>
                <MoneyInput
                  id={id('past-amount')}
                  value={pastAmount}
                  onValueChange={(v) => setPastAmount(v)}
                  currency={currency}
                  locale={locale}
                  placeholder="0"
                />
              </FieldRow>
              <FieldRow label={t('Note (optional)', 'הערה (אופציונלי)', lang)} htmlFor={id('past-note')}>
                <Input
                  id={id('past-note')}
                  value={pastNote}
                  onChange={(e) => setPastNote(e.target.value)}
                  placeholder={t('e.g. Bonus payment', 'למשל: בונוס', lang)}
                />
              </FieldRow>
            </>
          )}

          {savedLabel && (
            <p role="status" className="flex items-center justify-center gap-1 text-center text-xs text-success-strong">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(`Added to ${savedLabel} in History`, `נוסף ל${savedLabel} בהיסטוריה`, lang)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={mode === 'past' ? !canSavePast : !canSaveBudget}
            onClick={handleSave}
          >
            {t('Save', 'שמור', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
