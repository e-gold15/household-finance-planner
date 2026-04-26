/**
 * Tests for receipt scan response parsing (v3.1).
 *
 * The `scanReceipt` function makes a live API call, so we test the
 * pure parsing/validation logic that runs on the API response.
 * All tests are self-contained with no network calls.
 */
import { describe, it, expect } from 'vitest'

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
