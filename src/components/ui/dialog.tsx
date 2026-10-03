import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useDirection } from '@radix-ui/react-direction'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Responsive dialog (PRD §2.C).
 *
 * - `variant="auto"` (default): below 640px it renders as a bottom sheet
 *   (full width, 24px top corners, max 90dvh, safe-area padding, drag handle —
 *   dragging the handle down > 80px dismisses). At ≥ 640px it is a centred
 *   dialog `w-[calc(100%-2rem)] max-w-lg`.
 * - `variant="center"`: always a centred dialog.
 *
 * Positioning uses a flex wrapper instead of translate(-50%), so the
 * tailwindcss-animate enter/exit transforms are clean and nothing overflows
 * the viewport at 375px (P0-4). Existing callers passing
 * `className="max-h-[85vh] overflow-y-auto"` / `max-w-*` keep working —
 * tailwind-merge lets the caller's values win.
 */

type DialogVariant = 'auto' | 'center'

const DialogVariantContext = React.createContext<DialogVariant>('center')

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const SHEET_DISMISS_THRESHOLD_PX = 80

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<T | null>).current = value
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-overlay/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:duration-slow data-[state=closed]:duration-base data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** 'auto' = bottom sheet < 640px, centred dialog ≥ 640px. 'center' = always centred. */
  variant?: DialogVariant
  /** Accessible label for the close X. Defaults to "Close" / "סגור" based on the Radix direction. */
  closeLabel?: string
  /** Hide the close X (Esc, overlay tap and drag still dismiss). */
  hideClose?: boolean
  overlayClassName?: string
}

const SHEET_CLASSES =
  // < 640px: bottom sheet
  'w-full max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-b-0 px-4 pt-0 ' +
  'pb-[calc(1rem_+_env(safe-area-inset-bottom))] ' +
  'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom ' +
  // ≥ 640px: centred dialog
  'sm:w-[calc(100%-2rem)] sm:max-h-[85vh] sm:rounded-lg sm:border-b sm:p-6 ' +
  'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 ' +
  'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95'

const CENTER_CLASSES =
  'w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto overscroll-contain rounded-lg p-6 ' +
  'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, variant = 'auto', closeLabel, hideClose = false, overlayClassName, ...props }, forwardedRef) => {
    const dir = useDirection()
    const label = closeLabel ?? (dir === 'rtl' ? 'סגור' : 'Close')

    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const closeRef = React.useRef<HTMLButtonElement | null>(null)
    const dragStartY = React.useRef<number | null>(null)
    const dragDelta = React.useRef(0)

    const composedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        setRef(forwardedRef, node)
      },
      [forwardedRef]
    )

    const resetDrag = (animate: boolean) => {
      const el = contentRef.current
      dragStartY.current = null
      dragDelta.current = 0
      if (!el) return
      el.style.transition = animate ? 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)' : ''
      el.style.transform = ''
    }

    const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragStartY.current = e.clientY
      dragDelta.current = 0
      e.currentTarget.setPointerCapture(e.pointerId)
      if (contentRef.current) contentRef.current.style.transition = 'none'
    }

    const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return
      const dy = Math.max(0, e.clientY - dragStartY.current)
      dragDelta.current = dy
      if (contentRef.current) contentRef.current.style.transform = `translate3d(0, ${dy}px, 0)`
    }

    const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      const shouldDismiss = dragDelta.current > SHEET_DISMISS_THRESHOLD_PX
      if (shouldDismiss) {
        dragStartY.current = null
        dragDelta.current = 0
        // Let Radix own the close (fires onOpenChange(false) + exit animation).
        closeRef.current?.click()
      } else {
        resetDrag(true)
      }
    }

    const onHandlePointerCancel = () => resetDrag(true)

    const isSheet = variant === 'auto'

    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <div
          className={cn(
            'pointer-events-none fixed inset-0 z-50 flex justify-center',
            isSheet ? 'items-end sm:items-center' : 'items-center'
          )}
        >
          <DialogVariantContext.Provider value={variant}>
            <DialogPrimitive.Content
              ref={composedRef}
              className={cn(
                'pointer-events-auto relative grid max-w-lg gap-4 border bg-surface-2 text-card-foreground shadow-lg outline-none',
                'ease-standard data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-slow data-[state=closed]:duration-base data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                isSheet ? SHEET_CLASSES : CENTER_CLASSES,
                className
              )}
              {...props}
            >
              {isSheet && (
                <div
                  aria-hidden="true"
                  data-sheet-handle=""
                  className="sticky top-0 z-10 -mx-4 -mb-2 flex cursor-grab touch-none select-none justify-center bg-surface-2 pb-2 pt-3 active:cursor-grabbing sm:hidden"
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerCancel}
                >
                  <div className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
                </div>
              )}
              {children}
              {hideClose ? (
                <DialogPrimitive.Close ref={closeRef} className="hidden" tabIndex={-1} aria-hidden="true" />
              ) : (
                <DialogPrimitive.Close
                  ref={closeRef}
                  title={label}
                  className="absolute end-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">{label}</span>
                </DialogPrimitive.Close>
              )}
            </DialogPrimitive.Content>
          </DialogVariantContext.Provider>
        </div>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = DialogPrimitive.Content.displayName

/** `pe-12` keeps the title clear of the close X (P0-5). */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 pe-12 text-start', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

/**
 * Action row. Inside a bottom sheet it is sticky at the bottom (Save always
 * visible, clears the home indicator); in a centred dialog it is a normal
 * end-aligned row. Buttons stack full-width on mobile.
 *
 * The sticky inset is the *negative* of the sheet's bottom padding: browsers
 * stick relative to the scroll container's padding-deflated box, so with
 * `bottom-0` the footer floated 1rem (+ safe area) above the sheet edge and
 * scrolling content showed through the strip underneath it.
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const variant = React.useContext(DialogVariantContext)
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        variant === 'auto' &&
          'sticky -bottom-[calc(1rem_+_env(safe-area-inset-bottom))] z-10 -mx-4 -mb-[calc(1rem_+_env(safe-area-inset-bottom))] border-t bg-surface-2 px-4 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mb-0 sm:border-t-0 sm:bg-transparent sm:p-0',
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-snug tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog, DialogTrigger, DialogPortal, DialogOverlay,
  DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
}
export type { DialogVariant }
