import { cn, t } from '@/lib/utils'
import { getCategoryMeta } from '@/lib/categories'
import type { ExpenseCategory } from '@/types'

export interface CategoryOption {
  value: ExpenseCategory
  en: string
  he: string
}

/**
 * Category icon tile tinted with the category's stable chart colour.
 * Decorative — always pair with a visible label.
 */
export function CategoryIcon({ category, size = 'md' }: { category: ExpenseCategory; size?: 'sm' | 'md' }) {
  const meta = getCategoryMeta(category)
  const Icon = meta.icon
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center',
        size === 'sm' ? 'h-6 w-6 rounded-full' : 'h-9 w-9 rounded-lg'
      )}
      style={{ backgroundColor: `hsl(var(--${meta.colorVar}) / 0.15)`, color: meta.color }}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  )
}

/**
 * Wrapping grid of category chips (icon + label, ≥ 44px). Single-select
 * (radio semantics): click/Enter/Space selects. Order follows `options`, and
 * flex-wrap mirrors automatically in RTL.
 */
export function CategoryChips({
  options,
  value,
  onChange,
  lang,
  labelledBy,
  invalid = false,
}: {
  options: ReadonlyArray<CategoryOption>
  value: ExpenseCategory | null
  onChange: (category: ExpenseCategory) => void
  lang: 'en' | 'he'
  /** id of the visible label element. */
  labelledBy: string
  invalid?: boolean
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {options.map((c) => {
        const selected = value === c.value
        const label = t(c.en, c.he, lang)
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(c.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              selected
                ? 'border-primary bg-primary-subtle text-primary-strong'
                : 'border-input bg-background text-foreground hover:bg-muted'
            )}
          >
            <CategoryIcon category={c.value} size="sm" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
