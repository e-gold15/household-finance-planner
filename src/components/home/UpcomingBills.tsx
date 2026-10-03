import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/ui/money'
import { StatusChip } from '@/components/ui/status-chip'
import { getCategoryMeta } from '@/lib/categories'
import { t } from '@/lib/utils'
import type { UpcomingBill } from '@/lib/insights'
import type { Currency, Locale } from '@/types'

const MONTH_SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_SHORT_HE = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳']

interface UpcomingBillsProps {
  bills: UpcomingBill[]
  currency: Currency
  locale: Locale
  lang: 'en' | 'he'
}

function countdown(daysUntil: number, lang: 'en' | 'he') {
  if (daysUntil < 30) {
    return (
      <StatusChip
        tone="warning"
        label={daysUntil === 0 ? t('Due now', 'לתשלום עכשיו', lang) : t(`In ${daysUntil} days`, `בעוד ${daysUntil} ימים`, lang)}
      />
    )
  }
  if (daysUntil < 90) {
    const w = Math.ceil(daysUntil / 7)
    return <Badge variant="outline">{t(`${w} weeks`, `${w} שבועות`, lang)}</Badge>
  }
  const m = Math.ceil(daysUntil / 30)
  return <Badge variant="secondary">{t(`${m} months`, `${m} חודשים`, lang)}</Badge>
}

/** Yearly bills due in the next 6 months (v2.9 28.2). */
export function UpcomingBills({ bills, currency, locale, lang }: UpcomingBillsProps) {
  if (bills.length === 0) return null
  const monthShort = lang === 'he' ? MONTH_SHORT_HE : MONTH_SHORT_EN
  const total = bills.reduce((s, b) => s + b.expense.amount, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary-strong" aria-hidden="true" />
          {t('Upcoming yearly bills', 'חשבונות שנתיים קרובים', lang)}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('Next 6 months', '6 החודשים הבאים', lang)}</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {bills.map((b) => {
            const meta = getCategoryMeta(b.expense.category)
            return (
              <li key={b.expense.id} className="flex min-h-14 items-center gap-3 py-2">
                <span className="w-10 shrink-0 text-center text-xs font-medium text-muted-foreground">
                  {monthShort[b.month]}
                </span>
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.expense.name}</p>
                  <div className="mt-0.5">{countdown(b.daysUntil, lang)}</div>
                </div>
                <Money value={b.expense.amount} currency={currency} locale={locale} className="shrink-0 text-sm font-semibold" />
              </li>
            )
          })}
        </ul>
        <p className="flex flex-wrap items-center justify-end gap-1 pt-2 text-xs text-muted-foreground">
          {t('Total in next 6 months:', 'סה"כ ב-6 החודשים הבאים:', lang)}
          <Money value={total} currency={currency} locale={locale} className="font-semibold text-foreground" />
        </p>
      </CardContent>
    </Card>
  )
}
