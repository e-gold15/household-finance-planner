import { useState, useEffect, useRef } from 'react'
import { Wallet, Eye, EyeOff, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { isGoogleAvailable, renderGoogleButton } from '@/lib/googleAuth'

// ─── Shared sub-components ─────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
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
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ─── Google Sign-In button ─────────────────────────────────────────────────
// Uses Google's official renderButton() — much more reliable than One-Tap prompt.

function GoogleButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  const available = isGoogleAvailable()

  useEffect(() => {
    if (!containerRef.current) return
    if (available) {
      renderGoogleButton(containerRef.current)
    }
  }, [available])

  // Retry rendering once the GIS script loads (it loads async)
  useEffect(() => {
    if (available) return
    const timer = setInterval(() => {
      if (isGoogleAvailable() && containerRef.current) {
        renderGoogleButton(containerRef.current)
        clearInterval(timer)
      }
    }, 300)
    return () => clearInterval(timer)
  }, [available])

  if (!available) {
    return (
      <div className="w-full h-11 rounded-md border flex items-center justify-center text-sm text-muted-foreground gap-2">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 opacity-40" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google Sign-In not configured
      </div>
    )
  }

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
    if (!email || !password) { setError('Please fill in all fields.'); return }
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
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Password</Label>
        <PasswordInput id="signin-password" value={password} onChange={setPassword}
          placeholder="••••••••" autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
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
    if (!name || !email || !password || !confirm) { setError('Please fill in all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
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
        <Label htmlFor="signup-name">Full Name</Label>
        <Input id="signup-name" type="text" autoComplete="name" placeholder="Alex Cohen"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput id="signup-password" value={password} onChange={setPassword}
          placeholder="Min. 6 characters" autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm}
          placeholder="••••••••" autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account'}
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
            <h1 className="text-2xl font-bold tracking-tight">Household Finance Planner</h1>
            <p className="text-sm text-muted-foreground mt-1">מתכנן פיננסי ביתי</p>
          </div>
        </div>

        {/* Primary CTA — Google */}
        <div className="space-y-3">
          <GoogleButton />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t" />
          </div>

          {/* Email accordion toggle */}
          <button
            type="button"
            onClick={() => setEmailOpen((o) => !o)}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Continue with Email
            <ChevronDown className={cn('h-4 w-4 transition-transform', emailOpen && 'rotate-180')} />
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
                    'py-3 text-sm font-medium transition-colors',
                    emailTab === tab
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab === 'signin' ? 'Sign In' : 'Create Account'}
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
          All data is stored locally on this device — no cloud, no subscriptions.
        </p>
      </div>
    </div>
  )
}
