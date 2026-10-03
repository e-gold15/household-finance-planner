import { useState } from 'react'
import { PencilLine } from 'lucide-react'
import { Money } from '@/components/ui/money'
import { MoneyInput } from '@/components/ui/money-input'
import { useFinance } from '@/context/FinanceContext'
import { parseMoneyInput, toMoneyInputValue } from '@/lib/moneyInput'
import { categoryLabel } from '@/lib/quickAdd'
import { t } from '@/lib/utils'
import type { ExpenseCategory } from '@/types'

/**
 * Inline monthly budget limit per category. Blur / Enter commits; an empty,
 * zero or invalid value clears the limit (same as v2.2); Escape cancels.
 */
export function BudgetEditor({ category, lang }: { category: ExpenseCategory; lang: 'en' | 'he' }) {
  const { data, updateCategoryBudget } = useFinance()
  const budget = data.categoryBudgets[category]
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const catName = categoryLabel(category, lang)

  const commit = () => {
    const n = parseMoneyInput(value, { allowNegative: false })
    updateCategoryBudget(category, n === null || n <= 0 ? undefined : n)
    setEditing(false)
  }

  if (editing) {
    return (
      <MoneyInput
        value={value}
        onValueChange={(v) => setValue(v)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.stopPropagation()
            setEditing(false)
          }
        }}
        currency={data.currency}
        locale={data.locale}
        wrapperClassName="w-36"
        autoFocus
        aria-label={t(`Monthly budget limit for ${catName}`, `תקציב חודשי עבור ${catName}`, lang)}
      />
    )
  }

  const label = budget
    ? t(`Edit budget limit for ${catName}`, `עריכת תקציב עבור ${catName}`, lang)
    : t(`Set budget limit for ${catName}`, `הגדרת תקציב עבור ${catName}`, lang)

  return (
    <button
      type="button"
      onClick={() => {
        setValue(toMoneyInputValue(budget))
        setEditing(true)
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={label}
      aria-label={label}
    >
      <PencilLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {budget ? <Money value={budget} currency={data.currency} locale={data.locale} /> : t('Set budget', 'הגדר תקציב', lang)}
    </button>
  )
}
