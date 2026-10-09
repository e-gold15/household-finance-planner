import { useLayoutEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Info, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Money } from '@/components/ui/money'
import { MoneyInput } from '@/components/ui/money-input'
import { StatusChip } from '@/components/ui/status-chip'
import { activeMonthActual } from '@/lib/monthActual'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import { getNetMonthly } from '@/lib/taxEstimation'
import { cn, t } from '@/lib/utils'
import type { Currency, IncomeMonthActual, IncomeSource, Locale } from '@/types'

const REASONS: Array<{ en: string; he: string }> = [
  { en: 'Bonus', he: 'בונוס' },
  { en: 'Vacation days', he: 'ימי חופשה' },
  { en: 'Overtime', he: 'שעות נוספות' },
  { en: 'Holiday gift', he: 'מתנה לחג' },
]

/**
 * v4.2 — "This month's actual": records the net actually received this month
 * for one source. The planned amount is shown read-only and never changed.
 */
export function MonthActualDialog({
  open, onOpenChange, memberName, source, yearMonth, monthLabel, onSave, lang, currency, locale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  source: IncomeSource
  /** Current month, "YYYY-MM". */
  yearMonth: string
  /** Localized "October 2026". */
  monthLabel: string
  /** `null` = reset to planned. */
  onSave: (actual: IncomeMonthActual | null) => void
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
}) {
  const planned = getNetMonthly(source)
  const existing = activeMonthActual(source, yearMonth)
  const ownCurrency: Currency = source.sourceCurrency ?? currency

  // Planned net rounded to agorot — the pre-fill and the comparison base, so an
  // untouched field never shows a fake "−₪0" difference.
  const plannedRounded = Math.round(planned * 100) / 100
  const seedValue = () => toMoneyInputValue(existing ? existing.amount : plannedRounded)
  const [value, setValue] = useState(seedValue)
  const [note, setNote] = useState(existing?.note ?? '')
  const [touched, setTouched] = useState(false)

  // Re-seed every time the sheet opens (before paint, so no empty-field flash).
  useLayoutEffect(() => {
    if (!open) return
    setValue(seedValue())
    setNote(existing?.note ?? '')
    setTouched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parsed = parseMoneyInput(value)
  const valid = parsed !== null && Number.isFinite(parsed) && parsed >= 0
  const delta = valid ? parsed - plannedRounded : 0

  const save = () => {
    if (!valid) return
    const trimmed = note.trim()
    onSave({ month: yearMonth, amount: parsed, ...(trimmed ? { note: trimmed } : {}) })
    onOpenChange(false)
  }

  const reset = () => {
    onSave(null)
    onOpenChange(false)
  }

  // Salaries arrive the month after they're earned: what comes in this month is
  // usually last month's pay, and it funds this month's expenses (v4.2.1 copy).
  const [y, m] = yearMonth.split('-').map(Number)
  const loc = lang === 'he' ? 'he-IL' : 'en-US'
  const payMonth = new Date(y, m - 2, 1).toLocaleDateString(loc, { month: 'long' })
  const spendMonth = new Date(y, m - 1, 1).toLocaleDateString(loc, { month: 'long' })

  const inputId = `month-actual-${source.id}`
  const hintId = `month-actual-hint-${source.id}`
  const noteId = `month-actual-note-${source.id}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("This month's actual", 'בפועל החודש', lang)}</DialogTitle>
          <DialogDescription>
            <bdi>{memberName}</bdi> · <bdi>{source.name}</bdi> — {t(`received in ${monthLabel}`, `התקבל ב${monthLabel}`, lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">{t('Planned net per month', 'נטו מתוכנן לחודש', lang)}</span>
            <Money value={planned} currency={ownCurrency} locale={locale} className="font-semibold" />
          </div>

          <div className="space-y-2">
            <Label htmlFor={inputId}>{t('Actual net received this month', 'נטו שהתקבל בפועל החודש', lang)}</Label>
            <p id={hintId} className="text-xs text-muted-foreground">
              {t(
                `Usually ${payMonth}'s pay — it funds ${spendMonth}'s expenses.`,
                `בדרך כלל משכורת ${payMonth} — היא מממנת את ההוצאות של ${spendMonth}.`,
                lang,
              )}
            </p>
            <MoneyInput
              id={inputId}
              value={value}
              onValueChange={(v) => {
                setValue(v)
                setTouched(true)
              }}
              currency={ownCurrency}
              locale={locale}
              aria-invalid={touched && !valid}
              aria-describedby={hintId}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
            {valid ? (
              Math.abs(delta) >= 0.005 && (
                <StatusChip
                  tone={delta > 0 ? 'success' : 'warning'}
                  icon={delta > 0 ? ArrowUp : ArrowDown}
                  size="md"
                  label={
                    <>
                      <Money value={delta} currency={ownCurrency} locale={locale} showSign />{' '}
                      {t('vs planned', 'מהמתוכנן', lang)}
                    </>
                  }
                />
              )
            ) : touched && (
              <p className="text-sm text-destructive" role="alert">
                {t('Enter an amount of 0 or more.', 'יש להזין סכום של 0 ומעלה.', lang)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={noteId}>
              {t('Why is it different?', 'למה זה שונה?', lang)}{' '}
              <span className="font-normal text-muted-foreground">{t('(optional)', '(לא חובה)', lang)}</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => {
                const label = t(r.en, r.he, lang)
                const selected = note.trim() === label
                return (
                  <Button
                    key={r.en}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={selected}
                    className={cn('min-h-[44px] rounded-full', selected && 'border-primary bg-primary-subtle text-primary-strong')}
                    onClick={() => setNote(selected ? '' : label)}
                  >
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {label}
                  </Button>
                )
              })}
            </div>
            <Input
              id={noteId}
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. 3 vacation days', 'למשל: 3 ימי חופשה', lang)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary-subtle px-3 py-2.5 text-sm text-primary-strong">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t(
                `Counts toward the ${monthLabel} budget only. Your planned amount and future months stay the same.`,
                `נספר רק בתקציב של ${monthLabel}. הסכום המתוכנן והחודשים הבאים נשארים ללא שינוי.`,
                lang,
              )}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" disabled={!valid} onClick={save}>
            {t(`Save for ${monthLabel}`, `שמור עבור ${monthLabel}`, lang)}
          </Button>
          <div className="flex gap-2">
            {existing && (
              <Button variant="outline" className="flex-1" onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('Reset to planned', 'חזרה למתוכנן', lang)}
              </Button>
            )}
            <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
