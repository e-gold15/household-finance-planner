import { useNav } from '@/context/NavContext'
import { NAV_ITEMS, tabToHash } from '@/lib/navigation'
import { cn, t } from '@/lib/utils'

/**
 * Desktop tab bar (≥768px). Rendered inside the sticky Header so the header,
 * demo banner and tabs form one opaque sticky block.
 */
export function DesktopNav({ lang }: { lang: 'en' | 'he' }) {
  const { tab, navigate } = useNav()

  return (
    <nav aria-label={t('Main navigation', 'ניווט ראשי', lang)} className="hidden md:block border-t bg-card">
      <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map(({ id, icon: Icon, en, he }) => {
          const active = tab === id
          return (
            <a
              key={id}
              href={tabToHash(id)}
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
                navigate(id)
              }}
              className={cn(
                'relative flex items-center gap-1.5 px-3 min-h-[44px] text-sm font-medium whitespace-nowrap transition-colors',
                'border-b-2 -mb-px rounded-t-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t(en, he, lang)}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
