import { describe, it, expect } from 'vitest'
import {
  parseMoneyInput,
  sanitizeMoneyTyping,
  toMoneyInputValue,
  currencySymbol,
} from '@/lib/moneyInput'

// ─── parseMoneyInput() ────────────────────────────────────────────────────

describe('parseMoneyInput()', () => {
  describe('empty and invalid input', () => {
    it('returns null for an empty string (field may be empty, never forced to 0)', () => {
      expect(parseMoneyInput('')).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(parseMoneyInput('   ')).toBeNull()
    })

    it('returns null for null / undefined', () => {
      expect(parseMoneyInput(null)).toBeNull()
      expect(parseMoneyInput(undefined)).toBeNull()
    })

    it('returns null for non-numeric text', () => {
      expect(parseMoneyInput('abc')).toBeNull()
      expect(parseMoneyInput('12abc')).toBeNull()
      expect(parseMoneyInput('abc12')).toBeNull()
    })

    it('returns null for a lone separator or sign', () => {
      expect(parseMoneyInput('.')).toBeNull()
      expect(parseMoneyInput(',')).toBeNull()
      expect(parseMoneyInput('-')).toBeNull()
      expect(parseMoneyInput('₪')).toBeNull()
    })

    it('returns null for multiple decimal points', () => {
      expect(parseMoneyInput('1.2.3')).toBeNull()
    })

    it('returns null for exponent notation, Infinity and NaN', () => {
      expect(parseMoneyInput('1e5')).toBeNull()
      expect(parseMoneyInput('Infinity')).toBeNull()
      expect(parseMoneyInput('NaN')).toBeNull()
    })

    it('returns null for misplaced thousands separators', () => {
      expect(parseMoneyInput('12,345,67')).toBeNull()
      expect(parseMoneyInput('1234,')).toBeNull()
    })
  })

  describe('plain numbers', () => {
    it('parses integers', () => {
      expect(parseMoneyInput('50')).toBe(50)
      expect(parseMoneyInput('0')).toBe(0)
    })

    it('parses decimals', () => {
      expect(parseMoneyInput('12.5')).toBe(12.5)
      expect(parseMoneyInput('.5')).toBe(0.5)
      expect(parseMoneyInput('12.')).toBe(12)
    })

    it('trims surrounding whitespace', () => {
      expect(parseMoneyInput('  42  ')).toBe(42)
    })
  })

  describe('grouping separators', () => {
    it('parses "1,234.5" as 1234.5', () => {
      expect(parseMoneyInput('1,234.5')).toBe(1234.5)
    })

    it('parses "1,234" as 1234 (comma + 3 digits = thousands)', () => {
      expect(parseMoneyInput('1,234')).toBe(1234)
    })

    it('parses multi-group values', () => {
      expect(parseMoneyInput('1,234,567.89')).toBe(1234567.89)
    })

    it('treats a single comma followed by 1–2 digits as a decimal comma', () => {
      expect(parseMoneyInput('12,5')).toBe(12.5)
      expect(parseMoneyInput('12,50')).toBe(12.5)
    })

    it('accepts space / NBSP grouping', () => {
      expect(parseMoneyInput('1 234')).toBe(1234)
      expect(parseMoneyInput('1 234')).toBe(1234)
    })
  })

  describe('currency symbols', () => {
    it('parses "₪50" as 50', () => {
      expect(parseMoneyInput('₪50')).toBe(50)
    })

    it('parses a trailing symbol and Intl he-IL output with bidi marks', () => {
      expect(parseMoneyInput('50 ₪')).toBe(50)
      const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(1234.5)
      expect(parseMoneyInput(formatted)).toBe(1234.5)
    })

    it('parses other currencies and ISO codes', () => {
      expect(parseMoneyInput('$1,234.50')).toBe(1234.5)
      expect(parseMoneyInput('€99')).toBe(99)
      expect(parseMoneyInput('£7.25')).toBe(7.25)
      expect(parseMoneyInput('100 ILS')).toBe(100)
    })
  })

  describe('negative input', () => {
    it('parses a leading minus', () => {
      expect(parseMoneyInput('-50')).toBe(-50)
    })

    it('parses a unicode minus sign', () => {
      expect(parseMoneyInput('−50')).toBe(-50)
    })

    it('parses a minus before a currency symbol', () => {
      expect(parseMoneyInput('-₪1,000')).toBe(-1000)
    })

    it('parses accounting parentheses', () => {
      expect(parseMoneyInput('(50)')).toBe(-50)
    })

    it('parses a trailing minus', () => {
      expect(parseMoneyInput('50-')).toBe(-50)
    })

    it('parses Intl he-IL negative output', () => {
      const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(-1234)
      expect(parseMoneyInput(formatted)).toBe(-1234)
    })

    it('returns null for negatives when allowNegative is false', () => {
      expect(parseMoneyInput('-50', { allowNegative: false })).toBeNull()
    })

    it('still parses positives when allowNegative is false', () => {
      expect(parseMoneyInput('50', { allowNegative: false })).toBe(50)
    })

    it('normalises -0 to 0', () => {
      expect(Object.is(parseMoneyInput('-0'), 0)).toBe(true)
    })
  })
})

// ─── sanitizeMoneyTyping() ────────────────────────────────────────────────

describe('sanitizeMoneyTyping()', () => {
  it('keeps digits, dots and commas', () => {
    expect(sanitizeMoneyTyping('1,234.5')).toBe('1,234.5')
  })

  it('strips letters and symbols', () => {
    expect(sanitizeMoneyTyping('₪12a3')).toBe('123')
  })

  it('keeps an empty string empty', () => {
    expect(sanitizeMoneyTyping('')).toBe('')
  })

  it('drops the minus sign by default', () => {
    expect(sanitizeMoneyTyping('-50')).toBe('50')
  })

  it('keeps a single leading minus when negatives are allowed', () => {
    expect(sanitizeMoneyTyping('-50', true)).toBe('-50')
    expect(sanitizeMoneyTyping('5-0', true)).toBe('50')
    expect(sanitizeMoneyTyping('−50', true)).toBe('-50')
  })
})

// ─── toMoneyInputValue() ──────────────────────────────────────────────────

describe('toMoneyInputValue()', () => {
  it('returns "" for null, undefined and NaN', () => {
    expect(toMoneyInputValue(null)).toBe('')
    expect(toMoneyInputValue(undefined)).toBe('')
    expect(toMoneyInputValue(Number.NaN)).toBe('')
  })

  it('stringifies numbers without grouping', () => {
    expect(toMoneyInputValue(1234.5)).toBe('1234.5')
    expect(toMoneyInputValue(0)).toBe('0')
  })

  it('round-trips through parseMoneyInput', () => {
    for (const n of [0, 1, 12.5, 1234, 99999.99]) {
      expect(parseMoneyInput(toMoneyInputValue(n))).toBe(n)
    }
  })
})

// ─── currencySymbol() ─────────────────────────────────────────────────────

describe('currencySymbol()', () => {
  it('returns ₪ for ILS in he-IL', () => {
    expect(currencySymbol('ILS', 'he-IL')).toBe('₪')
  })

  it('returns $ for USD in en-US', () => {
    expect(currencySymbol('USD', 'en-US')).toBe('$')
  })

  it('returns € for EUR in de-DE', () => {
    expect(currencySymbol('EUR', 'de-DE')).toBe('€')
  })

  it('defaults to ILS / he-IL', () => {
    expect(currencySymbol()).toBe('₪')
  })
})
