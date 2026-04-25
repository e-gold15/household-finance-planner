import { useState } from 'react'
import { Crown, User, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useFinance } from '@/context/FinanceContext'
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
        alt={member.name}
        width={44}
        height={44}
        className="h-11 w-11 rounded-full object-cover shrink-0"
      />
    )
  }

  return (
    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0 select-none">
      {initials || <User className="h-5 w-5" />}
    </div>
  )
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role, lang }: { role: 'owner' | 'member'; lang: 'en' | 'he' }) {
  if (role === 'owner') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
        <Crown className="h-3 w-3" />
        {t('Owner', 'בעלים', lang)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
      <User className="h-3 w-3" />
      {t('Member', 'חבר', lang)}
    </span>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: LocalUser
  role: 'owner' | 'member'
  joinedAt: string
  isCurrentUser: boolean
  canRemove: boolean
  lang: 'en' | 'he'
  onRemove: () => void
}

function MemberCard({ member, role, joinedAt, isCurrentUser, canRemove, lang, onRemove }: MemberCardProps) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove()
    setRemoving(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <MemberAvatar member={member} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">
            {member.name}
            {isCurrentUser && (
              <span className="ms-1.5 text-xs text-muted-foreground font-normal">
                {t('(you)', '(את/ה)', lang)}
              </span>
            )}
          </p>
          <RoleBadge role={role} lang={lang} />
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('Joined', 'הצטרף/ה', lang)}{' '}
          {new Date(joinedAt).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      </div>

      {canRemove && (
        <button
          onClick={handleRemove}
          disabled={removing}
          title={t('Remove member', 'הסר חבר', lang)}
          aria-label={t(`Remove ${member.name}`, `הסר את ${member.name}`, lang)}
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ─── Members tab ──────────────────────────────────────────────────────────────

export function Members() {
  const { user, household, getMembers, removeMember } = useAuth()
  const { data } = useFinance()
  const lang = data.language

  const members    = getMembers()
  const isOwner    = household?.createdBy === user?.id

  const handleRemove = async (targetId: string, name: string) => {
    const err = await removeMember(targetId)
    if (err) {
      toast.error(err)
    } else {
      toast.success(t(`${name} removed from household`, `${name} הוסר/ה ממשק הבית`, lang))
    }
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Users className="h-10 w-10 opacity-30" />
        <p className="text-sm">{t('No members found.', 'לא נמצאו חברים.', lang)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {t('Household Members', 'חברי משק הבית', lang)}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length === 1
              ? t('1 member', 'חבר אחד', lang)
              : t(`${members.length} members`, `${members.length} חברים`, lang)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const membership = household?.memberships.find((m) => m.userId === member.id)
          const role       = membership?.role ?? 'member'
          const joinedAt   = membership?.joinedAt ?? member.createdAt

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
      </div>
    </div>
  )
}
