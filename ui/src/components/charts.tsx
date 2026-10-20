import type { ReactNode } from 'react'
import { useTooltip } from '@/hooks/use-tooltip'
import type { Commit } from '@/lib/diff'
import { cn } from '@/lib/utils'

export type Slice = { id: string; label: string; value: number; color: string; detail?: ReactNode }

/**
 * A donut of parts of a whole: thin ring, 2px gaps between slices, the total in
 * the middle. Hover a slice for its numbers; click to act on it.
 */
export function Donut({ slices, center, sub, onSelect }: { slices: Slice[]; center: string; sub: string; onSelect?: (id: string) => void }) {
  const { show, hide, node } = useTooltip()
  const size = 168
  const stroke = 18
  const r = (size - stroke) / 2
  const length = 2 * Math.PI * r
  const total = slices.reduce((n, s) => n + s.value, 0) || 1
  const gap = slices.length > 1 ? 2 : 0
  // Where each slice starts along the ring.
  const starts = slices.reduce<number[]>((acc, _slice, i) => [...acc, i ? acc[i - 1] + (slices[i - 1].value / total) * length : 0], [])
  return (
    <div data-chart className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${center} ${sub}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const dash = Math.max(0, (s.value / total) * length - gap)
          return (
            <circle
              key={s.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${length - dash}`}
              strokeDashoffset={-starts[i]}
              className={cn('transition-opacity', onSelect && 'cursor-pointer hover:opacity-80')}
              onMouseMove={(e) =>
                show(
                  e,
                  <>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted-foreground">
                      {s.value.toLocaleString()} lines · {Math.round((s.value / total) * 100)}%
                    </div>
                    {s.detail}
                  </>,
                )
              }
              onMouseLeave={hide}
              onClick={() => onSelect?.(s.id)}
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{center}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      {node}
    </div>
  )
}

/**
 * Lines added (above the axis) and removed (below) per commit, oldest first.
 * Hover a bar for the commit; click it to review just that commit.
 */
export function CommitBars({ commits, selected, onSelect }: { commits: Commit[]; selected?: string; onSelect?: (sha: string) => void }) {
  const { show, hide, node } = useTooltip()
  const ordered = commits.toReversed()
  const maxAdd = Math.max(1, ...ordered.map((c) => c.add))
  const maxDel = Math.max(1, ...ordered.map((c) => c.del))
  const height = 132
  // The axis sits where it splits the height in proportion to the biggest bars.
  const up = Math.round((height * maxAdd) / (maxAdd + maxDel))
  return (
    <div data-chart className="relative">
      <div className="flex items-stretch gap-0.5" style={{ height }} role="img" aria-label="Lines changed per commit">
        {ordered.map((c) => (
          <button
            key={c.sha}
            type="button"
            className={cn(
              'group relative flex min-w-1 max-w-16 flex-1 flex-col rounded-sm hover:bg-accent/60',
              selected === c.sha && 'bg-accent',
            )}
            onMouseMove={(e) =>
              show(
                e,
                <>
                  <div className="max-w-64 truncate font-medium">{c.subject}</div>
                  <div className="text-muted-foreground">
                    <span className="font-mono">{c.sha.slice(0, 7)}</span> · {c.author} · {c.date}
                  </div>
                  <div className="tabular-nums">
                    <span className="text-added">+{c.add.toLocaleString()}</span>{' '}
                    <span className="text-deleted">−{c.del.toLocaleString()}</span>
                  </div>
                </>,
              )
            }
            onMouseLeave={hide}
            onClick={() => onSelect?.(c.sha)}
          >
            <div className="flex flex-col justify-end" style={{ height: up }}>
              <div className="rounded-t-[4px] bg-added" style={{ height: Math.max(c.add ? 2 : 0, (c.add / maxAdd) * up) }} />
            </div>
            <div className="h-px bg-border" />
            <div className="flex flex-col" style={{ height: height - up - 1 }}>
              <div className="rounded-b-[4px] bg-deleted" style={{ height: Math.max(c.del ? 2 : 0, (c.del / maxDel) * (height - up - 1)) }} />
            </div>
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>oldest</span>
        <span>newest</span>
      </div>
      {node}
    </div>
  )
}
