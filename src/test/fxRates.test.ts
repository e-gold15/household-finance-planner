/**
 * Tests for fxRates.ts — convertAmount, formatRateNote, getRates.
 *
 * getRates tests mock `fetch` via vi.stubGlobal and rely on the
 * in-memory localStorage mock from setup.ts (reset in beforeEach).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { convertAmount, formatRateNote, getRates } from '@/lib/fxRates'
import type { FxRateCache } from '@/lib/fxRates'

// ─── Helper ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
}

function makeCache(overrides?: Partial<FxRateCache>): FxRateCache {
  return {
    date: todayStr(),
    base: 'ILS',
    rates: { USD: 0.269, EUR: 0.247, GBP: 0.212 },
    ...overrides,
  }
}

// ─── convertAmount() ──────────────────────────────────────────────────────────

describe('convertAmount()', () => {
  // 1. Same currency — no conversion needed
  it('returns amount unchanged when source === target', () => {
    const result = convertAmount(1000, 'ILS', 'ILS', makeCache())
    expect(result).toBe(1000)
  })

  // 2. Base as target: USD → ILS
  //    cache: 1 ILS = 0.269 USD  ⟹  1 USD = 1/0.269 ILS ≈ 29739 ILS (for 8000 USD)
  it('converts source to base currency (base as target)', () => {
    const cache = makeCache({ base: 'ILS', rates: { USD: 0.269 } })
    const result = convertAmount(8000, 'USD', 'ILS', cache)
    expect(result).not.toBeNull()
    expect(result as number).toBeCloseTo(8000 / 0.269, 2)
  })

  // 3. Base as source: ILS → USD
  //    cache: 1 ILS = 0.269 USD  ⟹  10000 ILS * 0.269 = 2690 USD
  it('converts base currency to target (base as source)', () => {
    const cache = makeCache({ base: 'ILS', rates: { USD: 0.269 } })
    const result = convertAmount(10000, 'ILS', 'USD', cache)
    expect(result).toBeCloseTo(10000 * 0.269, 5)
  })

  // 4. Cross-rate: USD → EUR via ILS base
  //    1 ILS = 0.269 USD, 1 ILS = 0.247 EUR
  //    1000 USD → (1000 / 0.269) ILS → * 0.247 EUR
  it('converts via cross-rate (source → base → target)', () => {
    const cache = makeCache({ base: 'ILS', rates: { USD: 0.269, EUR: 0.247 } })
    const result = convertAmount(1000, 'USD', 'EUR', cache)
    const expected = (1000 / 0.269) * 0.247
    expect(result).not.toBeNull()
    expect(result as number).toBeCloseTo(expected, 4)
  })

  // 5. Null cache → null
  it('returns null when cache is null', () => {
    expect(convertAmount(1000, 'USD', 'EUR', null)).toBeNull()
  })

  // 6. Missing rate in cache → null
  it('returns null when source currency rate is missing from cache', () => {
    // Cache has no GBP entry
    const cache = makeCache({ rates: { USD: 0.269 } })
    expect(convertAmount(500, 'GBP', 'ILS', cache)).toBeNull()
  })

  it('returns null when target currency rate is missing from cache', () => {
    // Cache has no GBP entry; base is ILS, source is ILS
    const cache = makeCache({ rates: { USD: 0.269 } })
    expect(convertAmount(500, 'ILS', 'GBP', cache)).toBeNull()
  })

  it('returns null when neither currency is base and one rate is missing', () => {
    // USD → GBP cross-rate, but GBP is absent
    const cache = makeCache({ rates: { USD: 0.269 } })
    expect(convertAmount(1000, 'USD', 'GBP', cache)).toBeNull()
  })
})

// ─── formatRateNote() ─────────────────────────────────────────────────────────

describe('formatRateNote()', () => {
  // 7. Updated today
  it('contains "updated today" when cache date is today', () => {
    const cache = makeCache({ date: todayStr() })
    const note = formatRateNote('USD', 'ILS', cache, 'en')
    expect(note).toContain('updated today')
    expect(note).toContain('1 USD')
  })

  // 8. Updated yesterday
  it('contains "updated yesterday" when cache date is yesterday', () => {
    const cache = makeCache({ date: yesterdayStr() })
    const note = formatRateNote('USD', 'ILS', cache, 'en')
    expect(note).toContain('updated yesterday')
  })

  // 9. Estimated offline
  it('contains "estimated (offline)" when isEstimated is true', () => {
    const cache = makeCache({ isEstimated: true })
    const note = formatRateNote('USD', 'ILS', cache, 'en')
    expect(note).toContain('estimated (offline)')
  })

  // 10. Hebrew — updated today
  it('returns Hebrew label when lang is "he" and date is today', () => {
    const cache = makeCache({ date: todayStr() })
    const note = formatRateNote('USD', 'ILS', cache, 'he')
    expect(note).toContain('מעודכן היום')
  })

  it('returns Hebrew label for yesterday', () => {
    const cache = makeCache({ date: yesterdayStr() })
    const note = formatRateNote('USD', 'ILS', cache, 'he')
    expect(note).toContain('מעודכן אתמול')
  })

  it('returns Hebrew label for estimated offline', () => {
    const cache = makeCache({ isEstimated: true })
    const note = formatRateNote('USD', 'ILS', cache, 'he')
    expect(note).toContain('מוערך (אופליין)')
  })

  // 11. Null cache → empty string
  it('returns empty string when cache is null', () => {
    expect(formatRateNote('USD', 'ILS', null, 'en')).toBe('')
  })

  // 12. Same currency — convertAmount returns the amount (not null), note is non-empty
  it('returns a non-empty string for same-currency pair (1 ILS = ₪1.00)', () => {
    const cache = makeCache()
    const note = formatRateNote('ILS', 'ILS', cache, 'en')
    // convertAmount(1, 'ILS', 'ILS', cache) = 1 → valid note
    expect(note).not.toBe('')
    expect(note).toContain('1 ILS')
    expect(note).toContain('₪1.00')
  })

  it('returns empty string when source rate is missing and currencies differ', () => {
    // GBP not in cache — convertAmount returns null
    const cache = makeCache({ rates: { USD: 0.269 } })
    const note = formatRateNote('GBP', 'USD', cache, 'en')
    expect(note).toBe('')
  })

  it('contains the correct currency symbol for EUR target', () => {
    const cache = makeCache()
    const note = formatRateNote('ILS', 'EUR', cache, 'en')
    expect(note).toContain('€')
  })

  it('uses date string label for old cache date', () => {
    const oldDate = '2025-01-15'
    const cache = makeCache({ date: oldDate })
    const note = formatRateNote('USD', 'ILS', cache, 'en')
    expect(note).toContain(`updated ${oldDate}`)
  })
})

// ─── getRates() ───────────────────────────────────────────────────────────────

const CACHE_KEY = 'hf-fx-rates'

describe('getRates()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 13. Cache hit — same day, same base → no fetch
  it('returns cached value and does not call fetch when cache is fresh', async () => {
    const cache = makeCache({ base: 'ILS', date: todayStr() })
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    const result = await getRates('ILS')

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.base).toBe('ILS')
    expect(result!.date).toBe(todayStr())
  })

  // Cache hit — different base → should fetch (cache is for different currency)
  it('fetches fresh data when cached base differs from requested base', async () => {
    const cache = makeCache({ base: 'USD', date: todayStr() })
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: todayStr(),
        rates: { USD: 0.269, EUR: 0.247 },
      }),
    })

    const result = await getRates('ILS')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result!.base).toBe('ILS')
  })

  // 14. Cache miss → fetch succeeds → result saved to localStorage
  it('fetches and caches fresh data when localStorage is empty', async () => {
    // localStorage is already clear from setup.ts beforeEach

    const freshDate = todayStr()
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: freshDate,
        rates: { USD: 0.269, EUR: 0.247, GBP: 0.212 },
      }),
    })

    const result = await getRates('ILS')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).not.toBeNull()
    expect(result!.base).toBe('ILS')
    expect(result!.date).toBe(freshDate)
    expect(result!.rates.USD).toBe(0.269)

    // Verify it was persisted to localStorage
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(stored.base).toBe('ILS')
    expect(stored.rates.USD).toBe(0.269)
  })

  it('calls the Frankfurter API with the correct base currency', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ date: todayStr(), rates: { EUR: 1.08 } }),
    })

    await getRates('USD')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('base=USD')
  })

  // 15. Fetch fails, stale cache exists → returns stale with isEstimated: true
  it('returns stale cache with isEstimated true when fetch fails', async () => {
    const staleDate = '2025-03-01'
    const staleCache = makeCache({ date: staleDate, base: 'ILS' })
    localStorage.setItem(CACHE_KEY, JSON.stringify(staleCache))

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await getRates('ILS')

    expect(result).not.toBeNull()
    expect(result!.isEstimated).toBe(true)
    expect(result!.date).toBe(staleDate)
    expect(result!.rates.USD).toBe(0.269)
  })

  it('returns stale cache with isEstimated true when fetch returns non-ok status', async () => {
    const staleCache = makeCache({ date: '2025-01-10', base: 'ILS' })
    localStorage.setItem(CACHE_KEY, JSON.stringify(staleCache))

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await getRates('ILS')

    expect(result).not.toBeNull()
    expect(result!.isEstimated).toBe(true)
  })

  // 16. Fetch fails, no cache → returns null
  it('returns null when fetch fails and there is no cached data', async () => {
    // localStorage is empty from setup.ts beforeEach

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await getRates('ILS')

    expect(result).toBeNull()
  })

  it('returns null when fetch returns non-ok and localStorage is empty', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })

    const result = await getRates('ILS')

    expect(result).toBeNull()
  })
})
