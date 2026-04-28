import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Target, CheckCircle, AlertTriangle, XCircle, Edit2, Bot, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Switch } from './ui/switch'
import { Slider } from './ui/slider'
import { useFinance } from '@/context/FinanceContext'
import { allocateGoals, autoAllocateSavings } from '@/lib/savingsEngine'
import { getNetMonthly } from '@/lib/taxEstimation'
import { formatCurrency, generateId, t } from '@/lib/utils'
import { explainGoalPlan, aiEnabled } from '@/lib/aiAdvisor'
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
  tight: 'text-warning',
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

  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiCard, setShowAiCard] = useState(false)

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

  // Derive FCF from most recent non-stub snapshot, or fall back to computed surplus.
  // Stubs have totalIncome === 0 (income is unknown for retroactive stubs).
  // Only snapshots where totalIncome > 0 carry a meaningful freeCashFlow figure.
  const freeCashFlow = useMemo(() => {
    const nonStub = [...data.history]
      .filter((s) => s.totalIncome > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (nonStub.length > 0) return nonStub[0].freeCashFlow
    return surplus
  }, [data.history, surplus])

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

  const [autoAllocations, setAutoAllocations] = useState<GoalAllocation[] | null>(null)

  const displayAllocations = autoAllocations ?? allocations

  const handleRecalculate = () => {
    setAutoAllocations(autoAllocateSavings(allocations, Math.max(0, freeCashFlow)))
    setAiExplanation(null)
    setAiError(null)
    setShowAiCard(false)
  }

  // Sync autoAllocations when base allocations change (goals/data changes)
  const totalAllocated = useMemo(
    () => displayAllocations.reduce((s, g) => s + (g.monthlyAllocated ?? g.monthlyRecommended), 0),
    [displayAllocations]
  )

  const isOverBudget = totalAllocated > Math.max(0, freeCashFlow)

  const handleExplainPlan = async () => {
    if (aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setShowAiCard(true)
    try {
      const payload = {
        goals: displayAllocations.map((g) => ({
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          deadline: g.deadline,
          priority: g.priority,
          monthlyRecommended: g.monthlyRecommended,
          monthlyAllocated: g.monthlyAllocated ?? g.monthlyRecommended,
          status: g.status,
        })),
        freeCashFlow: Math.max(0, freeCashFlow),
        currency: data.currency,
      }
      const explanation = await explainGoalPlan(payload, lang)
      setAiExplanation(explanation)
    } catch {
      setAiError(t('Could not reach AI — check your API key', 'לא ניתן להתחבר ל-AI — בדוק את מפתח ה-API', lang))
    } finally {
      setAiLoading(false)
    }
  }

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

      {/* Allocation Plan */}
      {data.goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('Allocation Plan', 'תוכנית הקצאה', lang)}</CardTitle>
              <div className="flex items-center gap-2">
                {aiEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={handleExplainPlan}
                    disabled={aiLoading}
                    aria-label={t('Explain my plan', 'הסבר את התוכנית', lang)}
                  >
                    <Bot className="h-4 w-4 me-1" />
                    {aiLoading
                      ? t('Thinking…', 'חושב…', lang)
                      : t('Explain my plan', 'הסבר את התוכנית', lang)}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={handleRecalculate}
                  aria-label={t('Recalculate', 'חשב מחדש', lang)}
                >
                  <RefreshCw className="h-4 w-4 me-1" />
                  {t('Recalculate', 'חשב מחדש', lang)}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 max-h-[85vh] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-start py-2 font-medium">{t('Goal', 'יעד', lang)}</th>
                    <th className="text-start py-2 font-medium">{t('Priority', 'עדיפות', lang)}</th>
                    <th className="text-start py-2 font-medium">{t('Needed/mo', 'נדרש/חודש', lang)}</th>
                    <th className="text-start py-2 font-medium">{t('Allocated', 'מוקצה', lang)}</th>
                    <th className="text-start py-2 font-medium">{t('Status', 'סטטוס', lang)}</th>
                    <th className="text-start py-2 font-medium">{t('Progress', 'התקדמות', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayAllocations.map((goal) => {
                    const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)
                    const allocated = goal.monthlyAllocated ?? goal.monthlyRecommended
                    const statusLabel = {
                      realistic: t('Realistic', 'ריאלי', lang),
                      tight: t('Tight', 'הדוק', lang),
                      unrealistic: t('Unrealistic', 'לא ריאלי', lang),
                      blocked: t('Blocked', 'חסום', lang),
                    }[goal.status]
                    const priorityLabel = {
                      high: t('High', 'גבוה', lang),
                      medium: t('Medium', 'בינוני', lang),
                      low: t('Low', 'נמוך', lang),
                    }[goal.priority]
                    return (
                      <tr key={goal.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{goal.name}</td>
                        <td className="py-2">
                          <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-xs">{priorityLabel}</Badge>
                        </td>
                        <td className="py-2">{formatCurrency(goal.monthlyRecommended, data.currency, data.locale)}</td>
                        <td className="py-2 font-semibold">{formatCurrency(allocated, data.currency, data.locale)}</td>
                        <td className="py-2">
                          <Badge variant={STATUS_BADGE[goal.status]} className="text-xs inline-flex items-center gap-1">
                            {(() => { const Icon = STATUS_ICONS[goal.status]; return <Icon className="h-3 w-3" /> })()}
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="py-2 min-w-[80px]">
                          <Progress
                            value={pct}
                            indicatorClassName={
                              goal.status === 'realistic' ? 'bg-primary' :
                              goal.status === 'tight' ? 'bg-warning' : 'bg-destructive'
                            }
                            aria-label={`${goal.name} – ${pct.toFixed(0)}%`}
                          />
                          <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="py-2 text-muted-foreground">
                      {t('Total allocated:', 'סה"כ מוקצה:', lang)}
                    </td>
                    <td colSpan={3} className="py-2">
                      <span className={`font-semibold ${isOverBudget ? 'text-destructive' : 'text-primary'}`}>
                        {formatCurrency(totalAllocated, data.currency, data.locale)}
                      </span>
                      <span className="text-muted-foreground ms-1 me-1">/</span>
                      <span className="text-muted-foreground">
                        {t('FCF:', 'תזרים:', lang)} {formatCurrency(Math.max(0, freeCashFlow), data.currency, data.locale)}
                      </span>
                      {isOverBudget && (
                        <span className="text-destructive ms-2 text-xs">
                          {t('⚠ Over budget', '⚠ חריגה מתקציב', lang)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* AI Explanation card */}
            {showAiCard && (
              <div className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">{t('AI Plan Assessment', 'הערכת תוכנית AI', lang)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 max-h-[40vh] overflow-y-auto">
                    {aiLoading && (
                      <p className="text-sm text-muted-foreground">{t('Analyzing your plan…', 'מנתח את התוכנית שלך…', lang)}</p>
                    )}
                    {aiError && (
                      <p className="text-sm text-destructive">{aiError}</p>
                    )}
                    {aiExplanation && !aiLoading && (
                      <p className="text-sm whitespace-pre-wrap">{aiExplanation}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Target className="h-10 w-10" />
          <p>{t('Set a financial goal to get started', 'הגדר יעד פיננסי כדי להתחיל', lang)}</p>
        </div>
      ) : (
        displayAllocations.map((goal, idx) => {
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
                      goal.status === 'tight' ? 'bg-warning' : 'bg-destructive'
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
                  {goal.monthlyAllocated !== undefined && goal.monthlyAllocated !== goal.monthlyRecommended && (
                    <div className="bg-muted/50 rounded p-2">
                      <p className="text-muted-foreground">{t('Allocated/mo', 'מוקצה/חודש', lang)}</p>
                      <p className="font-semibold">{formatCurrency(goal.monthlyAllocated, data.currency, data.locale)}</p>
                    </div>
                  )}
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
                      disabled={idx === displayAllocations.length - 1} onClick={() => moveGoal(goal.id, 'down')}
                      title={t('Move down', 'הזז למטה', lang)} aria-label={t('Move down', 'הזז למטה', lang)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <GoalDialog existing={goal} onSave={(g) => updateGoal(g)} lang={lang} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-destructive"
                          title={t('Delete goal', 'מחק יעד', lang)} aria-label={t('Delete goal', 'מחק יעד', lang)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('Are you sure?', 'האם אתה בטוח?', lang)}</AlertDialogTitle>
                          <AlertDialogDescription>{t('This cannot be undone.', 'פעולה זו אינה הפיכה.', lang)}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteGoal(goal.id)}
                          >
                            {t('Delete', 'מחק', lang)}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
