import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Status variants (success / warning / danger / info) use the `*-strong` text
 * on `*-subtle` background token pairs (≥ 4.5:1 in both themes).
 * Pair a status badge with an icon — never colour alone.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-success-subtle text-success-strong',
        warning: 'border-transparent bg-warning-subtle text-warning-strong',
        danger: 'border-transparent bg-danger-subtle text-danger-strong',
        info: 'border-transparent bg-info-subtle text-info-strong',
        subtle: 'border-transparent bg-primary-subtle text-primary-strong',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
