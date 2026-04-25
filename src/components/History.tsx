import { Camera, History as HistoryIcon, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, t } from '@/lib/utils'

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
                  <Line type="monotone" dataKey="totalIncome" name={t('Income', 'הכנסה', lang)} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalExpenses" name={t('Expenses', 'הוצאות', lang)} stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="freeCashFlow" name={t('Free Cash', 'תזרים חופשי', lang)} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {[...data.history].reverse().map((snap) => (
              <Card key={snap.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{snap.label}</p>
                      <p className="text-xs text-muted-foreground">{new Date(snap.date).toLocaleDateString(data.locale)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={snap.freeCashFlow >= 0 ? 'success' : 'destructive'}>
                        {snap.freeCashFlow >= 0 ? '+' : ''}{formatCurrency(snap.freeCashFlow, data.currency, data.locale)}
                      </Badge>
                      <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-destructive"
                        onClick={() => deleteSnapshot(snap.id)}
                        title={t('Delete snapshot', 'מחק תמונת מצב', lang)}
                        aria-label={t('Delete snapshot', 'מחק תמונת מצב', lang)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
