/**
 * Home (Overview) — v4.0 (PRD §2.E).
 *
 * One headline number ("Left to spend this month"), up to 3 insight cards,
 * a compact KPI row, upcoming yearly bills, the expense donut, and a
 * collapsible "More charts" section that keeps every v2.9–v3.3 chart
 * (budget health, goals, savings forecast, liquidity, AI briefing).
 *
 * All numbers are derived by pure functions in src/lib/insights.ts.
 */
import { useMemo, useRef, useState } from 'react'
import { useFinance } from '@/context/FinanceContext'
import { useNav } from '@/context/NavContext'
import { allocateGoals } from '@/lib/savingsEngine'
import { activeGoals } from '@/lib/goals'
import { aiEnabled } from '@/lib/aiAdvisor'
import type { BriefingPayload } from '@/lib/aiAdvisor'
import {
  buildExpenseDonut,
  buildInsights,
  computeBudgetHealth,
  computeLegacyTotals,
  computeMomTrend,
  computeMonthlyPlan,
  computeSavingsProjection,
  findActionableSurplus,
  getOnboardingState,
  getUpcomingBills,
} from '@/lib/insights'
import type { ExpenseCategory } from '@/types'
import { SurplusAllocationSheet } from './SurplusBanner'
import { HeroCard, HeroSkeleton } from './home/HeroCard'
import { InsightCards } from './home/InsightCards'
import { OnboardingChecklist } from './home/OnboardingChecklist'
import { KpiRow } from './home/KpiRow'
import { UpcomingBills } from './home/UpcomingBills'
import { ExpenseDonut } from './home/ExpenseDonut'
import { MonthlyBriefingCard } from './home/MonthlyBriefingCard'
import { BudgetHealthCard, GoalsCard, MoreCharts, SavingsForecastCard, SavingsLiquidityCard } from './home/MoreCharts'

function isWideViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 768px)').matches
    : true
}

export function Overview() {
  const { data, isLoading, saveBriefing } = useFinance()
  const { navigate, openQuickAdd } = useNav()
  const lang = data.language
  const { currency, locale } = data

  // `today` is captured once per mount — Home is recomputed on every visit.
  const [today] = useState(() => new Date())
  const [moreOpen, setMoreOpen] = useState(isWideViewport)
  const [surplusOpen, setSurplusOpen] = useState(false)
  const briefingRef = useRef<HTMLDivElement>(null)

  // ── Derived numbers ──────────────────────────────────────────────────────
  const plan = useMemo(() => computeMonthlyPlan(data, today), [data, today])
  // Same evaluation order as the v2.x KPIs (plan.leftToSpend === legacy.freeCashFlow
  // unless this month's actual income is set — v4.2).
  const legacy = useMemo(() => computeLegacyTotals(data), [data])
  const totalExpenses = legacy.totalExpenses
  const totalAssets = useMemo(() => data.accounts.reduce((s, a) => s + a.balance, 0), [data.accounts])
  // All money flowing into savings each month (forecast display — not FCF).
  const totalSavingsFlow = useMemo(() => data.accounts.reduce((s, a) => s + a.monthlyContribution, 0), [data.accounts])

  const momTrend = useMemo(() => computeMomTrend(data.history), [data.history])
  const budgetHealth = useMemo(() => computeBudgetHealth(data), [data])
  const upcomingBills = useMemo(() => getUpcomingBills(data.expenses, today), [data.expenses, today])
  const donut = useMemo(() => buildExpenseDonut(data.expenses), [data.expenses])
  const projection = useMemo(() => computeSavingsProjection(data.accounts), [data.accounts])
  const onboarding = useMemo(() => getOnboardingState(data, plan.plannedIncome), [data, plan.plannedIncome])
  const surplusSnapshot = useMemo(() => findActionableSurplus(data.history, today), [data.history, today])

  // v4.1 — done goals are excluded from the Home goal donut, top-priority list and briefing.
  const goalAllocations = useMemo(() => {
    const goals = activeGoals(data.goals)
    if (goals.length === 0) return []
    // v4.2 — goals plan on the planned income, never on this month's actuals.
    return allocateGoals({
      goals,
      monthlySurplus: legacy.freeCashFlow,
      accounts: data.accounts,
      emergencyBufferMonths: data.emergencyBufferMonths,
      monthlyExpenses: totalExpenses,
    })
  }, [data.goals, legacy.freeCashFlow, data.accounts, data.emergencyBufferMonths, totalExpenses])

  // ── v3.3 Monthly briefing (unchanged payload) ────────────────────────────
  const currentSnapshot = useMemo(() => data.history.find((h) => h.autoSnapshot === true), [data.history])
  const pastSnapshots = useMemo(() => data.history.filter((h) => !h.autoSnapshot), [data.history])
  const fcfAvg3m = useMemo(() => {
    const last3 = pastSnapshots.slice(-3)
    if (last3.length === 0) return 0
    return last3.reduce((s, h) => s + h.freeCashFlow, 0) / last3.length
  }, [pastSnapshots])

  const briefingPayload = useMemo<BriefingPayload | null>(() => {
    if (!currentSnapshot) return null
    const budgetOverruns = Object.entries(data.categoryBudgets)
      .filter(([cat, budget]) =>
        budget !== undefined && (currentSnapshot.categoryActuals?.[cat as ExpenseCategory] ?? 0) > (budget as number)
      )
      .map(([cat, budget]) => ({
        category: cat,
        budget: budget as number,
        actual: currentSnapshot.categoryActuals?.[cat as ExpenseCategory] ?? 0,
      }))
    return {
      month: new Date().toLocaleDateString(data.locale, { month: 'long', year: 'numeric' }),
      fcf: currentSnapshot.freeCashFlow,
      fcfAvg3m,
      incomeTotal: currentSnapshot.totalIncome,
      expensesTotal: currentSnapshot.totalExpenses,
      budgetOverruns,
      savingsGrowthTotal: data.accounts.reduce((s, a) => s + a.monthlyContribution, 0),
      goalsSummary: goalAllocations.map((g) => ({
        name: g.name,
        status: g.status,
        pctComplete: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
      })),
      upcomingBills: upcomingBills.map((b) => ({
        name: b.expense.name,
        amount: b.expense.amount,
        daysUntilDue: b.daysUntil,
      })),
      surplusActioned: currentSnapshot.surplusActioned ?? false,
      emergencyBufferMonths: data.emergencyBufferMonths,
      currency: data.currency,
    }
  }, [currentSnapshot, data.locale, data.categoryBudgets, data.accounts, data.emergencyBufferMonths, data.currency, fcfAvg3m, goalAllocations, upcomingBills])

  const showBriefingCard = aiEnabled && !!currentSnapshot && !!briefingPayload

  // ── Insights (briefing card only if it can be opened below) ──────────────
  const insights = useMemo(
    () =>
      buildInsights(data, plan, today).filter(
        (i) => i.id !== 'briefing' || (showBriefingCard && i.snapshotId === currentSnapshot?.id)
      ),
    [data, plan, today, showBriefingCard, currentSnapshot]
  )

  function openBriefing() {
    setMoreOpen(true)
    // Wait for the section to render, then bring the briefing into view.
    window.setTimeout(() => {
      briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      briefingRef.current?.focus({ preventScroll: true })
    }, 50)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 1 — Hero / onboarding */}
      {isLoading ? (
        <HeroSkeleton />
      ) : onboarding.show ? (
        <OnboardingChecklist
          state={onboarding}
          lang={lang}
          onAddIncome={() => navigate('income')}
          onAddExpense={openQuickAdd}
          onAddGoal={() => navigate('goals')}
        />
      ) : (
        <HeroCard plan={plan} currency={currency} locale={locale} lang={lang} onAddIncome={() => navigate('income')} />
      )}

      {/* 2 — Insight cards (≤ 3). Surplus + deficit banners are folded in here. */}
      <InsightCards
        insights={insights}
        lang={lang}
        currency={currency}
        locale={locale}
        onNavigateExpenses={() => navigate('expenses')}
        onAllocateSurplus={() => setSurplusOpen(true)}
        onReadBriefing={openBriefing}
      />
      <SurplusAllocationSheet open={surplusOpen} onOpenChange={setSurplusOpen} snapshot={surplusSnapshot} />

      {/* 3 — Compact KPI row */}
      <KpiRow
        income={plan.income}
        expenses={totalExpenses}
        assets={totalAssets}
        incomeTrend={momTrend?.incomePct != null ? { pct: momTrend.incomePct, positiveIsGood: true } : undefined}
        expensesTrend={momTrend?.expensesPct != null ? { pct: momTrend.expensesPct, positiveIsGood: false } : undefined}
        currency={currency}
        locale={locale}
        lang={lang}
        onIncome={() => navigate('income')}
        onExpenses={() => navigate('expenses')}
        onAssets={() => navigate('savings')}
      />

      {/* 4 — Upcoming yearly bills + expense donut */}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <UpcomingBills bills={upcomingBills} currency={currency} locale={locale} lang={lang} />
        <div className={upcomingBills.length === 0 ? 'md:col-span-2' : undefined}>
          <ExpenseDonut donut={donut} currency={currency} locale={locale} lang={lang} onAddExpense={openQuickAdd} />
        </div>
      </div>

      {/* 5 — More charts */}
      <MoreCharts open={moreOpen} onOpenChange={setMoreOpen} lang={lang}>
        {showBriefingCard && currentSnapshot && briefingPayload && (
          <div ref={briefingRef} tabIndex={-1} className="scroll-mt-24 outline-none md:col-span-2">
            <MonthlyBriefingCard
              lang={lang}
              payload={briefingPayload}
              cached={currentSnapshot.aiBriefing}
              hasEnoughHistory={pastSnapshots.length >= 2}
              onSave={(result) => saveBriefing(currentSnapshot.id, result)}
            />
          </div>
        )}
        {(() => {
          // Half-width cards; when their count is odd the last one spans both columns.
          const half = [
            budgetHealth && <BudgetHealthCard key="budget" health={budgetHealth} lang={lang} />,
            goalAllocations.length > 0 && (
              <GoalsCard key="goals" allocations={goalAllocations} currency={currency} locale={locale} lang={lang} />
            ),
            totalAssets > 0 && (
              <SavingsLiquidityCard key="liquidity" accounts={data.accounts} currency={currency} locale={locale} lang={lang} />
            ),
          ].filter(Boolean)
          return half.map((card, idx) => (
            <div key={idx} className={half.length % 2 === 1 && idx === half.length - 1 ? 'md:col-span-2' : undefined}>
              {card}
            </div>
          ))
        })()}
        {projection && (
          <SavingsForecastCard
            projection={projection}
            totalAssets={totalAssets}
            totalSavingsFlow={totalSavingsFlow}
            currency={currency}
            locale={locale}
            lang={lang}
          />
        )}
      </MoreCharts>
    </div>
  )
}
