import { useState } from 'react'
import { Camera, History as HistoryIcon, Trash2, ClipboardList } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, t } from '@/lib/utils'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import type { ExpenseCategory, MonthSnapshot } from '@/types'

// ── ActualsDialog ─────────────────────────────────────────────────────────────
// Lets the user record or edit what they actually spent per category in a past month.

function ActualsDialog({
  snap,
  lang,
}: {
  snap: MonthSnapshot
  lang: 'en' | 'he'
}) {
  const { data, updateSnapshotActuals } = useFinance()
  const [open, setOpen] = useState(false)

  // Initialise form from existing actuals (or empty strings so inputs are blank)
  const [form, setForm] = useState<Record<string, string>>({})

  const handleOpen = (o: boolean) => {
    if (o) {
      const init: Record<string, string> = {}
      CATEGORIES.forEach(({ value }) => {
        const existing = snap.categoryActuals?.[value]
        init[value] = existing != null ? existing.toFixed(0) : ''
      })
      setForm(init)
    }
    setOpen(o)
  }

  const handleSave = () => {
    const actuals: Partial<Record<ExpenseCategory, number>> = {}
    CATEGORIES.forEach(({ value }) => {
      const n = parseFloat(form[value] ?? '')
      if (!isNaN(n) && n >= 0) actuals[value] = n
    })
    updateSnapshotActuals(snap.id, actuals)
    setOpen(false)
  }

  const hasActuals = snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 min-h-[44px]"
          title={t('Log actual spending for this month', 'רשום הוצאות בפועל לחודש זה', lang)}>
          <ClipboardList className="h-3.5 w-3.5" />
          {hasActuals ? t('Edit Actuals', 'ערוך בפועל', lang) : t('Log Actuals', 'רשום בפועל', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {snap.label} — {t('Actual Spending', 'הוצאות בפועל', lang)}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            'Enter what you actually spent per category. Pre-filled with your planned amounts — edit only what changed.',
            'הזן כמה הוצאת בפועל לכל קטגוריה. ערכים ממולאים לפי תכנון — ערוך רק מה שהשתנה.',
            lang
          )}
        </p>
        <div className="space-y-3 mt-3">
          {CATEGORIES.map(({ value, en, he }) => (
            <div key={value} className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-sm">{lang === 'he' ? he : en}</Label>
              <Input
                type="number"
                min="0"
                value={form[value] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [value]: e.target.value }))}
                placeholder="0"
                className="flex-1"
                aria-label={`${lang === 'he' ? he : en} — ${t('actual amount', 'סכום בפועל', lang)}`}
              />
              <span className="text-xs text-muted-foreground shrink-0">
                {formatCurrency(0, data.currency, data.locale).replace('0', '').trim()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={handleSave}>
            {t('Save Actuals', 'שמור בפועל', lang)}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('Cancel', 'ביטול', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main History component ────────────────────────────────────────────────────

export function History() {
  const { data, snapshotMonth, setData } = useFinance()
  const lang = data.language

  const deleteSnapshot = (id: string) =>
    setData((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.history.length} {t('snapshots recorded', 'תמונות מצב שנרשמו', lang)}
        </p>
        <Button size="sm" onClick={snapshotMonth}>
          <Camera className="h-4 w-4 me-1" />
          {t('Snapshot This Month', 'צלם חודש זה', lang)}
        </Button>
      </div>

      {data.history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <HistoryIcon className="h-10 w-10" />
          <p>{t('Take your first monthly snapshot to start tracking trends', 'צלם את תמונת המצב החודשית הראשונה כדי להתחיל לעקוב', lang)}</p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('Monthly Trend', 'מגמה חודשית', lang)}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), data.currency, data.locale)} />
                  <Legend />
                  <Line type="monotone" dataKey="totalIncome"   name={t('Income',     'הכנסה',       lang)} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalExpenses" name={t('Expenses',    'הוצאות',      lang)} stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="freeCashFlow"  name={t('Free Cash',   'תזרים חופשי', lang)} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {[...data.history].reverse().map((snap) => {
              const hasActuals = snap.categoryActuals && Object.keys(snap.categoryActuals).length > 0
              return (
                <Card key={snap.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{snap.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(snap.date).toLocaleDateString(data.locale)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={snap.freeCashFlow >= 0 ? 'success' : 'destructive'}>
                          {snap.freeCashFlow >= 0 ? '+' : ''}{formatCurrency(snap.freeCashFlow, data.currency, data.locale)}
                        </Badge>
                        {/* Actuals indicator */}
                        {hasActuals && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {t('Actuals logged', 'נרשם בפועל', lang)}
                          </Badge>
                        )}
                        <ActualsDialog snap={snap} lang={lang} />
                        <Button
                          variant="ghost" size="icon"
                          className="min-h-[44px] min-w-[44px] text-destructive"
                          onClick={() => deleteSnapshot(snap.id)}
                          title={t('Delete snapshot', 'מחק תמונת מצב', lang)}
                          aria-label={t('Delete snapshot', 'מחק תמונת מצב', lang)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Summary totals */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Income', 'הכנסה', lang)}</p>
                        <p className="font-semibold text-primary">{formatCurrency(snap.totalIncome, data.currency, data.locale)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Expenses', 'הוצאות', lang)}</p>
                        <p className="font-semibold text-destructive">{formatCurrency(snap.totalExpenses, data.currency, data.locale)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">{t('Savings', 'חיסכון', lang)}</p>
                        <p className="font-semibold">{formatCurrency(snap.totalSavings, data.currency, data.locale)}</p>
                      </div>
                    </div>

                    {/* Category actuals breakdown — shown when logged */}
                    {hasActuals && snap.categoryActuals && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{t('Actual spending by category', 'הוצאות בפועל לפי קטגוריה', lang)}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {CATEGORIES.filter(({ value }) => snap.categoryActuals![value] != null).map(({ value, en, he }) => (
                            <div key={value} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{lang === 'he' ? he : en}</span>
                              <span className="font-medium">{formatCurrency(snap.categoryActuals![value]!, data.currency, data.locale)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
