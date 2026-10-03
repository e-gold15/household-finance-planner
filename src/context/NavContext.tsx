import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useHashTab } from '@/hooks/useHashTab'
import type { Tab } from '@/lib/navigation'

// ─── NavContext — UI state only ───────────────────────────────────────────────
// Holds the active tab (mirrored in the URL hash) and the open state of the two
// app-level overlays that can be triggered from anywhere in the shell:
//   • Quick Add sheet  — rendered once by AppShell
//   • Settings dialog  — rendered by Header (the existing settings dialog)
// Nothing here is persisted or synced.

export interface NavContextType {
  /** Active tab, derived from `location.hash`. */
  tab: Tab
  /** Switch tab (pushes a history entry so Back returns to the previous tab). */
  navigate: (tab: Tab) => void
  /** Open the app-level Quick Add sheet. */
  openQuickAdd: () => void
  /** Open the existing app Settings dialog (owned/rendered by Header). */
  openSettings: () => void

  /** Controlled state for the Quick Add sheet — consumed by AppShell. */
  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void
  /** Controlled state for the Settings dialog — consumed by Header. */
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

const NavContext = createContext<NavContextType | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const { tab, navigate } = useHashTab()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const openQuickAdd = useCallback(() => setQuickAddOpen(true), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const value = useMemo<NavContextType>(
    () => ({
      tab,
      navigate,
      openQuickAdd,
      openSettings,
      quickAddOpen,
      setQuickAddOpen,
      settingsOpen,
      setSettingsOpen,
    }),
    [tab, navigate, openQuickAdd, openSettings, quickAddOpen, settingsOpen]
  )

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavContextType {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within <NavProvider>')
  return ctx
}
