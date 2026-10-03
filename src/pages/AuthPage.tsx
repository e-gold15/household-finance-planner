import { useState, useEffect, useRef, useId } from 'react'
import { DirectionProvider } from '@radix-ui/react-direction'
import {
  Wallet, Eye, EyeOff, AlertCircle, ChevronDown, FlaskConical, Users, Calculator, Target, Mail,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useAuth } from '@/context/AuthContext'
import { cn, t } from '@/lib/utils'
import { isGoogleAvailable, renderGoogleButton } from '@/lib/googleAuth'

// AuthPage is rendered outside FinanceProvider (no household yet), so the
// language is local React state, defaulting from the browser. Not persisted.
type Lang = 'en' | 'he'

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const langs = [navigator.language, ...(navigator.languages ?? [])]
  return langs.some((l) => /^(he|iw)\b/i.test(l ?? '')) ? 'he' : 'en'
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{message}</span>
    </div>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, lang }: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  lang: Lang
}) {
  const [visible, setVisible] = useState(false)
  const label = visible ? t('Hide password', 'הסתר סיסמה', lang) : t('Show password', 'הצג סיסמה', lang)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pe-12"
        dir="ltr"
        autoComplete={autoComplete ?? 'current-password'}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        title={label}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 end-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <div className="flex-1 border-t" />
      <span className="text-xs text-muted-foreground" aria-hidden="true">{label}</span>
      <div className="flex-1 border-t" />
    </div>
  )
}

// ─── Google Sign-In button ─────────────────────────────────────────────────
// Uses Google's official renderButton(). Uses React state so it re-renders
// when GIS finishes loading asynchronously.

const GoogleSVG = () => (
  // Google's brand mark — official colours are required by Google's branding rules.
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function GoogleButton({ lang }: { lang: Lang }) {
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
      <div
        role="status"
        className="flex h-11 w-full animate-pulse items-center justify-center gap-2 rounded-md border bg-muted/40 text-sm text-muted-foreground"
      >
        <GoogleSVG />
        {t('Loading Google Sign-In…', 'טוען כניסה עם Google…', lang)}
      </div>
    )
  }

  if (!ready) {
    // GIS timed out or CLIENT_ID not set — show a custom fallback button
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 font-medium"
        onClick={() => {
          // Try the One-Tap prompt as a last resort
          import('@/lib/googleAuth').then(({ promptGoogleSignIn }) => promptGoogleSignIn())
        }}
      >
        <GoogleSVG />
        {t('Continue with Google', 'המשך עם Google', lang)}
      </Button>
    )
  }

  // GIS ready — let Google render its official button. Google's iframe is LTR.
  return <div ref={containerRef} dir="ltr" className="flex min-h-[44px] w-full justify-center" />
}

// ─── Email forms ───────────────────────────────────────────────────────────

type EmailTab = 'signin' | 'signup'

function SignInForm({ onClose, lang }: { onClose: () => void; lang: Lang }) {
  const { signInEmail } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError(t('Please fill in all fields.', 'אנא מלא את כל השדות.', lang))
      return
    }
    setLoading(true)
    const err = await signInEmail(email, password)
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">{t('Email', 'אימייל', lang)}</Label>
        <Input id="signin-email" type="email" autoComplete="email" inputMode="email" dir="ltr"
          placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">{t('Password', 'סיסמא', lang)}</Label>
        <PasswordInput id="signin-password" value={password} onChange={setPassword}
          placeholder="••••••••" autoComplete="current-password" lang={lang} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('Signing in…', 'מתחבר…', lang) : t('Sign In', 'התחבר', lang)}
      </Button>
    </form>
  )
}

function SignUpForm({ onClose, lang }: { onClose: () => void; lang: Lang }) {
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
      setError(t('Please fill in all fields.', 'אנא מלא את כל השדות.', lang))
      return
    }
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters.', 'הסיסמא חייבת להכיל לפחות 6 תווים.', lang))
      return
    }
    if (password !== confirm) {
      setError(t('Passwords do not match.', 'הסיסמאות אינן תואמות.', lang))
      return
    }
    setLoading(true)
    const err = await signUpEmail(email, password, name)
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">{t('Full Name', 'שם מלא', lang)}</Label>
        <Input id="signup-name" type="text" autoComplete="name"
          placeholder={t('Alex Cohen', 'אלכס כהן', lang)}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">{t('Email', 'אימייל', lang)}</Label>
        <Input id="signup-email" type="email" autoComplete="email" inputMode="email" dir="ltr"
          placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">{t('Password', 'סיסמא', lang)}</Label>
        <PasswordInput id="signup-password" value={password} onChange={setPassword}
          placeholder={t('Min. 6 characters', 'מינ. 6 תווים', lang)}
          autoComplete="new-password" lang={lang} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">{t('Confirm Password', 'אשר סיסמא', lang)}</Label>
        <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm}
          placeholder="••••••••" autoComplete="new-password" lang={lang} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('Creating account…', 'יוצר חשבון…', lang) : t('Create Account', 'צור חשבון', lang)}
      </Button>
    </form>
  )
}

// ─── Value proposition ─────────────────────────────────────────────────────

function Benefit({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-strong">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="pt-1.5 text-sm text-foreground">{children}</span>
    </li>
  )
}

// ─── Main AuthPage ─────────────────────────────────────────────────────────

export function AuthPage() {
  const { startDemo }             = useAuth()
  const [lang, setLang]           = useState<Lang>(detectLang)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTab, setEmailTab]   = useState<EmailTab>('signin')
  const emailPanelId = useId()
  const dir = lang === 'he' ? 'rtl' : 'ltr'

  // Keep <html dir/lang> in step while the auth screen is shown (portals,
  // screen readers, the SW update toast). AppShell takes over after sign-in.
  useEffect(() => {
    document.documentElement.dir  = dir
    document.documentElement.lang = lang
  }, [dir, lang])

  return (
    <DirectionProvider dir={dir}>
      <div dir={dir} lang={lang} className="flex min-h-dvh flex-col bg-background">
        {/* Top bar — language toggle */}
        <div className="flex justify-end px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <SegmentedControl<Lang>
            aria-label={t('Language', 'שפה', lang)}
            fullWidth={false}
            value={lang}
            onValueChange={setLang}
            options={[
              { value: 'en', label: 'EN', ariaLabel: 'English' },
              { value: 'he', label: 'עב', ariaLabel: 'עברית' },
            ]}
          />
        </div>

        <main className="flex flex-1 items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4">
          <div className="w-full max-w-sm space-y-6">
            {/* Brand + value proposition */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-2xl bg-primary p-4 shadow-md">
                <Wallet className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Household Finance Planner', 'מתכנן פיננסי ביתי', lang)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t(
                  'Plan your household money together — income, expenses, savings and goals in one place.',
                  'מתכננים את כספי הבית יחד — הכנסות, הוצאות, חסכונות ויעדים במקום אחד.',
                  lang,
                )}
              </p>
            </div>

            <ul className="space-y-2.5" aria-label={t('Why use it', 'למה כדאי', lang)}>
              <Benefit icon={Users}>
                {t('Shared with your partner, synced across devices', 'משותף עם בן/בת הזוג, מסונכרן בין מכשירים', lang)}
              </Benefit>
              <Benefit icon={Calculator}>
                {t('Net salary estimated from gross, Israeli tax included', 'הערכת שכר נטו מברוטו, כולל מס ישראלי', lang)}
              </Benefit>
              <Benefit icon={Target}>
                {t('Savings goals with a realistic monthly plan', 'יעדי חיסכון עם תוכנית חודשית ריאלית', lang)}
              </Benefit>
            </ul>

            {/* Sign-in card */}
            <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
              <GoogleButton lang={lang} />

              <Divider label={t('or', 'או', lang)} />

              {/* Email accordion toggle */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                aria-expanded={emailOpen}
                aria-controls={emailPanelId}
                onClick={() => setEmailOpen((o) => !o)}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t('Continue with Email', 'המשך עם אימייל', lang)}
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-fast', emailOpen && 'rotate-180')} aria-hidden="true" />
              </Button>

              {emailOpen && (
                <div id={emailPanelId} className="space-y-4 pt-2">
                  <SegmentedControl<EmailTab>
                    aria-label={t('Account', 'חשבון', lang)}
                    value={emailTab}
                    onValueChange={setEmailTab}
                    options={[
                      { value: 'signin', label: t('Sign In', 'התחבר', lang) },
                      { value: 'signup', label: t('Create Account', 'צור חשבון', lang) },
                    ]}
                  />
                  {emailTab === 'signin'
                    ? <SignInForm onClose={() => setEmailOpen(false)} lang={lang} />
                    : <SignUpForm onClose={() => setEmailOpen(false)} lang={lang} />}
                </div>
              )}
            </div>

            {/* Try Demo */}
            <div className="space-y-1.5 text-center">
              <Button type="button" variant="ghost" className="w-full gap-2 text-primary-strong" onClick={startDemo}>
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                {t('Try Demo', 'נסה דמו', lang)}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('Explore with sample data — nothing is saved', 'חקור עם נתונים לדוגמא — לא נשמר', lang)}
              </p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {t(
                'Your data is stored locally and synced to the cloud for shared households.',
                'הנתונים שלך מאוחסנים מקומית ומסונכרנים לענן עבור משקי בית משותפים.',
                lang,
              )}
            </p>
          </div>
        </main>
      </div>
    </DirectionProvider>
  )
}
