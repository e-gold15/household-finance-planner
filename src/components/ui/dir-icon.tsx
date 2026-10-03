import * as React from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DirIconProps extends LucideProps {
  /** A directional lucide icon (ChevronLeft/Right, ArrowLeft/Right, …) drawn for LTR. */
  icon: LucideIcon
}

/**
 * Mirrors a directional icon in RTL (P1-4), e.g. a "next" ChevronRight points
 * left in Hebrew. Decorative by default (aria-hidden) — label the button.
 */
const DirIcon = React.forwardRef<SVGSVGElement, DirIconProps>(({ icon: Icon, className, ...props }, ref) => (
  <Icon ref={ref} aria-hidden="true" className={cn('rtl:-scale-x-100', className)} {...props} />
))
DirIcon.displayName = 'DirIcon'

export { DirIcon }
