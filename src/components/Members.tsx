import { useState, useEffect } from 'react'
import { Crown, Settings, User, UserMinus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { EmptyState } from './ui/empty-state'
import { StatusChip } from './ui/status-chip'
import { ConfirmDelete } from './ui/confirm-delete'
import { useAuth } from '@/context/AuthContext'
import { useFinance } from '@/context/FinanceContext'
import { useNav } from '@/context/NavContext'
import { t } from '@/lib/utils'
import type { LocalUser } from '@/types'

// ─── Avatar ──────────────────────────────────────────────────────────────────

function MemberAvatar({ member }: { member: LocalUser }) {
  const initials = member.name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (member.avatar) {
    return (
      <img
        src={member.avatar}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary-strong"
    >
      {initials || <User className="h-5 w-5" />}
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: LocalUser
  role: 'owner' | 'member'
  joinedAt: string
  isCurrentUser: boolean
  canRemove: boolean
  lang: 'en' | 'he'
  onRemove: () => Promise<void>
}

function MemberCard({ member, role, joinedAt, isCurrentUser, canRemove, lang, onRemove }: MemberCardProps) {
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove()
    setRemoving(false)
  }

  const joined = new Date(joinedAt)
  const joinedLabel = Number.isNaN(joined.getTime())
    ? null
    : joined.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <li className="flex items-center gap-3 p-4">
      <MemberAvatar member={member} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 truncate text-sm font-semibold">
            {member.name}
            {isCurrentUser && (
              <span className="ms-1.5 text-xs font-normal text-muted-foreground">{t('(you)', '(את/ה)', lang)}</span>
            )}
          </p>
          {role === 'owner' ? (
            <StatusChip tone="info" icon={Crown} label={t('Owner', 'בעלים', lang)} />
          ) : (
            <StatusChip tone="neutral" icon={User} label={t('Member', 'חבר', lang)} />
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr" style={{ textAlign: 'start' }}>
          {member.email}
        </p>
        {joinedLabel && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('Joined', 'הצטרף/ה', lang)} {joinedLabel}
          </p>
        )}
      </div>

      {canRemove && (
        <>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={removing}
            title={t('Remove member', 'הסר חבר', lang)}
            aria-label={t(`Remove ${member.name}`, `הסר את ${member.name}`, lang)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-subtle hover:text-danger-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <UserMinus className="h-4 w-4" aria-hidden="true" />
          </button>
          <ConfirmDelete
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            itemName={member.name}
            lang={lang}
            title={t(`Remove "${member.name}" from the household?`, `להסיר את "${member.name}" ממשק הבית?`, lang)}
            description={t(
              'They will lose access to this household. Its finance data is not deleted.',
              'הגישה למשק הבית תוסר. הנתונים הפיננסיים של משק הבית לא יימחקו.',
              lang
            )}
            confirmLabel={t('Remove', 'הסר', lang)}
            onConfirm={handleRemove}
          />
        </>
      )}
    </li>
  )
}

// ─── Members tab ──────────────────────────────────────────────────────────────

export function Members() {
  const { user, household, getMembers, removeMember } = useAuth()
  const { data } = useFinance()
  const { openSettings } = useNav()
  const lang = data.language

  // Cloud member fetch (refreshMembersFromCloud) is async — show skeleton
  // for up to 1.5 s while it resolves so we don't flash an empty list.
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  const members = getMembers()
  const isOwner = household?.createdBy === user?.id

  // Once members arrive from cloud we can stop showing the skeleton early
  const showSkeleton = isLoading && members.length === 0

  const handleRemove = async (targetId: string, name: string) => {
    const err = await removeMember(targetId)
    if (err) {
      toast.error(err)
    } else {
      toast.success(t(`${name} removed from household`, `${name} הוסר/ה ממשק הבית`, lang))
    }
  }

  if (showSkeleton) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only">{t('Loading members…', 'טוען חברים…', lang)}</span>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title={t('No members found.', 'לא נמצאו חברים.', lang)}
          description={t(
            'Invite your partner from Household Settings to plan together.',
            'הזמינו את בן/בת הזוג מהגדרות משק הבית כדי לתכנן יחד.',
            lang
          )}
          actionLabel={t('Household Settings', 'הגדרות משק הבית', lang)}
          actionIcon={Settings}
          onAction={openSettings}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('Household Members', 'חברי משק הבית', lang)}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {members.length === 1
            ? t('1 member', 'חבר אחד', lang)
            : t(`${members.length} members`, `${members.length} חברים`, lang)}
        </p>
      </div>

      <Card>
        <ul className="divide-y">
          {members.map((member) => {
            const membership = household?.memberships.find((m) => m.userId === member.id)
            const role = membership?.role ?? 'member'
            const joinedAt = membership?.joinedAt ?? member.createdAt

            return (
              <MemberCard
                key={member.id}
                member={member}
                role={role}
                joinedAt={joinedAt}
                isCurrentUser={member.id === user?.id}
                canRemove={isOwner && member.id !== user?.id}
                lang={lang}
                onRemove={() => handleRemove(member.id, member.name)}
              />
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
