import { useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Loader2, Lock, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Money } from '@/components/ui/money'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { estimateTax } from '@/lib/taxEstimation'
import { scanPayslip, aiEnabled, type PayslipScanResult } from '@/lib/aiAdvisor'
import { formatCurrency, generateId, t } from '@/lib/utils'
import type { Country, Currency, IncomeSource, IncomeSourceType, Locale, PayslipComponents } from '@/types'
import { DecimalField, FieldRow, MoneyField, SectionLabel, ToggleRow } from './fields'
import { NetPreview } from './TaxBreakdown'
import { PayslipAdvanced } from './PayslipAdvanced'
import {
  COUNTRIES, CURRENCIES, CURRENCY_SYMBOLS, DEFAULT_PAYSLIP_COMPONENTS, DEFAULT_SOURCE,
  SOURCE_TYPES, computeTaxableGross,
} from './incomeUtils'

function initialForm(existing?: IncomeSource): IncomeSource {
  return {
    ...DEFAULT_SOURCE,
    ...existing,
    id: existing?.id ?? generateId(),
    sourceCurrency: existing?.sourceCurrency ?? undefined,
  }
}

/**
 * Add / edit an income source (gross→net tax engine inputs, payslip scan,
 * advanced payslip, contributions, manual net). Controlled: the parent owns
 * `open`. The form resets every time the sheet opens.
 */
export function SourceDialog({
  open, onOpenChange, memberId, memberName, existing, onSave, lang, currency, locale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName?: string
  existing?: IncomeSource
  onSave: (memberId: string, src: IncomeSource) => void
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
}) {
  const uid = useId()
  const [form, setForm] = useState<IncomeSource>(() => initialForm(existing))

  // ── Payslip scan state ───────────────────────────────────────────────────────
  const payslipFileRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSuccess, setScanSuccess] = useState<string | null>(null)

  // Reset when the sheet opens (adjust-state-on-prop-change; no flash of stale data).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(initialForm(existing))
      setScanError(null)
      setScanSuccess(null)
    }
  }

  const set = <K extends keyof IncomeSource>(k: K, v: IncomeSource[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const breakdown = useMemo(() => estimateTax(form), [form])

  const applyPayslipScan = (result: PayslipScanResult) => {
    const hasComponents = [
      result.base, result.overtime125, result.overtime150,
      result.otherTaxable, result.imputedIncome, result.nonTaxableReimbursements,
    ].some((v) => v !== null && v > 0)

    setForm((prev) => {
      const next = { ...prev }

      if (hasComponents) {
        next.payslipMode = 'advanced'
        next.country = 'IL'
        next.type = 'salary'
        next.isGross = true
        const components: PayslipComponents = {
          base:                     result.base ?? prev.payslipComponents?.base ?? 0,
          overtime125:              result.overtime125 ?? prev.payslipComponents?.overtime125 ?? 0,
          overtime150:              result.overtime150 ?? prev.payslipComponents?.overtime150 ?? 0,
          otherTaxable:             result.otherTaxable ?? prev.payslipComponents?.otherTaxable ?? 0,
          imputedIncome:            result.imputedIncome ?? prev.payslipComponents?.imputedIncome ?? 0,
          nonTaxableReimbursements: result.nonTaxableReimbursements ?? prev.payslipComponents?.nonTaxableReimbursements ?? 0,
        }
        next.payslipComponents = components
        // Keep form.amount in sync so canSubmit passes (same logic as setComp)
        next.amount = computeTaxableGross(components)
      }

      // Always pin the net from the payslip — the payslip "נטו לתשלום" IS the ground truth.
      if (result.net !== null && result.net > 0) {
        next.useManualNet = true
        next.manualNetOverride = result.net
      }

      if (result.pensionEmployee !== null)       { next.pensionEmployee = result.pensionEmployee;           next.useContributions = true }
      if (result.pensionEmployer !== null)       { next.pensionEmployer = result.pensionEmployer }
      if (result.educationFundEmployee !== null) { next.educationFundEmployee = result.educationFundEmployee; next.useContributions = true }
      if (result.educationFundEmployer !== null) { next.educationFundEmployer = result.educationFundEmployer }
      if (result.severanceEmployer !== null)     { next.severanceEmployer = result.severanceEmployer }
      if (result.taxCreditPoints !== null)       { next.taxCreditPoints = result.taxCreditPoints }
      if (result.pensionBase !== null && result.pensionBase > 0)     next.pensionBase = result.pensionBase
      if (result.studyFundBase !== null && result.studyFundBase > 0) next.studyFundBase = result.studyFundBase

      return next
    })

    const filled: string[] = []
    if (hasComponents) filled.push(t('payslip breakdown', 'פירוט תלוש', lang))
    if (result.net !== null && result.net > 0) filled.push(t('net salary (from payslip)', 'נטו לתשלום (מהתלוש)', lang))
    if (result.taxCreditPoints !== null) filled.push(t('tax credit points', 'נקודות זיכוי', lang))
    if (result.pensionEmployee !== null || result.pensionEmployer !== null) filled.push(t('pension %', 'פנסיה %', lang))
    if (result.educationFundEmployee !== null || result.studyFundEmployerAmount !== null) {
      if (result.studyFundEmployerAmount != null) {
        const amt = formatCurrency(result.studyFundEmployerAmount, 'ILS', locale)
        filled.push(t(`study fund — employer ${amt} per month`, `קרן השתלמות — מעסיק ${amt} לחודש`, lang))
      } else {
        filled.push(t('study fund %', 'קרן השתלמות %', lang))
      }
    }

    if (filled.length > 0) {
      setScanSuccess(t('Payslip read — please review:', 'התלוש נקרא — אנא בדוק:', lang) + ' ' + filled.join(', '))
    } else {
      setScanError(t('Could not read payslip fields — please enter manually.', 'לא ניתן לקרוא שדות — אנא הזן ידנית.', lang))
    }
  }

  const handlePayslipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 5 * 1024 * 1024) {
      setScanError(t('File too large — use a file under 5 MB', 'הקובץ גדול מדי — השתמש בקובץ עד 5MB', lang))
      return
    }

    setScanError(null)
    setScanSuccess(null)
    setScanning(true)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await scanPayslip(base64, file.type, lang)
      applyPayslipScan(result)
    } catch (err) {
      setScanError(
        t('Could not read payslip.', 'לא ניתן לקרוא את התלוש.', lang) +
        ' — ' +
        (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setScanning(false)
    }
  }

  const isILSalary = form.type === 'salary' && form.country === 'IL'
  const isAdvanced = isILSalary && form.payslipMode === 'advanced'
  const incomeType = form.incomeType ?? 'fixed'
  // Amounts are entered in the source's own currency (converted for totals).
  const amountCurrency: Currency = form.sourceCurrency ?? currency

  // In advanced mode, amount is auto-synced from components by applyPayslipScan / setComp
  const canSubmit = form.name.trim().length > 0 &&
    Number.isFinite(form.amount) &&
    (isAdvanced
      ? (form.payslipComponents != null && computeTaxableGross(form.payslipComponents) > 0)
      : form.amount > 0
    ) &&
    (!form.useManualNet || (form.manualNetOverride != null && Number.isFinite(form.manualNetOverride) && form.manualNetOverride > 0))

  const handleSave = () => {
    if (!canSubmit) return

    let saved = form

    if (form.payslipMode === 'advanced' && form.payslipComponents) {
      const taxableGross = computeTaxableGross(form.payslipComponents)
      // Clamp contribution bases to taxable gross
      const clampedPensionBase   = form.pensionBase   != null ? Math.min(form.pensionBase,   taxableGross) : undefined
      const clampedStudyFundBase = form.studyFundBase != null ? Math.min(form.studyFundBase, taxableGross) : undefined
      saved = {
        ...form,
        amount: taxableGross,
        pensionBase:   clampedPensionBase,
        studyFundBase: clampedStudyFundBase,
      }
    }

    onSave(memberId, saved)
    onOpenChange(false)
  }

  const id = (name: string) => `${uid}-${name}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('Edit Income Source', 'ערוך מקור הכנסה', lang) : t('Add Income Source', 'הוסף מקור הכנסה', lang)}
          </DialogTitle>
          {memberName && (
            <DialogDescription>
              <bdi>{memberName}</bdi>
            </DialogDescription>
          )}
        </DialogHeader>

        {aiEnabled && (
          <>
            <input
              ref={payslipFileRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handlePayslipFile}
            />
            <Button
              type="button"
              variant="outline"
              disabled={scanning}
              onClick={() => { setScanError(null); setScanSuccess(null); payslipFileRef.current?.click() }}
              title={t('Scan payslip with AI', 'סרוק תלוש עם AI', lang)}
              aria-label={t('Scan payslip', 'סרוק תלוש', lang)}
              className="w-full border-dashed"
            >
              {scanning
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Camera className="h-4 w-4" aria-hidden="true" />}
              {scanning ? t('Scanning…', 'סורק…', lang) : t('Scan Payslip', 'סרוק תלוש', lang)}
            </Button>
          </>
        )}

        {scanError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{scanError}</span>
          </div>
        )}
        {scanSuccess && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs text-success-strong">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{scanSuccess}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* ── 1. Basic Info ─────────────────────────────────────────── */}
          <FieldRow label={t('Source Name', 'שם המקור', lang)} htmlFor={id('name')}>
            <Input
              id={id('name')}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('e.g. Main Salary', 'למשל: משכורת ראשית', lang)}
              autoFocus
            />
          </FieldRow>

          <div className={isAdvanced ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 min-[400px]:grid-cols-2'}>
            {/* Amount field — hidden in advanced mode (auto-computed) */}
            {!isAdvanced && (
              <FieldRow label={t('Monthly Amount', 'סכום חודשי', lang)} htmlFor={id('amount')}>
                <MoneyField
                  id={id('amount')}
                  value={form.amount}
                  emptyValue={0}
                  zeroAsEmpty
                  currency={amountCurrency}
                  locale={locale}
                  onValue={(v) => set('amount', v)}
                />
              </FieldRow>
            )}
            <FieldRow label={t('Type', 'סוג', lang)} htmlFor={id('type')}>
              <Select value={form.type} onValueChange={(v) => set('type', v as IncomeSourceType)}>
                <SelectTrigger id={id('type')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {lang === 'he' ? s.he : s.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          {/* ── Fixed / Variable ──────────────────────────────────────── */}
          <div className="space-y-2">
            <p id={id('incomeType')} className="text-sm text-muted-foreground">{t('Income type', 'סוג הכנסה', lang)}</p>
            <SegmentedControl<'fixed' | 'variable'>
              aria-labelledby={id('incomeType')}
              value={incomeType}
              onValueChange={(v) => set('incomeType', v)}
              options={[
                { value: 'fixed', label: t('Fixed', 'קבוע', lang), icon: Lock },
                { value: 'variable', label: t('Variable', 'משתנה', lang), icon: Waves },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {incomeType === 'fixed'
                ? t('Fixed income — predictable every month', 'הכנסה קבועה — צפויה כל חודש', lang)
                : t('Variable income — freelance, bonus, commission', 'הכנסה משתנה — פרילנס, בונוס, עמלה', lang)}
            </p>
          </div>

          {/* ── Simple / Advanced (IL salary only) ────────────────────── */}
          {isILSalary && (
            <div className="space-y-2">
              <p id={id('payslipMode')} className="text-sm text-muted-foreground">{t('Payslip mode', 'מצב תלוש', lang)}</p>
              <SegmentedControl<'simple' | 'advanced'>
                aria-labelledby={id('payslipMode')}
                value={isAdvanced ? 'advanced' : 'simple'}
                onValueChange={(v) => {
                  if (v === 'simple') {
                    set('payslipMode', 'simple')
                  } else {
                    setForm((f) => ({
                      ...f,
                      payslipMode: 'advanced',
                      payslipComponents: f.payslipComponents ?? { ...DEFAULT_PAYSLIP_COMPONENTS },
                    }))
                  }
                }}
                options={[
                  { value: 'simple', label: t('Simple', 'פשוט', lang) },
                  { value: 'advanced', label: t('Advanced', 'מפורט', lang) },
                ]}
              />
            </div>
          )}

          {/* ── Advanced payslip fields ───────────────────────────────── */}
          {isAdvanced && (
            <PayslipAdvanced form={form} setForm={setForm} lang={lang} currency={currency} locale={locale} />
          )}

          {/* ── 2. Gross Toggle ───────────────────────────────────────── */}
          <ToggleRow
            id={id('isGross')}
            label={t('This is gross pay (calculate net)', 'זהו שכר ברוטו (חשב נטו)', lang)}
            subLabel={t('Apply tax brackets and deductions', 'החל מדרגות מס וניכויים', lang)}
            checked={form.isGross}
            onCheckedChange={(v) => set('isGross', v)}
          />

          {form.isGross && (
            <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
              {/* Country */}
              <FieldRow label={t('Country', 'בחר מדינה', lang)} htmlFor={id('country')}>
                <Select value={form.country} onValueChange={(v) => set('country', v as Country)}>
                  <SelectTrigger id={id('country')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              {/* Currency selector — non-IL income */}
              {form.country !== 'IL' && (
                <FieldRow
                  label={t('Currency', 'מטבע', lang)}
                  htmlFor={id('currency')}
                  hint={
                    form.sourceCurrency && form.sourceCurrency !== currency
                      ? t(
                          `Amount in ${form.sourceCurrency}. Converted to ${currency} using today's rate.`,
                          `סכום ב-${form.sourceCurrency}. מומר ל-${currency} לפי שער היום.`,
                          lang,
                        )
                      : undefined
                  }
                >
                  <Select
                    value={form.sourceCurrency ?? currency}
                    onValueChange={(v) => set('sourceCurrency', v as Currency)}
                  >
                    <SelectTrigger id={id('currency')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_SYMBOLS[c]} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}

              {/* IL-specific fields — hidden when manual net is used (tax calc not needed) */}
              {form.country === 'IL' && !form.useManualNet && (
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label={t('Tax Credit Points', 'נקודות זיכוי', lang)} htmlFor={id('tcp')}>
                    <DecimalField
                      id={id('tcp')}
                      value={form.taxCreditPoints}
                      emptyValue={0}
                      onValue={(v) => set('taxCreditPoints', v)}
                    />
                  </FieldRow>
                  <FieldRow label={t('Insured Salary %', 'אחוז שכר מבוטח', lang)} htmlFor={id('isr')}>
                    <DecimalField
                      id={id('isr')}
                      value={form.insuredSalaryRatio}
                      emptyValue={0}
                      suffix="%"
                      onValue={(v) => set('insuredSalaryRatio', v)}
                    />
                  </FieldRow>
                </div>
              )}

              {/* Contributions Toggle */}
              <ToggleRow
                id={id('useContributions')}
                label={t('Add salary contributions', 'הוסף הפרשות שכר', lang)}
                subLabel={t('Pension, education fund, severance', 'פנסיה, קרן השתלמות, פיצויים', lang)}
                checked={form.useContributions}
                onCheckedChange={(v) => set('useContributions', v)}
              />

              {form.useContributions && (
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <SectionLabel>{t('Employee (deducted from net)', 'עובד (מנוכה מנטו)', lang)}</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label={t('Pension %', 'פנסיה %', lang)} htmlFor={id('pe')}>
                      <DecimalField id={id('pe')} value={form.pensionEmployee} emptyValue={0} suffix="%"
                        onValue={(v) => set('pensionEmployee', v)} />
                    </FieldRow>
                    <FieldRow label={t('Edu. Fund %', 'קרן השתלמות %', lang)} htmlFor={id('efe')}>
                      <DecimalField id={id('efe')} value={form.educationFundEmployee} emptyValue={0} suffix="%"
                        onValue={(v) => set('educationFundEmployee', v)} />
                    </FieldRow>
                  </div>

                  <SectionLabel className="mt-2">{t('Employer (informational)', 'מעסיק (לידיעה בלבד)', lang)}</SectionLabel>
                  <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3">
                    <FieldRow label={t('Pension %', 'פנסיה %', lang)} htmlFor={id('per')}>
                      <DecimalField id={id('per')} value={form.pensionEmployer} emptyValue={0} suffix="%"
                        onValue={(v) => set('pensionEmployer', v)} />
                    </FieldRow>
                    <FieldRow label={t('Edu. Fund %', 'השתלמות %', lang)} htmlFor={id('efr')}>
                      <DecimalField id={id('efr')} value={form.educationFundEmployer} emptyValue={0} suffix="%"
                        onValue={(v) => set('educationFundEmployer', v)} />
                    </FieldRow>
                    <FieldRow label={t('Severance %', 'פיצויים %', lang)} htmlFor={id('sev')}>
                      <DecimalField id={id('sev')} value={form.severanceEmployer} emptyValue={0} suffix="%"
                        onValue={(v) => set('severanceEmployer', v)} />
                    </FieldRow>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. Manual Net Toggle ──────────────────────────────────── */}
          <ToggleRow
            id={id('useManualNet')}
            label={t('Override net manually', 'דרוס שכר נטו ידנית', lang)}
            subLabel={t('Skip all calculations — enter take-home directly', 'דלג על כל החישובים — הזן נטו ישירות', lang)}
            checked={form.useManualNet}
            onCheckedChange={(v) => set('useManualNet', v)}
          />

          {form.useManualNet && (
            <FieldRow label={t('Manual Net Amount', 'סכום נטו ידני', lang)} htmlFor={id('manualNet')}>
              <MoneyField
                id={id('manualNet')}
                value={form.manualNetOverride}
                emptyValue={undefined}
                currency={amountCurrency}
                locale={locale}
                placeholder={t('Take-home amount per month', 'סכום נטו לחודש', lang)}
                onValue={(v) => set('manualNetOverride', v)}
              />
            </FieldRow>
          )}

          {/* ── 4. Net Preview ────────────────────────────────────────── */}
          {form.amount > 0 && (
            <NetPreview breakdown={breakdown} currency={amountCurrency} locale={locale} lang={lang} />
          )}

          {/* ── Employer summary (informational) ──────────────────────── */}
          {form.isGross && form.useContributions && form.amount > 0 && (
            <div className="space-y-1 rounded-lg border border-dashed p-3 text-xs">
              <p className="mb-1 font-medium text-muted-foreground">
                {t('Employer Cost (on top of your gross)', 'עלות מעסיק (מעל הברוטו)', lang)}
              </p>
              {([
                [t('Pension', 'פנסיה', lang), breakdown.pensionEmployer],
                [t('Education Fund', 'קרן השתלמות', lang), breakdown.educationFundEmployer],
                [t('Severance', 'פיצויים', lang), breakdown.severanceEmployer],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-0.5">
                  <span className="text-muted-foreground">{label}</span>
                  <Money value={value} currency={amountCurrency} locale={locale} />
                </div>
              ))}
              <div className="mt-1 flex justify-between gap-3 border-t pt-1 font-semibold">
                <span>{t('Total employer cost', 'עלות כוללת למעסיק', lang)}</span>
                <Money value={form.amount + breakdown.totalEmployerContrib} currency={amountCurrency} locale={locale} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="w-full" disabled={!canSubmit || scanning} onClick={handleSave}>
            {t('Save Source', 'שמור מקור', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
