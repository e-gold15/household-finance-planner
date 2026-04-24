import { useEffect, useState } from 'react'
import { LayoutDashboard, TrendingUp, ShoppingCart, PiggyBank, Target, History, PartyPopper, X } from 'lucide-react'
import { Toaster } from 'sonner'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { Header } from './components/Header'
import { Overview } from './components/Overview'
import { Income } from './components/Income'
import { Expenses } from './components/Expenses'
import { Savings } from './components/Savings'
import { Goals } from './components/Goals'
import { History as HistoryTab } from './components/History'
import { t } from './lib/utils'
import { cn } from './lib/utils'

// ─── Welcome banner (shown once after accepting an invite) ──────────────────

function JoinedHouseholdBanner({ lang }: { lang: 'en' | 'he' }) {
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
            "This app is privacy-first — each partner's financial data is stored locally on their own device. You're starting with a clean slate. Add your own income and expenses to get started.",
            'האפליקציה מאחסנת נתונים מקומית — לכל שותף יש נתוניו הפרטיים במכשיר שלו. אתה מתחיל עם דף ריק. הוסף את ההכנסות וההוצאות שלך כדי להתחיל.',
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

type Tab = 'overview' | 'income' | 'expenses' | 'savings' | 'goals' | 'history'

const TABS: { id: Tab; icon: React.ElementType; en: string; he: string }[] = [
  { id: 'overview',  icon: LayoutDashboard, en: 'Overview',  he: 'סקירה' },
  { id: 'income',    icon: TrendingUp,       en: 'Income',    he: 'הכנסות' },
  { id: 'expenses',  icon: ShoppingCart,     en: 'Expenses',  he: 'הוצאות' },
  { id: 'savings',   icon: PiggyBank,        en: 'Savings',   he: 'חיסכון' },
  { id: 'goals',     icon: Target,           en: 'Goals',     he: 'יעדים' },
  { id: 'history',   icon: History,          en: 'History',   he: 'היסטוריה' },
]

function AppShell() {
  const { data } = useFinance()
  const { justJoined } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const lang = data.language

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.darkMode)
    document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang === 'he' ? 'he' : 'en'
  }, [data.darkMode, lang])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {justJoined && <JoinedHouseholdBanner lang={lang} />}
        <nav className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(({ id, icon: Icon, en, he }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                tab === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t(en, he, lang)}</span>
            </button>
          ))}
        </nav>

        <h1 className="sr-only">{t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}</h1>

        {tab === 'overview'  && <Overview />}
        {tab === 'income'    && <Income />}
        {tab === 'expenses'  && <Expenses />}
        {tab === 'savings'   && <Savings />}
        {tab === 'goals'     && <Goals />}
        {tab === 'history'   && <HistoryTab />}
      </main>
      <Toaster position="bottom-right" />
    </div>
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

export default function Root() {
  return (
    <AuthProvider>
      <AppOrAuth />
    </AuthProvider>
  )
}
