import { useId, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/ui/money'
import { cn, t } from '@/lib/utils'
import type { Currency, IncomeSource, Locale, PayslipComponents } from '@/types'
import { FieldRow, MoneyField, SectionLabel } from './fields'
import { DEFAULT_PAYSLIP_COMPONENTS, computeTaxableGross, computeTotalGross } from './incomeUtils'

const PAYSLIP_FIELDS: Array<{ key: keyof PayslipComponents; en: string; he: string }> = [
  { key: 'base',                     en: 'Base salary',                  he: 'שכר יסוד' },
  { key: 'overtime125',              en: 'Global overtime 125%',         he: 'גלובאלי 125%' },
  { key: 'overtime150',              en: 'Global overtime 150%',         he: 'גלובאלי 150%' },
  { key: 'otherTaxable',             en: 'Other taxable additions',      he: 'תוספות חייבות' },
  { key: 'imputedIncome',            en: 'Imputed income (שווי מס)',     he: 'שווי מס' },
  { key: 'nonTaxableReimbursements', en: 'Reimbursements (non-taxable)', he: 'החזרים (לא חייבים)' },
]

function CostRow({
  label, value, currency, locale, strong = false,
}: {
  label: React.ReactNode; value: number; currency: Currency; locale: Locale; strong?: boolean
}) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'mt-1 border-t pt-2')}>
      <span className={cn('min-w-0 text-muted-foreground', strong && 'font-medium')}>{label}</span>
      <Money
        value={value}
        currency={currency}
        locale={locale}
        className={strong ? 'font-bold text-primary-strong' : 'font-semibold'}
      />
    </div>
  )
}

/** Israeli payslip breakdown (advanced mode). Behaviour identical to v3.2. */
export function PayslipAdvanced({
  form, setForm, lang, currency, locale,
}: {
  form: IncomeSource
  setForm: React.Dispatch<React.SetStateAction<IncomeSource>>
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
}) {
  const [showBases, setShowBases] = useState(false)
  const idBase = useId()
  const basesPanelId = `${idBase}-bases`

  const comp = form.payslipComponents ?? DEFAULT_PAYSLIP_COMPONENTS

  const setComp = (key: keyof PayslipComponents, value: number) => {
    setForm((f) => {
      const current = f.payslipComponents ?? DEFAULT_PAYSLIP_COMPONENTS
      const next = { ...current, [key]: value }
      return { ...f, payslipComponents: next, amount: computeTaxableGross(next) }
    })
  }

  const taxableGross  = computeTaxableGross(comp)
  const totalGross    = computeTotalGross(comp)
  const nonTaxable    = comp.nonTaxableReimbursements
  const guaranteedPct = taxableGross > 0 ? Math.round((comp.base / taxableGross) * 100) : 0

  // Employer cost card values (read-only)
  const pensionBase  = form.pensionBase ?? taxableGross
  const studyBase    = form.studyFundBase ?? taxableGross
  const empPension   = ((form.pensionEmployer ?? 6.5) / 100) * pensionBase
  const empStudy     = ((form.educationFundEmployer ?? 7.5) / 100) * studyBase
  const empSeverance = ((form.severanceEmployer ?? 8.33) / 100) * pensionBase
  // Employer cost gross = pensionBase (the insured salary, per spec).
  const totalEmpCost = pensionBase + empPension + empStudy + empSeverance

  const defaultsHint = t('Defaults to taxable gross if left blank', 'ברירת מחדל: שכר ברוטו החייב', lang)
  const defaultsPlaceholder = t('Defaults to taxable gross', 'ברירת מחדל: ברוטו חייב', lang)

  return (
    <div className="space-y-4">
      {/* Helper info note */}
      <div className="flex gap-2 rounded-lg border bg-muted/40 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            'In many Israeli payslips, the pension/study fund bases differ from total gross. Copy the contribution bases from your payslip for accurate results.',
            'בתלושי שכר רבים, שכר הבסיס לפנסיה/קרן השתלמות שונה מהברוטו הכולל. העתק את הבסיסים מהתלוש לחישוב מדויק.',
            lang,
          )}
        </p>
      </div>

      {/* Component fields */}
      <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
        <SectionLabel>{t('Payslip components', 'רכיבי תלוש', lang)}</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAYSLIP_FIELDS.map(({ key, en, he }) => {
            const id = `${idBase}-${key}`
            return (
              <FieldRow key={key} label={t(en, he, lang)} htmlFor={id}>
                <MoneyField
                  id={id}
                  value={comp[key]}
                  emptyValue={0}
                  zeroAsEmpty
                  currency={currency}
                  locale={locale}
                  onValue={(v) => setComp(key, Math.max(0, v))}
                />
              </FieldRow>
            )
          })}
        </div>

        {/* Live summary */}
        <div className="space-y-1 rounded-md border bg-muted/60 px-3 py-2 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <span className="text-muted-foreground">{t('Total gross', 'ברוטו כולל', lang)}: </span>
              <Money value={totalGross} currency={currency} locale={locale} className="font-semibold" />
            </span>
            <span>
              <span className="text-muted-foreground">{t('Taxable', 'חייב', lang)}: </span>
              <Money value={taxableGross} currency={currency} locale={locale} className="font-semibold text-primary-strong" />
            </span>
            <span>
              <span className="text-muted-foreground">{t('Non-taxable', 'לא חייב', lang)}: </span>
              <Money value={nonTaxable} currency={currency} locale={locale} className="font-semibold" />
            </span>
          </div>
          {taxableGross > 0 && (
            <div className="pt-1">
              <Badge variant="secondary" className="text-xs">
                {t('Guaranteed', 'מובטח', lang)} <bdi className="ms-1 tabular-nums">{guaranteedPct}%</bdi>
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Contribution bases — collapsible */}
      <div className="overflow-hidden rounded-lg border">
        <button
          type="button"
          onClick={() => setShowBases((v) => !v)}
          aria-expanded={showBases}
          aria-controls={basesPanelId}
          className="flex min-h-11 w-full items-center justify-between bg-secondary/30 px-4 py-3 text-sm font-medium transition-colors duration-fast hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span>{t('Contribution bases', 'בסיסי חישוב', lang)}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-fast', showBases && 'rotate-180')} aria-hidden="true" />
        </button>

        {showBases && (
          <div id={basesPanelId} className="space-y-4 bg-card p-4">
            <FieldRow label={t('Pension insured salary', 'שכר מבוטח לפנסיה', lang)} htmlFor={`${idBase}-pb`} hint={defaultsHint}>
              <MoneyField
                id={`${idBase}-pb`}
                value={form.pensionBase}
                emptyValue={undefined}
                currency={currency}
                locale={locale}
                placeholder={defaultsPlaceholder}
                onValue={(v) => setForm((f) => ({ ...f, pensionBase: v === undefined ? undefined : Math.max(0, v) }))}
              />
            </FieldRow>

            <FieldRow label={t('Study fund base', 'בסיס קרן השתלמות', lang)} htmlFor={`${idBase}-sb`} hint={defaultsHint}>
              <MoneyField
                id={`${idBase}-sb`}
                value={form.studyFundBase}
                emptyValue={undefined}
                currency={currency}
                locale={locale}
                placeholder={defaultsPlaceholder}
                onValue={(v) => setForm((f) => ({ ...f, studyFundBase: v === undefined ? undefined : Math.max(0, v) }))}
              />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Employer cost card — read-only */}
      {taxableGross > 0 && (
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <SectionLabel>{t('Employer total cost', 'עלות מעסיק', lang)}</SectionLabel>
          <div className="space-y-1 text-sm">
            <CostRow label={t('Gross salary (pension base)', 'שכר ברוטו (בסיס פנסיה)', lang)} value={pensionBase} currency={currency} locale={locale} />
            <CostRow
              label={<>{t('Employer pension', 'פנסיה מעסיק', lang)} (<bdi>{form.pensionEmployer ?? 6.5}%</bdi>)</>}
              value={empPension} currency={currency} locale={locale}
            />
            <CostRow
              label={<>{t('Employer study fund', 'קרן השתלמות מעסיק', lang)} (<bdi>{form.educationFundEmployer ?? 7.5}%</bdi>)</>}
              value={empStudy} currency={currency} locale={locale}
            />
            <CostRow
              label={<>{t('Severance', 'פיצויים', lang)} (<bdi>{form.severanceEmployer ?? 8.33}%</bdi>)</>}
              value={empSeverance} currency={currency} locale={locale}
            />
            <CostRow label={t('Total', 'סה"כ', lang)} value={totalEmpCost} currency={currency} locale={locale} strong />
          </div>
        </div>
      )}
    </div>
  )
}
