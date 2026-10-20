import { ChevronRight, CircleAlert, ListFilter, StepForward } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Entry } from '@/lib/diff'
import { areas, effort, hints, KINDS, type Kind, kindOf } from '@/lib/insights'
import type { Moves } from '@/lib/moved'

const KIND_COLOR: Record<Kind, string> = {
  code: 'var(--kind-code)',
  tests: 'var(--kind-tests)',
  config: 'var(--kind-config)',
  ci: 'var(--kind-ci)',
  docs: 'var(--kind-docs)',
  generated: 'var(--muted-foreground)',
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
const duration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`)

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Added and removed as two bars sharing one scale, with a 2px gap between them. */
function ChangeBar({ add, del, max }: { add: number; del: number; max: number }) {
  return (
    <div className="flex h-2 w-full gap-0.5" title={`+${add} −${del}`}>
      {add > 0 && <div className="rounded-sm bg-added" style={{ width: `${(add / max) * 100}%` }} />}
      {del > 0 && <div className="rounded-sm bg-deleted" style={{ width: `${(del / max) * 100}%` }} />}
    </div>
  )
}

/**
 * What a diff is made of, at a glance: how much needs reading and how far you
 * are, where the changes are, what kind they are, and what deserves attention.
 */
export function Overview({
  open,
  onOpenChange,
  entries,
  isViewed,
  moves,
  churn,
  onFile,
  onFilter,
  onReviewNext,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: Entry[]
  isViewed: (e: Entry) => boolean
  moves: Moves
  /** Commits that touched each file, when the range has commits. */
  churn: Map<string, number>
  onFile: (id: string) => void
  /** Narrows the file tree to a folder. */
  onFilter: (prefix: string) => void
  onReviewNext?: () => void
}) {
  const [prefix, setPrefix] = useState('')
  const totals = useMemo(() => entries.reduce((t, e) => ({ add: t.add + e.add, del: t.del + e.del }), { add: 0, del: 0 }), [entries])
  const work = useMemo(() => effort(entries, moves, isViewed), [entries, moves, isViewed])
  const rows = useMemo(() => areas(entries, prefix, isViewed), [entries, prefix, isViewed])
  const kinds = useMemo(() => {
    const lines = new Map<Kind, number>()
    for (const e of entries) lines.set(kindOf(e), (lines.get(kindOf(e)) ?? 0) + e.add + e.del)
    return KINDS.map((k) => ({ ...k, lines: lines.get(k.id) ?? 0 })).filter((k) => k.lines > 0)
  }, [entries])
  const flags = useMemo(() => hints(entries, churn), [entries, churn])
  const maxArea = Math.max(1, ...rows.map((r) => Math.max(r.add, r.del)))
  const kindTotal = kinds.reduce((n, k) => n + k.lines, 0) || 1
  const crumbs = prefix.split('/').filter(Boolean)
  const done = work.lines ? Math.round((work.viewedLines / work.lines) * 100) : 100

  const go = (run: () => void) => {
    onOpenChange(false)
    run()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] gap-5 overflow-y-auto pb-6 sm:max-w-[440px]">
        <SheetHeader className="pb-0">
          <SheetTitle>Overview</SheetTitle>
          <SheetDescription>
            {plural(entries.length, 'file')} · <span className="text-added">+{totals.add.toLocaleString()}</span>{' '}
            <span className="text-deleted">−{totals.del.toLocaleString()}</span>
          </SheetDescription>
        </SheetHeader>

        <Section title="Review">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">≈ {duration(work.minutes)}</span>
            <span className="text-xs text-muted-foreground">to read {plural(work.lines, 'line')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {[
              work.moved > 0 && `${plural(work.moved, 'moved line')} not counted`,
              work.skipped > 0 && `${plural(work.skipped, 'generated or renamed line')} skipped`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Every changed line counts.'}
          </p>
          <div className="flex items-center gap-3">
            <Progress value={done} className="h-1.5" aria-label="Reviewed" />
            <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{done}% reviewed</span>
          </div>
          {onReviewNext && (
            <Button variant="outline" size="sm" className="mt-1 self-start text-xs" onClick={() => go(onReviewNext)}>
              <StepForward />
              Review next file
              <kbd className="ml-1 text-muted-foreground">n</kbd>
            </Button>
          )}
        </Section>

        <Section
          title="Changes by area"
          aside={
            <nav className="flex min-w-0 items-center text-xs text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={() => setPrefix('')}>
                all
              </button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center">
                  <ChevronRight className="size-3" />
                  <button
                    type="button"
                    className="max-w-28 truncate hover:text-foreground"
                    onClick={() => setPrefix(crumbs.slice(0, i + 1).join('/') + '/')}
                  >
                    {c}
                  </button>
                </span>
              ))}
            </nav>
          }
        >
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li key={r.path} className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent/60">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                  title={r.deeper ? `Open ${r.path}` : `Go to ${r.path}`}
                  onClick={() => (r.deeper ? setPrefix(r.path) : go(() => onFile(entries.find((e) => e.file.name === r.path)!.id)))}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 truncate font-mono text-[13px]">
                      {r.name}
                      {r.deeper && '/'}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      <span className="text-added">+{r.add}</span> <span className="text-deleted">−{r.del}</span>
                      {r.deeper && <span className="ml-2">{r.viewed}/{r.files} viewed</span>}
                    </span>
                  </span>
                  <ChangeBar add={r.add} del={r.del} max={maxArea} />
                </button>
                {r.deeper && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={`Show only ${r.path} in the file tree`}
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => go(() => onFilter(r.path))}
                  >
                    <ListFilter />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="By kind">
          <div className="flex h-2.5 w-full gap-0.5" role="img" aria-label="Changed lines by kind">
            {kinds.map((k) => (
              <div
                key={k.id}
                className="rounded-sm"
                style={{ width: `${(k.lines / kindTotal) * 100}%`, background: KIND_COLOR[k.id] }}
                title={`${k.label}: ${plural(k.lines, 'line')} (${Math.round((k.lines / kindTotal) * 100)}%)`}
              />
            ))}
          </div>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-1">
            {kinds.map((k) => (
              <li key={k.id} className="flex items-center gap-1.5 text-xs">
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: KIND_COLOR[k.id] }} />
                <span>{k.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{k.lines.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Section>

        {flags.length > 0 && (
          <Section title="Worth a closer look">
            <ul className="flex flex-col gap-3">
              {flags.map((f) => (
                <li key={f.id} className="flex gap-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.detail}</span>
                    {f.files.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {f.files.slice(0, 6).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => go(() => onFile(e.id))}
                            className="max-w-full truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                          >
                            {e.file.name}
                          </button>
                        ))}
                        {f.files.length > 6 && <span className="text-[11px] text-muted-foreground">+{f.files.length - 6} more</span>}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </SheetContent>
    </Sheet>
  )
}
