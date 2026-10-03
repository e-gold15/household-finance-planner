import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { clampPastMonth, monthName, pastMonthOptions, pastYearOptions } from '@/lib/quickAdd'
import { t } from '@/lib/utils'

/**
 * Month + year selects for adding to a past month: completed months only,
 * current year and the 2 before. Changing the year clamps an invalid month
 * (same behaviour as the v2.4 picker).
 */
export function PastMonthPicker({
  year,
  month,
  onChange,
  lang,
  idPrefix,
}: {
  year: number
  month: number
  onChange: (next: { year: number; month: number }) => void
  lang: 'en' | 'he'
  idPrefix: string
}) {
  const monthId = `${idPrefix}-past-month`
  const yearId = `${idPrefix}-past-year`
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={monthId}>{t('Month', 'חודש', lang)}</Label>
        <Select value={month.toString()} onValueChange={(v) => onChange({ year, month: +v })}>
          <SelectTrigger id={monthId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pastMonthOptions(year).map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {monthName(m, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={yearId}>{t('Year', 'שנה', lang)}</Label>
        <Select
          value={year.toString()}
          onValueChange={(v) => onChange({ year: +v, month: clampPastMonth(+v, month) })}
        >
          <SelectTrigger id={yearId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pastYearOptions()
              // In January the current year has no completed month yet.
              .filter((y) => pastMonthOptions(y).length > 0)
              .map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
