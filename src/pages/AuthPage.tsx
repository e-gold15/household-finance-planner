import { useState, useEffect, useRef } from 'react'
import { Wallet, Eye, EyeOff, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { cn, t } from '@/lib/utils'
import { isGoogleAvailable, renderGoogleButton } from '@/lib/googleAuth'

// AuthPage is rendered outside FinanceProvider (no household yet).
// Language defaults to 'en' on the pre-login screen.
const lang: 'en' | 'he' = 'en'

// ─── Shared sub-components ─────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete }: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pe-10"
        autoComplete={autoComplete ?? 'current-password'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('Hide password', 'הסתר סיסמה', lang) : t('Show password', 'הצג סיסמה', lang)}
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

// ─── Google Sign-In button ─────────────────────────────────────────────────
// Uses Google's official renderButton(). Uses React state so it re-renders
// when GIS finishes loading asynchronously.

const GoogleSVG = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function GoogleButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Use state so the component re-renders when GIS finishes loading
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check immediately
    if (isGoogleAvailable()) {
      setReady(true)
      setLoading(false)
      return
    }
    // Poll every 200ms until GIS script loads (it loads async from index.html)
    const timer = setInterval(() => {
      if (isGoogleAvailable()) {
        setReady(true)
        setLoading(false)
        clearInterval(timer)
      }
    }, 200)
    // Give up after 6 seconds — show fallback
    const timeout = setTimeout(() => {
      clearInterval(timer)
      setLoading(false)
    }, 6000)
    return () => { clearInterval(timer); clearTimeout(timeout) }
  }, [])

  // Render Google's button once GIS is ready
  useEffect(() => {
    if (ready && containerRef.current) {
      renderGoogleButton(containerRef.current)
    }
  }, [ready])

  if (loading) {
    // GIS script still loading — show a shimmer placeholder
    return (
      <div className="w-full h-11 rounded-md border bg-muted/40 animate-pulse flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <GoogleSVG />
        {t('Loading Google Sign-In\u2026', '\u05d8\u05d5\u05e2\u05df \u05db\u05e0\u05d9\u05e1\u05d4 \u05e2\u05dd Google\u2026', lang)}
      </div>
    )
  }

  if (!ready) {
    // GIS timed out or CLIENT_ID not set — show a custom fallback button
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-2 font-medium"
        onClick={() => {
          // Try the One-Tap prompt as a last resort
          import('@/lib/googleAuth').then(({ promptGoogleSignIn }) => promptGoogleSignIn())
        }}
      >
        <GoogleSVG />
        {t('Continue with Google', '\u05d4\u05de\u05e9\u05da \u05e2\u05dd Google', lang)}
      </Button>
    )
  }

  // GIS ready — let Google render its official button
  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
}

// ─── Email forms ───────────────────────────────────────────────────────────

type EmailTab = 'signin' | 'signup'

function SignInForm({ onClose }: { onClose: () => void }) {
  const { signInEmail } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError(t('Please fill in all fields.', '\u05d0\u05e0\u05d0 \u05de\u05dc\u05d0 \u05d0\u05ea \u05db\u05dc \u05d4\u05e9\u05d3\u05d5\u05ea.', lang))
      return
    }
    setLoading(true)
    const err = await signInEmail(email, password)
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">{t('Email', '\u05d0\u05d9\u05de\u05d9\u05d9\u05dc', lang)}</Label>
        <Input id="signin-email" type="email" autoComplete="email"
          placeholder={t('you@example.com', 'you@example.com', lang)}
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">{t('Password', '\u05e1\u05d9\u05e1\u05de\u05d0', lang)}</Label>
        <PasswordInput id="signin-password" value={password} onChange={setPassword}
          placeholder={t('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', lang)}
          autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? t('Signing in\u2026', '\u05de\u05ea\u05d7\u05d1\u05e8\u2026', lang)
          : t('Sign In', '\u05d4\u05ea\u05d7\u05d1\u05e8', lang)}
      </Button>
    </form>
  )
}

function SignUpForm({ onClose }: { onClose: () => void }) {
  const { signUpEmail } = useAuth()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password || !confirm) {
      setError(t('Please fill in all fields.', '\u05d0\u05e0\u05d0 \u05de\u05dc\u05d0 \u05d0\u05ea \u05db\u05dc \u05d4\u05e9\u05d3\u05d5\u05ea.', lang))
      return
    }
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters.', '\u05d4\u05e1\u05d9\u05e1\u05de\u05d0 \u05d7\u05d9\u05d9\u05d1\u05ea \u05dc\u05d4\u05db\u05d9\u05dc \u05dc\u05e4\u05d7\u05d5\u05ea 6 \u05ea\u05d5\u05d5\u05d9\u05dd.', lang))
      return
    }
    if (password !== confirm) {
      setError(t('Passwords do not match.', '\u05d4\u05e1\u05d9\u05e1\u05de\u05d0\u05d5\u05ea \u05d0\u05d9\u05e0\u05df \u05ea\u05d5\u05d0\u05de\u05d5\u05ea.', lang))
      return
    }
    setLoading(true)
    const err = await signUpEmail(email, password, name)
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">{t('Full Name', '\u05e9\u05dd \u05de\u05dc\u05d0', lang)}</Label>
        <Input id="signup-name" type="text" autoComplete="name"
          placeholder={t('Alex Cohen', '\u05d0\u05dc\u05db\u05e1 \u05db\u05d4\u05df', lang)}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">{t('Email', '\u05d0\u05d9\u05de\u05d9\u05d9\u05dc', lang)}</Label>
        <Input id="signup-email" type="email" autoComplete="email"
          placeholder={t('you@example.com', 'you@example.com', lang)}
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">{t('Password', '\u05e1\u05d9\u05e1\u05de\u05d0', lang)}</Label>
        <PasswordInput id="signup-password" value={password} onChange={setPassword}
          placeholder={t('Min. 6 characters', '\u05de\u05d9\u05e0. 6 \u05ea\u05d5\u05d5\u05d9\u05dd', lang)}
          autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">{t('Confirm Password', '\u05d0\u05e9\u05e8 \u05e1\u05d9\u05e1\u05de\u05d0', lang)}</Label>
        <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm}
          placeholder={t('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', lang)}
          autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? t('Creating account\u2026', '\u05d9\u05d5\u05e6\u05e8 \u05d7\u05e9\u05d1\u05d5\u05df\u2026', lang)
          : t('Create Account', '\u05e6\u05d5\u05e8 \u05d7\u05e9\u05d1\u05d5\u05df', lang)}
      </Button>
    </form>
  )
}

// ─── Main AuthPage ─────────────────────────────────────────────────────────

export function AuthPage() {
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTab, setEmailTab]   = useState<EmailTab>('signin')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-primary p-4 shadow-md">
            <Wallet className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Household Finance Planner', '\u05de\u05ea\u05db\u05e0\u05df \u05e4\u05d9\u05e0\u05e0\u05e1\u05d9 \u05d1\u05d9\u05ea\u05d9', lang)}
            </h1>
          </div>
        </div>

        {/* Primary CTA — Google */}
        <div className="space-y-3">
          <GoogleButton />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">{t('or', '\u05d0\u05d5', lang)}</span>
            <div className="flex-1 border-t" />
          </div>

          {/* Email accordion toggle */}
          <button
            type="button"
            onClick={() => setEmailOpen((o) => !o)}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            {t('Continue with Email', '\u05d4\u05de\u05e9\u05da \u05e2\u05dd \u05d0\u05d9\u05de\u05d9\u05d9\u05dc', lang)}
            <ChevronDown className={cn('h-4 w-4 transition-transform', emailOpen && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>

        {/* Email section (collapsible) */}
        {emailOpen && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="grid grid-cols-2 border-b">
              {(['signin', 'signup'] as EmailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEmailTab(tab)}
                  className={cn(
                    'min-h-[44px] text-sm font-medium transition-colors',
                    emailTab === tab
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab === 'signin'
                    ? t('Sign In', '\u05d4\u05ea\u05d7\u05d1\u05e8', lang)
                    : t('Create Account', '\u05e6\u05d5\u05e8 \u05d7\u05e9\u05d1\u05d5\u05df', lang)}
                </button>
              ))}
            </div>

            <div className="p-6">
              {emailTab === 'signin'
                ? <SignInForm  onClose={() => setEmailOpen(false)} />
                : <SignUpForm onClose={() => setEmailOpen(false)} />
              }
            </div>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {t(
            'Your data is stored locally and synced to the cloud for shared households.',
            '\u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05e9\u05dc\u05da \u05de\u05d0\u05d5\u05d7\u05e1\u05e0\u05d9\u05dd \u05de\u05e7\u05d5\u05de\u05d9\u05ea \u05d5\u05de\u05e1\u05d5\u05e0\u05db\u05e8\u05e0\u05d9\u05dd \u05dc\u05e2\u05e0\u05df \u05e2\u05d1\u05d5\u05e8 \u05de\u05e9\u05e7\u05d9 \u05d1\u05d9\u05ea \u05de\u05e9\u05d5\u05ea\u05e4\u05d9\u05dd.',
            lang
          )}
        </p>
      </div>
    </div>
  )
}
