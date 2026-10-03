/**
 * Shared category definitions for expenses.
 * Single source of truth — imported by Expenses.tsx, History.tsx, and Overview.tsx.
 */
import {
  Briefcase,
  Car,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  PiggyBank,
  Shapes,
  ShieldCheck,
  Shirt,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ExpenseCategory } from '@/types'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; en: string; he: string }[] = [
  { value: 'housing',   en: 'Housing',   he: 'דיור' },
  { value: 'food',      en: 'Food',      he: 'מזון' },
  { value: 'transport', en: 'Transport', he: 'תחבורה' },
  { value: 'education', en: 'Education', he: 'חינוך' },
  { value: 'leisure',   en: 'Leisure',   he: 'פנאי' },
  { value: 'health',    en: 'Health',    he: 'בריאות' },
  { value: 'utilities', en: 'Utilities', he: 'שירותים' },
  { value: 'clothing',  en: 'Clothing',  he: 'ביגוד' },
  { value: 'insurance', en: 'Insurance', he: 'ביטוח' },
  { value: 'savings',   en: 'Savings',   he: 'חיסכון' },
  { value: 'work',      en: 'Work',      he: 'עבודה' },
  { value: 'other',     en: 'Other',     he: 'אחר' },
]

// ─── v4: fixed category → colour + icon map (audit P1-9) ──────────────────
// Colours are stable across devices and renders (never assigned by array
// index). Reuse for chart slices, legend dots, list-row strips and icons.

export type ChartColorToken =
  | 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'chart-6'
  | 'chart-7' | 'chart-8' | 'chart-9' | 'chart-10' | 'chart-11' | 'chart-neutral'

export interface CategoryMeta {
  /** Design token name (CSS var without `--`). */
  colorVar: ChartColorToken
  /** Ready-to-use CSS colour, e.g. for Recharts `fill` or inline `style`. */
  color: string
  /** Tailwind background class for dots / strips (literal, so JIT keeps it). */
  bgClass: string
  icon: LucideIcon
}

export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  housing:   { colorVar: 'chart-7',       color: 'hsl(var(--chart-7))',       bgClass: 'bg-chart-7',       icon: House },
  food:      { colorVar: 'chart-3',       color: 'hsl(var(--chart-3))',       bgClass: 'bg-chart-3',       icon: UtensilsCrossed },
  transport: { colorVar: 'chart-2',       color: 'hsl(var(--chart-2))',       bgClass: 'bg-chart-2',       icon: Car },
  education: { colorVar: 'chart-10',      color: 'hsl(var(--chart-10))',      bgClass: 'bg-chart-10',      icon: GraduationCap },
  leisure:   { colorVar: 'chart-9',       color: 'hsl(var(--chart-9))',       bgClass: 'bg-chart-9',       icon: Gamepad2 },
  health:    { colorVar: 'chart-5',       color: 'hsl(var(--chart-5))',       bgClass: 'bg-chart-5',       icon: HeartPulse },
  utilities: { colorVar: 'chart-8',       color: 'hsl(var(--chart-8))',       bgClass: 'bg-chart-8',       icon: Zap },
  clothing:  { colorVar: 'chart-4',       color: 'hsl(var(--chart-4))',       bgClass: 'bg-chart-4',       icon: Shirt },
  insurance: { colorVar: 'chart-11',      color: 'hsl(var(--chart-11))',      bgClass: 'bg-chart-11',      icon: ShieldCheck },
  savings:   { colorVar: 'chart-1',       color: 'hsl(var(--chart-1))',       bgClass: 'bg-chart-1',       icon: PiggyBank },
  work:      { colorVar: 'chart-6',       color: 'hsl(var(--chart-6))',       bgClass: 'bg-chart-6',       icon: Briefcase },
  other:     { colorVar: 'chart-neutral', color: 'hsl(var(--chart-neutral))', bgClass: 'bg-chart-neutral', icon: Shapes },
}

/** Meta for any category string; unknown / legacy values fall back to `other`. */
export function getCategoryMeta(category: string | null | undefined): CategoryMeta {
  return (category && Object.prototype.hasOwnProperty.call(CATEGORY_META, category)
    ? CATEGORY_META[category as ExpenseCategory]
    : CATEGORY_META.other)
}
