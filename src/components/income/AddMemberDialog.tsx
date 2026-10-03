import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/utils'
import { FieldRow } from './fields'

/** Add Household Member — controlled so both the toolbar and the empty state can open it. */
export function AddMemberDialog({
  open, onOpenChange, onAdd, lang,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
  lang: 'en' | 'he'
}) {
  const [name, setName] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add Household Member', 'הוסף חבר משק בית', lang)}</DialogTitle>
        </DialogHeader>
        <FieldRow label={t('Name', 'שם', lang)} htmlFor="add-member-name">
          <Input
            id="add-member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('e.g. Alex', 'למשל: אלכס', lang)}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </FieldRow>
        <DialogFooter>
          <Button className="w-full" disabled={!name.trim()} onClick={submit}>
            {t('Add', 'הוסף', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
