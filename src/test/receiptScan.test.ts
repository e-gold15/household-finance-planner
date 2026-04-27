/**
 * Tests for receipt scan response parsing (v3.2).
 *
 * The `scanReceipt` function makes a live API call, so we test the
 * pure parsing/validation logic that runs on the API response.
 * All tests are self-contained with no network calls.
 *
 * Architecture (v3.2):
 *   Both images AND PDFs → single fetch to /v1/messages with inline base64.
 *   No Files API upload step — avoids CORS preflight issues in the browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scanReceipt } from '@/lib/aiAdvisor'

// ─── Pure parsing logic (mirrors scanReceipt in aiAdvisor.ts) ─────────────────

const VALID_CATEGORIES = [
  'housing', 'food', 'transport', 'education', 'leisure',
  'health', 'utilities', 'clothing', 'insurance', 'savings', 'other',
] as const

type ReceiptScanResult = { name: string; amount: number; category: string }

function parseReceiptResponse(rawText: string): ReceiptScanResult {
  // Strip markdown code fences
  const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('Could not parse receipt scan response')
  }

  const name     = typeof parsed.name     === 'string' ? parsed.name.slice(0, 60)    : 'Receipt'
  const amount   = typeof parsed.amount   === 'number' ? Math.max(0, parsed.amount)  : 0
  const catRaw   = typeof parsed.category === 'string' ? parsed.category.toLowerCase().trim() : 'other'
  const category = (VALID_CATEGORIES as readonly string[]).includes(catRaw) ? catRaw : 'other'

  return { name, amount, category }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseReceiptResponse()', () => {
  // ── Happy-path JSON ────────────────────────────────────────────────────────
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({ name: 'Supermarket', amount: 153.5, category: 'food' })
    const result = parseReceiptResponse(raw)
    expect(result).toEqual({ name: 'Supermarket', amount: 153.5, category: 'food' })
  })

  it('strips markdown code fences (```json ... ```)', () => {
    const raw = '```json\n{"name":"Pharmacy","amount":42,"category":"health"}\n```'
    const result = parseReceiptResponse(raw)
    expect(result.name).toBe('Pharmacy')
    expect(result.amount).toBe(42)
    expect(result.category).toBe('health')
  })

  it('strips plain ``` fences', () => {
    const raw = '```\n{"name":"Gas","amount":200,"category":"transport"}\n```'
    expect(parseReceiptResponse(raw).category).toBe('transport')
  })

  // ── Category validation ────────────────────────────────────────────────────
  it('accepts all valid categories', () => {
    const valid = ['housing','food','transport','education','leisure','health','utilities','clothing','insurance','savings','other']
    for (const cat of valid) {
      const raw = JSON.stringify({ name: 'Test', amount: 10, category: cat })
      expect(parseReceiptResponse(raw).category).toBe(cat)
    }
  })

  it('falls back to "other" for unknown category', () => {
    const raw = JSON.stringify({ name: 'Test', amount: 10, category: 'groceries' })
    expect(parseReceiptResponse(raw).category).toBe('other')
  })

  it('normalises category to lowercase', () => {
    const raw = JSON.stringify({ name: 'Test', amount: 10, category: 'FOOD' })
    expect(parseReceiptResponse(raw).category).toBe('food')
  })

  it('trims whitespace from category', () => {
    const raw = JSON.stringify({ name: 'Test', amount: 10, category: '  transport  ' })
    expect(parseReceiptResponse(raw).category).toBe('transport')
  })

  // ── Name validation ────────────────────────────────────────────────────────
  it('uses "Receipt" when name is missing', () => {
    const raw = JSON.stringify({ amount: 50, category: 'food' })
    expect(parseReceiptResponse(raw).name).toBe('Receipt')
  })

  it('uses "Receipt" when name is a number (wrong type)', () => {
    const raw = JSON.stringify({ name: 123, amount: 50, category: 'food' })
    expect(parseReceiptResponse(raw).name).toBe('Receipt')
  })

  it('truncates long merchant names to 60 chars', () => {
    const longName = 'A'.repeat(100)
    const raw = JSON.stringify({ name: longName, amount: 50, category: 'food' })
    expect(parseReceiptResponse(raw).name).toHaveLength(60)
  })

  // ── Amount validation ──────────────────────────────────────────────────────
  it('uses 0 when amount is missing', () => {
    const raw = JSON.stringify({ name: 'Shop', category: 'food' })
    expect(parseReceiptResponse(raw).amount).toBe(0)
  })

  it('uses 0 when amount is a string (wrong type)', () => {
    const raw = JSON.stringify({ name: 'Shop', amount: '153.5', category: 'food' })
    expect(parseReceiptResponse(raw).amount).toBe(0)
  })

  it('clamps negative amounts to 0', () => {
    const raw = JSON.stringify({ name: 'Shop', amount: -50, category: 'food' })
    expect(parseReceiptResponse(raw).amount).toBe(0)
  })

  it('preserves decimal amounts', () => {
    const raw = JSON.stringify({ name: 'Coffee', amount: 12.9, category: 'food' })
    expect(parseReceiptResponse(raw).amount).toBeCloseTo(12.9)
  })

  // ── Malformed input ────────────────────────────────────────────────────────
  it('throws on invalid JSON', () => {
    expect(() => parseReceiptResponse('not json at all')).toThrow('Could not parse')
  })

  it('throws on empty string', () => {
    expect(() => parseReceiptResponse('')).toThrow()
  })

  it('handles extra unknown fields gracefully', () => {
    const raw = JSON.stringify({ name: 'Bakery', amount: 25, category: 'food', extra: 'ignored', tax: 2.5 })
    const result = parseReceiptResponse(raw)
    expect(result).toEqual({ name: 'Bakery', amount: 25, category: 'food' })
  })

  it('handles all-missing fields with safe defaults', () => {
    const result = parseReceiptResponse('{}')
    expect(result).toEqual({ name: 'Receipt', amount: 0, category: 'other' })
  })

  // ── Real-world model output patterns ──────────────────────────────────────
  it('handles model returning amount as integer', () => {
    const raw = JSON.stringify({ name: 'Shufersal', amount: 238, category: 'food' })
    expect(parseReceiptResponse(raw).amount).toBe(238)
  })

  it('handles model wrapping in extra whitespace', () => {
    const raw = `  \n  {"name":"Rami Levy","amount":95.4,"category":"food"}  \n  `
    expect(parseReceiptResponse(raw.trim()).name).toBe('Rami Levy')
  })
})

// ─── scanReceipt() — integration tests ───────────────────────────────────────
//
// Architecture (v3.2): single fetch to /v1/messages for both images and PDFs.
// PDFs use an inline base64 "document" block — no Files API upload step.

function mockSingleFetch(mockFetch: ReturnType<typeof vi.fn>, claudeJson: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ content: [{ text: claudeJson }] }),
  })
}

describe('scanReceipt() — image path (inline base64, single fetch)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('makes exactly one fetch call for images', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Shufersal","amount":153.5,"category":"food"}')
    await scanReceipt('base64data', 'image/jpeg', 'en')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends image request directly to /v1/messages', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Shufersal","amount":153.5,"category":"food"}')
    await scanReceipt('base64data', 'image/jpeg', 'en')
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
  })

  it('image message does NOT include beta header', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Shufersal","amount":153.5,"category":"food"}')
    await scanReceipt('base64data', 'image/jpeg', 'en')
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['anthropic-beta']).toBeUndefined()
  })

  it('image content block uses inline base64 source', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Shufersal","amount":153.5,"category":"food"}')
    await scanReceipt('base64data', 'image/jpeg', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const block = body.messages[0].content[0]
    expect(block.type).toBe('image')
    expect(block.source.type).toBe('base64')
    expect(block.source.media_type).toBe('image/jpeg')
    expect(block.source.data).toBe('base64data')
  })

  it('normalises unsupported mime types (e.g. heic) to image/jpeg', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Photo","amount":50,"category":"food"}')
    await scanReceipt('base64data', 'image/heic', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].source.media_type).toBe('image/jpeg')
  })

  it('returns parsed name, amount, category for image', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Shufersal","amount":153.5,"category":"food"}')
    const result = await scanReceipt('base64data', 'image/jpeg', 'en')
    expect(result).toEqual({ name: 'Shufersal', amount: 153.5, category: 'food' })
  })

  it('throws if messages request fails', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Bad Request' } }),
    })
    await expect(scanReceipt('base64data', 'image/jpeg', 'en')).rejects.toThrow('400')
  })
})

describe('scanReceipt() — PDF path (inline base64, single fetch)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('makes exactly ONE fetch call for PDFs (no Files API upload)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Receipt","amount":200,"category":"utilities"}')
    await scanReceipt('base64data', 'application/pdf', 'en')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends PDF request to /v1/messages (not /v1/files)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Receipt","amount":200,"category":"utilities"}')
    await scanReceipt('base64data', 'application/pdf', 'en')
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
  })

  it('PDF message does NOT include beta header (inline base64, no Files API)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Receipt","amount":200,"category":"utilities"}')
    await scanReceipt('base64data', 'application/pdf', 'en')
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['anthropic-beta']).toBeUndefined()
  })

  it('PDF content block uses "document" type with inline base64 source', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Receipt","amount":200,"category":"utilities"}')
    await scanReceipt('base64data', 'application/pdf', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const block = body.messages[0].content[0]
    expect(block.type).toBe('document')
    expect(block.source.type).toBe('base64')
    expect(block.source.media_type).toBe('application/pdf')
    expect(block.source.data).toBe('base64data')
  })

  it('returns parsed name, amount, category for PDF', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockSingleFetch(mockFetch, '{"name":"Carrefour City","amount":57.57,"category":"food"}')
    const result = await scanReceipt('base64data', 'application/pdf', 'en')
    expect(result).toEqual({ name: 'Carrefour City', amount: 57.57, category: 'food' })
  })

  it('throws if PDF messages request fails', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Bad Request' } }),
    })
    await expect(scanReceipt('base64data', 'application/pdf', 'en')).rejects.toThrow('400')
  })
})
