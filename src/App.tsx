import { useEffect, useState } from 'react'
import { LayoutDashboard, TrendingUp, ShoppingCart, PiggyBank, Target, History } from 'lucide-react'
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
