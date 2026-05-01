import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp, UserPlus, Users,
  ArrowRight, BadgeCheck, Pencil, CalendarCheck, History, Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Switch } from './ui/switch'
import { useFinance } from '@/context/FinanceContext'
import { estimateTax, getNetMonthly, type TaxBreakdown } from '@/lib/taxEstimation'
import { formatCurrency, generateId, t } from '@/lib/utils'
import type { Country, IncomeSource, IncomeSourceType, HouseholdMember, PayslipComponents } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_TYPES: { value: IncomeSourceType; en: string; he: string }[] = [
  { value: 'salary',     en: 'Salary',       he: 'משכורת' },
  { value: 'freelance',  en: 'Freelance',     he: 'פרילנס' },
  { value: 'business',   en: 'Business',      he: 'עסק עצמאי' },
  { value: 'rental',     en: 'Rental',        he: 'שכ"ד' },
  { value: 'investment', en: 'Investment',    he: 'השקעות' },
  { value: 'pension',    en: 'Pension',       he: 'פנסיה' },
  { value: 'other',      en: 'Other',         he: 'אחר' },
]

const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'IL', label: 'ישראל 🇮🇱' },
  { value: 'US', label: 'USA 🇺🇸' },
  { value: 'UK', label: 'UK 🇬🇧' },
  { value: 'DE', label: 'Germany 🇩🇪' },
  { value: 'FR', label: 'France 🇫🇷' },
  { value: 'CA', label: 'Canada 🇨🇦' },
]

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

const DEFAULT_SOURCE: Omit<IncomeSource, 'id'> = {
  name: '',
  amount: 0,
  period: 'monthly',
  type: 'salary',
  isGross: true,
  useManualNet: false,
  country: 'IL',
  taxCreditPoints: 2.25,
  insuredSalaryRatio: 100,
  useContributions: false,
  pensionEmployee: 6,
  pensionEmployer: 6.5,
  educationFundEmployee: 2.5,
  educationFundEmployer: 7.5,
  severanceEmployer: 8.33,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  id, label, subLabel, checked, onCheckedChange,
}: {
  id: string; label: string; subLabel?: string
  checked: boolean; onCheckedChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between rounded-lg border bg-secondary/40 px-4 py-3 cursor-pointer hover:bg-secondary/60 transition-colors"
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

function NetPreview({
  breakdown, currency, locale, lang,
}: {
  breakdown: TaxBreakdown; currency: string; locale: string; lang: 'en' | 'he'
}) {
  const fmt = (v: number) => formatCurrency(v, currency as any, locale as any)

  return (
    <div className="rounded-lg border bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {t('Monthly Net', 'נטו חודשי', lang)}
        </span>
        <div className="flex items-center gap-2">
          {breakdown.grossMonthly > 0 && !breakdown.isManual && breakdown.grossMonthly !== breakdown.netMonthly && (
            <span className="text-xs text-muted-foreground line-through">{fmt(breakdown.grossMonthly)}</span>
          )}
          <span className="text-lg font-bold text-primary">{fmt(breakdown.netMonthly)}</span>
        </div>
      </div>
      {breakdown.effectiveRate > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('Effective deduction rate', 'שיעור ניכוי אפקטיבי', lang)}: {breakdown.effectiveRate.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

function ContribRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ── Payslip helpers ───────────────────────────────────────────────────────────

const DEFAULT_PAYSLIP_COMPONENTS: PayslipComponents = {
  base: 0,
  overtime125: 0,
  overtime150: 0,
  otherTaxable: 0,
  imputedIncome: 0,
  nonTaxableReimbursements: 0,
}

function computeTaxableGross(c: PayslipComponents): number {
  return c.base + c.overtime125 + c.overtime150 + c.otherTaxable + c.imputedIncome
}

function computeTotalGross(c: PayslipComponents): number {
  return computeTaxableGross(c) + c.nonTaxableReimbursements
}

// ── PayslipAdvanced ───────────────────────────────────────────────────────────

function PayslipAdvanced({
  form,
  setForm,
  lang,
  currency,
  locale,
}: {
  form: IncomeSource
  setForm: React.Dispatch<React.SetStateAction<IncomeSource>>
  lang: 'en' | 'he'
  currency: string
  locale: string
}) {
  const fmt = (v: number) => formatCurrency(v, currency as never, locale as never)
  const [showBases, setShowBases] = useState(false)

  const comp = form.payslipComponents ?? DEFAULT_PAYSLIP_COMPONENTS

  const setComp = (key: keyof PayslipComponents, value: number) => {
    const next = { ...comp, [key]: value }
    const taxableGross = computeTaxableGross(next)
    setForm((f) => ({
      ...f,
      payslipComponents: next,
      amount: taxableGross,
    }))
  }

  const taxableGross = computeTaxableGross(comp)
  const totalGross   = computeTotalGross(comp)
  const nonTaxable   = comp.nonTaxableReimbursements
  const guaranteedPct = taxableGross > 0 ? Math.round((comp.base / taxableGross) * 100) : 0

  // Employer cost card values (read-only)
  const pensionBase   = form.pensionBase ?? taxableGross
  const studyBase     = form.studyFundBase ?? taxableGross
  const empPension    = ((form.pensionEmployer ?? 6.5) / 100) * pensionBase
  const empStudy      = ((form.educationFundEmployer ?? 7.5) / 100) * studyBase
  const empSeverance  = ((form.severanceEmployer ?? 8.33) / 100) * pensionBase
  // Employer cost gross = pensionBase (the insured salary, per spec).
  // Pension, study fund and severance contributions are all based on their respective bases.
  const totalEmpCost  = pensionBase + empPension + empStudy + empSeverance

  const PAYSLIP_FIELDS: Array<{
    key: keyof PayslipComponents
    en: string
    he: string
  }> = [
    { key: 'base',                    en: 'Base salary',                   he: 'שכר יסוד' },
    { key: 'overtime125',             en: 'Global overtime 125%',          he: 'גלובאלי 125%' },
    { key: 'overtime150',             en: 'Global overtime 150%',          he: 'גלובאלי 150%' },
    { key: 'otherTaxable',            en: 'Other taxable additions',       he: 'תוספות חייבות' },
    { key: 'imputedIncome',           en: 'Imputed income (שווי מס)',      he: 'שווי מס' },
    { key: 'nonTaxableReimbursements',en: 'Reimbursements (non-taxable)',  he: 'החזרים (לא חייבים)' },
  ]

  return (
    <div className="space-y-4">
      {/* Helper info note */}
      <div className="flex gap-2 rounded-lg border bg-muted/40 p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(
            'In many Israeli payslips, the pension/study fund bases differ from total gross. Copy the contribution bases from your payslip for accurate results.',
            'בתלושי שכר רבים, שכר הבסיס לפנסיה/קרן השתלמות שונה מהברוטו הכולל. העתק את הבסיסים מהתלוש לחישוב מדויק.',
            lang,
          )}
        </p>
      </div>

      {/* Component fields */}
      <div className="rounded-lg border bg-secondary/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('Payslip components', 'רכיבי תלוש', lang)}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAYSLIP_FIELDS.map(({ key, en, he }) => (
            <FieldRow key={key} label={t(en, he, lang)}>
              <Input
                type="number"
                min={0}
                step={1}
                className="min-h-[44px]"
                value={comp[key] || ''}
                placeholder="0"
                onChange={(e) => setComp(key, Math.max(0, +e.target.value))}
              />
            </FieldRow>
          ))}
        </div>

        {/* Live summary */}
        <div className="rounded-md bg-muted/60 border px-3 py-2 text-xs space-y-0.5">
          <div className="flex flex-wrap gap-3">
            <span>
              <span className="text-muted-foreground">{t('Total gross', 'ברוטו כולל', lang)}: </span>
              <span className="font-semibold">{fmt(totalGross)}</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              <span className="text-muted-foreground">{t('Taxable', 'חייב', lang)}: </span>
              <span className="font-semibold text-primary">{fmt(taxableGross)}</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              <span className="text-muted-foreground">{t('Non-taxable', 'לא חייב', lang)}: </span>
              <span className="font-semibold">{fmt(nonTaxable)}</span>
            </span>
          </div>
          {taxableGross > 0 && (
            <div className="pt-1">
              <Badge variant="secondary" className="text-xs">
                {t('Guaranteed', 'מובטח', lang)} {guaranteedPct}%
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Contribution bases — collapsible */}
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBases((v) => !v)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-secondary/30 hover:bg-secondary/50 transition-colors min-h-[44px]"
        >
          <span>{t('Contribution bases', 'בסיסי חישוב', lang)}</span>
          {showBases ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showBases && (
          <div className="p-4 space-y-4 bg-card">
            <FieldRow label={t('Pension insured salary', 'שכר מבוטח לפנסיה', lang)}>
              <Input
                type="number"
                min={0}
                step={1}
                className="min-h-[44px]"
                value={form.pensionBase ?? ''}
                placeholder={t('Defaults to taxable gross', 'ברירת מחדל: ברוטו חייב', lang)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pensionBase: e.target.value ? Math.max(0, +e.target.value) : undefined,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('Defaults to taxable gross if left blank', 'ברירת מחדל: שכר ברוטו החייב', lang)}
              </p>
            </FieldRow>

            <FieldRow label={t('Study fund base', 'בסיס קרן השתלמות', lang)}>
              <Input
                type="number"
                min={0}
                step={1}
                className="min-h-[44px]"
                value={form.studyFundBase ?? ''}
                placeholder={t('Defaults to taxable gross', 'ברירת מחדל: ברוטו חייב', lang)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    studyFundBase: e.target.value ? Math.max(0, +e.target.value) : undefined,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('Defaults to taxable gross if left blank', 'ברירת מחדל: שכר ברוטו החייב', lang)}
              </p>
            </FieldRow>
          </div>
        )}
      </div>

      {/* Employer cost card — read-only */}
      {taxableGross > 0 && (
        <div className="rounded-lg border border-dashed p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('Employer total cost', 'עלות מעסיק', lang)}
          </p>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Gross salary (pension base)', 'שכר ברוטו (בסיס פנסיה)', lang)}</span>
              <span className="font-semibold">{fmt(pensionBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('Employer pension', 'פנסיה מעסיק', lang)} ({form.pensionEmployer ?? 6.5}%)
              </span>
              <span className="font-semibold">{fmt(empPension)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('Employer study fund', 'קרן השתלמות מעסיק', lang)} ({form.educationFundEmployer ?? 7.5}%)
              </span>
              <span className="font-semibold">{fmt(empStudy)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('Severance', 'פיצויים', lang)} ({form.severanceEmployer ?? 8.33}%)
              </span>
              <span className="font-semibold">{fmt(empSeverance)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="text-muted-foreground font-medium">{t('Total', 'סה"כ', lang)}</span>
              <span className="text-primary font-bold">{fmt(totalEmpCost)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SourceDialog ──────────────────────────────────────────────────────────────

function SourceDialog({
  memberId, existing, onSave, lang, currency, locale,
}: {
  memberId: string
  existing?: IncomeSource
  onSave: (memberId: string, src: IncomeSource) => void
  lang: 'en' | 'he'
  currency: string
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<IncomeSource>(() => ({
    ...DEFAULT_SOURCE,
    ...existing,
    id: existing?.id ?? generateId(),
  }))

  const set = <K extends keyof IncomeSource>(k: K, v: IncomeSource[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const breakdown = useMemo(() => estimateTax(form), [form])

  const isILSalary = form.type === 'salary' && form.country === 'IL'
  const isAdvanced = isILSalary && form.payslipMode === 'advanced'

  // In advanced mode, amount is auto-computed; we just need name + at least one component > 0
  const canSubmit = form.name.trim().length > 0 &&
    (isAdvanced ? form.amount > 0 : form.amount > 0) &&
    (!form.useManualNet || (form.manualNetOverride != null && form.manualNetOverride > 0))

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...DEFAULT_SOURCE, ...existing, id: existing?.id ?? generateId() })
    setOpen(v)
  }

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
    setOpen(false)
  }

  const fmt = (v: number) => formatCurrency(v, currency as any, locale as any)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            title={t('Edit income source', 'ערוך מקור הכנסה', lang)}
            aria-label={t('Edit income source', 'ערוך מקור הכנסה', lang)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 me-1" />
            {t('Add Source', 'הוסף מקור', lang)}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('Edit Income Source', 'ערוך מקור הכנסה', lang) : t('Add Income Source', 'הוסף מקור הכנסה', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">

          {/* ── 1. Basic Info ─────────────────────────────────────────── */}
          <FieldRow label={t('Source Name', 'שם המקור', lang)}>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('e.g. Main Salary', 'למשל: משכורת ראשית', lang)}
              autoFocus
            />
          </FieldRow>

          <div className={isAdvanced ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
            {/* Amount field — hidden in advanced mode (auto-computed) */}
            {!isAdvanced && (
              <FieldRow label={t('Monthly Amount', 'סכום חודשי', lang)}>
                <Input
                  type="number"
                  min={0}
                  className="min-h-[44px]"
                  value={form.amount || ''}
                  onChange={(e) => set('amount', +e.target.value)}
                  placeholder="0"
                />
              </FieldRow>
            )}
            <FieldRow label={t('Type', 'סוג', lang)}>
              <Select value={form.type} onValueChange={(v) => set('type', v as IncomeSourceType)}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
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

          {/* ── Simple / Advanced toggle (IL salary only) ─────────────── */}
          {isILSalary && (
            <div>
              <Label className="mb-2 block text-sm text-muted-foreground">
                {t('Payslip mode', 'מצב תלוש', lang)}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={!isAdvanced}
                  onClick={() => {
                    set('payslipMode', 'simple')
                  }}
                  className={`flex items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    !isAdvanced
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('Simple', 'פשוט', lang)}
                </button>
                <button
                  type="button"
                  aria-pressed={isAdvanced}
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      payslipMode: 'advanced',
                      payslipComponents: f.payslipComponents ?? { ...DEFAULT_PAYSLIP_COMPONENTS },
                    }))
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    isAdvanced
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('Advanced', 'מפורט', lang)}
                </button>
              </div>
            </div>
          )}

          {/* ── Advanced payslip fields ───────────────────────────────── */}
          {isAdvanced && (
            <PayslipAdvanced
              form={form}
              setForm={setForm}
              lang={lang}
              currency={currency}
              locale={locale}
            />
          )}

          {/* ── 2. Gross Toggle ───────────────────────────────────────── */}
          <ToggleRow
            id="isGross"
            label={t('This is gross pay (calculate net)', 'זהו שכר ברוטו (חשב נטו)', lang)}
            subLabel={t('Apply tax brackets and deductions', 'החל מדרגות מס וניכויים', lang)}
            checked={form.isGross}
            onCheckedChange={(v) => set('isGross', v)}
          />

          {form.isGross && !form.useManualNet && (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-4">

              {/* Country */}
              <FieldRow label={t('Country', 'בחר מדינה', lang)}>
                <Select value={form.country} onValueChange={(v) => set('country', v as Country)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              {/* IL-specific fields */}
              {form.country === 'IL' && (
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label={t('Tax Credit Points', 'נקודות זיכוי', lang)}>
                    <Input
                      type="number" step="0.25" min={0}
                      value={form.taxCreditPoints}
                      onChange={(e) => set('taxCreditPoints', +e.target.value)}
                    />
                  </FieldRow>
                  <FieldRow label={t('Insured Salary %', 'אחוז שכר מבוטח', lang)}>
                    <Input
                      type="number" step="1" min={0} max={100}
                      value={form.insuredSalaryRatio}
                      onChange={(e) => set('insuredSalaryRatio', +e.target.value)}
                    />
                  </FieldRow>
                </div>
              )}

              {/* Contributions Toggle */}
              <ToggleRow
                id="useContributions"
                label={t('Add salary contributions', 'הוסף הפרשות שכר', lang)}
                subLabel={t('Pension, education fund, severance', 'פנסיה, קרן השתלמות, פיצויים', lang)}
                checked={form.useContributions}
                onCheckedChange={(v) => set('useContributions', v)}
              />

              {form.useContributions && (
                <div className="rounded-lg border bg-card p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('Employee (deducted from net)', 'עובד (מנוכה מנטו)', lang)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label={t('Pension %', 'פנסיה %', lang)}>
                      <Input type="number" step="0.5" min={0} value={form.pensionEmployee}
                        onChange={(e) => set('pensionEmployee', +e.target.value)} />
                    </FieldRow>
                    <FieldRow label={t('Edu. Fund %', 'קרן השתלמות %', lang)}>
                      <Input type="number" step="0.5" min={0} value={form.educationFundEmployee}
                        onChange={(e) => set('educationFundEmployee', +e.target.value)} />
                    </FieldRow>
                  </div>

                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                    {t('Employer (informational)', 'מעסיק (לידיעה בלבד)', lang)}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <FieldRow label={t('Pension %', 'פנסיה %', lang)}>
                      <Input type="number" step="0.5" min={0} value={form.pensionEmployer}
                        onChange={(e) => set('pensionEmployer', +e.target.value)} />
                    </FieldRow>
                    <FieldRow label={t('Edu. Fund %', 'השתלמות %', lang)}>
                      <Input type="number" step="0.5" min={0} value={form.educationFundEmployer}
                        onChange={(e) => set('educationFundEmployer', +e.target.value)} />
                    </FieldRow>
                    <FieldRow label={t('Severance %', 'פיצויים %', lang)}>
                      <Input type="number" step="0.5" min={0} value={form.severanceEmployer}
                        onChange={(e) => set('severanceEmployer', +e.target.value)} />
                    </FieldRow>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. Manual Net Toggle ──────────────────────────────────── */}
          <ToggleRow
            id="useManualNet"
            label={t('Override net manually', 'דרוס שכר נטו ידנית', lang)}
            subLabel={t('Skip all calculations — enter take-home directly', 'דלג על כל החישובים — הזן נטו ישירות', lang)}
            checked={form.useManualNet}
            onCheckedChange={(v) => set('useManualNet', v)}
          />

          {form.useManualNet && (
            <FieldRow label={t('Manual Net Amount', 'סכום נטו ידני', lang)}>
              <Input
                type="number" min={0}
                value={form.manualNetOverride ?? ''}
                placeholder={t('Take-home amount per month', 'סכום נטו לחודש', lang)}
                onChange={(e) => set('manualNetOverride', e.target.value ? +e.target.value : undefined)}
              />
            </FieldRow>
          )}

          {/* ── 4. Net Preview ────────────────────────────────────────── */}
          {form.amount > 0 && (
            <NetPreview breakdown={breakdown} currency={currency} locale={locale} lang={lang} />
          )}

          {/* ── Employer summary (collapsed, informational) ───────────── */}
          {form.isGross && !form.useManualNet && form.useContributions && form.amount > 0 && (
            <div className="rounded-lg border border-dashed p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {t('Employer Cost (on top of your gross)', 'עלות מעסיק (מעל הברוטו)', lang)}
              </p>
              <ContribRow label={t('Pension', 'פנסיה', lang)} value={fmt(breakdown.pensionEmployer)} />
              <ContribRow label={t('Education Fund', 'קרן השתלמות', lang)} value={fmt(breakdown.educationFundEmployer)} />
              <ContribRow label={t('Severance', 'פיצויים', lang)} value={fmt(breakdown.severanceEmployer)} />
              <div className="border-t mt-1 pt-1 flex justify-between text-xs font-semibold">
                <span>{t('Total employer cost', 'עלות כוללת למעסיק', lang)}</span>
                <span>{fmt(form.amount + breakdown.totalEmployerContrib)}</span>
              </div>
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────── */}
          <Button className="w-full" disabled={!canSubmit} onClick={handleSave}>
            {t('Save Source', 'שמור מקור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── TaxBreakdownExpander ──────────────────────────────────────────────────────

function TaxBreakdownExpander({
  source, currency, locale, lang,
}: {
  source: IncomeSource; currency: string; locale: string; lang: 'en' | 'he'
}) {
  const [open, setOpen] = useState(false)
  const bd = useMemo(() => estimateTax(source), [source])
  const fmt = (v: number) => formatCurrency(v, currency as any, locale as any)

  if (!source.isGross && !source.useManualNet) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {t('Tax breakdown', 'פירוט ניכויים', lang)}
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-muted/40 border p-3 space-y-1 text-xs">
          <div className="flex justify-between font-medium">
            <span>{t('Gross', 'ברוטו', lang)}</span>
            <span>{fmt(bd.grossMonthly)}</span>
          </div>
          {bd.incomeTax > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('Income Tax', 'מס הכנסה', lang)}</span>
              <span>−{fmt(bd.incomeTax)}</span>
            </div>
          )}
          {bd.bituachLeumi > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('Bituach Leumi', 'ביטוח לאומי', lang)}</span>
              <span>−{fmt(bd.bituachLeumi)}</span>
            </div>
          )}
          {bd.healthTax > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('Health Tax', 'מס בריאות', lang)}</span>
              <span>−{fmt(bd.healthTax)}</span>
            </div>
          )}
          {bd.pensionEmployee > 0 && (
            <div className="flex justify-between text-warning-foreground">
              <span>{t('Pension (employee)', 'פנסיה (עובד)', lang)}</span>
              <span>−{fmt(bd.pensionEmployee)}</span>
            </div>
          )}
          {bd.educationFundEmployee > 0 && (
            <div className="flex justify-between text-warning-foreground">
              <span>{t('Edu. Fund (employee)', 'קרן השתלמות (עובד)', lang)}</span>
              <span>−{fmt(bd.educationFundEmployee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold border-t pt-1 mt-1">
            <span>
              {t('Net', 'נטו', lang)}
              {bd.effectiveRate > 0 && (
                <span className="font-normal text-muted-foreground ms-1">
                  ({bd.effectiveRate.toFixed(1)}% {t('effective', 'אפקטיבי', lang)})
                </span>
              )}
            </span>
            <span className="text-primary">{fmt(bd.netMonthly)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SourceCard ────────────────────────────────────────────────────────────────

function SourceCard({
  source, member, onDelete, lang, currency, locale, onSave,
}: {
  source: IncomeSource
  member: HouseholdMember
  onDelete: () => void
  lang: 'en' | 'he'
  currency: string
  locale: string
  onSave: (memberId: string, src: IncomeSource) => void
}) {
  const bd = useMemo(() => estimateTax(source), [source])
  const fmt = (v: number) => formatCurrency(v, currency as any, locale as any)
  const typeLabel = SOURCE_TYPES.find((s) => s.value === (source.type ?? 'salary'))

  return (
    <div className="rounded-lg border p-3 space-y-2.5 bg-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{source.name}</p>
          {/* Badges */}
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-xs py-0">
              {lang === 'he' ? typeLabel?.he : typeLabel?.en}
            </Badge>
            {source.isGross && !source.useManualNet && (
              <Badge variant="secondary" className="text-xs py-0 flex items-center gap-0.5">
                {t('Gross', 'ברוטו', lang)}
                <ArrowRight className="h-2.5 w-2.5" />
                {t('Net', 'נטו', lang)}
              </Badge>
            )}
            {source.useManualNet && (
              <Badge variant="warning" className="text-xs py-0 flex items-center gap-0.5">
                <BadgeCheck className="h-2.5 w-2.5" />
                {t('Manual', 'ידני', lang)}
              </Badge>
            )}
            {source.useContributions && (
              <Badge variant="secondary" className="text-xs py-0">
                {t('Contributions', 'הפרשות', lang)}
              </Badge>
            )}
            {source.payslipMode === 'advanced' && (
              <Badge variant="secondary" className="text-xs py-0">
                {t('Detailed payslip', 'תלוש מפורט', lang)}
              </Badge>
            )}
          </div>
        </div>

        {/* Amount display */}
        <div className="text-end shrink-0">
          {source.isGross && !source.useManualNet && bd.grossMonthly !== bd.netMonthly && (
            <p className="text-xs text-muted-foreground line-through">{fmt(bd.grossMonthly)}</p>
          )}
          <p className="font-semibold text-primary tabular-nums">{fmt(bd.netMonthly)}</p>
          <p className="text-xs text-muted-foreground">{t('/mo net', '/חודש נטו', lang)}</p>
        </div>
      </div>

      {/* Tax breakdown expander */}
      <TaxBreakdownExpander source={source} currency={currency} locale={locale} lang={lang} />

      {/* Actions */}
      <div className="flex justify-end gap-1 pt-1 border-t">
        <SourceDialog
          memberId={member.id}
          existing={source}
          onSave={onSave}
          lang={lang}
          currency={currency}
          locale={locale}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] text-destructive"
              title={t('Delete income source', 'מחק מקור הכנסה', lang)}
              aria-label={t('Delete income source', 'מחק מקור הכנסה', lang)}
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
                onClick={onDelete}
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

// ── AddIncomeDialog ───────────────────────────────────────────────────────────

function AddIncomeDialog({
  lang,
  currency,
  locale,
  members,
  onSaveBudget,
}: {
  lang: 'en' | 'he'
  currency: string
  locale: string
  members: HouseholdMember[]
  onSaveBudget: (memberId: string, src: IncomeSource) => void
}) {
  const { addIncomeToMonth } = useFinance()
  const [open, setOpen] = useState(false)

  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [mode, setMode]               = useState<'budget' | 'past'>('budget')
  const [pastMonth, setPastMonth]     = useState(prevMonth)
  const [pastYear, setPastYear]       = useState(prevYear)
  const [pastMemberName, setPastMemberName] = useState('')
  const [pastAmount, setPastAmount]   = useState(0)
  const [pastNote, setPastNote]       = useState('')

  // Budget mode fields
  const [budgetMemberId, setBudgetMemberId]     = useState('')
  const [budgetSourceName, setBudgetSourceName] = useState('')
  const [budgetAmount, setBudgetAmount]         = useState(0)

  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handlePastYearChange = (y: number) => {
    setPastYear(y)
    const cur = new Date()
    const curY = cur.getFullYear()
    const curM = cur.getMonth() + 1
    if (y === curY && pastMonth >= curM) {
      setPastMonth(curM > 1 ? curM - 1 : 12)
    }
  }

  const handleOpen = (o: boolean) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    if (o) {
      setMode('budget')
      setSavedLabel(null)
      setPastMemberName('')
      setPastAmount(0)
      setPastNote('')
      setBudgetMemberId(members[0]?.id ?? '')
      setBudgetSourceName('')
      setBudgetAmount(0)
      const n = new Date()
      if (n.getMonth() === 0) {
        setPastMonth(12); setPastYear(n.getFullYear() - 1)
      } else {
        setPastMonth(n.getMonth()); setPastYear(n.getFullYear())
      }
    }
    setOpen(o)
  }

  const canSavePast   = pastMemberName.trim().length > 0 && pastAmount > 0
  const canSaveBudget = budgetMemberId.length > 0 && budgetSourceName.trim().length > 0 && budgetAmount > 0

  const handleSave = () => {
    if (mode === 'past') {
      if (!canSavePast) return
      addIncomeToMonth(pastYear, pastMonth, {
        memberName: pastMemberName.trim(),
        amount: pastAmount,
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
        amount: budgetAmount,
        useManualNet: true,
        manualNetOverride: budgetAmount,
      }
      onSaveBudget(budgetMemberId, src)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 me-1" />
          {t('Add Income Entry', 'הוסף רשומת הכנסה', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add Income Entry', 'הוסף רשומת הכנסה', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">

          {/* When? toggle */}
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

            {/* Month + Year pickers — past mode only */}
            {mode === 'past' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="income-past-month">{t('Month', 'חודש', lang)}</Label>
                  <Select value={pastMonth.toString()} onValueChange={(v) => setPastMonth(+v)}>
                    <SelectTrigger id="income-past-month" aria-label={t('Month', 'חודש', lang)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.filter((m) => {
                        const curM = now.getMonth() + 1
                        const curY = now.getFullYear()
                        if (pastYear === curY) return m.value < curM
                        if (pastYear > curY)   return false
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
                  <Label htmlFor="income-past-year">{t('Year', 'שנה', lang)}</Label>
                  <Select value={pastYear.toString()} onValueChange={(v) => handlePastYearChange(+v)}>
                    <SelectTrigger id="income-past-year" aria-label={t('Year', 'שנה', lang)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 3 }, (_, i) => now.getFullYear() - i).map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* ── Budget mode fields ── */}
          {mode === 'budget' && (
            <>
              {members.length > 0 && (
                <div>
                  <Label htmlFor="income-budget-member">{t('Member', 'חבר', lang)}</Label>
                  <Select value={budgetMemberId} onValueChange={setBudgetMemberId}>
                    <SelectTrigger id="income-budget-member">
                      <SelectValue placeholder={t('Select member', 'בחר חבר', lang)} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="income-budget-name">{t('Source Name', 'שם המקור', lang)}</Label>
                <Input
                  id="income-budget-name"
                  value={budgetSourceName}
                  onChange={(e) => setBudgetSourceName(e.target.value)}
                  placeholder={t('e.g. Main Salary', 'למשל: משכורת ראשית', lang)}
                />
              </div>
              <div>
                <Label htmlFor="income-budget-amount">{t('Monthly Net Amount', 'סכום נטו חודשי', lang)}</Label>
                <Input
                  id="income-budget-amount"
                  type="number"
                  min={0}
                  value={budgetAmount || ''}
                  onChange={(e) => setBudgetAmount(+e.target.value)}
                  placeholder="0"
                />
              </div>
            </>
          )}

          {/* ── Past mode fields ── */}
          {mode === 'past' && (
            <>
              <datalist id="income-dialog-members-list">
                {members.map((m) => <option key={m.id} value={m.name} />)}
              </datalist>
              <div>
                <Label htmlFor="income-past-member">{t('Member Name', 'שם החבר', lang)}</Label>
                <Input
                  id="income-past-member"
                  list="income-dialog-members-list"
                  value={pastMemberName}
                  onChange={(e) => setPastMemberName(e.target.value)}
                  placeholder={t('e.g. Alex', 'למשל: אלכס', lang)}
                />
              </div>
              <div>
                <Label htmlFor="income-past-amount">{t('Net Amount', 'סכום נטו', lang)}</Label>
                <Input
                  id="income-past-amount"
                  type="number"
                  min={0}
                  value={pastAmount || ''}
                  onChange={(e) => setPastAmount(+e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="income-past-note">{t('Note (optional)', 'הערה (אופציונלי)', lang)}</Label>
                <Input
                  id="income-past-note"
                  value={pastNote}
                  onChange={(e) => setPastNote(e.target.value)}
                  placeholder={t('e.g. Bonus payment', 'למשל: בונוס', lang)}
                />
              </div>
            </>
          )}

          <Button
            className="w-full"
            disabled={mode === 'past' ? !canSavePast : !canSaveBudget}
            onClick={handleSave}
          >
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

// ── Income Tab ────────────────────────────────────────────────────────────────

export function Income() {
  const { data, addMember, updateMember, deleteMember } = useFinance()
  const lang = data.language
  const [addMemberName, setAddMemberName] = useState('')
  const [memberOpen, setMemberOpen] = useState(false)

  const handleSaveSource = (memberId: string, src: IncomeSource) => {
    const member = data.members.find((m) => m.id === memberId)!
    const sources = member.sources.some((s) => s.id === src.id)
      ? member.sources.map((s) => (s.id === src.id ? src : s))
      : [...member.sources, src]
    updateMember({ ...member, sources })
  }

  const handleDeleteSource = (member: HouseholdMember, srcId: string) =>
    updateMember({ ...member, sources: member.sources.filter((s) => s.id !== srcId) })

  const totalIncome = useMemo(
    () => data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0),
    [data.members]
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {t('Total net monthly:', 'סה"כ נטו חודשי:', lang)}{' '}
          <span className="font-semibold text-primary">
            {formatCurrency(totalIncome, data.currency, data.locale)}
          </span>
        </p>

        <div className="flex items-center gap-2">
          <AddIncomeDialog
            lang={lang}
            currency={data.currency}
            locale={data.locale}
            members={data.members}
            onSaveBudget={handleSaveSource}
          />

          <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 me-1" />
                {t('Add Member', 'הוסף חבר', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('Add Household Member', 'הוסף חבר משק בית', lang)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-member-name" className="text-sm text-muted-foreground">
                    {t('Name', 'שם', lang)}
                  </Label>
                  <Input
                    id="add-member-name"
                    value={addMemberName}
                    onChange={(e) => setAddMemberName(e.target.value)}
                    placeholder={t('e.g. Alex', 'למשל: אלכס', lang)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && addMemberName.trim()) {
                        addMember(addMemberName.trim()); setAddMemberName(''); setMemberOpen(false)
                      }
                    }}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!addMemberName.trim()}
                  onClick={() => { addMember(addMemberName.trim()); setAddMemberName(''); setMemberOpen(false) }}
                >
                  {t('Add', 'הוסף', lang)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {data.members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm">{t('Add a household member to get started', 'הוסף חבר משק בית כדי להתחיל', lang)}</p>
        </div>
      ) : (
        data.members.map((member) => {
          const memberNet = member.sources.reduce((s, src) => s + getNetMonthly(src), 0)
          return (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{member.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {formatCurrency(memberNet, data.currency, data.locale)}{t('/mo', '/חודש', lang)}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] text-destructive"
                          title={t('Remove member', 'הסר חבר', lang)}
                          aria-label={t('Remove member', 'הסר חבר', lang)}
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
                            onClick={() => deleteMember(member.id)}
                          >
                            {t('Delete', 'מחק', lang)}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.sources.map((src) => (
                  <SourceCard
                    key={src.id}
                    source={src}
                    member={member}
                    onDelete={() => handleDeleteSource(member, src.id)}
                    lang={lang}
                    currency={data.currency}
                    locale={data.locale}
                    onSave={handleSaveSource}
                  />
                ))}
                <SourceDialog
                  memberId={member.id}
                  onSave={handleSaveSource}
                  lang={lang}
                  currency={data.currency}
                  locale={data.locale}
                />
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
