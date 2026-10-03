import { useId, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Money } from '@/components/ui/money'
import { DirIcon } from '@/components/ui/dir-icon'
import { estimateTax, type TaxBreakdown } from '@/lib/taxEstimation'
import { cn, t } from '@/lib/utils'
import type { Currency, IncomeSource, Locale } from '@/types'

/** Gross ⟶ Net summary used in the source sheet. */
export function NetPreview({
  breakdown, currency, locale, lang,
}: {
  breakdown: TaxBreakdown; currency: Currency; locale: Locale; lang: 'en' | 'he'
}) {
  const showGross =
    breakdown.grossMonthly > 0 && !breakdown.isManual && breakdown.grossMonthly !== breakdown.netMonthly

  return (
    <div className="space-y-2 rounded-lg border bg-primary-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('Monthly Net', 'נטו חודשי', lang)}
        </span>
        <div className="flex items-center gap-2">
          {showGross && (
            <>
              <Money
                value={breakdown.grossMonthly}
                currency={currency}
                locale={locale}
                className="text-xs text-muted-foreground line-through"
                aria-label={t('Gross', 'ברוטו', lang)}
              />
              <DirIcon icon={ArrowRight} className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
          <Money value={breakdown.netMonthly} currency={currency} locale={locale} size="lg" className="text-primary-strong" />
        </div>
      </div>
      {breakdown.effectiveRate > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('Effective deduction rate', 'שיעור ניכוי אפקטיבי', lang)}:{' '}
          <bdi className="tabular-nums">{breakdown.effectiveRate.toFixed(1)}%</bdi>
        </p>
      )}
    </div>
  )
}

function DeductionRow({
  label, value, tone, currency, locale,
}: {
  label: string; value: number; tone: 'danger' | 'warning'; currency: Currency; locale: Locale
}) {
  return (
    <div className={cn('flex justify-between gap-3', tone === 'danger' ? 'text-danger-strong' : 'text-warning-strong')}>
      <span className="min-w-0">{label}</span>
      <Money value={-value} currency={currency} locale={locale} />
    </div>
  )
}

/** Collapsible per-source tax breakdown (gross, deductions, net). */
export function TaxBreakdownExpander({
  source, currency, locale, lang,
}: {
  source: IncomeSource; currency: Currency; locale: Locale; lang: 'en' | 'he'
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const bd = useMemo(() => estimateTax(source), [source])

  if (!source.isGross && !source.useManualNet) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-fast', open && 'rotate-180')} aria-hidden="true" />
        {t('Tax breakdown', 'פירוט ניכויים', lang)}
      </button>

      {open && (
        <div id={panelId} className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex justify-between gap-3 font-medium">
            <span>{t('Gross', 'ברוטו', lang)}</span>
            <Money value={bd.grossMonthly} currency={currency} locale={locale} />
          </div>
          {bd.incomeTax > 0 && (
            <DeductionRow label={t('Income Tax', 'מס הכנסה', lang)} value={bd.incomeTax} tone="danger" currency={currency} locale={locale} />
          )}
          {bd.bituachLeumi > 0 && (
            <DeductionRow label={t('Bituach Leumi', 'ביטוח לאומי', lang)} value={bd.bituachLeumi} tone="danger" currency={currency} locale={locale} />
          )}
          {bd.healthTax > 0 && (
            <DeductionRow label={t('Health Tax', 'מס בריאות', lang)} value={bd.healthTax} tone="danger" currency={currency} locale={locale} />
          )}
          {bd.pensionEmployee > 0 && (
            <DeductionRow label={t('Pension (employee)', 'פנסיה (עובד)', lang)} value={bd.pensionEmployee} tone="warning" currency={currency} locale={locale} />
          )}
          {bd.educationFundEmployee > 0 && (
            <DeductionRow label={t('Edu. Fund (employee)', 'קרן השתלמות (עובד)', lang)} value={bd.educationFundEmployee} tone="warning" currency={currency} locale={locale} />
          )}
          <div className="mt-1 flex justify-between gap-3 border-t pt-1 font-semibold">
            <span className="min-w-0">
              {t('Net', 'נטו', lang)}
              {bd.effectiveRate > 0 && (
                <span className="ms-1 font-normal text-muted-foreground">
                  (<bdi className="tabular-nums">{bd.effectiveRate.toFixed(1)}%</bdi> {t('effective', 'אפקטיבי', lang)})
                </span>
              )}
            </span>
            <Money value={bd.netMonthly} currency={currency} locale={locale} className="text-primary-strong" />
          </div>
        </div>
      )}
    </div>
  )
}
