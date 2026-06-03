/**
 * SurplusBanner — v3.1
 *
 * Appears on the Overview tab when the previous calendar month's snapshot has
 * a positive REMAINING surplus (freeCashFlow − surplusAllocated).
 *
 * The user can allocate a PARTIAL amount each time. The banner reappears on
 * every app open until the remaining balance reaches 0 or "Don't ask again" is clicked.
 *
 *   • Allocate to Goal    — increments goal.currentAmount
 *   • Deposit to Savings  — increments account.balance
 *   • "Maybe later"       — session-only dismiss (no persistent change)
 *   • "Don't ask again"   — marks surplusActioned=true permanently
 */

import { useState, useMemo } from 'react'
import { Sparkles, X, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useFinance } from '@/context/FinanceContext'
import { formatCurrency, t } from '@/lib/utils'
import type { MonthSnapshot } from '@/types'

type ActionMode = 'goal' | 'account'

export function SurplusBanner() {
  const { data, updateGoal, updateAccount, markSurplusActioned, recordSurplusAllocation } = useFinance()
  const lang = data.language

  const [dismissed, setDismissed] = useState(false)
  const [mode, setMode] = useState<ActionMode | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [amount, setAmount] = useState('')

  // ── Find actionable snapshot ─────────────────────────────────────────────
  const snapshot: MonthSnapshot | null = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear  = today.getFullYear()

    const candidates = data.history.filter((h) => {
      if (h.totalIncome === 0) return false          // stub
      if (h.surplusActioned)  return false           // permanently dismissed
      const remaining = h.freeCashFlow - (h.surplusAllocated ?? 0)
      if (remaining <= 0) return false               // fully allocated
      const d = new Date(h.date)
      return d.getFullYear() < currentYear ||
        (d.getFullYear() === currentYear && d.getMonth() < currentMonth)
    })

    return candidates.length > 0 ? candidates[candidates.length - 1] : null
  }, [data.history])

  if (!snapshot || dismissed) return null

  // Remaining = total FCF minus what's already been allocated
  const totalSurplus = snapshot.freeCashFlow
  const alreadyAllocated = snapshot.surplusAllocated ?? 0
  const remaining = totalSurplus - alreadyAllocated

  const hasGoals    = data.goals.length > 0
  const hasAccounts = data.accounts.length > 0
  if (!hasGoals && !hasAccounts) return null

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openDialog(m: ActionMode) {
    setMode(m)
    setSelectedId('')
    setAmount(String(Math.round(remaining)))
  }

  function closeDialog() {
    setMode(null)
    setSelectedId('')
    setAmount('')
  }

  const parsedAmount = parseFloat(amount)
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= remaining

  function handleConfirm() {
    if (!isValidAmount || !selectedId) return
    const afterThis = remaining - parsedAmount

    if (mode === 'goal') {
      const goal = data.goals.find((g) => g.id === selectedId)
      if (!goal) return
      updateGoal({ ...goal, currentAmount: goal.currentAmount + parsedAmount })
      recordSurplusAllocation(snapshot!.id, {
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
      recordSurplusAllocation(snapshot!.id, {
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

    closeDialog()
  }

  // ── Shared amount field (inlined — never define components inside render) ──
  const amountFields = (
    <div className="space-y-1.5">
      <Label>{t('Amount', 'סכום', lang)}</Label>
      <Input
        type="number"
        min={0}
        step={100}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={t('Amount', 'סכום', lang)}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('Remaining surplus:', 'עודף שנותר:', lang)}</span>
        <span className="font-semibold text-primary">
          {formatCurrency(remaining, data.currency, data.locale)}
        </span>
      </div>
      {alreadyAllocated > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, (alreadyAllocated / totalSurplus) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(alreadyAllocated, data.currency, data.locale)}{' '}
            {t('already allocated of', 'כבר חולק מתוך', lang)}{' '}
            {formatCurrency(totalSurplus, data.currency, data.locale)}
          </p>
        </div>
      )}
      {!isNaN(parsedAmount) && parsedAmount > remaining && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3 w-3" />
          {t('Amount exceeds remaining surplus.', 'הסכום עולה על העודף שנותר.', lang)}
        </p>
      )}
    </div>
  )

  // ── Banner ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-lg bg-primary/15 p-2 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('You had a surplus last month', 'היה לך עודף בחודש שעבר', lang)}
              {' '}
              <Badge variant="success" className="ms-1">
                +{formatCurrency(remaining, data.currency, data.locale)}
              </Badge>
              {alreadyAllocated > 0 && (
                <span className="text-xs text-muted-foreground font-normal ms-2">
                  {t('remaining', 'נותר', lang)}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {snapshot.label}
              {alreadyAllocated > 0 && (
                <> · {formatCurrency(alreadyAllocated, data.currency, data.locale)} {t('already allocated', 'כבר חולק', lang)}</>
              )}
              {alreadyAllocated === 0 && (
                <> · {t('Put it to work?', 'מה לעשות איתו?', lang)}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {hasGoals && (
            <Button size="sm" variant="default" className="gap-1" onClick={() => openDialog('goal')}>
              <ChevronRight className="h-3.5 w-3.5" />
              {t('Add to Goal', 'הוסף ליעד', lang)}
            </Button>
          )}
          {hasAccounts && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => openDialog('account')}>
              <ChevronRight className="h-3.5 w-3.5" />
              {t('Add to Savings', 'הוסף לחיסכון', lang)}
            </Button>
          )}
          <Button
            size="sm" variant="ghost"
            className="text-muted-foreground text-xs"
            onClick={() => {
              markSurplusActioned(snapshot.id)
              toast(t("Won't ask again", 'לא ישאל שוב', lang), {
                description: t(
                  "You won't be asked about this surplus again.",
                  'לא תישאל שוב על עודף זה.',
                  lang
                ),
                duration: 5000,
              })
            }}
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

      {/* Goal dialog */}
      <Dialog open={mode === 'goal'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Add surplus to a Goal', 'הוסף עודף ליעד', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('Choose a goal', 'בחר יעד', lang)}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={t('Select goal…', 'בחר יעד...', lang)} /></SelectTrigger>
                <SelectContent>
                  {data.goals.map((g) => {
                    const pct = g.targetAmount > 0
                      ? Math.min(100, (g.currentAmount / g.targetAmount) * 100).toFixed(0)
                      : '0'
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · {pct}%
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {amountFields}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>{t('Cancel', 'ביטול', lang)}</Button>
            <Button onClick={handleConfirm} disabled={!selectedId || !isValidAmount}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Savings dialog */}
      <Dialog open={mode === 'account'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Deposit to a Savings Account', 'הפקד לחיסכון', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('Choose an account', 'בחר חשבון', lang)}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={t('Select account…', 'בחר חשבון...', lang)} /></SelectTrigger>
                <SelectContent>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatCurrency(a.balance, data.currency, data.locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {amountFields}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>{t('Cancel', 'ביטול', lang)}</Button>
            <Button onClick={handleConfirm} disabled={!selectedId || !isValidAmount}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
