import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-7 max-w-52 min-w-0 appearance-none truncate rounded-md border border-input bg-transparent py-0 pr-7 pl-2.5 font-mono text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
          className,
        )}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
