import { useMemo, useState } from 'react'
import { Lock, UserPlus, Users, Waves } from 'lucide-react'
import { Button } from './ui/button'
import { ConfirmDelete } from './ui/confirm-delete'
import { EmptyState } from './ui/empty-state'
import { Money } from './ui/money'
import { StatusChip } from './ui/status-chip'
import { useFinance } from '@/context/FinanceContext'
import { getNetMonthly } from '@/lib/taxEstimation'
import { t } from '@/lib/utils'
import type { IncomeSource } from '@/types'
import { AddIncomeDialog } from './income/AddIncomeDialog'
import { AddMemberDialog } from './income/AddMemberDialog'
import { MemberSection } from './income/MemberSection'
import { SourceDialog } from './income/SourceDialog'

type SourceTarget = { memberId: string; memberName: string; source?: IncomeSource }
type DeleteTarget =
  | { kind: 'source'; memberId: string; sourceId: string; name: string }
  | { kind: 'member'; memberId: string; name: string }

// ── Income Tab ────────────────────────────────────────────────────────────────

export function Income() {
  const { data, fxRates, addMember, updateMember, deleteMember } = useFinance()
  const lang = data.language
  const currency = data.currency
  const locale = data.locale

  const [memberOpen, setMemberOpen] = useState(false)

  // One shared source sheet + one shared delete confirmation. The targets are
  // kept after close so the exit animation doesn't flash different content.
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const handleSaveSource = (memberId: string, src: IncomeSource) => {
    const member = data.members.find((m) => m.id === memberId)
    if (!member) return
    const sources = member.sources.some((s) => s.id === src.id)
      ? member.sources.map((s) => (s.id === src.id ? src : s))
      : [...member.sources, src]
    updateMember({ ...member, sources })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'member') {
      deleteMember(deleteTarget.memberId)
    } else {
      const member = data.members.find((m) => m.id === deleteTarget.memberId)
      if (member) updateMember({ ...member, sources: member.sources.filter((s) => s.id !== deleteTarget.sourceId) })
    }
  }

  const openSource = (target: SourceTarget) => {
    setSourceTarget(target)
    setSourceOpen(true)
  }

  const askDelete = (target: DeleteTarget) => {
    setDeleteTarget(target)
    setDeleteOpen(true)
  }

  const { totalIncome, fixedIncome, variableIncome } = useMemo(() => {
    let total = 0
    let fixed = 0
    let variable = 0
    for (const m of data.members) {
      for (const src of m.sources) {
        const net = getNetMonthly(src)
        total += net
        if ((src.incomeType ?? 'fixed') === 'fixed') fixed += net
        else if (src.incomeType === 'variable') variable += net
      }
    }
    return { totalIncome: total, fixedIncome: fixed, variableIncome: variable }
  }, [data.members])

  const hasSources = data.members.some((m) => m.sources.length > 0)
  const hasFixedAndVariable = fixedIncome > 0 && variableIncome > 0

  return (
    <div className="space-y-4">
      {/* Summary — total + fixed/variable split */}
      {hasSources && (
        <div className="space-y-2 px-1 pt-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-muted-foreground">
              {t('Total net monthly', 'סה"כ נטו חודשי', lang)}
            </span>
            <Money value={totalIncome} currency={currency} locale={locale} className="text-2xl font-bold" />
          </div>
          {hasFixedAndVariable && (
            <div className="flex flex-wrap gap-2">
              <StatusChip
                tone="neutral"
                icon={Lock}
                size="md"
                label={<>{t('Fixed', 'קבוע', lang)} <Money value={fixedIncome} currency={currency} locale={locale} /></>}
              />
              <StatusChip
                tone="warning"
                icon={Waves}
                size="md"
                label={<>{t('Variable', 'משתנה', lang)} <Money value={variableIncome} currency={currency} locale={locale} /></>}
              />
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      {data.members.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AddIncomeDialog
            lang={lang}
            currency={currency}
            locale={locale}
            members={data.members}
            onSaveBudget={handleSaveSource}
          />
          <Button size="sm" onClick={() => setMemberOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t('Add Member', 'הוסף חבר', lang)}
          </Button>
        </div>
      )}

      {data.members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('Add a household member to get started', 'הוסף חבר משק בית כדי להתחיל', lang)}
          description={t(
            'Each member can have salaries and other income sources. We estimate the net from gross for you.',
            'לכל חבר יכולים להיות משכורות ומקורות הכנסה נוספים. אנחנו נחשב עבורך את הנטו מהברוטו.',
            lang,
          )}
          action={
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button onClick={() => setMemberOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {t('Add Member', 'הוסף חבר', lang)}
              </Button>
              <AddIncomeDialog
                lang={lang}
                currency={currency}
                locale={locale}
                members={data.members}
                onSaveBudget={handleSaveSource}
              />
            </div>
          }
        />
      ) : (
        data.members.map((member) => (
          <MemberSection
            key={member.id}
            member={member}
            lang={lang}
            currency={currency}
            locale={locale}
            fxRates={fxRates}
            onAddSource={() => openSource({ memberId: member.id, memberName: member.name })}
            onEditSource={(src) => openSource({ memberId: member.id, memberName: member.name, source: src })}
            onDeleteSource={(src) => askDelete({ kind: 'source', memberId: member.id, sourceId: src.id, name: src.name })}
            onDeleteMember={() => askDelete({ kind: 'member', memberId: member.id, name: member.name })}
          />
        ))
      )}

      <AddMemberDialog open={memberOpen} onOpenChange={setMemberOpen} onAdd={addMember} lang={lang} />

      {sourceTarget && (
        <SourceDialog
          open={sourceOpen}
          onOpenChange={setSourceOpen}
          memberId={sourceTarget.memberId}
          memberName={sourceTarget.memberName}
          existing={sourceTarget.source}
          onSave={handleSaveSource}
          lang={lang}
          currency={currency}
          locale={locale}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          itemName={deleteTarget.name}
          lang={lang}
          onConfirm={confirmDelete}
          description={
            deleteTarget.kind === 'member'
              ? t(
                  'This removes the member and all of their income sources. This cannot be undone.',
                  'פעולה זו מסירה את החבר ואת כל מקורות ההכנסה שלו. פעולה זו אינה הפיכה.',
                  lang,
                )
              : undefined
          }
        />
      )}
    </div>
  )
}
