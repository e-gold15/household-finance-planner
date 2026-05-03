import { useState, useEffect } from 'react'
import { Share, X } from 'lucide-react'
import { t } from '@/lib/utils'

const DISMISS_KEY = 'hf-ios-install-dismissed'
const DISMISS_DAYS = 14

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  return (
    'standalone' in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export function IOSInstallTooltip({ lang }: { lang: 'en' | 'he' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIOS() || isInStandaloneMode()) return
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const days = (Date.now() - Number(dismissed)) / 86400000
      if (days < DISMISS_DAYS) return
    }
    // Small delay so it doesn't flash on first paint
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 mb-4 flex gap-3 items-start">
      <Share className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">
          {t('Add to Home Screen', 'הוסף למסך הבית', lang)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {t(
            'Tap the Share button below, then "Add to Home Screen"',
            'לחץ על כפתור השיתוף למטה, ואז "הוסף למסך הבית"',
            lang
          )}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center -me-2"
        title={t('Dismiss', 'סגור', lang)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
