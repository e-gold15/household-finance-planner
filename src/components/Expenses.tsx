import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, CalendarDays, LayoutList, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from './ui/button'
import { Money } from './ui/money'
import { ActionMenu } from './ui/action-menu'
import { EmptyState } from './ui/empty-state'
import { SegmentedControl } from './ui/segmented-control'
import { Card } from './ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { useFinance } from '@/context/FinanceContext'
import { useNav } from '@/context/NavContext'
import { EXPENSE_CATEGORIES as CATEGORIES } from '@/lib/categories'
import { t } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'
import { ExpenseDialog } from './expenses/ExpenseDialog'
import { ExpenseRow } from './expenses/ExpenseRow'
import { CategoryGroup } from './expenses/CategoryGroup'
import { DateView } from './expenses/DateView'
import { PastMonthView } from './expenses/PastMonthView'
import { MonthNavigator } from './expenses/MonthNavigator'
import { ExpensesSummary } from './expenses/ExpensesSummary'
import { isBeforeCurrentMonth, isFixedExpense, monthlyAmount } from './expenses/format'

type ViewMode = 'category' | 'date'

export function Expenses({ onNavigateToHistory }: { onNavigateToHistory?: () => void } = {}) {
  const { data, addExpense, clearVariableExpenses } = useFinance()
  const { openQuickAdd } = useNav()
  const lang = data.language
  const [comparing, setComparing] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<ExpenseCategory>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('category')

  // ── Month selector ────────────────────────────────────────────────────────
  // null = current budget plan; a snapshot id = viewing that past month
  const [viewingSnapshotId, setViewingSnapshotId] = useState<string | null>(null)

  // Completed-month snapshots, newest → oldest
  const pastSnapshots = useMemo(
    () =>
      data.history
        .filter((h) => isBeforeCurrentMonth(h.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data.history]
  )

  const viewingSnapshot = viewingSnapshotId ? (pastSnapshots.find((s) => s.id === viewingSnapshotId) ?? null) : null
  const currentIndex = viewingSnapshot ? pastSnapshots.findIndex((s) => s.id === viewingSnapshot.id) : -1

  const goOlder = () => {
    if (currentIndex === -1) {
      if (pastSnapshots.length > 0) setViewingSnapshotId(pastSnapshots[0].id)
    } else if (currentIndex < pastSnapshots.length - 1) {
      setViewingSnapshotId(pastSnapshots[currentIndex + 1].id)
    }
  }
  const goNewer = () => {
    if (currentIndex <= 0) setViewingSnapshotId(null)
    else setViewingSnapshotId(pastSnapshots[currentIndex - 1].id)
  }
  const canGoOlder = currentIndex === -1 ? pastSnapshots.length > 0 : currentIndex < pastSnapshots.length - 1
  const canGoNewer = currentIndex !== -1

  const toggleCategory = (cat: ExpenseCategory) =>
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  // ── Derived current-budget data ───────────────────────────────────────────
  const hasVariableExpenses = data.expenses.some((e) => !isFixedExpense(e))

  // Variable expenses created before this month — should have been cleared on rollover.
  const hasStaleVariables = useMemo(
    () => data.expenses.some((e) => !isFixedExpense(e) && !!e.createdAt && isBeforeCurrentMonth(e.createdAt)),
    [data.expenses]
  )

  // Stable current month value — avoids stale-capture if the tab is left open overnight
  const currentMonth = useMemo(() => new Date().getMonth() + 1, [])

  const grouped = useMemo(
    () =>
      CATEGORIES.reduce<Record<ExpenseCategory, Expense[]>>((acc, cat) => {
        acc[cat.value] = data.expenses.filter((e) => e.category === cat.value)
        return acc
      }, {} as Record<ExpenseCategory, Expense[]>),
    [data.expenses]
  )

  const { fixedTotal, variableTotal } = useMemo(() => {
    let fixed = 0
    let variable = 0
    for (const e of data.expenses) {
      // undefined expenseType counts as fixed; only an explicit 'variable' is variable
      if (e.expenseType === 'variable') variable += monthlyAmount(e)
      else fixed += monthlyAmount(e)
    }
    return { fixedTotal: fixed, variableTotal: variable }
  }, [data.expenses])
  const total = fixedTotal + variableTotal

  // Last snapshot from a PREVIOUS month — "Compare" always means "vs last month".
  const lastSnapshot = pastSnapshots[0] ?? null

  const dueThisMonth = useMemo(
    () => data.expenses.filter((e) => e.period === 'yearly' && e.dueMonth === currentMonth),
    [data.expenses, currentMonth]
  )

  const getDelta = (category: ExpenseCategory, currentTotal: number): number | null => {
    if (!comparing || !lastSnapshot?.categoryActuals) return null
    return currentTotal - (lastSnapshot.categoryActuals[category] ?? 0)
  }

  const hasExpenses = data.expenses.length > 0

  const addLabel = t('Add expense', 'הוספת הוצאה', lang)
  const desktopAddButton = (
    <ExpenseDialog
      onSave={(e) => addExpense(e)}
      lang={lang}
      trigger={
        <Button className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      }
    />
  )

  return (
    <div className="space-y-4">
      {/* ── Month selector ─────────────────────────────────────────────── */}
      {pastSnapshots.length > 0 && (
        <MonthNavigator
          label={viewingSnapshot ? viewingSnapshot.label : t('Current budget', 'תקציב נוכחי', lang)}
          canGoOlder={canGoOlder}
          canGoNewer={canGoNewer}
          onOlder={goOlder}
          onNewer={goNewer}
          onCurrent={viewingSnapshot ? () => setViewingSnapshotId(null) : undefined}
          lang={lang}
        />
      )}

      {viewingSnapshot ? (
        <PastMonthView snapshot={viewingSnapshot} lang={lang} onGoToHistory={onNavigateToHistory} />
      ) : !hasExpenses ? (
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title={t('No expenses yet', 'אין הוצאות עדיין', lang)}
            description={t(
              'Add rent, groceries and bills to see where your money goes each month.',
              'הוסיפו שכר דירה, קניות וחשבונות כדי לראות לאן הולך הכסף בכל חודש.',
              lang
            )}
            actionLabel={addLabel}
            actionIcon={Plus}
            onAction={openQuickAdd}
          />
        </Card>
      ) : (
        <>
          <ExpensesSummary total={total} fixedTotal={fixedTotal} variableTotal={variableTotal} lang={lang} />

          {/* ── Stale variable expenses banner ─────────────────────────── */}
          {hasStaleVariables && (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-subtle px-4 py-3 sm:flex-row sm:items-start"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("These are last month's variable expenses", 'אלו הוצאות משתנות מהחודש שעבר', lang)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(
                      "A new month started but variable expenses weren't cleared automatically. Clear them to start fresh.",
                      'החודש החדש התחיל אך ההוצאות המשתנות לא נמחקו אוטומטית. נקו אותן כדי להתחיל מחדש.',
                      lang
                    )}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 self-end border-warning/40 text-warning-strong hover:bg-warning/10 sm:self-start"
                onClick={() => setClearConfirmOpen(true)}
              >
                {t('Clear now', 'נקה עכשיו', lang)}
              </Button>
            </div>
          )}

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<ViewMode>
              fullWidth={false}
              aria-label={t('View', 'תצוגה', lang)}
              value={viewMode}
              onValueChange={(v) => {
                setViewMode(v)
                if (v === 'date') setComparing(false)
              }}
              options={[
                { value: 'category', label: t('Category', 'קטגוריה', lang), icon: LayoutList },
                { value: 'date', label: t('By date', 'לפי תאריך', lang), icon: CalendarDays },
              ]}
            />

            {viewMode === 'category' && lastSnapshot && (
              <Button
                variant={comparing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setComparing((v) => !v)}
                aria-pressed={comparing}
                title={t('Compare to last month', 'השוואה לחודש הקודם', lang)}
                aria-label={t('Compare to last month', 'השוואה לחודש הקודם', lang)}
                className="w-11 px-0 sm:w-auto sm:px-3"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('Compare', 'השווה', lang)}</span>
              </Button>
            )}

            <div className="ms-auto flex items-center gap-2">
              {desktopAddButton}
              {hasVariableExpenses && (
                <ActionMenu
                  label={t('More expense actions', 'פעולות נוספות', lang)}
                  items={[
                    {
                      key: 'clear-variable',
                      label: t('Clear variable expenses', 'ניקוי הוצאות משתנות', lang),
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => setClearConfirmOpen(true),
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {comparing && lastSnapshot && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t(`Comparing to: ${lastSnapshot.label}`, `משווה ל: ${lastSnapshot.label}`, lang)}
            </p>
          )}

          {/* Annual bills due this month */}
          {dueThisMonth.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-subtle px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-warning-strong">
                  {t('Annual bills due this month:', 'חיובים שנתיים לתשלום החודש:', lang)}
                </p>
                <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-foreground">
                  {dueThisMonth.map((e) => (
                    <li key={e.id}>
                      <bdi>{e.name}</bdi> (<Money value={e.amount} currency={data.currency} locale={data.locale} />)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Lists ───────────────────────────────────────────────────── */}
          {viewMode === 'date' ? (
            <DateView expenses={data.expenses} lang={lang} />
          ) : (
            CATEGORIES.filter((cat) => grouped[cat.value].length > 0).map((cat) => {
              const catExpenses = grouped[cat.value]
              const catTotal = catExpenses.reduce((s, e) => s + monthlyAmount(e), 0)
              const expanded = expandedCategories.has(cat.value)
              return (
                <CategoryGroup
                  key={cat.value}
                  category={cat.value}
                  label={t(cat.en, cat.he, lang)}
                  total={catTotal}
                  itemCount={catExpenses.length}
                  budget={data.categoryBudgets[cat.value]}
                  delta={getDelta(cat.value, catTotal)}
                  editableBudget
                  expanded={expanded}
                  onToggle={() => toggleCategory(cat.value)}
                  lang={lang}
                >
                  <ul className="divide-y">
                    {catExpenses.map((expense) => (
                      <ExpenseRow key={expense.id} expense={expense} lang={lang} />
                    ))}
                  </ul>
                </CategoryGroup>
              )
            })
          )}
        </>
      )}

      {/* Clear variable expenses confirmation (kept from v2.x — P1-3) */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Clear all variable expenses?', 'לנקות את כל ההוצאות המשתנות?', lang)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This removes all variable expenses from your budget. Fixed expenses are kept.',
                'פעולה זו מסירה את כל ההוצאות המשתנות מהתקציב. הוצאות קבועות נשמרות.',
                lang
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                clearVariableExpenses()
                setClearConfirmOpen(false)
              }}
            >
              {t('Clear', 'נקה', lang)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
