import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useFinance } from '@/context/FinanceContext'
import { t } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Moved verbatim from App.tsx (v4.0 shell refactor). Behaviour — including the
// `hf-last-seen-month` read/write — is intentionally unchanged.

// ─── Auto-snapshot prompt (shown once per month if previous month has no snapshot) ─

const LAST_SEEN_KEY = 'hf-last-seen-month'

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthLabel(lang: 'en' | 'he'): string {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const prevDate  = new Date(prevYear, prevMonth - 1, 1)
  return prevDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' })
}

function hasPrevMonthSnapshot(history: import('@/types').MonthSnapshot[]): boolean {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  return history.some((s) => {
    const sd = new Date(s.date)
    return sd.getFullYear() === prevYear && sd.getMonth() + 1 === prevMonth
  })
}

export function NewMonthPrompt({ lang }: { lang: 'en' | 'he' }) {
  const { data, snapshotPreviousMonth } = useFinance()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored  = localStorage.getItem(LAST_SEEN_KEY)
    const current = currentMonthKey()

    // Always update the last-seen key so next visit can detect a month change.
    localStorage.setItem(LAST_SEEN_KEY, current)

    // The actual variable-expense clearing now happens inside FinanceContext's
    // cloud pull (after the additive merge), so the cleared state can't be
    // restored by cloud data arriving after this effect runs.
    // Here we only handle the snapshot prompt UI.
    if (stored && stored !== current && !hasPrevMonthSnapshot(data.history)) {
      setOpen(true)
    }
  // Run only once on mount — data.history checked at mount time intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const monthLabel = prevMonthLabel(lang)

  const handleSnapshot = () => {
    snapshotPreviousMonth()
    setOpen(false)
    toast.success(
      t(`Snapshot saved for ${monthLabel}`, `תמונת מצב נשמרה עבור ${monthLabel}`, lang)
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('New month — snapshot last month?', 'חודש חדש — לצלם את החודש שעבר?', lang)}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            `${monthLabel} has no snapshot yet. Would you like to save it now?`,
            `ל${monthLabel} אין עדיין תמונת מצב. האם תרצה לשמור אותה עכשיו?`,
            lang
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t(
            'Variable expenses have been cleared so the new month starts fresh. Fixed expenses are kept.',
            'הוצאות משתנות נמחקו כדי שהחודש החדש יתחיל נקי. הוצאות קבועות נשמרות.',
            lang
          )}
        </p>
        <div className="flex gap-3 justify-end mt-4">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setOpen(false)}
          >
            {t('Skip', 'דלג', lang)}
          </Button>
          <Button
            className="min-h-[44px]"
            onClick={handleSnapshot}
          >
            {t(`Snapshot ${monthLabel}`, `צלם את ${monthLabel}`, lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
