import { ShoppingCart } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFinance } from '@/context/FinanceContext'
import { useNav } from '@/context/NavContext'
import { t } from '@/lib/utils'

// ─── Quick Add sheet — STUB (Wave 1B) ─────────────────────────────────────────
// Wave 2B replaces the body with the full Quick Add form (PRD §2.D).
// The public signature below is the contract and must not change.

export function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useFinance()
  const { navigate } = useNav()
  const lang = data.language

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add expense', 'הוספת הוצאה', lang)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t(
            'Quick Add is coming soon. For now, add expenses from the Expenses tab.',
            'הוספה מהירה תגיע בקרוב. בינתיים אפשר להוסיף הוצאות מלשונית ההוצאות.',
            lang
          )}
        </p>
        <div className="flex justify-end">
          <Button
            className="min-h-[44px] gap-2"
            onClick={() => {
              onOpenChange(false)
              navigate('expenses')
            }}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {t('Go to Expenses', 'מעבר להוצאות', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
