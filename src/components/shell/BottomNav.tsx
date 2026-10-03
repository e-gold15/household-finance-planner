import { useState, type MouseEvent, type ReactNode } from 'react'
import { MoreHorizontal, Plus, type LucideIcon } from 'lucide-react'
import { useNav } from '@/context/NavContext'
import { useFinance } from '@/context/FinanceContext'
import { getNavItem, isMoreTab, tabToHash, type Tab } from '@/lib/navigation'
import { cn, t } from '@/lib/utils'
import { MoreSheet } from './MoreSheet'

type Lang = 'en' | 'he'

/** Lets modified clicks (new tab / window) fall through to the browser. */
function isModifiedClick(e: MouseEvent): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}

function NavSlot({
  icon: Icon,
  label,
  active,
  children,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  children?: ReactNode
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
          active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          'text-xs leading-none',
          active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
        )}
      >
        {label}
      </span>
      {children}
    </>
  )
}

const slotClass =
  'flex flex-1 min-w-0 min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Mobile bottom navigation (<768px): Home · Expenses · [+] · Goals · More.
 * Flex order mirrors automatically in RTL.
 */
export function BottomNav({ lang }: { lang: Lang }) {
  const { tab, navigate, openQuickAdd } = useNav()
  // Quick Add is disabled until household data has loaded (see AppQuickAdd).
  const { isLoading } = useFinance()
  const [moreOpen, setMoreOpen] = useState(false)

  const tabLink = (id: Tab) => {
    const item = getNavItem(id)
    const active = tab === id
    const label = t(item.shortEn ?? item.en, item.shortHe ?? item.he, lang)
    return (
      <a
        key={id}
        href={tabToHash(id)}
        aria-current={active ? 'page' : undefined}
        className={slotClass}
        onClick={(e) => {
          if (isModifiedClick(e)) return
          e.preventDefault()
          navigate(id)
        }}
      >
        <NavSlot icon={item.icon} label={label} active={active} />
      </a>
    )
  }

  const moreActive = isMoreTab(tab)
  const addLabel = t('Add expense', 'הוספת הוצאה', lang)

  return (
    <>
      <nav
        aria-label={t('Main navigation', 'ניווט ראשי', lang)}
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex h-16 max-w-4xl items-stretch px-1">
          {tabLink('overview')}
          {tabLink('expenses')}

          {/* Raised primary "+" — opens Quick Add */}
          <button
            type="button"
            onClick={openQuickAdd}
            disabled={isLoading}
            aria-label={addLabel}
            title={addLabel}
            className="group flex flex-1 min-w-0 flex-col items-center justify-end gap-1 pb-1.5 focus-visible:outline-none disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card transition-transform group-active:scale-95 group-focus-visible:ring-ring"
            >
              <Plus className="h-6 w-6" />
            </span>
            <span aria-hidden="true" className="text-xs font-medium leading-none text-muted-foreground">
              {t('Add', 'הוספה', lang)}
            </span>
          </button>

          {tabLink('goals')}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            className={slotClass}
          >
            <NavSlot icon={MoreHorizontal} label={t('More', 'עוד', lang)} active={moreActive} />
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} lang={lang} />
    </>
  )
}
