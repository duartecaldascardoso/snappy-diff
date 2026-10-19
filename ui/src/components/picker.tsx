import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { PickerGroup } from '@/lib/options'

// Radix reserves the empty string for "no selection", but '' is a real value
// here (working tree, all commits, default font), so it travels as this.
const EMPTY = '\u0000'
const encode = (v: string) => (v === '' ? EMPTY : v)

/** A shadcn Select over plain string values, optionally grouped. */
export function Picker({
  value,
  onChange,
  groups,
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  groups: PickerGroup[]
  className?: string
  'aria-label': string
}) {
  return (
    <Select value={encode(value)} onValueChange={(v) => onChange(v === EMPTY ? '' : v)}>
      <SelectTrigger size="sm" aria-label={props['aria-label']} className={cn('max-w-56 text-xs', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-96">
        {groups.map((g, i) => (
          <SelectGroup key={g.label ?? i}>
            {g.label && <SelectLabel>{g.label}</SelectLabel>}
            {g.options.map((o) => (
              <SelectItem key={o.value} value={encode(o.value)} title={o.title} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
