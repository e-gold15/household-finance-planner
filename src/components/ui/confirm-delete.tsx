import * as React from 'react'
import { t } from '@/lib/utils'
import { buttonVariants } from './button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'

export interface ConfirmDeleteProps {
  /** Name of the thing being deleted — shown in the title: Delete "Rent"? */
  itemName: string
  onConfirm: () => void
  lang: 'en' | 'he'
  /** Uncontrolled usage: the element that opens the dialog (rendered via asChild). */
  trigger?: React.ReactElement
  /** Controlled usage (e.g. opened from an ActionMenu item). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Override the default "This cannot be undone." */
  description?: React.ReactNode
  /** Override the default "Delete" / "מחק" button label. */
  confirmLabel?: string
  /** Override the full title (defaults to Delete "itemName"?). */
  title?: React.ReactNode
}

/**
 * Centred destructive confirmation that names the item (P1-16).
 * Supports either a `trigger` (uncontrolled) or `open` + `onOpenChange`.
 */
function ConfirmDelete({
  itemName,
  onConfirm,
  lang,
  trigger,
  open,
  onOpenChange,
  description,
  confirmLabel,
  title,
}: ConfirmDeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title ?? (
              <>
                {t('Delete', 'למחוק את', lang)} &quot;<bdi>{itemName}</bdi>&quot;?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t('This cannot be undone.', 'פעולה זו אינה הפיכה.', lang)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel', 'ביטול', lang)}</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onConfirm}>
            {confirmLabel ?? t('Delete', 'מחק', lang)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDelete }
