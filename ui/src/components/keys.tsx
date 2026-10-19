import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

/** Keys to press, each in its own cap: ⌘ then K is two caps side by side. */
export function Keys({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${i}`} className="border">
          {key}
        </Kbd>
      ))}
    </span>
  )
}
