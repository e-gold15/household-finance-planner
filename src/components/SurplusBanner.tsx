/**
 * Surplus allocation — v3.1 logic, v4.0 presentation.
 *
 * The previous calendar month's snapshot may carry a positive REMAINING
 * surplus (freeCashFlow − surplusAllocated). The user can allocate a PARTIAL
 * amount each time:
 *
 *   • Allocate to Goal    — increments goal.currentAmount
 *   • Deposit to Savings  — increments account.balance
 *   • "Maybe later"       — session-only dismiss (no persistent change)
 *   • "Don't ask again"   — marks surplusActioned=true permanently
 *
 * v4.0: Home shows this as an insight card and opens `SurplusAllocationSheet`.
 * The legacy `SurplusBanner` is kept (same behaviour) and built from the same
 * pieces. The detection rule lives in `findActionableSurplus` (src/lib/insights).
 */

import { useState } from 'react'
import { ArrowLeft, AlertTriangle, ChevronRight, PiggyBank, Sparkles, Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { MoneyInput } from './ui/money-input'
import { Money } from './ui/money'
import { DirIcon } from './ui/dir-icon'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, t } from '@/lib/utils'
import { parseMoneyInput } from '@/lib/moneyInput'
import { findActionableSurplus, remainingSurplus } from '@/lib/insights'
import type { MonthSnapshot } from '@/types'

export { findActionableSurplus }

type ActionMode = 'goal' | 'account'

// ─── Shared allocation form (select destination + amount + confirm) ──────────

interface AllocationFormProps {
  snapshot: MonthSnapshot
  mode: ActionMode
  onCancel: () => void
  onDone: () => void
}

function SurplusAllocationForm({ snapshot, mode, onCancel, onDone }: AllocationFormProps) {
  const { data, updateGoal, updateAccount, recordSurplusAllocation } = useFinance()
  const lang = data.language

  const totalSurplus = snapshot.freeCashFlow
  const alreadyAllocated = snapshot.surplusAllocated ?? 0
  const remaining = remainingSurplus(snapshot)

  const [selectedId, setSelectedId] = useState('')
  const [amount, setAmount] = useState(() => String(Math.round(remaining)))

  const parsed = parseMoneyInput(amount)
  const parsedAmount = parsed ?? NaN
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= remaining

  function handleConfirm() {
    if (!isValidAmount || !selectedId) return
    const afterThis = remaining - parsedAmount

    if (mode === 'goal') {
      const goal = data.goals.find((g) => g.id === selectedId)
      if (!goal) return
      updateGoal({ ...goal, currentAmount: goal.currentAmount + parsedAmount })
      recordSurplusAllocation(snapshot.id, {
        amount: parsedAmount, type: 'goal',
        destinationId: selectedId, destinationName: goal.name,
      })
      toast.success(
        afterThis > 0
          ? t(
              `${formatCurrency(parsedAmount, data.currency, data.locale)} added to "${goal.name}" ✓  ·  ${formatCurrency(afterThis, data.currency, data.locale)} remaining`,
              `${formatCurrency(parsedAmount, data.currency, data.locale)} נוסף ל-"${goal.name}" ✓  ·  נותר ${formatCurrency(afterThis, data.currency, data.locale)}`,
              lang
            )
          : t(
              `${formatCurrency(parsedAmount, data.currency, data.locale)} added to "${goal.name}" ✓  ·  Surplus fully allocated!`,
              `${formatCurrency(parsedAmount, data.currency, data.locale)} נוסף ל-"${goal.name}" ✓  ·  העודף חולק במלואו!`,
              lang
            )
      )
    } else {
      const account = data.accounts.find((a) => a.id === selectedId)
      if (!account) return
      updateAccount({ ...account, balance: account.balance + parsedAmount })
      recordSurplusAllocation(snapshot.id, {
        amount: parsedAmount, type: 'savings',
        destinationId: selectedId, destinationName: account.name,
      })
      toast.success(
        afterThis > 0
          ? t(
              `${formatCurrency(parsedAmount, data.currency, data.locale)} deposited into "${account.name}" ✓  ·  ${formatCurrency(afterThis, data.currency, data.locale)} remaining`,
              `${formatCurrency(parsedAmount, data.currency, data.locale)} הופקד ב-"${account.name}" ✓  ·  נותר ${formatCurrency(afterThis, data.currency, data.locale)}`,
              lang
            )
          : t(
              `${formatCurrency(parsedAmount, data.currency, data.locale)} deposited into "${account.name}" ✓  ·  Surplus fully allocated!`,
              `${formatCurrency(parsedAmount, data.currency, data.locale)} הופקד ב-"${account.name}" ✓  ·  העודף חולק במלואו!`,
              lang
            )
      )
    }

    onDone()
  }

  const selectId = `surplus-dest-${mode}`
  const amountId = `surplus-amount-${mode}`

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor={selectId}>
            {mode === 'goal' ? t('Choose a goal', 'בחר יעד', lang) : t('Choose an account', 'בחר חשבון', lang)}
          </Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger id={selectId}>
              <SelectValue
                placeholder={mode === 'goal' ? t('Select goal…', 'בחר יעד...', lang) : t('Select account…', 'בחר חשבון...', lang)}
              />
            </SelectTrigger>
            <SelectContent>
              {mode === 'goal'
                ? data.goals.map((g) => {
                    const pct = g.targetAmount > 0
                      ? Math.min(100, (g.currentAmount / g.targetAmount) * 100).toFixed(0)
                      : '0'
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · {pct}%
                      </SelectItem>
                    )
                  })
                : data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatCurrency(a.balance, data.currency, data.locale)}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={amountId}>{t('Amount', 'סכום', lang)}</Label>
          <MoneyInput
            id={amountId}
            value={amount}
            onValueChange={(v) => setAmount(v)}
            currency={data.currency}
            locale={data.locale}
            placeholder={t('Amount', 'סכום', lang)}
            aria-invalid={parsed !== null && parsed > remaining}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t('Remaining surplus:', 'עודף שנותר:', lang)}</span>
            <Money value={remaining} currency={data.currency} locale={data.locale} className="font-semibold text-foreground" />
          </div>
          {alreadyAllocated > 0 && (
            <div className="space-y-1">
              <Progress value={Math.min(100, (alreadyAllocated / totalSurplus) * 100)} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                <Money value={alreadyAllocated} currency={data.currency} locale={data.locale} />{' '}
                {t('already allocated of', 'כבר חולק מתוך', lang)}{' '}
                <Money value={totalSurplus} currency={data.currency} locale={data.locale} />
              </p>
            </div>
          )}
          {parsed !== null && parsed > remaining && (
            <p className="mt-1 flex items-center gap-1 text-xs text-danger-strong" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('Amount exceeds remaining surplus.', 'הסכום עולה על העודף שנותר.', lang)}
            </p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>{t('Cancel', 'ביטול', lang)}</Button>
        <Button onClick={handleConfirm} disabled={!selectedId || !isValidAmount}>
          {t('Confirm', 'אישור', lang)}
        </Button>
      </DialogFooter>
    </>
  )
}

/** "Don't ask again" — permanent dismiss (unchanged v3.0 behaviour). */
function useDontAskAgain() {
  const { data, markSurplusActioned } = useFinance()
  const lang = data.language
  return (snapshotId: string) => {
    markSurplusActioned(snapshotId)
    toast(t("Won't ask again", 'לא ישאל שוב', lang), {
      description: t(
        "You won't be asked about this surplus again.",
        'לא תישאל שוב על עודף זה.',
        lang
      ),
      duration: 5000,
    })
  }
}

// ─── Sheet: the full allocation flow, opened from the Home insight card ──────

export interface SurplusAllocationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The actionable snapshot (from findActionableSurplus). Null closes the sheet. */
  snapshot: MonthSnapshot | null
}

export function SurplusAllocationSheet({ open, onOpenChange, snapshot }: SurplusAllocationSheetProps) {
  const { data } = useFinance()
  const lang = data.language
  const dontAskAgain = useDontAskAgain()
  const [step, setStep] = useState<'choose' | ActionMode>('choose')

  const close = () => {
    onOpenChange(false)
    setStep('choose')
  }

  const hasGoals = data.goals.length > 0
  const hasAccounts = data.accounts.length > 0
  const isOpen = open && snapshot !== null

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {snapshot && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'goal'
                ? t('Add surplus to a Goal', 'הוסף עודף ליעד', lang)
                : step === 'account'
                  ? t('Deposit to a Savings Account', 'הפקד לחיסכון', lang)
                  : t('Put last month’s surplus to work', 'מה לעשות עם העודף מהחודש שעבר?', lang)}
            </DialogTitle>
            <DialogDescription>
              <bdi>{snapshot.label}</bdi>
              {' · '}
              {t('Remaining', 'נותר', lang)}{' '}
              <Money value={remainingSurplus(snapshot)} currency={data.currency} locale={data.locale} className="font-semibold text-foreground" />
            </DialogDescription>
          </DialogHeader>

          {step === 'choose' ? (
            <>
              <div className="space-y-2">
                {hasGoals && (
                  <button
                    type="button"
                    onClick={() => setStep('goal')}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-strong">
                      <Target className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t('Add to Goal', 'הוסף ליעד', lang)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t('Increase a goal’s saved amount', 'הגדל את הסכום שנחסך ליעד', lang)}
                      </span>
                    </span>
                    <DirIcon icon={ChevronRight} className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {hasAccounts && (
                  <button
                    type="button"
                    onClick={() => setStep('account')}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-strong">
                      <PiggyBank className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t('Add to Savings', 'הוסף לחיסכון', lang)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t('Deposit into a savings account', 'הפקדה לחשבון חיסכון', lang)}
                      </span>
                    </span>
                    <DirIcon icon={ChevronRight} className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    dontAskAgain(snapshot.id)
                    close()
                  }}
                >
                  {t("Don't ask again", 'אל תשאל שוב', lang)}
                </Button>
                <Button variant="outline" onClick={close}>{t('Maybe later', 'אולי אחר כך', lang)}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="-mt-2 justify-self-start" onClick={() => setStep('choose')}>
                <DirIcon icon={ArrowLeft} className="h-4 w-4" />
                {t('Back', 'חזרה', lang)}
              </Button>
              <SurplusAllocationForm key={step} snapshot={snapshot} mode={step} onCancel={close} onDone={close} />
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  )
}

// ─── Legacy banner (v3.x layout; no longer rendered by Home) ─────────────────

export function SurplusBanner() {
  const { data } = useFinance()
  const lang = data.language
  const dontAskAgain = useDontAskAgain()

  const [dismissed, setDismissed] = useState(false)
  const [mode, setMode] = useState<ActionMode | null>(null)

  const snapshot = findActionableSurplus(data.history, new Date())
  if (!snapshot || dismissed) return null

  const alreadyAllocated = snapshot.surplusAllocated ?? 0
  const remaining = remainingSurplus(snapshot)

  const hasGoals    = data.goals.length > 0
  const hasAccounts = data.accounts.length > 0
  if (!hasGoals && !hasAccounts) return null

  const closeDialog = () => setMode(null)

  return (
    <>
      <div className="rounded-xl border border-primary/30 bg-primary-subtle px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-lg bg-primary/15 p-2 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary-strong" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {/* <div>, not <p>: Badge renders a <div> (validateDOMNesting) */}
            <div className="text-sm font-semibold text-foreground">
              {t('You had a surplus last month', 'היה לך עודף בחודש שעבר', lang)}
              {' '}
              <Badge variant="success" className="ms-1">
                <Money value={remaining} currency={data.currency} locale={data.locale} showSign />
              </Badge>
              {alreadyAllocated > 0 && (
                <span className="text-xs text-muted-foreground font-normal ms-2">
                  {t('remaining', 'נותר', lang)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {snapshot.label}
              {alreadyAllocated > 0 && (
                <> · <Money value={alreadyAllocated} currency={data.currency} locale={data.locale} /> {t('already allocated', 'כבר חולק', lang)}</>
              )}
              {alreadyAllocated === 0 && (
                <> · {t('Put it to work?', 'מה לעשות איתו?', lang)}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {hasGoals && (
            <Button size="sm" variant="default" className="gap-1" onClick={() => setMode('goal')}>
              <DirIcon icon={ChevronRight} className="h-3.5 w-3.5" />
              {t('Add to Goal', 'הוסף ליעד', lang)}
            </Button>
          )}
          {hasAccounts && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setMode('account')}>
              <DirIcon icon={ChevronRight} className="h-3.5 w-3.5" />
              {t('Add to Savings', 'הוסף לחיסכון', lang)}
            </Button>
          )}
          <Button
            size="sm" variant="ghost"
            className="text-muted-foreground text-xs"
            onClick={() => dontAskAgain(snapshot.id)}
          >
            {t("Don't ask again", 'אל תשאל שוב', lang)}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t('Maybe later', 'אולי אחר כך', lang)}
            aria-label={t('Dismiss', 'סגור', lang)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && closeDialog()}>
        {mode && (
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {mode === 'goal'
                  ? t('Add surplus to a Goal', 'הוסף עודף ליעד', lang)
                  : t('Deposit to a Savings Account', 'הפקד לחיסכון', lang)}
              </DialogTitle>
            </DialogHeader>
            <SurplusAllocationForm key={mode} snapshot={snapshot} mode={mode} onCancel={closeDialog} onDone={closeDialog} />
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
