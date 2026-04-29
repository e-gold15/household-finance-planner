import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Label } from './ui/label'
import { generateCsvExports } from '@/lib/csvExport'
import { t } from '@/lib/utils'
import type { MonthSnapshot, Currency } from '@/types'

interface CsvExportButtonProps {
  history: MonthSnapshot[]
  currency: Currency
  lang: 'en' | 'he'
}

/** Converts a "YYYY-MM" period string to a display label like "Jan 2025" */
function periodLabel(period: string, lang: 'en' | 'he'): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  const locale = lang === 'he' ? 'he-IL' : 'en-US'
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
}

/** Triggers a browser file download for the given CSV string */
function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Derives a filename from the selected period range */
function buildFilename(fromPeriod: string, toPeriod: string, type: 'summary' | 'detail'): string {
  const fromYear = fromPeriod.slice(0, 4)
  const toYear = toPeriod.slice(0, 4)
  if (fromYear === toYear) {
    // Same year — use YYYY format
    return `household-finance-${fromYear}-${type}.csv`
  }
  // Multi-year — use YYYYMM-YYYYMM
  const from = fromPeriod.replace('-', '')
  const to = toPeriod.replace('-', '')
  return `household-finance-${from}-${to}-${type}.csv`
}

export function CsvExportButton({ history, currency, lang }: CsvExportButtonProps) {
  const [open, setOpen] = useState(false)

  // Derive sorted unique period strings from history
  const periods = useMemo(() => {
    return [...new Set(history.map((s) => s.date.slice(0, 7)))]
      .sort()
  }, [history])

  // Default: From = Jan of current year (or earliest), To = most recent
  const defaultFrom = useMemo(() => {
    if (periods.length === 0) return ''
    const currentYear = new Date().getFullYear().toString()
    const firstThisYear = periods.find((p) => p.startsWith(currentYear))
    return firstThisYear ?? periods[0]
  }, [periods])

  const defaultTo = useMemo(() => {
    return periods[periods.length - 1] ?? ''
  }, [periods])

  const [fromPeriod, setFromPeriod] = useState<string>('')
  const [toPeriod, setToPeriod] = useState<string>('')

  // Resolve effective from/to (using state if set, otherwise defaults)
  const effectiveFrom = fromPeriod || defaultFrom
  const effectiveTo = toPeriod || defaultTo

  // Reset state when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setFromPeriod('')
      setToPeriod('')
    }
    setOpen(o)
  }

  const handleFromChange = (value: string) => {
    setFromPeriod(value)
    // Auto-adjust To if From would exceed it
    const resolvedTo = toPeriod || defaultTo
    if (value > resolvedTo) {
      setToPeriod(value)
    }
  }

  const handleToChange = (value: string) => {
    setToPeriod(value)
    // Auto-adjust From if To would be before it
    const resolvedFrom = fromPeriod || defaultFrom
    if (value < resolvedFrom) {
      setFromPeriod(value)
    }
  }

  const filteredSnapshots = useMemo(() => {
    return history.filter((s) => {
      const p = s.date.slice(0, 7)
      return p >= effectiveFrom && p <= effectiveTo
    })
  }, [history, effectiveFrom, effectiveTo])

  const handleDownload = (type: 'summary' | 'detail') => {
    const { summary, detail } = generateCsvExports(filteredSnapshots, currency, lang)
    const content = type === 'summary' ? summary : detail
    const filename = buildFilename(effectiveFrom, effectiveTo, type)
    downloadCsv(content, filename)
  }

  // Hidden when no history
  if (history.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 min-h-[44px]">
          <Download className="h-4 w-4" />
          {t('Export CSV', 'ייצוא CSV', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('Export CSV', 'ייצוא CSV', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Date range selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="csv-from">{t('From', 'מ', lang)}</Label>
              <Select value={effectiveFrom} onValueChange={handleFromChange}>
                <SelectTrigger id="csv-from" className="min-h-[44px]" aria-label={t('From month', 'מחודש', lang)}>
                  <SelectValue placeholder={periodLabel(effectiveFrom, lang)} />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabel(p, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="csv-to">{t('To', 'עד', lang)}</Label>
              <Select value={effectiveTo} onValueChange={handleToChange}>
                <SelectTrigger id="csv-to" className="min-h-[44px]" aria-label={t('To month', 'עד חודש', lang)}>
                  <SelectValue placeholder={periodLabel(effectiveTo, lang)} />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabel(p, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredSnapshots.length}{' '}
            {t('snapshots selected', 'תמונות מצב נבחרות', lang)}
          </p>

          {/* Download buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 gap-2 min-h-[44px]"
              onClick={() => handleDownload('summary')}
              disabled={filteredSnapshots.length === 0}
              title={t('Download summary CSV — one row per month', 'הורד סיכום CSV — שורה אחת לחודש', lang)}
            >
              <Download className="h-4 w-4" />
              {t('Summary CSV', 'סיכום CSV', lang)}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 min-h-[44px]"
              onClick={() => handleDownload('detail')}
              disabled={filteredSnapshots.length === 0}
              title={t('Download detailed CSV — one row per income/expense item', 'הורד פרוט CSV — שורה לכל פריט הכנסה/הוצאה', lang)}
            >
              <Download className="h-4 w-4" />
              {t('Detailed CSV', 'פרוט CSV', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
