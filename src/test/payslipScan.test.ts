/**
 * Tests for payslip scan response parsing (v4.x).
 *
 * The `scanPayslip` function makes a live API call, so we test the
 * pure parsing/validation logic that runs on the API response.
 * All parse-logic tests are self-contained with no network calls.
 *
 * Architecture (Gemini):
 *   payslip file (image/PDF) → single fetch to Gemini generateContent with inline base64.
 *   Response is parsed by parsePayslipText (internal to aiAdvisor.ts).
 *   We mirror that parser here for unit tests, and use mocked fetch
 *   to test end-to-end through the exported scanPayslip() function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scanPayslip } from '@/lib/aiAdvisor'

// ─── Mirror the internal parse logic ─────────────────────────────────────────
// These helpers exactly match the private functions in aiAdvisor.ts so we can
// unit-test them without a network call.

import type { PayslipScanResult } from '@/lib/aiAdvisor'

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null
}

function clampOrNull(v: number | null, min: number, max: number): number | null {
  if (v === null) return null
  return Math.min(max, Math.max(min, v))
}

function positiveOrNull(v: number | null): number | null {
  if (v === null) return null
  return v > 0 ? v : null
}

function parsePayslipResponse(rawText: string): PayslipScanResult {
  const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('Could not parse payslip scan response')
  }

  return {
    gross:                    positiveOrNull(numOrNull(parsed.gross)),
    net:                      positiveOrNull(numOrNull(parsed.net)),
    base:                     positiveOrNull(numOrNull(parsed.base)),
    overtime125:              positiveOrNull(numOrNull(parsed.overtime125)),
    overtime150:              positiveOrNull(numOrNull(parsed.overtime150)),
    otherTaxable:             positiveOrNull(numOrNull(parsed.otherTaxable)),
    imputedIncome:            positiveOrNull(numOrNull(parsed.imputedIncome)),
    nonTaxableReimbursements: positiveOrNull(numOrNull(parsed.nonTaxableReimbursements)),
    taxCreditPoints:          clampOrNull(numOrNull(parsed.taxCreditPoints), 0, 20),
    pensionEmployee:          clampOrNull(numOrNull(parsed.pensionEmployee), 0, 30),
    pensionEmployer:          clampOrNull(numOrNull(parsed.pensionEmployer), 0, 30),
    educationFundEmployee:    clampOrNull(numOrNull(parsed.educationFundEmployee), 0, 20),
    educationFundEmployer:    clampOrNull(numOrNull(parsed.educationFundEmployer), 0, 20),
    severanceEmployer:        clampOrNull(numOrNull(parsed.severanceEmployer), 0, 20),
    pensionBase:              positiveOrNull(numOrNull(parsed.pensionBase)),
    studyFundBase:            positiveOrNull(numOrNull(parsed.studyFundBase)),
    studyFundEmployerAmount:  positiveOrNull(numOrNull(parsed.studyFundEmployerAmount)),
    studyFundEmployeeAmount:  positiveOrNull(numOrNull(parsed.studyFundEmployeeAmount)),
  }
}

// ─── Helper: build a full valid payslip JSON string ──────────────────────────

function validPayslipJson(overrides: Partial<Record<keyof PayslipScanResult, unknown>> = {}): string {
  const defaults: Record<string, unknown> = {
    gross: 20000,
    net: 14500,
    base: 17000,
    overtime125: 800,
    overtime150: 400,
    otherTaxable: 300,
    imputedIncome: 150,
    nonTaxableReimbursements: 500,
    taxCreditPoints: 2.25,
    pensionEmployee: 6,
    pensionEmployer: 6.5,
    educationFundEmployee: 2.5,
    educationFundEmployer: 7.5,
    severanceEmployer: 8.33,
    pensionBase: 17000,
    studyFundBase: 17000,
    studyFundEmployerAmount: 1275,
    studyFundEmployeeAmount: 425,
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

// ─── 1. Happy path — all 18 fields populated ─────────────────────────────────

describe('parsePayslipResponse() — happy path', () => {
  it('returns correct values for a fully populated Israeli payslip', () => {
    const result = parsePayslipResponse(validPayslipJson())
    expect(result.gross).toBe(20000)
    expect(result.net).toBe(14500)
    expect(result.base).toBe(17000)
    expect(result.overtime125).toBe(800)
    expect(result.overtime150).toBe(400)
    expect(result.otherTaxable).toBe(300)
    expect(result.imputedIncome).toBe(150)
    expect(result.nonTaxableReimbursements).toBe(500)
    expect(result.taxCreditPoints).toBeCloseTo(2.25)
    expect(result.pensionEmployee).toBe(6)
    expect(result.pensionEmployer).toBe(6.5)
    expect(result.educationFundEmployee).toBe(2.5)
    expect(result.educationFundEmployer).toBe(7.5)
    expect(result.severanceEmployer).toBe(8.33)
    expect(result.pensionBase).toBe(17000)
    expect(result.studyFundBase).toBe(17000)
    expect(result.studyFundEmployerAmount).toBe(1275)
    expect(result.studyFundEmployeeAmount).toBe(425)
  })

  it('returns an object with exactly 18 keys', () => {
    const result = parsePayslipResponse(validPayslipJson())
    expect(Object.keys(result)).toHaveLength(18)
  })
})

// ─── 2. Null fields — missing keys must return null ───────────────────────────

describe('parsePayslipResponse() — null fields', () => {
  it('returns null for all 16 fields when JSON is empty object', () => {
    const result = parsePayslipResponse('{}')
    const keys: (keyof PayslipScanResult)[] = [
      'gross', 'net', 'base', 'overtime125', 'overtime150',
      'otherTaxable', 'imputedIncome', 'nonTaxableReimbursements',
      'taxCreditPoints', 'pensionEmployee', 'pensionEmployer',
      'educationFundEmployee', 'educationFundEmployer', 'severanceEmployer',
      'pensionBase', 'studyFundBase',
    ]
    for (const key of keys) {
      expect(result[key]).toBeNull()
    }
  })

  it('returns null for individual missing monetary field (overtime125)', () => {
    const raw = validPayslipJson({ overtime125: undefined })
    const obj = JSON.parse(raw) as Record<string, unknown>
    delete obj.overtime125
    const result = parsePayslipResponse(JSON.stringify(obj))
    expect(result.overtime125).toBeNull()
  })

  it('returns null for individual missing percentage field (pensionEmployee)', () => {
    const obj = JSON.parse(validPayslipJson()) as Record<string, unknown>
    delete obj.pensionEmployee
    const result = parsePayslipResponse(JSON.stringify(obj))
    expect(result.pensionEmployee).toBeNull()
  })

  it('passes through null from JSON for monetary field', () => {
    const result = parsePayslipResponse(validPayslipJson({ imputedIncome: null }))
    expect(result.imputedIncome).toBeNull()
  })

  it('passes through null from JSON for percentage field', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployee: null }))
    expect(result.educationFundEmployee).toBeNull()
  })
})

// ─── 3. Markdown fence stripping ─────────────────────────────────────────────

describe('parsePayslipResponse() — markdown fence stripping', () => {
  it('strips ```json ... ``` fences', () => {
    const inner = validPayslipJson()
    const raw = '```json\n' + inner + '\n```'
    const result = parsePayslipResponse(raw)
    expect(result.gross).toBe(20000)
    expect(result.net).toBe(14500)
  })

  it('strips plain ``` ... ``` fences', () => {
    const inner = validPayslipJson()
    const raw = '```\n' + inner + '\n```'
    const result = parsePayslipResponse(raw)
    expect(result.gross).toBe(20000)
  })

  it('handles fences with uppercase ```JSON', () => {
    const inner = validPayslipJson()
    const raw = '```JSON\n' + inner + '\n```'
    const result = parsePayslipResponse(raw)
    expect(result.gross).toBe(20000)
  })

  it('handles clean JSON with no fences', () => {
    const result = parsePayslipResponse(validPayslipJson())
    expect(result.gross).toBe(20000)
  })
})

// ─── 4. Invalid JSON ──────────────────────────────────────────────────────────

describe('parsePayslipResponse() — invalid JSON', () => {
  it('throws "Could not parse payslip scan response" on non-JSON text', () => {
    expect(() => parsePayslipResponse('this is not json')).toThrow(
      'Could not parse payslip scan response',
    )
  })

  it('throws on empty string', () => {
    expect(() => parsePayslipResponse('')).toThrow('Could not parse payslip scan response')
  })

  it('throws on truncated JSON', () => {
    expect(() => parsePayslipResponse('{"gross": 20000')).toThrow(
      'Could not parse payslip scan response',
    )
  })

  it('throws on JSON array instead of object', () => {
    // JSON.parse of an array succeeds but does NOT have the right shape; however,
    // our numOrNull / positiveOrNull chain returns null for array elements, so
    // the parse itself should succeed — only a string-level failure throws.
    // Verify a JSON array produces all-null output (no throw).
    const result = parsePayslipResponse('[1,2,3]')
    expect(result.gross).toBeNull()
  })
})

// ─── 5. Clamp: taxCreditPoints [0, 20] ───────────────────────────────────────

describe('parsePayslipResponse() — taxCreditPoints clamp [0, 20]', () => {
  it('returns 20 when value is 25 (above max)', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: 25 }))
    expect(result.taxCreditPoints).toBe(20)
  })

  it('returns 0 when value is negative', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: -1 }))
    expect(result.taxCreditPoints).toBe(0)
  })

  it('returns 0 when value is exactly 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: 0 }))
    expect(result.taxCreditPoints).toBe(0)
  })

  it('returns 20 when value is exactly 20 (at max)', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: 20 }))
    expect(result.taxCreditPoints).toBe(20)
  })

  it('returns midrange value unchanged (2.25)', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: 2.25 }))
    expect(result.taxCreditPoints).toBeCloseTo(2.25)
  })

  it('returns null when field is missing', () => {
    const obj = JSON.parse(validPayslipJson()) as Record<string, unknown>
    delete obj.taxCreditPoints
    const result = parsePayslipResponse(JSON.stringify(obj))
    expect(result.taxCreditPoints).toBeNull()
  })
})

// ─── 6. Clamp: pensionEmployee / pensionEmployer [0, 30] ─────────────────────

describe('parsePayslipResponse() — pensionEmployee / pensionEmployer clamp [0, 30]', () => {
  it('clamps pensionEmployee above 30 → 30', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployee: 35 }))
    expect(result.pensionEmployee).toBe(30)
  })

  it('clamps pensionEmployee below 0 → 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployee: -5 }))
    expect(result.pensionEmployee).toBe(0)
  })

  it('accepts pensionEmployee = 6 (typical)', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployee: 6 }))
    expect(result.pensionEmployee).toBe(6)
  })

  it('clamps pensionEmployer above 30 → 30', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployer: 40 }))
    expect(result.pensionEmployer).toBe(30)
  })

  it('clamps pensionEmployer below 0 → 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployer: -1 }))
    expect(result.pensionEmployer).toBe(0)
  })

  it('returns null when pensionEmployer is missing', () => {
    const obj = JSON.parse(validPayslipJson()) as Record<string, unknown>
    delete obj.pensionEmployer
    const result = parsePayslipResponse(JSON.stringify(obj))
    expect(result.pensionEmployer).toBeNull()
  })
})

// ─── 7. Clamp: educationFundEmployee / educationFundEmployer [0, 20] ─────────

describe('parsePayslipResponse() — educationFund clamp [0, 20]', () => {
  it('clamps educationFundEmployee above 20 → 20', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployee: 25 }))
    expect(result.educationFundEmployee).toBe(20)
  })

  it('clamps educationFundEmployee below 0 → 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployee: -3 }))
    expect(result.educationFundEmployee).toBe(0)
  })

  it('accepts educationFundEmployee = 2.5 (typical)', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployee: 2.5 }))
    expect(result.educationFundEmployee).toBeCloseTo(2.5)
  })

  it('clamps educationFundEmployer above 20 → 20', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployer: 22 }))
    expect(result.educationFundEmployer).toBe(20)
  })

  it('clamps educationFundEmployer below 0 → 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ educationFundEmployer: -0.1 }))
    expect(result.educationFundEmployer).toBe(0)
  })

  it('returns null when educationFundEmployer is missing', () => {
    const obj = JSON.parse(validPayslipJson()) as Record<string, unknown>
    delete obj.educationFundEmployer
    const result = parsePayslipResponse(JSON.stringify(obj))
    expect(result.educationFundEmployer).toBeNull()
  })
})

// ─── 8. Clamp: severanceEmployer [0, 20] ─────────────────────────────────────

describe('parsePayslipResponse() — severanceEmployer clamp [0, 20]', () => {
  it('clamps severanceEmployer above 20 → 20', () => {
    const result = parsePayslipResponse(validPayslipJson({ severanceEmployer: 25 }))
    expect(result.severanceEmployer).toBe(20)
  })

  it('clamps severanceEmployer below 0 → 0', () => {
    const result = parsePayslipResponse(validPayslipJson({ severanceEmployer: -2 }))
    expect(result.severanceEmployer).toBe(0)
  })

  it('accepts severanceEmployer = 8.33 (typical legal minimum)', () => {
    const result = parsePayslipResponse(validPayslipJson({ severanceEmployer: 8.33 }))
    expect(result.severanceEmployer).toBeCloseTo(8.33)
  })

  it('accepts severanceEmployer = 20 (at max)', () => {
    const result = parsePayslipResponse(validPayslipJson({ severanceEmployer: 20 }))
    expect(result.severanceEmployer).toBe(20)
  })
})

// ─── 9. positiveOrNull — monetary fields ─────────────────────────────────────

describe('parsePayslipResponse() — positiveOrNull on monetary fields', () => {
  it('gross = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ gross: 0 }))
    expect(result.gross).toBeNull()
  })

  it('net = -100 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ net: -100 }))
    expect(result.net).toBeNull()
  })

  it('base = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ base: 0 }))
    expect(result.base).toBeNull()
  })

  it('overtime125 = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ overtime125: 0 }))
    expect(result.overtime125).toBeNull()
  })

  it('overtime150 negative → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ overtime150: -1 }))
    expect(result.overtime150).toBeNull()
  })

  it('otherTaxable = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ otherTaxable: 0 }))
    expect(result.otherTaxable).toBeNull()
  })

  it('imputedIncome = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ imputedIncome: 0 }))
    expect(result.imputedIncome).toBeNull()
  })

  it('nonTaxableReimbursements = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ nonTaxableReimbursements: 0 }))
    expect(result.nonTaxableReimbursements).toBeNull()
  })

  it('pensionBase = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionBase: 0 }))
    expect(result.pensionBase).toBeNull()
  })

  it('studyFundBase = 0 → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ studyFundBase: 0 }))
    expect(result.studyFundBase).toBeNull()
  })

  it('small positive monetary value is preserved (0.01)', () => {
    const result = parsePayslipResponse(validPayslipJson({ overtime125: 0.01 }))
    expect(result.overtime125).toBeCloseTo(0.01)
  })
})

// ─── 10. String coercion — strings must not be coerced to numbers ─────────────

describe('parsePayslipResponse() — string values rejected (no coercion)', () => {
  it('gross as string "20000" → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ gross: '20000' }))
    expect(result.gross).toBeNull()
  })

  it('net as string "14500" → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ net: '14500' }))
    expect(result.net).toBeNull()
  })

  it('taxCreditPoints as string "2.25" → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ taxCreditPoints: '2.25' }))
    expect(result.taxCreditPoints).toBeNull()
  })

  it('pensionEmployee as string "6" → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ pensionEmployee: '6' }))
    expect(result.pensionEmployee).toBeNull()
  })

  it('base as string "1234" → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ base: '1234' }))
    expect(result.base).toBeNull()
  })

  it('boolean true for gross → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ gross: true }))
    expect(result.gross).toBeNull()
  })

  it('object value for net → null', () => {
    const result = parsePayslipResponse(validPayslipJson({ net: { amount: 14500 } }))
    expect(result.net).toBeNull()
  })
})

// ─── 11. Non-Israeli payslip — only gross + net populated ────────────────────

describe('parsePayslipResponse() — non-Israeli payslip', () => {
  const nonIsraeliRaw = JSON.stringify({
    gross: 5000,
    net: 3800,
    base: null,
    overtime125: null,
    overtime150: null,
    otherTaxable: null,
    imputedIncome: null,
    nonTaxableReimbursements: null,
    taxCreditPoints: null,
    pensionEmployee: null,
    pensionEmployer: null,
    educationFundEmployee: null,
    educationFundEmployer: null,
    severanceEmployer: null,
    pensionBase: null,
    studyFundBase: null,
  })

  it('returns gross and net from non-Israeli payslip', () => {
    const result = parsePayslipResponse(nonIsraeliRaw)
    expect(result.gross).toBe(5000)
    expect(result.net).toBe(3800)
  })

  it('returns null for all Israeli-specific fields on non-Israeli payslip', () => {
    const result = parsePayslipResponse(nonIsraeliRaw)
    const israeliFields: (keyof PayslipScanResult)[] = [
      'base', 'overtime125', 'overtime150', 'otherTaxable', 'imputedIncome',
      'nonTaxableReimbursements', 'taxCreditPoints', 'pensionEmployee',
      'pensionEmployer', 'educationFundEmployee', 'educationFundEmployer',
      'severanceEmployer', 'pensionBase', 'studyFundBase',
    ]
    for (const field of israeliFields) {
      expect(result[field]).toBeNull()
    }
  })
})

// ─── 12. Extra/unknown fields in JSON are ignored gracefully ─────────────────

describe('parsePayslipResponse() — extra fields ignored', () => {
  it('ignores unknown fields not in the schema', () => {
    const raw = JSON.stringify({
      gross: 20000, net: 14500, base: 17000,
      overtime125: 800, overtime150: 400, otherTaxable: 300,
      imputedIncome: 150, nonTaxableReimbursements: 500,
      taxCreditPoints: 2.25, pensionEmployee: 6, pensionEmployer: 6.5,
      educationFundEmployee: 2.5, educationFundEmployer: 7.5,
      severanceEmployer: 8.33, pensionBase: 17000, studyFundBase: 17000,
      employerName: 'Acme Corp',
      payPeriod: '2026-04',
      currency: 'ILS',
    })
    const result = parsePayslipResponse(raw)
    expect(result.gross).toBe(20000)
    expect(Object.keys(result)).toHaveLength(18)
  })
})

// ─── scanPayslip() — integration tests via mocked fetch (Gemini) ─────────────

const GEMINI_URL_PREFIX =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function mockGeminiFetch(mockFetch: ReturnType<typeof vi.fn>, responseText: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: responseText }] } }],
    }),
  })
}

describe('scanPayslip() — Gemini path (image)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-gemini-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('makes exactly one fetch call for image payslips', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'image/jpeg', 'en')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends request to Gemini generateContent endpoint', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'image/jpeg', 'en')
    expect(mockFetch.mock.calls[0][0]).toContain(GEMINI_URL_PREFIX)
  })

  it('includes API key in URL query param', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'image/jpeg', 'en')
    expect(mockFetch.mock.calls[0][0]).toContain('key=test-gemini-key')
  })

  it('sends image as inline_data in contents.parts', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'image/jpeg', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const part = body.contents[0].parts[0]
    expect(part.inline_data.mime_type).toBe('image/jpeg')
    expect(part.inline_data.data).toBe('base64data')
  })

  it('normalises unsupported mime type (image/heic) to image/jpeg', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'image/heic', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe('image/jpeg')
  })

  it('returns correct parsed PayslipScanResult from Gemini response', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    const result = await scanPayslip('base64data', 'image/jpeg', 'en')
    expect(result.gross).toBe(20000)
    expect(result.net).toBe(14500)
    expect(result.pensionEmployee).toBe(6)
    expect(result.taxCreditPoints).toBeCloseTo(2.25)
  })

  it('throws if API request fails (HTTP 400)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad Request' } }),
    })
    await expect(scanPayslip('base64data', 'image/jpeg', 'en')).rejects.toThrow('400')
  })

  it('throws if API request fails (HTTP 500)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal Server Error' } }),
    })
    await expect(scanPayslip('base64data', 'image/jpeg', 'en')).rejects.toThrow('500')
  })

  it('works with Hebrew language param (he)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    const result = await scanPayslip('base64data', 'image/jpeg', 'he')
    expect(result.gross).toBe(20000)
  })
})

describe('scanPayslip() — Gemini path (PDF)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-gemini-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('makes exactly one fetch call for PDF payslips', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'application/pdf', 'en')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends PDF as inline_data with application/pdf mime type', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    await scanPayslip('base64data', 'application/pdf', 'en')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const part = body.contents[0].parts[0]
    expect(part.inline_data.mime_type).toBe('application/pdf')
    expect(part.inline_data.data).toBe('base64data')
  })

  it('returns parsed result for PDF payslip', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    const result = await scanPayslip('base64data', 'application/pdf', 'en')
    expect(result.gross).toBe(20000)
    expect(result.net).toBe(14500)
  })

  it('throws if PDF request fails', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad Request' } }),
    })
    await expect(scanPayslip('base64data', 'application/pdf', 'en')).rejects.toThrow('400')
  })
})

// ─── 13. File too large guard ─────────────────────────────────────────────────

describe('scanPayslip() — file size guard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-gemini-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('throws "File too large" before making an API call when file exceeds 5 MB', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    // base64 overhead: actual bytes = length * 0.75
    // To exceed 5 MB (5_242_880 bytes), we need length > 5_242_880 / 0.75 = 6_990_507
    const oversizedBase64 = 'A'.repeat(7_000_000)
    await expect(
      scanPayslip(oversizedBase64, 'image/jpeg', 'en'),
    ).rejects.toThrow('File too large')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does NOT throw for a file just under 5 MB', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockGeminiFetch(mockFetch, validPayslipJson())
    // 6_990_000 chars * 0.75 = 5_242_500 bytes — just under 5 MB
    const underLimitBase64 = 'A'.repeat(6_990_000)
    await expect(
      scanPayslip(underLimitBase64, 'image/jpeg', 'en'),
    ).resolves.toBeDefined()
  })
})

// ─── 14. No API key configured ───────────────────────────────────────────────

describe('scanPayslip() — no API key', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Ensure no API keys are set
    vi.stubEnv('VITE_GEMINI_API_KEY', '')
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('throws "No API key configured" when no key is present', async () => {
    await expect(
      scanPayslip('base64data', 'image/jpeg', 'en'),
    ).rejects.toThrow('No API key configured')
  })
})
