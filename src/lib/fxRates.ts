import type { Currency } from '@/types'

export interface FxRateCache {
  date: string                                    // "YYYY-MM-DD"
  base: Currency                                  // always the household currency
  rates: Partial<Record<Currency, number>>        // e.g. { USD: 0.269 } meaning 1 ILS = 0.269 USD
  isEstimated?: boolean
}

const CACHE_KEY = 'hf-fx-rates'
const SUPPORTED = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'] as const

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadCache(): FxRateCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCache(cache: FxRateCache): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

/**
 * Fetch fresh rates from Frankfurter with household currency as base.
 * Returns null on network/parse failure.
 */
async function fetchRates(base: Currency): Promise<FxRateCache | null> {
  try {
    const symbols = SUPPORTED.filter(c => c !== base).join(',')
    const url = `https://api.frankfurter.app/latest?base=${base}&symbols=${symbols}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as { date: string; rates: Record<string, number> }
    const cache: FxRateCache = {
      date: json.date ?? todayStr(),
      base,
      rates: json.rates as Partial<Record<Currency, number>>,
    }
    saveCache(cache)
    return cache
  } catch { return null }
}

/**
 * Get rates — cache-first (same calendar day), then fetch, then stale fallback.
 */
export async function getRates(base: Currency): Promise<FxRateCache | null> {
  const cached = loadCache()
  if (cached && cached.base === base && cached.date === todayStr()) return cached
  const fresh = await fetchRates(base)
  if (fresh) return fresh
  if (cached) return { ...cached, isEstimated: true }
  return null
}

/**
 * Convert `amount` in `sourceCurrency` to `targetCurrency`.
 * Returns null when no rate is available.
 * Returns amount unchanged when currencies are the same.
 */
export function convertAmount(
  amount: number,
  sourceCurrency: Currency,
  targetCurrency: Currency,
  cache: FxRateCache | null,
): number | null {
  if (sourceCurrency === targetCurrency) return amount
  if (!cache) return null
  // cache.rates[X] = "how many X per 1 base"
  if (cache.base === targetCurrency) {
    const rate = cache.rates[sourceCurrency]
    if (!rate) return null
    return amount / rate
  }
  if (cache.base === sourceCurrency) {
    const rate = cache.rates[targetCurrency]
    if (!rate) return null
    return amount * rate
  }
  // Cross-rate: source → base → target
  const rateS = cache.rates[sourceCurrency]
  const rateT = cache.rates[targetCurrency]
  if (!rateS || !rateT) return null
  return (amount / rateS) * rateT
}

/**
 * Human-readable rate note, e.g. "1 USD = ₪3.72 · updated today"
 */
export function formatRateNote(
  sourceCurrency: Currency,
  targetCurrency: Currency,
  cache: FxRateCache | null,
  lang: 'en' | 'he',
): string {
  if (!cache) return ''
  const converted = convertAmount(1, sourceCurrency, targetCurrency, cache)
  if (converted === null) return ''

  const SYMBOLS: Record<Currency, string> = {
    ILS: '₪', USD: '$', EUR: '€', GBP: '£',
    JPY: '¥', CHF: 'Fr', CAD: 'CA$', AUD: 'A$',
  }
  const sym = SYMBOLS[targetCurrency] ?? targetCurrency

  const today = todayStr()
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  let label: string
  if (cache.isEstimated) {
    label = lang === 'he' ? 'מוערך (אופליין)' : 'estimated (offline)'
  } else if (cache.date === today) {
    label = lang === 'he' ? 'מעודכן היום' : 'updated today'
  } else if (cache.date === yesterday) {
    label = lang === 'he' ? 'מעודכן אתמול' : 'updated yesterday'
  } else {
    label = lang === 'he' ? `מעודכן ${cache.date}` : `updated ${cache.date}`
  }

  return `1 ${sourceCurrency} = ${sym}${converted.toFixed(2)} · ${label}`
}
