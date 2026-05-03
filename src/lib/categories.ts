/**
 * Shared category definitions for expenses.
 * Single source of truth — imported by Expenses.tsx, History.tsx, and Overview.tsx.
 */
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
