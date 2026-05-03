import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from './ui/button'
import { t } from '@/lib/utils'

const DISMISS_KEY = 'hf-pwa-dismissed'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallBanner({ lang }: { lang: 'en' | 'he' }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if dismissed within DISMISS_DAYS
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const days = (Date.now() - Number(dismissed)) / 86400000
      if (days < DISMISS_DAYS) return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !prompt) return null

  const handleInstall = async () => {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 mb-4 flex gap-3 items-center">
      <Download className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">
          {t('Install the app', 'התקן את האפליקציה', lang)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('Add to your home screen for quick access', 'הוסף למסך הבית לגישה מהירה', lang)}
        </p>
      </div>
      <Button onClick={handleInstall} size="sm" className="min-h-[44px] shrink-0">
        {t('Install', 'התקן', lang)}
      </Button>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
        title={t('Dismiss', 'סגור', lang)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
