import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { Switch } from '@/components/ui/switch'
import { sanitizeMoneyTyping } from '@/lib/moneyInput'
import { cn } from '@/lib/utils'
import type { Currency, Locale } from '@/types'
import { numericFieldText, parseNumericField } from './incomeUtils'

// ── Layout helpers ────────────────────────────────────────────────────────────

export function FieldRow({
  label, htmlFor, hint, children, className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ToggleRow({
  id, label, subLabel, checked, onCheckedChange,
}: {
  id: string; label: string; subLabel?: string
  checked: boolean; onCheckedChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-4 py-3 transition-colors duration-fast hover:bg-secondary/60"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}>
      {children}
    </p>
  )
}

// ── Numeric fields ────────────────────────────────────────────────────────────

/**
 * Keeps the editable text of a numeric field in sync with a stored number.
 * Typing updates the text and reports a parsed value (`fallback` when empty /
 * invalid — never NaN). If the stored number changes from outside (e.g. a
 * payslip scan), the text is replaced.
 */
function useNumericText<F extends number | undefined>(
  value: number | undefined,
  fallback: F,
  zeroAsEmpty: boolean,
  onValue: (v: number | F) => void,
) {
  const [text, setText] = useState(() => numericFieldText(value, zeroAsEmpty))

  useEffect(() => {
    if (parseNumericField(text, fallback) !== value) setText(numericFieldText(value, zeroAsEmpty))
    // Only react to external value changes; `text` is the source while typing.
  }, [value])

  const change = (next: string) => {
    setText(next)
    onValue(parseNumericField(next, fallback))
  }
  return [text, change] as const
}

interface NumericFieldProps<F extends number | undefined> {
  id: string
  value: number | undefined
  /** Stored when the field is emptied (0 for required numbers, undefined for optional ones). */
  emptyValue: F
  onValue: (v: number | F) => void
  /** Show a stored 0 as an empty field (legacy `value || ''`). */
  zeroAsEmpty?: boolean
  placeholder?: string
  'aria-describedby'?: string
}

/** Currency amount field (MoneyInput: text + inputMode=decimal, can be emptied). */
export function MoneyField<F extends number | undefined>({
  id, value, emptyValue, onValue, zeroAsEmpty = false, placeholder, currency, locale, ...rest
}: NumericFieldProps<F> & { currency: Currency; locale: Locale }) {
  const [text, change] = useNumericText(value, emptyValue, zeroAsEmpty, onValue)
  return (
    <MoneyInput
      id={id}
      value={text}
      onValueChange={(v) => change(v)}
      currency={currency}
      locale={locale}
      placeholder={placeholder ?? '0'}
      aria-describedby={rest['aria-describedby']}
    />
  )
}

/** Plain decimal field for percentages and points (no currency adornment). */
export function DecimalField<F extends number | undefined>({
  id, value, emptyValue, onValue, zeroAsEmpty = false, placeholder, suffix, ...rest
}: NumericFieldProps<F> & { suffix?: string }) {
  const [text, change] = useNumericText(value, emptyValue, zeroAsEmpty, onValue)
  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        className={cn('num tabular-nums', suffix && 'pe-8')}
        value={text}
        placeholder={placeholder}
        aria-describedby={rest['aria-describedby']}
        onChange={(e) => change(sanitizeMoneyTyping(e.target.value))}
      />
      {suffix && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  )
}
