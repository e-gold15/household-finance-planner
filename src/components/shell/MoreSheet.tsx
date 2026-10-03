import { useRef } from 'react'
import { ChevronRight, Settings, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNav } from '@/context/NavContext'
import { MORE_TABS, getNavItem, type Tab } from '@/lib/navigation'
import { cn, t } from '@/lib/utils'

type Lang = 'en' | 'he'

function SheetRow({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex w-full min-h-[52px] items-center gap-3 rounded-lg px-3 text-start text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
      </button>
    </li>
  )
}

/**
 * Mobile "More" sheet — Income, Savings, History, Members, Settings.
 * Uses the shared Dialog primitive (renders as a bottom sheet on small screens).
 */
export function MoreSheet({
  open,
  onOpenChange,
  lang,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lang: Lang
}) {
  const { tab, navigate, openSettings } = useNav()
  // When handing off to another dialog (Settings), don't pull focus back to the
  // "More" trigger — the Settings dialog manages its own focus.
  const handingOffRef = useRef(false)

  const go = (id: Tab) => {
    onOpenChange(false)
    navigate(id)
  }

  const goSettings = () => {
    handingOffRef.current = true
    onOpenChange(false)
    openSettings()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          if (handingOffRef.current) {
            e.preventDefault()
            handingOffRef.current = false
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('More', 'עוד', lang)}</DialogTitle>
        </DialogHeader>
        <nav aria-label={t('More sections', 'אזורים נוספים', lang)}>
          <ul className="space-y-1">
            {MORE_TABS.map((id) => {
              const item = getNavItem(id)
              return (
                <SheetRow
                  key={id}
                  icon={item.icon}
                  label={t(item.en, item.he, lang)}
                  active={tab === id}
                  onSelect={() => go(id)}
                />
              )
            })}
            <li aria-hidden="true" className="my-1 h-px bg-border" />
            <SheetRow icon={Settings} label={t('Settings', 'הגדרות', lang)} onSelect={goSettings} />
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  )
}
