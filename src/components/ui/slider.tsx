import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { useDirection } from '@radix-ui/react-direction'
import { cn } from '@/lib/utils'

/**
 * Direction comes from Radix `DirectionProvider` (or an explicit `dir` prop,
 * passed straight through), so in RTL the range fills from the right.
 * Thumb is 24px with a 44px invisible hit area.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, dir, ...props }, ref) => {
  // `@radix-ui/react-slider` bundles its own nested `react-direction` copy, so
  // the app DirectionProvider does not reach it — pass the app direction explicitly.
  const appDir = useDirection()
  const thumbCount = Array.isArray(props.value)
    ? props.value.length
    : Array.isArray(props.defaultValue)
      ? props.defaultValue.length
      : 1
  return (
    <SliderPrimitive.Root
      ref={ref}
      dir={dir ?? appDir}
      className={cn(
        'relative flex min-h-11 w-full touch-none select-none items-center data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: Math.max(1, thumbCount) }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="relative block h-6 w-6 cursor-grab rounded-full border-2 border-primary bg-background shadow-md transition-[box-shadow,transform] duration-fast before:absolute before:-inset-2.5 before:rounded-full before:content-[''] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
