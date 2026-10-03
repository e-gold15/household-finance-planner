import { useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Wallet, Settings, Download, Upload, Moon, Sun, LogOut, Users, FlaskConical, ArrowRight, ChevronDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { useFinance } from '@/context/FinanceContext'
import { useAuth } from '@/context/AuthContext'
import { useNav } from '@/context/NavContext'
import { cn, t } from '@/lib/utils'
import type { Currency, Locale, FinanceData } from '@/types'
import { HouseholdSettings } from './HouseholdSettings'
import { DesktopNav } from './shell/DesktopNav'

const menuItemClass =
  'flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-3 min-h-[44px] text-sm outline-none transition-colors data-[highlighted]:bg-muted focus-visible:ring-2 focus-visible:ring-ring'

const CURRENCY_OPTIONS: { value: Currency; label: string; locale: Locale }[] = [
  { value: 'ILS', label: '₪ ILS', locale: 'he-IL' },
  { value: 'USD', label: '$ USD', locale: 'en-US' },
  { value: 'GBP', label: '£ GBP', locale: 'en-GB' },
  { value: 'EUR', label: '€ EUR', locale: 'de-DE' },
  { value: 'CAD', label: '$ CAD', locale: 'en-CA' },
]

export function Header() {
  const { data, setData, exportData, importData, isLoading } = useFinance()
  const { user, household, signOut, isDemo } = useAuth()
  const { navigate, openQuickAdd, settingsOpen: settingsDialogOpen, setSettingsOpen: setSettingsDialogOpen } = useNav()
  const lang    = data.language
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<FinanceData | null>(null)

  const toggleLang = () => setData((d) => ({ ...d, language: d.language === 'en' ? 'he' : 'en' }))
  const toggleDark = () => setData((d) => ({ ...d, darkMode: !d.darkMode }))

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onerror = () => {
      toast.error(t('Failed to read file.', 'שגיאה בקריאת הקובץ.', lang))
    }
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as FinanceData
        setPendingImport(parsed)
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        toast.error(t('Invalid JSON file.', 'קובץ JSON לא תקין.', lang) + ' ' + detail)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = () => {
    if (!pendingImport) return
    try {
      importData(JSON.stringify(pendingImport))
      toast.success(t('Data imported successfully.', 'הנתונים יובאו בהצלחה.', lang))
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      toast.error(t('Import failed.', 'הייבוא נכשל.', lang) + ' ' + detail)
    } finally {
      setPendingImport(null)
    }
  }

  const userName = user?.name ?? user?.email ?? ''
  const userInitial = userName.slice(0, 1).toUpperCase()
  const firstName = userName.split(' ')[0] ?? userName

  // Account menu (avatar dropdown) + dialogs it can open.
  // The Settings dialog open state lives in NavContext so the mobile "More"
  // sheet can open the very same dialog via `openSettings()`.
  const [menuOpen, setMenuOpen] = useState(false)
  const [householdDialogOpen, setHouseholdDialogOpen] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)
  // Set when a menu item opens a dialog, so the menu doesn't steal focus back.
  const openingDialogRef = useRef(false)

  const openFromMenu = (open: () => void) => {
    openingDialogRef.current = true
    open()
  }

  // ── CSV helpers ──────────────────────────────────────────────────────────
  function downloadCsv(filename: string, rows: (string | number)[][]): void {
    const content = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExpensesCsv = () => {
    const header = ['Name', 'Amount', 'Period', 'Category', 'Type', 'Linked Account']
    const rows = data.expenses.map(e => {
      const linkedAccount = e.linkedAccountId
        ? (data.accounts.find(a => a.id === e.linkedAccountId)?.name ?? '')
        : ''
      return [e.name, e.amount, e.period, e.category, e.expenseType ?? 'fixed', linkedAccount]
    })
    downloadCsv('expenses.csv', [header, ...rows])
  }

  const handleExportHistoryCsv = () => {
    const header = ['Month', 'Year', 'Label', 'Income', 'Expenses', 'Savings', 'Free Cash Flow', 'Surplus Allocations']
    const sorted = [...data.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const rows = sorted.map(snap => {
      const allocations = snap.surplusAllocations?.length
        ? snap.surplusAllocations.map(al => `${al.amount} \u2192 ${al.destinationName}`).join('; ')
        : ''
      const d = new Date(snap.date)
      return [d.getMonth() + 1, d.getFullYear(), snap.label, snap.totalIncome, snap.totalExpenses, snap.totalSavings, snap.freeCashFlow, allocations]
    })
    downloadCsv('history.csv', [header, ...rows])
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b bg-card pt-[env(safe-area-inset-top)]">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo + app name — tap to go to Overview */}
        <button
          type="button"
          onClick={() => navigate('overview')}
          className="flex items-center gap-2.5 min-h-[44px] min-w-0 rounded-lg -ms-1 ps-1 pe-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t('Go to Overview', 'מעבר לסקירה', lang)}
          aria-label={t('Household Finance Planner — go to Overview', 'מתכנן פיננסי ביתי — מעבר לסקירה', lang)}
        >
          <span className="rounded-lg bg-primary p-1.5 shrink-0" aria-hidden="true">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-bold tracking-tight truncate lg:hidden" aria-hidden="true">
            {t('Finance', 'כספים', lang)}
          </span>
          <span className="font-bold tracking-tight truncate hidden lg:block" aria-hidden="true">
            {t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}
          </span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Add expense — desktop only (mobile uses the bottom-nav "+") */}
          <Button onClick={openQuickAdd} disabled={isLoading} className="hidden md:inline-flex min-h-[44px] gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('Add expense', 'הוספת הוצאה', lang)}
          </Button>

          {/* Language toggle */}
          <Button variant="ghost" size="sm" onClick={toggleLang} className="text-xs font-medium min-h-[44px] min-w-[44px]"
            title={t('Switch language', 'החלף שפה', lang)}
            aria-label={t('Switch language', 'החלף שפה', lang)}>
            {lang === 'en' ? 'עב' : 'EN'}
          </Button>

          {/* Dark mode toggle (sm+; on mobile it lives in the account menu) */}
          <Button variant="ghost" size="icon" onClick={toggleDark}
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px]"
            title={t('Toggle dark mode', 'החלף מצב לילה', lang)}
            aria-label={t('Toggle dark mode', 'החלף מצב לילה', lang)}>
            {data.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Settings gear (sm+; on mobile: account menu or More sheet) */}
          <Button variant="ghost" size="icon"
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px]"
            title={t('Settings', 'הגדרות', lang)}
            aria-label={t('Settings', 'הגדרות', lang)}
            onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>

          {/* Account menu (avatar dropdown) — all breakpoints */}
          {user && (
            <>
              <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
              <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false} dir={lang === 'he' ? 'rtl' : 'ltr'}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border bg-muted/50 ps-1 pe-2 py-1 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('Account menu', 'תפריט חשבון', lang)}
                    title={t('Account menu', 'תפריט חשבון', lang)}
                  >
                    {user.avatar
                      ? <img src={user.avatar} className="h-7 w-7 rounded-full object-cover shrink-0" alt="" width={28} height={28} />
                      : (
                        <span className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0" aria-hidden="true">
                          {userInitial}
                        </span>
                      )
                    }
                    {/* Mobile: first name; sm+: full name + household */}
                    <span className="text-sm font-medium max-w-[60px] truncate sm:hidden">{firstName}</span>
                    <span className="hidden sm:flex flex-col items-start leading-tight max-w-[120px] min-w-0">
                      <span className="text-sm font-medium truncate max-w-full">{userName}</span>
                      {household && (
                        <span className="text-xs text-muted-foreground truncate max-w-full">{household.name}</span>
                      )}
                    </span>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0', menuOpen && 'rotate-180')} aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align={lang === 'he' ? 'start' : 'end'}
                    sideOffset={6}
                    collisionPadding={8}
                    onCloseAutoFocus={(e) => {
                      if (openingDialogRef.current) {
                        e.preventDefault()
                        openingDialogRef.current = false
                      }
                    }}
                    className="z-50 min-w-[220px] max-w-[calc(100vw-1rem)] rounded-lg border bg-card text-card-foreground shadow-lg p-1"
                  >
                    <DropdownMenu.Label className="px-3 py-2">
                      <span className="block text-sm font-medium truncate">{userName}</span>
                      {household && (
                        <span className="block text-xs text-muted-foreground truncate">{household.name}</span>
                      )}
                    </DropdownMenu.Label>
                    <DropdownMenu.Separator className="h-px bg-border mx-1 my-1" />

                    {household && (
                      <DropdownMenu.Item className={menuItemClass} onSelect={() => openFromMenu(() => setHouseholdDialogOpen(true))}>
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        {t('Household settings', 'הגדרות משק הבית', lang)}
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item className={menuItemClass} onSelect={() => openFromMenu(() => setSettingsDialogOpen(true))}>
                      <Settings className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      {t('App settings', 'הגדרות אפליקציה', lang)}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItemClass} onSelect={toggleDark}>
                      {data.darkMode
                        ? <Sun className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        : <Moon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />}
                      {data.darkMode ? t('Light mode', 'מצב יום', lang) : t('Dark mode', 'מצב לילה', lang)}
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="h-px bg-border mx-1 my-1" />
                    <DropdownMenu.Item
                      className={cn(menuItemClass, 'text-destructive')}
                      onSelect={() => openFromMenu(() => setSignOutDialogOpen(true))}
                    >
                      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('Sign out', 'התנתק', lang)}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          )}

          {/* ── Shared dialogs (triggered from both mobile dropdown and desktop buttons) ── */}

          {/* Household settings dialog */}
          {household && (
            <Dialog open={householdDialogOpen} onOpenChange={setHouseholdDialogOpen}>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('Household', 'משק הבית', lang)}
                  </DialogTitle>
                </DialogHeader>
                <HouseholdSettings />
              </DialogContent>
            </Dialog>
          )}

          {/* Sign out confirmation dialog */}
          <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Sign out?', 'להתנתק?', lang)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('You will need to sign in again to access your data.', 'תצטרך להתחבר שוב כדי לגשת לנתונים שלך.', lang)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={signOut}
                >
                  {t('Sign out', 'התנתק', lang)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Settings dialog */}
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('Settings', 'הגדרות', lang)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                {/* Change 5: grouped Preferences label */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    {t('Preferences', 'העדפות', lang)}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('Currency', 'מטבע', lang)}</Label>
                      <Select
                        value={data.currency}
                        onValueChange={(v) => {
                          const opt = CURRENCY_OPTIONS.find((o) => o.value === v)!
                          setData((d) => ({ ...d, currency: opt.value, locale: opt.locale }))
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={data.darkMode} onCheckedChange={toggleDark} />
                      <Label>{t('Dark Mode', 'מצב לילה', lang)}</Label>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium">{t('Data', 'נתונים', lang)}</p>
                  {/* Change 5: grid layout for export/import buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="w-full justify-center min-h-[44px]" onClick={exportData}>
                      <Download className="h-4 w-4 me-1" />
                      {t('Export JSON', 'ייצא JSON', lang)}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-center min-h-[44px]" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4 me-1" />
                      {t('Import JSON', 'ייבא JSON', lang)}
                    </Button>
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                    <Button variant="outline" size="sm" onClick={handleExportExpensesCsv} className="w-full justify-center gap-1.5 min-h-[44px]">
                      <Download className="h-4 w-4" />
                      {t('Expenses CSV', 'הוצאות CSV', lang)}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportHistoryCsv} className="w-full justify-center gap-1.5 min-h-[44px]">
                      <Download className="h-4 w-4" />
                      {t('History CSV', 'היסטוריה CSV', lang)}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Import confirmation dialog — rendered outside the settings dialog to avoid z-index nesting issues */}
      <AlertDialog open={pendingImport !== null} onOpenChange={(open) => { if (!open) setPendingImport(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Replace all data?', 'להחליף את כל הנתונים?', lang)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will replace ALL your current data. This cannot be undone.', 'פעולה זו תחליף את כל הנתונים הנוכחיים שלך. פעולה זו אינה הפיכה.', lang)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmImport}
            >
              {t('Import', 'ייבא', lang)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demo Mode banner — part of the sticky header block, fully opaque (bg-card underneath) */}
      {isDemo && (
        <div className="border-t border-warning/40 bg-[hsl(var(--warning)/0.15)]">
          <div className="max-w-4xl mx-auto px-4 min-h-10 py-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0">
              <FlaskConical className="h-4 w-4 shrink-0 text-warning-foreground" aria-hidden="true" />
              <span className="sm:hidden">
                {t('Demo — nothing is saved', 'דמו — שום דבר לא נשמר', lang)}
              </span>
              <span className="hidden sm:inline">
                {t(
                  'Demo Mode \u2014 sample data only, nothing is saved',
                  '\u05de\u05e6\u05d1 \u05d3\u05de\u05d5 \u2014 \u05e0\u05ea\u05d5\u05e0\u05d9 \u05d3\u05d5\u05d2\u05de\u05d0 \u05d1\u05dc\u05d1\u05d3, \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8 \u05d3\u05d1\u05e8',
                  lang
                )}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="shrink-0 min-h-[44px] gap-1.5 text-xs bg-card"
            >
              {t('Exit Demo', 'צא מדמו', lang)}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop tab bar (≥768px) */}
      <DesktopNav lang={lang} />
    </header>
    </>
  )
}
