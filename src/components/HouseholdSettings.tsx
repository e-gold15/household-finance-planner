import { useState } from 'react'
import {
  Users, UserPlus, X, Copy, Mail, Crown, User,
  Link2, RefreshCw, RotateCcw, AlertCircle, Clock, CheckCircle2,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { t } from '@/lib/utils'
import { useFinance } from '@/context/FinanceContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LocalUser, HouseholdInvite, InviteMethod } from '@/types'
import type { CreatedHouseholdInvite } from '@/types'
import { sendInviteEmail } from '@/lib/emailService'

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildInviteUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}?inv=${token}`
}

function daysUntil(iso: string, lang: 'en' | 'he'): string {
  const ms   = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return t('Expired', 'פג תוקף', lang)
  if (days === 1) return t('Expires tomorrow', 'פג מחר', lang)
  return t(`Expires in ${days} days`, `פג בעוד ${days} ימים`, lang)
}

// ─── Member row ─────────────────────────────────────────────────────────────

function MemberRow({
  member,
  role,
  isCurrentUser,
  canRemove,
  onRemove,
  lang,
}: {
  member: LocalUser
  role: 'owner' | 'member'
  isCurrentUser: boolean
  canRemove: boolean
  onRemove: (id: string) => void
  lang: 'en' | 'he'
}) {
  const displayName = member.name || member.email
  return (
    <div className="flex items-center gap-3 min-h-[44px]">
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
          {isCurrentUser && <span className="text-muted-foreground font-normal"> ({t('you', 'את/ה', lang)})</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {role === 'owner'
          ? <Badge variant="secondary" className="gap-1 text-xs"><Crown className="h-3 w-3" />{t('Owner', 'בעלים', lang)}</Badge>
          : <Badge variant="outline"   className="gap-1 text-xs"><User  className="h-3 w-3" />{t('Member', 'חבר', lang)}</Badge>
        }
        {canRemove && (
          <Button
            variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(member.id)}
            title={t('Remove member', 'הסר חבר', lang)}
            aria-label={t('Remove member', 'הסר חבר', lang)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Email invite row ────────────────────────────────────────────────────────

function EmailInviteRow({
  invite,
  onRevoke,
  lang,
}: {
  invite: HouseholdInvite
  onRevoke: (id: string) => void
  lang: 'en' | 'he'
}) {
  const email = invite.invited_email ?? '—'
  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-muted-foreground">
          {email.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{email}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {daysUntil(invite.expires_at, lang)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="warning" className="text-xs">{t('Pending', 'ממתין', lang)}</Badge>
        <Button
          variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
          onClick={() => onRevoke(invite.id)}
          title={t('Revoke invite', 'בטל הזמנה', lang)}
          aria-label={t('Revoke invite', 'בטל הזמנה', lang)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Email tab ───────────────────────────────────────────────────────────────

function EmailTab({
  invites,
  onRevoke,
  lang,
}: {
  invites: HouseholdInvite[]
  onRevoke: (id: string) => void
  lang: 'en' | 'he'
}) {
  const { createInvite, user, household } = useAuth()
  const [email, setEmail]             = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  // If email delivery fails we surface the URL so the owner can share it manually
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [emailSent, setEmailSent]     = useState(false)

  const handleSend = async () => {
    setError('')
    setFallbackUrl(null)
    setEmailSent(false)
    if (!email.trim()) {
      setError(t('Enter an email address.', 'הכנס כתובת אימייל.', lang))
      return
    }
    setLoading(true)

    // Step 1 — create the invite token in Supabase
    const result = await createInvite('email', email.trim())
    if (typeof result === 'string') {
      setLoading(false)
      setError(result)
      return
    }

    const inviteUrl = buildInviteUrl(result.token)

    // Step 2 — send email via /api/send-invite (Vercel serverless + Resend)
    const emailResult = await sendInviteEmail({
      email: email.trim(),
      inviteUrl,
      householdName: household?.name ?? 'our household',
      inviterName: user?.name ?? 'Your partner',
    })

    setLoading(false)

    if ('ok' in emailResult) {
      // Email delivered ✅
      setEmailSent(true)
      toast.success(t(`Invite email sent to ${email.trim()}`, `אימייל הזמנה נשלח ל-${email.trim()}`, lang))
      setEmail('')
      setTimeout(() => setEmailSent(false), 4000)
    } else {
      // Email failed — invite still exists, show the URL so owner can share manually
      setFallbackUrl(inviteUrl)
      if (emailResult.notConfigured) {
        // Server-side key not set — informational, not an error
        toast.info(t(
          'Email sending is not set up — copy the link below to share manually.',
          'שליחת אימייל אינה מוגדרת — העתק את הקישור ושתף ידנית.',
          lang
        ))
      } else {
        toast.warning(t(
          `Invite created but email failed: ${emailResult.error}. Copy the link to share manually.`,
          `הזמנה נוצרה אך שליחת האימייל נכשלה: ${emailResult.error}. העתק את הקישור ושתף ידנית.`,
          lang
        ))
      }
    }
  }

  const handleCopyFallback = async () => {
    if (!fallbackUrl) return
    await navigator.clipboard.writeText(fallbackUrl)
    toast.success(t('Link copied!', 'הקישור הועתק!', lang))
  }

  const emailInvites = invites.filter((i) => i.method === 'email')

  return (
    <div className="space-y-4">
      {/* Input row */}
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">{t('Email address', 'כתובת אימייל', lang)}</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            placeholder="partner@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); setFallbackUrl(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            className="flex-1"
            autoFocus
          />
          <Button onClick={handleSend} disabled={loading} className="shrink-0 gap-1.5 min-h-[44px]">
            {emailSent
              ? <CheckCircle2 className="h-4 w-4" />
              : <Mail className="h-4 w-4" />
            }
            {loading
              ? t('Sending…', 'שולח…', lang)
              : emailSent
                ? t('Sent!', 'נשלח!', lang)
                : t('Send', 'שלח', lang)
            }
          </Button>
        </div>

        {/* Validation error */}
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {/* Fallback URL when email delivery failed or not configured */}
        {fallbackUrl && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
              {t('Share this link manually:', 'שתף את הקישור הזה ידנית:', lang)}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={fallbackUrl} className="flex-1 text-xs font-mono bg-background"
                onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" className="shrink-0 min-h-[44px] min-w-[44px]"
                onClick={handleCopyFallback} title={t('Copy link', 'העתק קישור', lang)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pending email invites */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('Pending', 'ממתינות', lang)}
          {emailInvites.length > 0 && <span className="ms-1.5 text-foreground">{emailInvites.length}</span>}
        </p>
        {emailInvites.length === 0
          ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('No pending email invitations.', 'אין הזמנות אימייל ממתינות.', lang)}
              </p>
            </div>
          )
          : (
            <div className="rounded-lg border divide-y">
              {emailInvites.map((inv) => (
                <div key={inv.id} className="px-3 py-1">
                  <EmailInviteRow invite={inv} onRevoke={onRevoke} lang={lang} />
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ─── Link tab ────────────────────────────────────────────────────────────────

function LinkTab({
  invites,
  onRevoke,
  lang,
}: {
  invites: HouseholdInvite[]
  onRevoke: (id: string) => void
  lang: 'en' | 'he'
}) {
  const { createInvite } = useAuth()
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)
  // raw token returned by createInvite — used for the current session only
  const [liveToken, setLiveToken] = useState<string | null>(null)

  const linkInvite = invites.find((i) => i.method === 'link')

  const handleGenerate = async () => {
    setLoading(true)
    const result = await createInvite('link')
    setLoading(false)
    if (typeof result === 'string') { toast.error(result); return }
    setLiveToken((result as CreatedHouseholdInvite).token)
    toast.success(t('Shareable link generated.', 'קישור שיתוף נוצר.', lang))
  }

  const handleCopy = async () => {
    if (!liveToken) return
    await navigator.clipboard.writeText(buildInviteUrl(liveToken))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('Link copied!', 'הקישור הועתק!', lang))
  }

  const handleRevoke = async (id: string) => {
    onRevoke(id)
    setLiveToken(null)
    toast.success(t('Invite link revoked.', 'קישור ההזמנה בוטל.', lang))
  }

  const handleRegenerate = async () => {
    // Revoking the old one is handled server-side inside createHouseholdInvite (method='link')
    await handleGenerate()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'Anyone with this link can join your household. The link stays active until you revoke it.',
          'כל מי שיש לו את הקישור יכול להצטרף. הקישור תקף עד שתבטל אותו.',
          lang
        )}
      </p>

      {!linkInvite
        ? (
          /* No active link — show empty state + generate button */
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <Link2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium">{t('No shareable link yet', 'אין קישור עדיין', lang)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('Generate a link to share with anyone.', 'צור קישור לשיתוף.', lang)}
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2 min-h-[44px]">
              <Link2 className="h-4 w-4" />
              {loading ? t('Generating…', 'יוצר…', lang) : t('Generate Link', 'צור קישור', lang)}
            </Button>
          </div>
        )
        : liveToken
          ? (
            /* Link created this session — show URL + actions */
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('Shareable link', 'קישור שיתוף', lang)}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={buildInviteUrl(liveToken)}
                    className="flex-1 text-xs font-mono bg-background"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    variant={copied ? 'default' : 'outline'}
                    size="icon"
                    className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]"
                    onClick={handleCopy}
                    title={t('Copy link', 'העתק קישור', lang)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {daysUntil(linkInvite.expires_at, lang)}
                  {' · '}
                  {t('Multi-use — anyone with the link can join', 'רב-שימושי — כל בעל הקישור יכול להצטרף', lang)}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline" size="sm" className="gap-1.5 min-h-[44px]"
                  onClick={handleRegenerate} disabled={loading}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('Regenerate', 'צור מחדש', lang)}
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive min-h-[44px]"
                  onClick={() => handleRevoke(linkInvite.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  {t('Revoke', 'בטל', lang)}
                </Button>
              </div>
            </div>
          )
          : (
            /* Link exists but token not in memory (page reload) — can regenerate or revoke */
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t('Active link', 'קישור פעיל', lang)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysUntil(linkInvite.expires_at, lang)}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {t('Active', 'פעיל', lang)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'The link was created in a previous session. Regenerate to get a new copyable URL.',
                  'הקישור נוצר בסשן קודם. צור מחדש כדי לקבל כתובת להעתקה.',
                  lang
                )}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline" size="sm" className="gap-1.5 min-h-[44px]"
                  onClick={handleRegenerate} disabled={loading}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {loading ? t('Generating…', 'יוצר…', lang) : t('Regenerate', 'צור מחדש', lang)}
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive min-h-[44px]"
                  onClick={() => handleRevoke(linkInvite.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  {t('Revoke', 'בטל', lang)}
                </Button>
              </div>
            </div>
          )
      }
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

type InviteTab = 'email' | 'link'

function InviteModal({
  open,
  onOpenChange,
  invites,
  onRevoke,
  lang,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  invites: HouseholdInvite[]
  onRevoke: (id: string) => void
  lang: 'en' | 'he'
}) {
  const [tab, setTab] = useState<InviteTab>('email')

  const tabs: { id: InviteTab; label: string; icon: React.ReactNode }[] = [
    { id: 'email', label: t('By Email', 'לפי אימייל', lang), icon: <Mail className="h-4 w-4" /> },
    { id: 'link',  label: t('Shareable Link', 'קישור שיתוף', lang), icon: <Link2 className="h-4 w-4" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('Invite a Member', 'הזמן חבר', lang)}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="grid grid-cols-2 border rounded-lg overflow-hidden -mx-0.5">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                tab === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-2">
          {tab === 'email'
            ? <EmailTab invites={invites} onRevoke={onRevoke} lang={lang} />
            : <LinkTab  invites={invites} onRevoke={onRevoke} lang={lang} />
          }
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function HouseholdSettings() {
  const {
    user, household, householdInvites,
    revokeInvite, refreshInvites,
    renameHousehold, removeMember, getMembers,
  } = useAuth()
  const { data } = useFinance()
  const lang = data.language

  const [inviteOpen, setInviteOpen]       = useState(false)
  const [householdName, setHouseholdName] = useState(household?.name ?? '')
  const [editingName, setEditingName]     = useState(false)
  const [refreshing, setRefreshing]       = useState(false)

  if (!user || !household) return null

  const members       = getMembers()
  const membershipMap = Object.fromEntries(
    household.memberships.map((m) => [m.userId, m.role as 'owner' | 'member'])
  )
  const isOwner = membershipMap[user.id] === 'owner'

  const handleRevoke = async (id: string) => {
    await revokeInvite(id)
    toast.success(t('Invite revoked.', 'הזמנה בוטלה.', lang))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshInvites()
    setRefreshing(false)
    toast.success(t('Invitations refreshed.', 'הזמנות רועננו.', lang))
  }

  const handleRename = async () => {
    if (!householdName.trim()) return
    await renameHousehold(householdName.trim())
    setEditingName(false)
    toast.success(t('Household renamed.', 'שם משק הבית שונה.', lang))
  }

  const handleRemoveMember = async (targetId: string) => {
    const err = await removeMember(targetId)
    if (err) toast.error(err)
    else toast.success(t('Member removed.', 'חבר הוסר.', lang))
  }

  const pendingCount = householdInvites.length

  return (
    <div className="space-y-6">

      {/* Household name */}
      <div className="space-y-2">
        <Label>{t('Household Name', 'שם משק הבית', lang)}</Label>
        {editingName
          ? (
            <div className="flex gap-2">
              <Input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleRename} className="min-h-[44px]">{t('Save', 'שמור', lang)}</Button>
              <Button size="sm" variant="ghost" className="min-h-[44px]"
                onClick={() => { setEditingName(false); setHouseholdName(household.name) }}>
                {t('Cancel', 'ביטול', lang)}
              </Button>
            </div>
          )
          : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{household.name}</span>
              {isOwner && (
                <Button variant="ghost" size="sm" className="min-h-[44px] text-xs text-muted-foreground"
                  onClick={() => { setHouseholdName(household.name); setEditingName(true) }}>
                  {t('Rename', 'שנה שם', lang)}
                </Button>
              )}
            </div>
          )
        }
      </div>

      {/* Members list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('Members', 'חברים', lang)}</span>
            <Badge variant="secondary">{members.length}</Badge>
          </div>
          {isOwner && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={handleRefresh}
                title={t('Refresh', 'רענן', lang)}
                aria-label={t('Refresh', 'רענן', lang)}
                disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs min-h-[44px]"
                onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                {t('Invite', 'הזמן', lang)}
                {pendingCount > 0 && (
                  <Badge variant="warning" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border divide-y">
          {members.length === 0
            ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{t('No members yet.', 'אין חברים עדיין.', lang)}</p>
              </div>
            )
            : members.map((m) => (
              <div key={m.id} className="px-3 py-1">
                <MemberRow
                  member={m}
                  role={membershipMap[m.id] ?? 'member'}
                  isCurrentUser={m.id === user.id}
                  canRemove={isOwner && m.id !== user.id && membershipMap[m.id] !== 'owner'}
                  onRemove={handleRemoveMember}
                  lang={lang}
                />
              </div>
            ))
          }
        </div>
      </div>

      {/* Invite modal (two-tab) */}
      {isOwner && (
        <InviteModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          invites={householdInvites}
          onRevoke={handleRevoke}
          lang={lang}
        />
      )}
    </div>
  )
}
