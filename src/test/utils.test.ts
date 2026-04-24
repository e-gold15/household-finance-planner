import { describe, it, expect, vi } from 'vitest'
import { cn, t, formatCurrency, formatPercent, generateId, monthsUntil } from '@/lib/utils'

// ─── cn() ─────────────────────────────────────────────────────────────────

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', undefined, null as any, 'c')).toBe('a c')
  })

  it('handles conditional objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })
})

// ─── t() ──────────────────────────────────────────────────────────────────

describe('t()', () => {
  it('returns English when lang is en', () => {
    expect(t('Hello', 'שלום', 'en')).toBe('Hello')
  })

  it('returns Hebrew when lang is he', () => {
    expect(t('Hello', 'שלום', 'he')).toBe('שלום')
  })
})

// ─── formatCurrency() ─────────────────────────────────────────────────────

describe('formatCurrency()', () => {
  it('formats ILS correctly', () => {
    const result = formatCurrency(1000, 'ILS', 'he-IL')
    expect(result).toContain('1,000')
    expect(result).toContain('₪')
  })

  it('formats USD correctly', () => {
    const result = formatCurrency(2500, 'USD', 'en-US')
    expect(result).toContain('2,500')
    expect(result).toContain('$')
  })

  it('rounds to zero decimal places', () => {
    const result = formatCurrency(1000.99, 'ILS', 'he-IL')
    expect(result).not.toContain('.')
  })

  it('handles zero', () => {
    const result = formatCurrency(0, 'ILS', 'he-IL')
    expect(result).toContain('0')
  })
})

// ─── formatPercent() ──────────────────────────────────────────────────────

describe('formatPercent()', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
  })

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('handles 100', () => {
    expect(formatPercent(100)).toBe('100.0%')
  })
})

// ─── generateId() ─────────────────────────────────────────────────────────

describe('generateId()', () => {
  it('returns a non-empty string', () => {
    expect(generateId()).toBeTruthy()
    expect(typeof generateId()).toBe('string')
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

// ─── monthsUntil() ────────────────────────────────────────────────────────

describe('monthsUntil()', () => {
  it('returns 0 for past dates', () => {
    expect(monthsUntil('2000-01-01')).toBe(0)
  })

  it('returns 0 for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(monthsUntil(today)).toBe(0)
  })

  it('returns correct months for future date', () => {
    const future = new Date()
    future.setMonth(future.getMonth() + 6)
    const result = monthsUntil(future.toISOString().slice(0, 10))
    expect(result).toBe(6)
  })

  it('returns correct months spanning years', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 2)
    const result = monthsUntil(future.toISOString().slice(0, 10))
    expect(result).toBe(24)
  })
})
