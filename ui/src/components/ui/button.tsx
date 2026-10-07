import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input',
}
const sizes = {
  sm: 'h-7 gap-1.5 px-2.5',
  icon: 'size-7',
}

export function Button({
  className,
  variant = 'ghost',
  size = 'sm',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-accent aria-pressed:text-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
