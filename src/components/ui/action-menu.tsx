import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Styled dropdown-menu primitives (reusable, e.g. header avatar menu) ── */

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'z-50 min-w-[12rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-surface-2 p-1 text-card-foreground shadow-lg',
        // Enter animation only: exit is instant so follow-up dialogs open without delay.
        'data-[state=open]:animate-in data-[state=open]:duration-base data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  destructive?: boolean
}

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, DropdownMenuItemProps>(
  ({ className, destructive = false, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex min-h-11 cursor-default select-none items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors duration-fast data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
        destructive
          ? 'text-danger-strong focus:bg-danger-subtle focus:text-danger-strong'
          : 'text-foreground focus:bg-muted',
        className
      )}
      {...props}
    />
  )
)
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-xs font-medium text-muted-foreground', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

/* ── ActionMenu: the ⋯ row-actions menu ── */

export interface ActionMenuItem {
  /** Stable key; defaults to the label. */
  key?: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

export type ActionMenuEntry = ActionMenuItem | 'separator'

export interface ActionMenuProps {
  items: ReadonlyArray<ActionMenuEntry>
  /** Accessible name + tooltip of the ⋯ trigger, e.g. t('Actions for Rent', 'פעולות עבור שכר דירה', lang). */
  label: string
  /** Logical alignment; Radix mirrors start/end in RTL via DirectionProvider. Default 'end'. */
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Trigger icon (default MoreHorizontal "⋯"). */
  icon?: LucideIcon
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
  /** Optional explicit direction; otherwise inherited from DirectionProvider. */
  dir?: 'ltr' | 'rtl'
}

/**
 * ⋯ overflow menu for row actions. 44px trigger with title + aria-label.
 *
 * The selected item's callback runs *after* the menu has closed and focus has
 * returned to the trigger, so an action that opens a Dialog/AlertDialog gets
 * correct focus trapping and restores focus to ⋯ when it closes.
 */
function ActionMenu({
  items,
  label,
  align = 'end',
  side = 'bottom',
  icon: Icon = MoreHorizontal,
  triggerClassName,
  contentClassName,
  disabled = false,
  dir,
}: ActionMenuProps) {
  const pending = React.useRef<(() => void) | null>(null)

  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground',
          triggerClassName
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className={contentClassName}
        onCloseAutoFocus={() => {
          const fn = pending.current
          pending.current = null
          // Default focus-return to the trigger runs first; then the action.
          if (fn) setTimeout(fn, 0)
        }}
      >
        {items.map((entry, i) =>
          entry === 'separator' ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={entry.key ?? entry.label}
              destructive={entry.destructive}
              disabled={entry.disabled}
              onSelect={() => {
                pending.current = entry.onSelect
              }}
            >
              {entry.icon && <entry.icon aria-hidden="true" />}
              <span className="truncate">{entry.label}</span>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export {
  ActionMenu,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
