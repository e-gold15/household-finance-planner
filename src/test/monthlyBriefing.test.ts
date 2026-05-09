/**
 * Tests for Monthly AI Financial Briefing (v3.3).
 *
 * `generateMonthlyBriefing` makes a live API call, so we test:
 *  1. The pure `parseBriefingText` logic — mirrored here exactly like
 *     receiptScan.test.ts and payslipScan.test.ts do for their parsers.
 *  2. The exported `generateMonthlyBriefing()` function via mocked fetch.
 *
 * All parse-logic tests are self-contained with no network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateMonthlyBriefing } from '@/lib/aiAdvisor'
import type { BriefingResult, BriefingBulletType } from '@/types'

// ─── Mirror the internal parseBriefingText ────────────────────────────────────
// Copied exactly from src/lib/aiAdvisor.ts so we can unit-test without a
// network call, following the pattern of receiptScan.test.ts and
// payslipScan.test.ts.

const VALID_BULLET_TYPES: BriefingBulletType[] = ['positive', 'warning', 'urgent', 'neutral']

function parseBriefingText(text: string): BriefingResult {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(clean) }
  catch { parsed = {} }

  const headline = typeof parsed.headline === 'string' ? parsed.headline : ''
  const advice   = typeof parsed.advice   === 'string' ? parsed.advice   : ''

  const rawScore = typeof parsed.score === 'number' ? parsed.score : 0
  const score    = Math.min(100, Math.max(0, Math.round(rawScore)))

  const rawBullets = Array.isArray(parsed.bullets) ? parsed.bullets : []
  const bullets = rawBullets
    .slice(0, 6)
    .map((b: unknown) => {
      const bullet = b as Record<string, unknown>
      const type: BriefingBulletType =
        typeof bullet.type === 'string' && (VALID_BULLET_TYPES as string[]).includes(bullet.type)
          ? (bullet.type as BriefingBulletType)
          : 'neutral'
      const btext = typeof bullet.text === 'string' ? bullet.text : ''
      return { type, text: btext }
    })

  while (bullets.length < 3) {
    bullets.push({ type: 'neutral', text: '' })
  }

  return { headline, score, bullets, advice, generatedAt: new Date().toISOString() }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validBriefingJson(overrides: Record<string, unknown> = {}): string {
  const defaults: Record<string, unknown> = {
    headline: 'Solid month — savings on track',
    score: 80,
    bullets: [
      { type: 'positive', text: 'FCF positive for third month running' },
      { type: 'warning',  text: 'Food budget exceeded by 12%' },
      { type: 'neutral',  text: 'Emergency fund at 2.5 months' },
    ],
    advice: 'Consider moving the surplus to your vacation goal this month.',
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

import type { BriefingPayload } from '@/lib/aiAdvisor'

function makePayload(overrides: Partial<BriefingPayload> = {}): BriefingPayload {
  return {
    month: 'May 2026',
    fcf: 1500,
    fcfAvg3m: 1200,
    incomeTotal: 20000,
    expensesTotal: 15000,
    budgetOverruns: [],
    savingsGrowthTotal: 3500,
    goalsSummary: [{ name: 'Vacation', status: 'realistic', pctComplete: 40 }],
    upcomingBills: [],
    surplusActioned: false,
    emergencyBufferMonths: 3,
    currency: 'ILS',
    ...overrides,
  }
}

// ─── parseBriefingText() — pure parsing tests ─────────────────────────────────

describe('parseBriefingText()', () => {

  // 1. Happy path — valid JSON with all 4 keys returns correct BriefingResult
  it('happy path — parses all 4 keys and sets generatedAt', () => {
    const raw = validBriefingJson()
    const result = parseBriefingText(raw)

    expect(result.headline).toBe('Solid month — savings on track')
    expect(result.score).toBe(80)
    expect(result.advice).toBe('Consider moving the surplus to your vacation goal this month.')
    expect(result.bullets).toHaveLength(3)
    expect(result.generatedAt).toBeTruthy()
  })

  // 2a. Score clamping — above 100
  it('clamps score 150 to 100', () => {
    const raw = validBriefingJson({ score: 150 })
    expect(parseBriefingText(raw).score).toBe(100)
  })

  // 2b. Score clamping — below 0
  it('clamps score -20 to 0', () => {
    const raw = validBriefingJson({ score: -20 })
    expect(parseBriefingText(raw).score).toBe(0)
  })

  // 2c. Score rounding
  it('rounds score 73.7 to 74', () => {
    const raw = validBriefingJson({ score: 73.7 })
    expect(parseBriefingText(raw).score).toBe(74)
  })

  // 3. Bullets trimmed to 6
  it('trims bullets array to first 6 when AI returns 8', () => {
    const eightBullets = Array.from({ length: 8 }, (_, i) => ({
      type: 'neutral',
      text: `Bullet ${i + 1}`,
    }))
    const raw = validBriefingJson({ bullets: eightBullets })
    const result = parseBriefingText(raw)
    expect(result.bullets).toHaveLength(6)
    expect(result.bullets[5].text).toBe('Bullet 6')
  })

  // 4. Bullets padded to 3 when fewer provided
  it('pads bullets to minimum 3 when AI returns 1 bullet', () => {
    const raw = validBriefingJson({ bullets: [{ type: 'positive', text: 'Only one bullet' }] })
    const result = parseBriefingText(raw)
    expect(result.bullets).toHaveLength(3)
    expect(result.bullets[0].text).toBe('Only one bullet')
    expect(result.bullets[1]).toEqual({ type: 'neutral', text: '' })
    expect(result.bullets[2]).toEqual({ type: 'neutral', text: '' })
  })

  // 5. Invalid bullet type defaults to 'neutral'
  it('defaults invalid bullet type "great" to "neutral"', () => {
    const raw = validBriefingJson({
      bullets: [
        { type: 'great', text: 'Some insight' },
        { type: 'positive', text: 'Another insight' },
        { type: 'neutral', text: 'Third insight' },
      ],
    })
    const result = parseBriefingText(raw)
    expect(result.bullets[0].type).toBe('neutral')
    expect(result.bullets[0].text).toBe('Some insight')
  })

  // 6. All 4 valid bullet types pass through unchanged
  it('accepts all 4 valid bullet types: positive, warning, urgent, neutral', () => {
    const raw = validBriefingJson({
      bullets: [
        { type: 'positive', text: 'Good news' },
        { type: 'warning',  text: 'Watch out' },
        { type: 'urgent',   text: 'Act now' },
        { type: 'neutral',  text: 'FYI' },
      ],
    })
    const result = parseBriefingText(raw)
    expect(result.bullets[0].type).toBe('positive')
    expect(result.bullets[1].type).toBe('warning')
    expect(result.bullets[2].type).toBe('urgent')
    expect(result.bullets[3].type).toBe('neutral')
  })

  // 7. Markdown fence stripping
  it('strips markdown ```json ... ``` fences and parses correctly', () => {
    const inner = validBriefingJson({ score: 65 })
    const fenced = `\`\`\`json\n${inner}\n\`\`\``
    const result = parseBriefingText(fenced)
    expect(result.score).toBe(65)
    expect(result.headline).toBe('Solid month — savings on track')
  })

  it('strips plain ``` fences without language tag', () => {
    const inner = validBriefingJson({ score: 50 })
    const fenced = `\`\`\`\n${inner}\n\`\`\``
    expect(parseBriefingText(fenced).score).toBe(50)
  })

  // 8. Invalid JSON — does NOT throw; returns safe defaults
  it('returns safe defaults on invalid JSON — does not throw', () => {
    const result = parseBriefingText('this is not json at all')
    expect(result.headline).toBe('')
    expect(result.advice).toBe('')
    expect(result.score).toBe(0)
    expect(result.bullets).toHaveLength(3)
    result.bullets.forEach(b => expect(b.type).toBe('neutral'))
  })

  // 9. Missing headline defaults to ''
  it('defaults headline to empty string when missing', () => {
    const raw = JSON.stringify({ score: 70, bullets: [], advice: 'Some advice' })
    expect(parseBriefingText(raw).headline).toBe('')
  })

  // 10. Missing advice defaults to ''
  it('defaults advice to empty string when missing', () => {
    const raw = JSON.stringify({ headline: 'Good month', score: 70, bullets: [] })
    expect(parseBriefingText(raw).advice).toBe('')
  })

  // 11. Non-string headline defaults to ''
  it('defaults headline to empty string when it is a number (wrong type)', () => {
    const raw = JSON.stringify({ headline: 42, score: 50, bullets: [], advice: 'ok' })
    expect(parseBriefingText(raw).headline).toBe('')
  })

  // 12. generatedAt is an ISO timestamp
  it('generatedAt matches ISO date format /^\\d{4}-\\d{2}-\\d{2}T/', () => {
    const result = parseBriefingText(validBriefingJson())
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  // Extra: empty bullets array is padded to 3
  it('pads empty bullets array to 3 neutral placeholders', () => {
    const raw = validBriefingJson({ bullets: [] })
    const result = parseBriefingText(raw)
    expect(result.bullets).toHaveLength(3)
    result.bullets.forEach(b => {
      expect(b.type).toBe('neutral')
      expect(b.text).toBe('')
    })
  })
})

// ─── generateMonthlyBriefing() — integration tests (Anthropic API) ────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

function mockAnthropicFetch(mockFetch: ReturnType<typeof vi.fn>, responseText: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ text: responseText }],
    }),
  })
}

describe('generateMonthlyBriefing() — Anthropic path', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-anthropic-key')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  // 13. Happy path — correct URL + parsed BriefingResult returned
  it('calls fetch exactly once with the Anthropic messages URL', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockAnthropicFetch(mockFetch, validBriefingJson())
    await generateMonthlyBriefing(makePayload(), 'en')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe(ANTHROPIC_URL)
  })

  it('returns a parsed BriefingResult from the API response', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockAnthropicFetch(mockFetch, validBriefingJson({ score: 75 }))
    const result = await generateMonthlyBriefing(makePayload(), 'en')
    expect(result.score).toBe(75)
    expect(result.headline).toBe('Solid month — savings on track')
    expect(result.bullets.length).toBeGreaterThanOrEqual(3)
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  // 15. API error — fetch returns 429
  it('throws with "API error 429" when fetch returns status 429', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    })
    await expect(generateMonthlyBriefing(makePayload(), 'en')).rejects.toThrow('API error 429')
  })

  // 16. Hebrew lang — prompt body includes 'Hebrew'
  it('includes "Hebrew" in the request body when lang is "he"', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockAnthropicFetch(mockFetch, validBriefingJson())
    await generateMonthlyBriefing(makePayload(), 'he')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const promptText: string = body.messages[0].content[0].text
    expect(promptText).toContain('Hebrew')
  })
})

// 14. No API key — throws 'No API key configured'
describe('generateMonthlyBriefing() — no API key', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Ensure neither key is set
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
    vi.stubEnv('VITE_GEMINI_API_KEY', '')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('throws "No API key configured" when no API key is set', async () => {
    await expect(generateMonthlyBriefing(makePayload(), 'en')).rejects.toThrow('No API key configured')
  })
})
