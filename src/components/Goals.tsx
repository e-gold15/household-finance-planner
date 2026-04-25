import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Target, CheckCircle, AlertTriangle, XCircle, Edit2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Switch } from './ui/switch'
import { Slider } from './ui/slider'
import { useFinance } from '@/context/FinanceContext'
import { allocateGoals } from '@/lib/savingsEngine'
import { getNetMonthly } from '@/lib/taxEstimation'
import { formatCurrency, generateId, t } from '@/lib/utils'
import type { Goal, GoalAllocation, GoalPriority, GoalStatus } from '@/types'

function GoalDialog({
  existing,
  onSave,
  lang,
}: {
  existing?: Goal
  onSave: (g: Goal) => void
  lang: 'en' | 'he'
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Goal>(
    existing ?? {
      id: generateId(),
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      deadline: '',
      priority: 'medium',
      notes: '',
      useLiquidSavings: false,
    }
  )
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
            title={t('Edit goal', 'ערוך יעד', lang)}
            aria-label={t('Edit goal', 'ערוך יעד', lang)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 me-1" />
            {t('Add Goal', 'הוסף יעד', lang)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? t('Edit Goal', 'ערוך יעד', lang) : t('Add Goal', 'הוסף יעד', lang)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t('Goal Name', 'שם היעד', lang)}</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('e.g. Emergency Fund', 'למשל: קרן חירום', lang)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Target Amount', 'סכום יעד', lang)}</Label>
              <Input type="number" value={form.targetAmount} onChange={(e) => set('targetAmount', +e.target.value)} />
            </div>
            <div>
              <Label>{t('Already Saved', 'כבר חסכת', lang)}</Label>
              <Input type="number" value={form.currentAmount} onChange={(e) => set('currentAmount', +e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t('Deadline', 'תאריך יעד', lang)}</Label>
            <Input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </div>
          <div>
            <Label>{t('Priority', 'עדיפות', lang)}</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v as GoalPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t('High', 'גבוה', lang)}</SelectItem>
                <SelectItem value="medium">{t('Medium', 'בינוני', lang)}</SelectItem>
                <SelectItem value="low">{t('Low', 'נמוך', lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('Notes', 'הערות', lang)}</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('Optional notes…', 'הערות אופציונליות…', lang)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.useLiquidSavings} onCheckedChange={(v) => set('useLiquidSavings', v)} />
            <Label>{t('Use liquid savings toward this goal', 'השתמש בחסכונות נזילים לעבר יעד זה', lang)}</Label>
          </div>
          <Button className="w-full" onClick={() => { onSave(form); setOpen(false) }}>
            {t('Save', 'שמור', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_ICONS: Record<GoalStatus, React.ElementType> = {
  realistic: CheckCircle,
  tight: AlertTriangle,
  unrealistic: XCircle,
  blocked: XCircle,
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  realistic: 'text-primary',
  tight: 'text-[hsl(var(--chart-3))]',
  unrealistic: 'text-destructive',
  blocked: 'text-destructive',
}

const STATUS_BADGE: Record<GoalStatus, 'success' | 'warning' | 'destructive'> = {
  realistic: 'success',
  tight: 'warning',
  unrealistic: 'destructive',
  blocked: 'destructive',
}

const PRIORITY_BADGE: Record<GoalPriority, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

export function Goals() {
  const { data, addGoal, updateGoal, deleteGoal, moveGoal, setData } = useFinance()
  const lang = data.language

  const totalIncome = useMemo(
    () => data.members.reduce((sum, m) => sum + m.sources.reduce((s, src) => s + getNetMonthly(src), 0), 0),
    [data.members]
  )
  const totalExpenses = useMemo(
    () => data.expenses.reduce((s, e) => s + (e.period === 'yearly' ? e.amount / 12 : e.amount), 0),
    [data.expenses]
  )
  const totalContrib = useMemo(
    () => data.accounts.reduce((s, a) => s + a.monthlyContribution, 0),
    [data.accounts]
  )
  const surplus = totalIncome - totalExpenses - totalContrib

  const allocations: GoalAllocation[] = useMemo(
    () =>
      allocateGoals({
        goals: data.goals,
        monthlySurplus: Math.max(0, surplus),
        accounts: data.accounts,
        emergencyBufferMonths: data.emergencyBufferMonths,
        monthlyExpenses: totalExpenses,
      }),
    [data.goals, data.accounts, data.emergencyBufferMonths, surplus, totalExpenses]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t('Monthly surplus for goals:', 'עודף חודשי ליעדים:', lang)}{' '}
          <span className={`font-semibold ${surplus >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(surplus, data.currency, data.locale)}
          </span>
        </div>
        <GoalDialog onSave={(g) => addGoal(g)} lang={lang} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">{t('Emergency Buffer', 'מרווח חירום', lang)}: {data.emergencyBufferMonths} {t('months', 'חודשים', lang)}</Label>
            <span className="text-xs text-muted-foreground">({formatCurrency(data.emergencyBufferMonths * totalExpenses, data.currency, data.locale)})</span>
          </div>
          <Slider
            min={1} max={12} step={1}
            value={[data.emergencyBufferMonths]}
            onValueChange={([v]) => setData((d) => ({ ...d, emergencyBufferMonths: v }))}
          />
        </CardContent>
      </Card>

      {data.goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Target className="h-10 w-10" />
          <p>{t('Set a financial goal to get started', 'הגדר יעד פיננסי כדי להתחיל', lang)}</p>
        </div>
      ) : (
        allocations.map((goal, idx) => {
          const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
          const StatusIcon = STATUS_ICONS[goal.status]
          const statusLabel = {
            realistic: t('Realistic', 'ריאלי', lang),
            tight: t('Tight', 'הדוק', lang),
            unrealistic: t('Unrealistic', 'לא ריאלי', lang),
            blocked: t('Blocked', 'חסום', lang),
          }[goal.status]

          return (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[goal.status]}`} />
                    <CardTitle className="text-base">{goal.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-xs">
                      {goal.priority === 'high' ? t('High', 'גבוה', lang) : goal.priority === 'medium' ? t('Medium', 'בינוני', lang) : t('Low', 'נמוך', lang)}
                    </Badge>
                    <Badge variant={STATUS_BADGE[goal.status]} className="text-xs">{statusLabel}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{formatCurrency(goal.currentAmount, data.currency, data.locale)} / {formatCurrency(goal.targetAmount, data.currency, data.locale)}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={
                      goal.status === 'realistic' ? 'bg-primary' :
                      goal.status === 'tight' ? 'bg-[hsl(var(--chart-3))]' : 'bg-destructive'
                    }
                    aria-label={`${goal.name} – ${pct.toFixed(0)}%`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-muted-foreground">{t('Recommended/mo', 'מומלץ/חודש', lang)}</p>
                    <p className="font-semibold">{formatCurrency(goal.monthlyRecommended, data.currency, data.locale)}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-muted-foreground">{t('Deadline', 'מועד יעד', lang)}</p>
                    <p className="font-semibold">{goal.deadline ? new Date(goal.deadline).toLocaleDateString(data.locale) : '—'}</p>
                  </div>
                  {goal.gap > 0 && (
                    <div className="bg-destructive/10 rounded p-2 col-span-2">
                      <p className="text-destructive text-xs">{t('Monthly gap:', 'פער חודשי:', lang)} {formatCurrency(goal.gap, data.currency, data.locale)}</p>
                    </div>
                  )}
                </div>
                {goal.notes && <p className="text-xs text-muted-foreground">{goal.notes}</p>}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
                      disabled={idx === 0} onClick={() => moveGoal(goal.id, 'up')}
                      title={t('Move up', 'הזז למעלה', lang)} aria-label={t('Move up', 'הזז למעלה', lang)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
                      disabled={idx === allocations.length - 1} onClick={() => moveGoal(goal.id, 'down')}
                      title={t('Move down', 'הזז למטה', lang)} aria-label={t('Move down', 'הזז למטה', lang)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <GoalDialog existing={goal} onSave={(g) => updateGoal(g)} lang={lang} />
                    <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-destructive"
                      onClick={() => deleteGoal(goal.id)}
                      title={t('Delete goal', 'מחק יעד', lang)} aria-label={t('Delete goal', 'מחק יעד', lang)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
