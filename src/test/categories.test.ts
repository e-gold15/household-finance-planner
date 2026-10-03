import { describe, it, expect } from 'vitest'
import { EXPENSE_CATEGORIES, CATEGORY_META, getCategoryMeta } from '@/lib/categories'

describe('EXPENSE_CATEGORIES (unchanged contract)', () => {
  it('still lists the 12 v3 categories in order', () => {
    expect(EXPENSE_CATEGORIES.map((c) => c.value)).toEqual([
      'housing', 'food', 'transport', 'education', 'leisure', 'health',
      'utilities', 'clothing', 'insurance', 'savings', 'work', 'other',
    ])
  })

  it('every category has en + he labels', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(c.en.length).toBeGreaterThan(0)
      expect(c.he.length).toBeGreaterThan(0)
    }
  })
})

describe('CATEGORY_META', () => {
  it('has an entry for every category in EXPENSE_CATEGORIES', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(CATEGORY_META[c.value]).toBeDefined()
    }
  })

  it('has no entries beyond EXPENSE_CATEGORIES', () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual(EXPENSE_CATEGORIES.map((c) => c.value).sort())
  })

  it('assigns a distinct colour to every category', () => {
    const colours = Object.values(CATEGORY_META).map((m) => m.colorVar)
    expect(new Set(colours).size).toBe(colours.length)
  })

  it('uses the neutral chart colour for "other"', () => {
    expect(CATEGORY_META.other.colorVar).toBe('chart-neutral')
  })

  it('uses HSL design tokens only (no hex / rgb)', () => {
    for (const m of Object.values(CATEGORY_META)) {
      expect(m.color).toBe(`hsl(var(--${m.colorVar}))`)
      expect(m.bgClass).toBe(`bg-${m.colorVar}`)
      expect(m.color).not.toMatch(/#|rgb/i)
    }
  })

  it('gives every category an icon component', () => {
    for (const m of Object.values(CATEGORY_META)) {
      expect(m.icon).toBeTruthy()
      expect(['function', 'object']).toContain(typeof m.icon)
    }
  })
})

describe('getCategoryMeta()', () => {
  it('returns the meta for a known category', () => {
    expect(getCategoryMeta('food')).toBe(CATEGORY_META.food)
  })

  it('falls back to "other" for unknown, empty or missing values', () => {
    expect(getCategoryMeta('legacy-thing')).toBe(CATEGORY_META.other)
    expect(getCategoryMeta('')).toBe(CATEGORY_META.other)
    expect(getCategoryMeta(undefined)).toBe(CATEGORY_META.other)
    expect(getCategoryMeta(null)).toBe(CATEGORY_META.other)
  })

  it('does not match inherited object keys', () => {
    expect(getCategoryMeta('toString')).toBe(CATEGORY_META.other)
  })
})
