import { useState } from 'react'
import { Users, UserPlus, X, Copy, Mail, Crown, User, Link, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { t } from '@/lib/utils'
import { useFinance } from '@/context/FinanceContext'
import type { LocalUser } from '@/types'
import type { CloudInvitation } from '@/lib/cloudInvites'
import { toast } from 'sonner'

// ─── Sub-components ────────────────────────────────────────────────────────

function MemberRow({
  member,
  role,
  isCurrentUser,
  canRemove,
  onRemove,
}: {
  member: LocalUser
  role: 'owner' | 'member'
  isCurrentUser: boolean
  canRemove: boolean
  onRemove: (id: string) => void
}) {
  const displayName = member.name || member.email
  return (
    <div className="flex items-center gap-3">
      {member.avatar
        ? <img src={member.avatar} className="h-9 w-9 rounded-full object-cover shrink-0" alt={displayName} />
        : (
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {displayName}
          {isCurrentUser && <span className="text-muted-foreground font-normal"> (you)</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {role === 'owner'
          ? <Badge variant="secondary" className="gap-1 text-xs"><Crown className="h-3 w-3" />Owner</Badge>
          : <Badge variant="outline"   className="gap-1 text-xs"><User  className="h-3 w-3" />Member</Badge>
        }
        {canRemove && (
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(member.id)}
            title="Remove member"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function InviteRow({
  invite,
  onCancel,
}: {
  invite: CloudInvitation
  onCancel: (id: string) => void
}) {
  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${invite.id}`

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast.success('Invite link copied to clipboard')
  }

  const openMailto = () => {
    const subject = encodeURIComponent('Join my Household Finance Planner')
    const body = encodeURIComponent(
      `Hi!\n\nI'd like you to join my household on Household Finance Planner.\n\nClick the link to accept:\n${inviteLink}\n\nThe link expires in 7 days.`
    )
    window.open(`mailto:${invite.email}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-muted-foreground">
          {invite.email.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="warning" className="text-xs">Pending</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLink} title="Copy invite link">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openMailto} title="Send via email app">
          <Mail className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onCancel(invite.id)} title="Cancel invite"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function HouseholdSettings() {
  const {
    user, household, pendingInvites,
    inviteMember, cancelInvite, refreshInvites,
    renameHousehold, removeMember, getMembers,
  } = useAuth()
  const { data } = useFinance()
  const lang = data.language

  const [inviteEmail, setInviteEmail]         = useState('')
  const [inviteError, setInviteError]         = useState('')
  const [inviteLoading, setInviteLoading]     = useState(false)
  const [inviteOpen, setInviteOpen]           = useState(false)
  const [householdName, setHouseholdName]     = useState(household?.name ?? '')
  const [editingName, setEditingName]         = useState(false)
  const [refreshing, setRefreshing]           = useState(false)

  if (!user || !household) return null

  const members       = getMembers()
  const membershipMap = Object.fromEntries(household.memberships.map((m) => [m.userId, m.role as 'owner' | 'member']))
  const isOwner       = membershipMap[user.id] === 'owner'

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError('Please enter an email address.'); return }
    setInviteLoading(true)
    const err = await inviteMember(inviteEmail.trim())
    setInviteLoading(false)
    if (err) { setInviteError(err); return }
    toast.success(`Invitation created for ${inviteEmail.trim()}`)
    setInviteEmail('')
    setInviteError('')
    setInviteOpen(false)
  }

  const handleCancelInvite = async (id: string) => {
    await cancelInvite(id)
    toast.success('Invitation cancelled')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshInvites()
    setRefreshing(false)
    toast.success('Invitations refreshed')
  }

  const handleRename = async () => {
    if (!householdName.trim()) return
    await renameHousehold(householdName.trim())
    setEditingName(false)
    toast.success('Household renamed')
  }

  const handleRemoveMember = async (targetId: string) => {
    const err = await removeMember(targetId)
    if (err) toast.error(err)
    else toast.success('Member removed')
  }

  return (
    <div className="space-y-6">
      {/* Household name */}
      <div className="space-y-2">
        <Label>{t('Household Name', 'שם משק הבית', lang)}</Label>
        {editingName ? (
          <div className="flex gap-2">
            <Input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleRename}>{t('Save', 'שמור', lang)}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setHouseholdName(household.name) }}>
              {t('Cancel', 'ביטול', lang)}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{household.name}</span>
            {isOwner && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                onClick={() => { setHouseholdName(household.name); setEditingName(true) }}>
                {t('Rename', 'שנה שם', lang)}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('Members', 'חברים', lang)}</span>
            <Badge variant="secondary">{members.length}</Badge>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
              onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              {t('Invite', 'הזמן', lang)}
            </Button>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          {members.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-2">No members yet</p>
            : members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                role={membershipMap[m.id] ?? 'member'}
                isCurrentUser={m.id === user.id}
                canRemove={isOwner && m.id !== user.id && membershipMap[m.id] !== 'owner'}
                onRemove={handleRemoveMember}
              />
            ))
          }
        </div>
      </div>

      {/* Pending invitations */}
      {isOwner && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('Pending Invitations', 'הזמנות ממתינות', lang)}</span>
              {pendingInvites.length > 0 && <Badge variant="warning">{pendingInvites.length}</Badge>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}
              title="Refresh" disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {pendingInvites.length === 0
            ? <p className="text-xs text-muted-foreground">{t('No pending invitations.', 'אין הזמנות ממתינות.', lang)}</p>
            : (
              <div className="space-y-3 rounded-lg border p-3">
                {pendingInvites.map((inv) => (
                  <InviteRow key={inv.id} invite={inv} onCancel={handleCancelInvite} />
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('Invite a Member', 'הזמן חבר', lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {t(
                'Enter their email. You\'ll get a link to share — valid for 7 days.',
                'הכנס את האימייל. תקבל קישור לשיתוף — בתוקף ל-7 ימים.',
                lang
              )}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t('Email address', 'כתובת אימייל', lang)}</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="partner@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
                autoFocus
              />
              {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmail(''); setInviteError('') }}>
                {t('Cancel', 'ביטול', lang)}
              </Button>
              <Button onClick={handleInvite} disabled={inviteLoading} className="gap-1.5">
                <Mail className="h-4 w-4" />
                {inviteLoading ? t('Sending…', 'שולח…', lang) : t('Send Invitation', 'שלח הזמנה', lang)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
