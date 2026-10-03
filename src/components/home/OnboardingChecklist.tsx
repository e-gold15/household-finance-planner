import { CheckCircle2, ChevronRight, Circle, Rocket } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DirIcon } from '@/components/ui/dir-icon'
import { cn, t } from '@/lib/utils'
import type { OnboardingState } from '@/lib/insights'

interface OnboardingChecklistProps {
  state: OnboardingState
  lang: 'en' | 'he'
  onAddIncome: () => void
  onAddExpense: () => void
  onAddGoal: () => void
}

/** First-run checklist that replaces the hero. Done states are derived from data. */
export function OnboardingChecklist({ state, lang, onAddIncome, onAddExpense, onAddGoal }: OnboardingChecklistProps) {
  const steps = [
    {
      key: 'income',
      done: state.hasIncome,
      title: t('Add your income', 'הוסיפו הכנסה', lang),
      hint: t('Salary, freelance or any other source', 'משכורת, עצמאי או כל מקור אחר', lang),
      onClick: onAddIncome,
    },
    {
      key: 'expense',
      done: state.hasExpense,
      title: t('Add an expense', 'הוסיפו הוצאה', lang),
      hint: t('Rent, groceries, subscriptions…', 'שכירות, סופר, מנויים…', lang),
      onClick: onAddExpense,
    },
    {
      key: 'goal',
      done: state.hasGoal,
      title: t('Set a goal', 'הגדירו יעד', lang),
      hint: t('An emergency fund, a trip, a new car', 'קרן חירום, טיול, רכב חדש', lang),
      onClick: onAddGoal,
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary-strong">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-lg">{t('Let’s get you set up', 'בואו נתחיל', lang)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t(`${doneCount} of 3 done`, `${doneCount} מתוך 3 הושלמו`, lang)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="space-y-1">
          {steps.map((s, idx) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={s.onClick}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.done ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-success-strong" aria-hidden="true" />
                ) : (
                  <Circle className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', s.done && 'text-muted-foreground line-through')}>
                    {idx + 1}. {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.done ? t('Done', 'הושלם', lang) : s.hint}
                  </span>
                </span>
                <DirIcon icon={ChevronRight} className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
