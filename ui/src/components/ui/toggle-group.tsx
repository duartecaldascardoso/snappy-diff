import { Button } from '@/components/ui/button'

/** A row of mutually exclusive buttons. */
export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-md border p-0.5">
      {options.map(([v, label]) => (
        <Button key={v} className="h-6" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </Button>
      ))}
    </div>
  )
}
