import { useEffect, useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { DirectionProvider } from '@radix-ui/react-direction'
import { Toaster, toast } from 'sonner'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NavProvider, useNav } from './context/NavContext'
import { AuthPage } from './pages/AuthPage'
import { Header } from './components/Header'
import { Overview } from './components/Overview'
import { Income } from './components/Income'
import { Expenses } from './components/Expenses'
import { Savings } from './components/Savings'
import { Goals } from './components/Goals'
import { History as HistoryTab } from './components/History'
import { Members } from './components/Members'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import { IOSInstallTooltip } from './components/IOSInstallTooltip'
import { JoinedHouseholdBanner } from './components/shell/JoinedHouseholdBanner'
import { NewMonthPrompt } from './components/shell/NewMonthPrompt'
import { BottomNav } from './components/shell/BottomNav'
import { AppSkeleton } from './components/shell/AppSkeleton'
import { QuickAddSheet } from './components/quick-add/QuickAddSheet'
import { useIsDesktop } from './hooks/useMediaQuery'
import { t } from './lib/utils'

// ─── Tab content (driven by the URL hash via NavContext) ──────────────────────

function TabContent() {
  const { tab, navigate } = useNav()
  return (
    <>
      {tab === 'overview'  && <Overview />}
      {tab === 'income'    && <Income />}
      {tab === 'expenses'  && <Expenses onNavigateToHistory={() => navigate('history')} />}
      {tab === 'savings'   && <Savings />}
      {tab === 'goals'     && <Goals />}
      {tab === 'history'   && <HistoryTab />}
      {tab === 'members'   && <Members />}
    </>
  )
}

/** App-level Quick Add sheet, mounted once and controlled by NavContext. */
function AppQuickAdd() {
  const { quickAddOpen, setQuickAddOpen } = useNav()
  const { isLoading } = useFinance()
  // Data safety: never allow writes before the first cloud pull completes.
  // An early write would schedule a debounced push of near-empty local data
  // that could overwrite the household's cloud row.
  return <QuickAddSheet open={quickAddOpen && !isLoading} onOpenChange={setQuickAddOpen} />
}

function AppToaster({ lang, dark }: { lang: 'en' | 'he'; dark: boolean }) {
  const isDesktop = useIsDesktop()
  // Below 768px toasts sit at the top, just under the sticky header
  // (56px + safe area), so they never cover the header or the bottom-nav "+".
  const belowHeader = { top: 'calc(env(safe-area-inset-top) + 64px)' }
  return (
    <Toaster
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      theme={dark ? 'dark' : 'light'}
      richColors
      position={isDesktop ? 'bottom-right' : 'top-center'}
      offset={isDesktop ? undefined : belowHeader}
      mobileOffset={belowHeader}
      containerAriaLabel={t('Notifications', 'התראות', lang)}
    />
  )
}

function AppShell() {
  const { data, isLoading } = useFinance()
  const { justJoined } = useAuth()
  const lang = data.language
  const dir  = lang === 'he' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.darkMode)
    document.documentElement.dir  = dir
    document.documentElement.lang = lang === 'he' ? 'he' : 'en'
  }, [data.darkMode, lang, dir])

  return (
    <DirectionProvider dir={dir}>
      <NavProvider>
        <div className="min-h-screen bg-background">
          <Header />
          {/* Bottom padding on mobile clears the fixed bottom nav (64px + raised "+" + safe area). */}
          <main className="max-w-4xl mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
            {justJoined && <JoinedHouseholdBanner lang={lang} />}
            <PWAInstallBanner lang={lang} />
            <IOSInstallTooltip lang={lang} />

            <h1 className="sr-only">{t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}</h1>

            <NewMonthPrompt lang={lang} />
            {isLoading ? <AppSkeleton lang={lang} /> : <TabContent />}
          </main>
          <BottomNav lang={lang} />
          <AppQuickAdd />
          <AppToaster lang={lang} dark={data.darkMode} />
        </div>
      </NavProvider>
    </DirectionProvider>
  )
}

function AppOrAuth() {
  const { user, household } = useAuth()

  if (!user || !household) return <AuthPage />

  // key={household.id} ensures FinanceProvider remounts (fresh data) when household changes
  return (
    <FinanceProvider key={household.id} householdId={household.id}>
      <AppShell />
    </FinanceProvider>
  )
}

// ── SW update notifier ───────────────────────────────────────────────────────
// Shows a Sonner toast with a "Refresh" button whenever a new app version is
// detected. Prevents users from being stuck on a cached old bundle.
// Lives outside FinanceProvider, so the language is read from <html lang>
// (kept in sync by AppShell) at the moment the toast fires.

function currentDocLang(): 'en' | 'he' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'he' ? 'he' : 'en'
}

function SWUpdateNotifier() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true)
  }, [updateServiceWorker])

  useEffect(() => {
    if (!needRefresh) return
    const lang = currentDocLang()
    toast(t('New version available', 'גרסה חדשה זמינה', lang), {
      description: t('Tap Refresh to get the latest update.', 'הקישו על "רענון" כדי לקבל את העדכון האחרון.', lang),
      duration: Infinity,
      action: {
        label: t('Refresh', 'רענון', lang),
        onClick: handleUpdate,
      },
    })
  }, [needRefresh, handleUpdate])

  return null
}

export default function Root() {
  return (
    <AuthProvider>
      <SWUpdateNotifier />
      <AppOrAuth />
    </AuthProvider>
  )
}
