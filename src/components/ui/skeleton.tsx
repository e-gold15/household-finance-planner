import * as React from 'react'
import { cn } from '@/lib/utils'

/** Placeholder block for async content. Decorative: hidden from AT. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
