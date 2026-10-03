import { Plus, Trash2 } from 'lucide-react'
import { ActionMenu } from '@/components/ui/action-menu'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { getNetMonthly } from '@/lib/taxEstimation'
import type { FxRateCache } from '@/lib/fxRates'
import { t } from '@/lib/utils'
import type { Currency, HouseholdMember, IncomeSource, Locale } from '@/types'
import { SourceRow } from './SourceRow'

/**
 * One household member: a section header (avatar initial · name · member net
 * total · ⋯) followed by flat source rows — no card-in-card (P1-17).
 */
export function MemberSection({
  member, lang, currency, locale, fxRates, onAddSource, onEditSource, onDeleteSource, onDeleteMember,
}: {
  member: HouseholdMember
  lang: 'en' | 'he'
  currency: Currency
  locale: Locale
  fxRates: FxRateCache | null
  onAddSource: () => void
  onEditSource: (src: IncomeSource) => void
  onDeleteSource: (src: IncomeSource) => void
  onDeleteMember: () => void
}) {
  const memberNet = member.sources.reduce((s, src) => s + getNetMonthly(src), 0)
  const headingId = `member-${member.id}-heading`
  const initial = member.name.trim().charAt(0).toUpperCase() || '?'
  const count = member.sources.length

  return (
    <Card className="overflow-hidden">
      <section aria-labelledby={headingId}>
        {/* Section header */}
        <div className="flex items-center gap-2 border-b py-2 pe-1 ps-3 sm:gap-3 sm:ps-4">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-base font-semibold text-primary-strong"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="truncate text-base font-semibold">
              <bdi>{member.name}</bdi>
            </h2>
            <p className="text-xs text-muted-foreground">
              {count === 1
                ? t('1 income source', 'מקור הכנסה אחד', lang)
                : t(`${count} income sources`, `${count} מקורות הכנסה`, lang)}
            </p>
          </div>
          <div className="shrink-0 text-end">
            <Money value={memberNet} currency={currency} locale={locale} size="md" className="font-semibold" />
            <p className="text-xs text-muted-foreground">{t('net per month', 'נטו לחודש', lang)}</p>
          </div>
          <ActionMenu
            label={t(`Actions for ${member.name}`, `פעולות עבור ${member.name}`, lang)}
            items={[
              { key: 'add', label: t('Add Source', 'הוסף מקור', lang), icon: Plus, onSelect: onAddSource },
              'separator',
              { key: 'remove', label: t('Remove member', 'הסר חבר', lang), icon: Trash2, destructive: true, onSelect: onDeleteMember },
            ]}
          />
        </div>

        {/* Source rows */}
        {count > 0 ? (
          <ul className="divide-y px-2">
            {member.sources.map((src) => (
              <SourceRow
                key={src.id}
                source={src}
                onEdit={() => onEditSource(src)}
                onDelete={() => onDeleteSource(src)}
                lang={lang}
                currency={currency}
                locale={locale}
                fxRates={fxRates}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            {t('No income sources yet.', 'אין עדיין מקורות הכנסה.', lang)}
          </p>
        )}

        <div className="px-2 pb-2 pt-1">
          <Button variant="ghost" size="sm" className="text-primary-strong" onClick={onAddSource}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('Add Source', 'הוסף מקור', lang)}
          </Button>
        </div>
      </section>
    </Card>
  )
}
