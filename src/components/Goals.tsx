import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Target } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Money } from './ui/money'
import { Slider } from './ui/slider'
import { EmptyState } from './ui/empty-state'
import { useFinance } from '@/context/FinanceContext'
import { allocateGoals, autoAllocateSavings } from '@/lib/savingsEngine'
import { getNetMonthly } from '@/lib/taxEstimation'
import { plannedFreeCashFlow } from '@/lib/monthActual'
import { t } from '@/lib/utils'
import { explainGoalPlan, aiEnabled } from '@/lib/aiAdvisor'
import { activeGoals, completedGoals, markGoalDone, moveStepsPastHidden, reopenGoal } from '@/lib/goals'
import type { Goal, GoalAllocation } from '@/types'
import { GoalDialog } from './goals/GoalDialog'
import { GoalCard } from './goals/GoalCard'
import { AllocationPlan } from './goals/AllocationPlan'
import { CompletedGoals } from './goals/CompletedGoals'

export function Goals() {
  const { data, addGoal, updateGoal, deleteGoal, moveGoal, setData, fundGoalFromSavings } = useFinance()
  const lang = data.language
  const { currency, locale } = data

  const [addOpen, setAddOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiCard, setShowAiCard] = useState(false)

  // v4.1 — done goals (completedAt set) never take part in allocation / AI / Recalculate.
  const active = useMemo(() => activeGoals(data.goals), [data.goals])
  const done = useMemo(() => completedGoals(data.goals), [data.goals])

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
  // v4.2 — goals plan on the PLANNED income, never on this month's actuals.
  const freeCashFlow = useMemo(
    () => plannedFreeCashFlow(data.history, data.members, surplus, new Date()),
    [data.history, data.members, surplus]
  )

  const allocations: GoalAllocation[] = useMemo(
    () =>
      allocateGoals({
        goals: active,
        monthlySurplus: Math.max(0, surplus),
        accounts: data.accounts,
        emergencyBufferMonths: data.emergencyBufferMonths,
        monthlyExpenses: totalExpenses,
      }),
    [active, data.accounts, data.emergencyBufferMonths, surplus, totalExpenses]
  )

  const [autoAllocations, setAutoAllocations] = useState<GoalAllocation[] | null>(null)
  // A Recalculate result is dropped as soon as a goal is marked done / reopened.
  const displayAllocations = (autoAllocations ?? allocations).filter((a) => active.some((g) => g.id === a.id))

  /** Always operates on the stored goal from `data.goals` — only `completedAt` changes. */
  const handleMarkDone = (stored: Goal) => {
    updateGoal(markGoalDone(stored))
    setAutoAllocations(null)
    const name = stored.name || t('Goal', 'יעד', lang)
    toast.success(t(`'${name}' marked as done ✓`, `'${name}' סומן כהושלם ✓`, lang))
  }

  const handleReopen = (stored: Goal) => {
    updateGoal(reopenGoal(stored))
    setAutoAllocations(null)
    const name = stored.name || t('Goal', 'יעד', lang)
    toast.success(t(`'${name}' reopened`, `'${name}' נפתח מחדש`, lang))
  }

  // Move within the *visible* (active) order: skip over hidden done goals in the
  // stored array so Up / Down always swaps with the adjacent active goal.
  const handleMove = (id: string, direction: 'up' | 'down') => {
    const steps = moveStepsPastHidden(data.goals, id, direction)
    for (let i = 0; i < steps; i++) moveGoal(id, direction)
  }

  const handleRecalculate = () => {
    setAutoAllocations(autoAllocateSavings(allocations, Math.max(0, freeCashFlow)))
    setAiExplanation(null)
    setAiError(null)
    setShowAiCard(false)
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          {t('Monthly surplus for goals:', 'עודף חודשי ליעדים:', lang)}{' '}
          <Money
            value={surplus}
            currency={currency}
            locale={locale}
            tone={surplus < 0 ? 'negative' : 'neutral'}
            className="font-semibold text-foreground"
          />
        </p>
        {active.length > 0 && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('Add Goal', 'הוסף יעד', lang)}
          </Button>
        )}
      </div>

      {/* Emergency buffer — the Slider inherits RTL from DirectionProvider */}
      <Card>
        <CardContent className="space-y-1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <p id="emergency-buffer-label" className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />
              {t('Emergency Buffer', 'מרווח חירום', lang)}:{' '}
              <bdi className="num tabular-nums">{data.emergencyBufferMonths}</bdi> {t('months', 'חודשים', lang)}
            </p>
            <span className="text-xs text-muted-foreground">
              (<Money value={data.emergencyBufferMonths * totalExpenses} currency={currency} locale={locale} />)
            </span>
          </div>
          <Slider
            min={1}
            max={12}
            step={1}
            value={[data.emergencyBufferMonths]}
            onValueChange={([v]) => setData((d) => ({ ...d, emergencyBufferMonths: v }))}
            aria-labelledby="emergency-buffer-label"
          />
          <p className="text-xs text-muted-foreground">
            {t('Use arrow keys to adjust', 'השתמש במקשי החצים לכוונון', lang)}
          </p>
        </CardContent>
      </Card>

      {active.length > 0 && (
        <AllocationPlan
          allocations={displayAllocations}
          totalAllocated={totalAllocated}
          freeCashFlow={freeCashFlow}
          isOverBudget={isOverBudget}
          currency={currency}
          locale={locale}
          lang={lang}
          aiEnabled={aiEnabled}
          aiLoading={aiLoading}
          onExplain={handleExplainPlan}
          onRecalculate={handleRecalculate}
          showAiCard={showAiCard}
          aiExplanation={aiExplanation}
          aiError={aiError}
        />
      )}

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={
              done.length > 0
                ? t('No active goals', 'אין יעדים פעילים', lang)
                : t('No savings goals yet', 'אין יעדי חיסכון עדיין', lang)
            }
            description={t("Set a target and track when you'll reach it.", 'הגדר יעד ועקוב מתי תגיע אליו.', lang)}
            actionLabel={t('Add Goal', 'הוסף יעד', lang)}
            actionIcon={Plus}
            onAction={() => setAddOpen(true)}
          />
        </Card>
      ) : (
        displayAllocations.map((goal, idx) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            storedGoal={data.goals.find((g) => g.id === goal.id) ?? goal}
            isFirst={idx === 0}
            isLast={idx === displayAllocations.length - 1}
            accounts={data.accounts}
            currency={currency}
            locale={locale}
            lang={lang}
            onUpdate={updateGoal}
            onDelete={deleteGoal}
            onMove={handleMove}
            onFund={fundGoalFromSavings}
            onMarkDone={handleMarkDone}
          />
        ))
      )}

      <CompletedGoals
        goals={done}
        currency={currency}
        locale={locale}
        lang={lang}
        onReopen={handleReopen}
        onUpdate={updateGoal}
        onDelete={deleteGoal}
      />

      <GoalDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(g) => addGoal(g)}
        currency={currency}
        locale={locale}
        lang={lang}
      />
    </div>
  )
}
