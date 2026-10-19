import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <span className={cn('relative inline-flex size-3.5 shrink-0', className)}>
      <input
        type="checkbox"
        className="peer size-full cursor-pointer appearance-none rounded-[4px] border border-input bg-transparent shadow-xs outline-none checked:border-foreground checked:bg-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:checked:bg-foreground"
        {...props}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-background peer-checked:block" strokeWidth={3} />
    </span>
  )
}
