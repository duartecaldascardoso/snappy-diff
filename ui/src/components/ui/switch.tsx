import { cn } from '@/lib/utils'

export function Switch({
  checked,
  disabled,
  onChange,
  className,
  ...props
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-foreground' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'block size-4 rounded-full bg-background transition-transform',
          checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
