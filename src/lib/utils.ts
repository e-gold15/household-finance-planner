import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Currency, Locale } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function t(en: string, he: string, lang: 'en' | 'he'): string {
  return lang === 'he' ? he : en
}

export function formatCurrency(
  amount: number,
  currency: Currency = 'ILS',
  locale: Locale = 'he-IL'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Generate a cryptographically random ID using the Web Crypto API.
 * Uses crypto.randomUUID() — a v4 UUID with 122 bits of entropy.
 * This is safe in all modern browsers and Node ≥ 14.17.
 */
export function generateId(): string {
  return crypto.randomUUID()
}

export function monthsUntil(deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  return Math.max(
    0,
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  )
}
