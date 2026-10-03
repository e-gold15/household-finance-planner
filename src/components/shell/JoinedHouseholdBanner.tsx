import { PartyPopper, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { t } from '@/lib/utils'

// ─── Welcome banner (shown once after accepting an invite) ──────────────────
// Moved verbatim from App.tsx (v4.0 shell refactor).

export function JoinedHouseholdBanner({ lang }: { lang: 'en' | 'he' }) {
  const { household, clearJustJoined } = useAuth()
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 mb-5 flex gap-3 items-start">
      <PartyPopper className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">
          {t(`You've joined ${household?.name ?? 'the household'}! 🎉`,
             `הצטרפת ל-${household?.name ?? 'משק הבית'}! 🎉`,
             lang)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {t(
            "Income, expenses, goals and savings are shared across all household members. Your display preferences (dark mode, language) stay personal to this device.",
            'הכנסות, הוצאות, יעדים וחיסכון משותפים לכל חברי משק הבית. העדפות תצוגה (מצב כהה, שפה) נשמרות במכשיר שלך בלבד.',
            lang
          )}
        </p>
      </div>
      <button
        onClick={clearJustJoined}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -me-2"
        title={t('Dismiss', 'סגור', lang)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
