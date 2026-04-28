import { useRef, useState } from 'react'
import { Wallet, Settings, Download, Upload, Moon, Sun, LogOut, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { useFinance } from '@/context/FinanceContext'
import { useAuth } from '@/context/AuthContext'
import { t } from '@/lib/utils'
import type { Currency, Locale, FinanceData } from '@/types'
import { HouseholdSettings } from './HouseholdSettings'

const CURRENCY_OPTIONS: { value: Currency; label: string; locale: Locale }[] = [
  { value: 'ILS', label: '₪ ILS', locale: 'he-IL' },
  { value: 'USD', label: '$ USD', locale: 'en-US' },
  { value: 'GBP', label: '£ GBP', locale: 'en-GB' },
  { value: 'EUR', label: '€ EUR', locale: 'de-DE' },
  { value: 'CAD', label: '$ CAD', locale: 'en-CA' },
]

export function Header() {
  const { data, setData, exportData, importData } = useFinance()
  const { user, household, signOut } = useAuth()
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

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo + app name */}
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary p-1.5">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight hidden sm:block">
            {t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <Button variant="ghost" size="sm" onClick={toggleLang} className="text-xs font-medium">
            {lang === 'en' ? 'עב' : 'EN'}
          </Button>

          {/* Dark mode toggle */}
          <Button variant="ghost" size="icon" onClick={toggleDark}
            title={t('Toggle dark mode', 'החלף מצב לילה', lang)}
            aria-label={t('Toggle dark mode', 'החלף מצב לילה', lang)}>
            {data.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User + household chip */}
          {user && (
            <>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                {/* Avatar */}
                {user.avatar
                  ? <img src={user.avatar} className="h-7 w-7 rounded-full object-cover shrink-0" alt={userName} />
                  : (
                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {userInitial}
                    </div>
                  )
                }
                {/* Name + household */}
                <div className="hidden sm:flex flex-col leading-none max-w-[120px]">
                  <span className="text-sm font-medium truncate">{userName}</span>
                  {household && (
                    <span className="text-[10px] text-muted-foreground truncate">{household.name}</span>
                  )}
                </div>

                {/* Household settings dialog */}
                {household && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                        title={t('Household', 'משק הבית', lang)}>
                        <Users className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
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

                {/* Sign out — with confirmation */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title={t('Sign out', 'התנתק', lang)}
                      aria-label={t('Sign out', 'התנתק', lang)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
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
              </div>
            </>
          )}

          {/* Settings gear */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"
                title={t('Settings', 'הגדרות', lang)}
                aria-label={t('Settings', 'הגדרות', lang)}>
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('Settings', 'הגדרות', lang)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
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
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium">{t('Data', 'נתונים', lang)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={exportData}>
                      <Download className="h-4 w-4 me-1" />
                      {t('Export JSON', 'ייצא JSON', lang)}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4 me-1" />
                      {t('Import JSON', 'ייבא JSON', lang)}
                    </Button>
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
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
    </header>
  )
}
