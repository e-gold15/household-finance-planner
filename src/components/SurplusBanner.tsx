/**
 * SurplusBanner — v3.0
 *
 * Appears on the Overview tab when the previous calendar month's snapshot has
 * a positive freeCashFlow that has not yet been actioned.
 *
 * The user can:
 *   • Allocate the surplus to a Goal  (increments goal.currentAmount)
 *   • Deposit it into a Savings Account (increments account.balance)
 *   • "Maybe later" — dismisses for the session (no persistent change)
 *   • "Don't ask again" — marks surplusActioned=true on the snapshot
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

// ─── Types ────────────────────────────────────────────────────────────────────
type ActionMode = 'goal' | 'account'

// ─── Component ────────────────────────────────────────────────────────────────
export function SurplusBanner() {
  const { data, updateGoal, updateAccount, markSurplusActioned, recordSurplusAllocation } = useFinance()
  const lang = data.language

  // Session-level dismiss (doesn't persist)
  const [dismissed, setDismissed] = useState(false)
  // Which dialog is open
  const [mode, setMode] = useState<ActionMode | null>(null)
  // Form state
  const [selectedId, setSelectedId] = useState('')
  const [amount, setAmount] = useState('')

  // ── Detect actionable snapshot ────────────────────────────────────────────
  const snapshot: MonthSnapshot | null = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear  = today.getFullYear()

    // Find the most recent non-stub, positive-FCF, un-actioned snapshot from a past month
    const candidates = data.history.filter((h) => {
      if (h.totalIncome === 0)    return false   // stub
      if (h.freeCashFlow <= 0)    return false   // no surplus
      if (h.surplusActioned)      return false   // already handled
      const d = new Date(h.date)
      // Must be from a previous calendar month
      return d.getFullYear() < currentYear ||
        (d.getFullYear() === currentYear && d.getMonth() < currentMonth)
    })

    return candidates.length > 0 ? candidates[candidates.length - 1] : null
  }, [data.history])

  if (!snapshot || dismissed) return null

  const surplus = snapshot.freeCashFlow
  const hasGoals    = data.goals.length > 0
  const hasAccounts = data.accounts.length > 0
  if (!hasGoals && !hasAccounts) return null

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openDialog(m: ActionMode) {
    setMode(m)
    setSelectedId('')
    setAmount(String(Math.round(surplus)))
  }

  function closeDialog() {
    setMode(null)
    setSelectedId('')
    setAmount('')
  }

  const parsedAmount = parseFloat(amount)
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0

  function handleConfirm() {
    if (!isValidAmount || !selectedId) return

    if (mode === 'goal') {
      const goal = data.goals.find((g) => g.id === selectedId)
      if (!goal) return
      updateGoal({ ...goal, currentAmount: goal.currentAmount + parsedAmount })
      recordSurplusAllocation(snapshot!.id, {
        amount: parsedAmount,
        type: 'goal',
        destinationId: selectedId,
        destinationName: goal.name,
      })
      toast.success(
        t(
          `${formatCurrency(parsedAmount, data.currency, data.locale)} added to "${goal.name}" ✓`,
          `${formatCurrency(parsedAmount, data.currency, data.locale)} נוסף ל-"${goal.name}" ✓`,
          lang
        )
      )
    } else {
      const account = data.accounts.find((a) => a.id === selectedId)
      if (!account) return
      updateAccount({ ...account, balance: account.balance + parsedAmount })
      recordSurplusAllocation(snapshot!.id, {
        amount: parsedAmount,
        type: 'savings',
        destinationId: selectedId,
        destinationName: account.name,
      })
      toast.success(
        t(
          `${formatCurrency(parsedAmount, data.currency, data.locale)} deposited into "${account.name}" ✓`,
          `${formatCurrency(parsedAmount, data.currency, data.locale)} הופקד ב-"${account.name}" ✓`,
          lang
        )
      )
    }

    closeDialog()
  }

  // ── Render banner ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Icon + text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-lg bg-primary/15 p-2 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('You had a surplus last month', 'היה לך עודף בחודש שעבר', lang)}
              {' '}
              <Badge variant="success" className="ms-1">
                +{formatCurrency(surplus, data.currency, data.locale)}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {snapshot.label} · {t('Put it to work?', 'מה לעשות איתו?', lang)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
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
            size="sm"
            variant="ghost"
            className="text-muted-foreground text-xs"
            onClick={() => {
              markSurplusActioned(snapshot.id)
              toast(t('Dismissed', 'בוטל', lang), {
                description: t(
                  "You won't be asked about this surplus again.",
                  'לא תישאל שוב על עודף זה.',
                  lang
                ),
                duration: 5000,
              })
            }}
            title={t("Don't ask again", 'אל תשאל שוב', lang)}
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

      {/* ── Goal dialog ── */}
      <Dialog open={mode === 'goal'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('Add surplus to a Goal', 'הוסף עודף ליעד', lang)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('Choose a goal', 'בחר יעד', lang)}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('Select goal…', 'בחר יעד...', lang)} />
                </SelectTrigger>
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
              <p className="text-xs text-muted-foreground">
                {t('Available surplus:', 'עודף זמין:', lang)}{' '}
                {formatCurrency(surplus, data.currency, data.locale)}
              </p>
              {isValidAmount && parsedAmount > surplus && (
                <p className="text-xs text-warning flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("Amount exceeds this month's surplus.", 'הסכום עולה על העודף החודשי.', lang)}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedId || !isValidAmount}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Savings dialog ── */}
      <Dialog open={mode === 'account'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('Deposit to a Savings Account', 'הפקד לחיסכון', lang)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('Choose an account', 'בחר חשבון', lang)}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('Select account…', 'בחר חשבון...', lang)} />
                </SelectTrigger>
                <SelectContent>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatCurrency(a.balance, data.currency, data.locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <p className="text-xs text-muted-foreground">
                {t('Available surplus:', 'עודף זמין:', lang)}{' '}
                {formatCurrency(surplus, data.currency, data.locale)}
              </p>
              {isValidAmount && parsedAmount > surplus && (
                <p className="text-xs text-warning flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("Amount exceeds this month's surplus.", 'הסכום עולה על העודף החודשי.', lang)}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedId || !isValidAmount}>
              {t('Confirm', 'אישור', lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
