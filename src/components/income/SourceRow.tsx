import { useMemo } from 'react'
import { ArrowRight, BadgeCheck, Lock, Pencil, Trash2, Waves } from 'lucide-react'
import { ActionMenu } from '@/components/ui/action-menu'
import { Badge } from '@/components/ui/badge'
import { DirIcon } from '@/components/ui/dir-icon'
import { ListRow } from '@/components/ui/list-row'
import { Money } from '@/components/ui/money'
import { StatusChip } from '@/components/ui/status-chip'
import { estimateTax, getNetMonthly } from '@/lib/taxEstimation'
import { convertAmount, formatRateNote, type FxRateCache } from '@/lib/fxRates'
import { t } from '@/lib/utils'
import type { Currency, IncomeSource, Locale } from '@/types'
import { TaxBreakdownExpander } from './TaxBreakdown'
import { sourceTypeLabel } from './incomeUtils'

/** FX conversion note for a source held in a foreign currency. */
function FxNote({
  source, currency, locale, lang, fxRates,
}: {
  source: IncomeSource; currency: Currency; locale: Locale; lang: 'en' | 'he'; fxRates: FxRateCache | null
}) {
  const src = source.sourceCurrency
  if (!src || src === currency) return null
  const converted = convertAmount(getNetMonthly(source), src, currency, fxRates)
  const rateNote = formatRateNote(src, currency, fxRates, lang)
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1">
        <Money value={source.amount} currency={src} locale={locale} />
        <DirIcon icon={ArrowRight} className="h-3 w-3" />
        {converted === null ? (
          <StatusChip tone="danger" label={t('Rate unavailable', 'שער לא זמין', lang)} />
        ) : (
          <>
            <Money value={converted} currency={currency} locale={locale} />
            <span>{t('per month', 'לחודש', lang)}</span>
          </>
        )}
      </div>
      {rateNote && <div className={fxRates?.isEstimated ? 'text-warning-strong' : ''}>{rateNote}</div>}
    </div>
  )
}

/**
 * One income source as a flat list row (P1-17): name · type meta · net amount ·
 * ⋯ (Edit / Delete). Tapping the row opens the edit sheet. Secondary badges
 * (contributions, detailed payslip) and the tax breakdown sit underneath.
 */
export function SourceRow({
  source, onEdit, onDelete, lang, currency, locale, fxRates,
}: {
  source: IncomeSource
  onEdit: () => void
  onDelete: () => void
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
  fxRates: FxRateCache | null
}) {
  const bd = useMemo(() => estimateTax(source), [source])
  const isFixed = (source.incomeType ?? 'fixed') === 'fixed'
  const showGross = source.isGross && !source.useManualNet && bd.grossMonthly !== bd.netMonthly
  // Amounts are stored in the source currency (converted for household totals).
  const ownCurrency: Currency = source.sourceCurrency ?? currency

  const extras: React.ReactNode[] = []
  if (source.useContributions) {
    extras.push(
      <Badge key="contrib" variant="secondary" className="py-0 text-xs">{t('Contributions', 'הפרשות', lang)}</Badge>,
    )
  }
  if (source.payslipMode === 'advanced') {
    extras.push(
      <Badge key="adv" variant="secondary" className="py-0 text-xs">{t('Detailed payslip', 'תלוש מפורט', lang)}</Badge>,
    )
  }

  const hasDetails = source.isGross || source.useManualNet
  const fx = <FxNote source={source} currency={currency} locale={locale} lang={lang} fxRates={fxRates} />

  return (
    <li className="py-1">
      <ListRow
        accentColor={isFixed ? 'hsl(var(--border))' : 'hsl(var(--warning))'}
        onClick={onEdit}
        clickLabel={t(`Edit ${source.name}`, `ערוך את ${source.name}`, lang)}
        title={<bdi>{source.name}</bdi>}
        meta={
          <>
            <StatusChip
              tone={isFixed ? 'neutral' : 'warning'}
              icon={isFixed ? Lock : Waves}
              label={isFixed ? t('Fixed', 'קבוע', lang) : t('Variable', 'משתנה', lang)}
            />
            <span>{sourceTypeLabel(source.type, lang)}</span>
            {source.isGross && !source.useManualNet && (
              <span className="inline-flex items-center gap-0.5">
                {t('Gross', 'ברוטו', lang)}
                <DirIcon icon={ArrowRight} className="h-3 w-3" />
                {t('Net', 'נטו', lang)}
              </span>
            )}
            {source.useManualNet && (
              <span className="inline-flex items-center gap-0.5">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {t('Manual', 'ידני', lang)}
              </span>
            )}
          </>
        }
        trailing={
          <div className="flex flex-col items-end">
            {showGross && (
              <Money
                value={bd.grossMonthly}
                currency={ownCurrency}
                locale={locale}
                className="text-xs text-muted-foreground line-through"
                aria-label={t('Gross', 'ברוטו', lang)}
              />
            )}
            <Money value={bd.netMonthly} currency={ownCurrency} locale={locale} size="md" className="font-semibold" />
            <span className="text-xs text-muted-foreground">{t('net per month', 'נטו לחודש', lang)}</span>
          </div>
        }
        actions={
          <ActionMenu
            label={t(`Actions for ${source.name}`, `פעולות עבור ${source.name}`, lang)}
            items={[
              { key: 'edit', label: t('Edit', 'עריכה', lang), icon: Pencil, onSelect: onEdit },
              'separator',
              { key: 'delete', label: t('Delete', 'מחיקה', lang), icon: Trash2, destructive: true, onSelect: onDelete },
            ]}
          />
        }
      />
      {(hasDetails || extras.length > 0 || (source.sourceCurrency && source.sourceCurrency !== currency)) && (
        <div className="space-y-1 pe-2 ps-4">
          {fx}
          {extras.length > 0 && <div className="flex flex-wrap gap-1">{extras}</div>}
          <TaxBreakdownExpander source={source} currency={ownCurrency} locale={locale} lang={lang} />
        </div>
      )}
    </li>
  )
}
