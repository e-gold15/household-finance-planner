import { useState, useMemo } from 'react'
import { Plus, ShieldCheck, Target } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Money } from './ui/money'
import { Slider } from './ui/slider'
import { EmptyState } from './ui/empty-state'
import { useFinance } from '@/context/FinanceContext'
import { allocateGoals, autoAllocateSavings } from '@/lib/savingsEngine'
import { getNetMonthly } from '@/lib/taxEstimation'
import { t } from '@/lib/utils'
import { explainGoalPlan, aiEnabled } from '@/lib/aiAdvisor'
import type { GoalAllocation } from '@/types'
import { GoalDialog } from './goals/GoalDialog'
import { GoalCard } from './goals/GoalCard'
import { AllocationPlan } from './goals/AllocationPlan'

export function Goals() {
  const { data, addGoal, updateGoal, deleteGoal, moveGoal, setData, fundGoalFromSavings } = useFinance()
  const lang = data.language
  const { currency, locale } = data

  const [addOpen, setAddOpen] = useState(false)
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
        {data.goals.length > 0 && (
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

      {data.goals.length > 0 && (
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

      {data.goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={t('No savings goals yet', 'אין יעדי חיסכון עדיין', lang)}
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
            onMove={moveGoal}
            onFund={fundGoalFromSavings}
          />
        ))
      )}

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
