import { forwardRef, useState } from 'react'
import {
  AlertOctagon, AlertTriangle, Bot, CheckCircle2, Info, Lightbulb, RefreshCw, Sparkles, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { generateMonthlyBriefing } from '@/lib/aiAdvisor'
import type { BriefingPayload } from '@/lib/aiAdvisor'
import { cn, t } from '@/lib/utils'
import type { BriefingBulletType, BriefingResult } from '@/types'

const BULLET_ICON: Record<BriefingBulletType, { icon: LucideIcon; className: string }> = {
  positive: { icon: CheckCircle2, className: 'text-success-strong' },
  warning:  { icon: AlertTriangle, className: 'text-warning-strong' },
  urgent:   { icon: AlertOctagon, className: 'text-danger-strong' },
  neutral:  { icon: Info, className: 'text-muted-foreground' },
}

const BULLET_BORDER: Record<BriefingBulletType, string> = {
  positive: 'border-s-4 border-success',
  warning:  'border-s-4 border-warning',
  urgent:   'border-s-4 border-danger',
  neutral:  'border-s-4 border-border',
}

export interface MonthlyBriefingCardProps {
  lang: 'en' | 'he'
  payload: BriefingPayload
  cached: BriefingResult | undefined
  hasEnoughHistory: boolean
  onSave: (result: BriefingResult) => void
}

/** v3.3 Monthly AI briefing — behaviour unchanged, emoji replaced by icons (P2-5). */
export const MonthlyBriefingCard = forwardRef<HTMLDivElement, MonthlyBriefingCardProps>(function MonthlyBriefingCard(
  { lang, payload, cached, hasEnoughHistory, onSave },
  ref
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BriefingResult | undefined>(cached)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const briefing = await generateMonthlyBriefing(payload, lang)
      setResult(briefing)
      onSave(briefing)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const errorBox = error && (
    <div role="alert" className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {error}
    </div>
  )

  if (loading) {
    return (
      <Card ref={ref} aria-busy="true">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary-strong motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm">{t('Analysing your finances…', 'מנתח את הכספים שלך…', lang)}</p>
        </CardContent>
      </Card>
    )
  }

  if (result) {
    const visibleBullets = result.bullets.filter((b) => b.text.trim() !== '')
    const generatedDate = new Date(result.generatedAt).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
    const scoreTone = result.score >= 75 ? 'success' : result.score >= 50 ? 'warning' : 'danger'
    return (
      <Card ref={ref}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary-strong" aria-hidden="true" />
              {t('Monthly Briefing', 'סיכום חודשי', lang)} — {payload.month}
            </CardTitle>
            <div className="flex items-center gap-2">
              <StatusChip tone={scoreTone} label={`${t('Score', 'ציון', lang)}: ${result.score}`} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={loading}
                title={t('Refresh briefing', 'רענן סיכום', lang)}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('Refresh', 'רענן', lang)}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorBox}
          <p className="text-sm font-semibold leading-snug">{result.headline}</p>
          <div className="space-y-2">
            {visibleBullets.map((bullet, i) => {
              const meta = BULLET_ICON[bullet.type] ?? BULLET_ICON.neutral
              const Icon = meta.icon
              return (
                <div key={i} className={cn('flex items-start gap-2 rounded-sm py-1 ps-3 text-sm', BULLET_BORDER[bullet.type] ?? BULLET_BORDER.neutral)}>
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.className)} aria-hidden="true" />
                  <span>{bullet.text}</span>
                </div>
              )
            })}
          </div>
          {result.advice && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden="true" />
              <span className="italic">{result.advice}</span>
            </p>
          )}
          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Generated by AI', 'נוצר על ידי AI', lang)} · {generatedDate}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!hasEnoughHistory) {
    return (
      <Card ref={ref}>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
          <Sparkles className="h-6 w-6 text-primary-strong" aria-hidden="true" />
          <p className="text-sm">{t('Come back after your first full month', 'חזור לאחר החודש הראשון שלך', lang)}</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card ref={ref}>
        <CardContent className="space-y-3 py-6">
          {errorBox}
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
            {t('Try again', 'נסה שנית', lang)}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card ref={ref}>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="rounded-full bg-primary-subtle p-3">
          <Bot className="h-6 w-6 text-primary-strong" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {t('Get your monthly financial briefing', 'קבל את הסיכום הפיננסי החודשי שלך', lang)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('AI-powered analysis of your finances for', 'ניתוח מבוסס AI של הכספים שלך עבור', lang)} {payload.month}
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={loading} className="px-6">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {t('Generate briefing', 'צור סיכום חודשי', lang)}
        </Button>
      </CardContent>
    </Card>
  )
})
