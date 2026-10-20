import { Check, ChevronRight, CircleAlert, ListFilter, StepForward } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { CommitBars, Donut } from '@/components/charts'
import { FileIcon } from '@/components/file-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import type { Commit, Entry } from '@/lib/diff'
import { areas, breakdown, effort, hints, type Kind, kindOf } from '@/lib/insights'
import type { Moves } from '@/lib/moved'
import type { Comment } from '@/lib/review'
import { cn } from '@/lib/utils'

const KIND_COLOR: Record<Kind, string> = {
  code: 'var(--kind-code)',
  tests: 'var(--kind-tests)',
  config: 'var(--kind-config)',
  ci: 'var(--kind-ci)',
  docs: 'var(--kind-docs)',
  generated: 'var(--muted-foreground)',
}

const n = (v: number) => v.toLocaleString()
const plural = (v: number, word: string) => `${n(v)} ${word}${v === 1 ? '' : 's'}`
const duration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`)
const split = (path: string) => {
  const at = path.lastIndexOf('/')
  return at < 0 ? { name: path, dir: '' } : { name: path.slice(at + 1), dir: path.slice(0, at + 1) }
}

/** A headline number with a label above and a line of context below. */
function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-xl font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{children}</span>
    </div>
  )
}

function Panel({ title, aside, className, children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-lg border p-4', className)}>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Added and removed as two bars on one shared scale, 2px apart. */
function ChangeBar({ add, del, max }: { add: number; del: number; max: number }) {
  return (
    <div className="flex h-1.5 w-full gap-0.5" title={`+${add} −${del}`}>
      {add > 0 && <div className="rounded-sm bg-added" style={{ width: `${(add / max) * 100}%` }} />}
      {del > 0 && <div className="rounded-sm bg-deleted" style={{ width: `${(del / max) * 100}%` }} />}
    </div>
  )
}

/**
 * The diff at a glance: headline numbers, where the changes are, what kind they
 * are, how they built up commit by commit, the biggest files, and what deserves
 * a closer look.
 */
export function Overview({
  open,
  onOpenChange,
  subject,
  entries,
  isViewed,
  moves,
  churn,
  commits,
  commit,
  comments,
  onFile,
  onFilter,
  onCommit,
  onReviewNext,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is under review, e.g. "main...feature". */
  subject: string
  entries: Entry[]
  isViewed: (e: Entry) => boolean
  moves: Moves
  /** Commits that touched each file, when the range has commits. */
  churn: Map<string, number>
  /** The range's commits, newest first; empty for patches and the working tree. */
  commits: Commit[]
  /** The commit narrowed down to, if any. */
  commit?: string
  comments: Comment[]
  onFile: (id: string) => void
  /** Sets the file filter: a folder path or `is:<kind>`. */
  onFilter: (filter: string) => void
  onCommit?: (sha?: string) => void
  onReviewNext?: () => void
}) {
  const [prefix, setPrefix] = useState('')
  const work = useMemo(() => effort(entries, moves, isViewed), [entries, moves, isViewed])
  const rows = useMemo(() => areas(entries, prefix, isViewed), [entries, prefix, isViewed])
  const kinds = useMemo(() => breakdown(entries), [entries])
  const flags = useMemo(() => hints(entries, churn), [entries, churn])
  const largest = useMemo(() => entries.toSorted((a, b) => b.add + b.del - (a.add + a.del)).slice(0, 8), [entries])

  const add = kinds.reduce((t, k) => t + k.add, 0)
  const del = kinds.reduce((t, k) => t + k.del, 0)
  const types = { new: 0, change: 0, deleted: 0, renamed: 0 }
  for (const e of entries) types[e.file.type.startsWith('rename') ? 'renamed' : (e.file.type as 'new' | 'change' | 'deleted')]++
  const viewed = entries.filter(isViewed).length
  const done = work.lines ? Math.round((work.viewedLines / work.lines) * 100) : 100
  const open_ = comments.filter((c) => !c.outdated)
  const authors = new Set(commits.map((c) => c.author)).size
  const maxArea = Math.max(1, ...rows.map((r) => Math.max(r.add, r.del)))
  const maxFile = Math.max(1, ...largest.map((e) => Math.max(e.add, e.del)))
  const crumbs = prefix.split('/').filter(Boolean)

  const go = (run: () => void) => {
    onOpenChange(false)
    run()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>Overview</DialogTitle>
            <DialogDescription className="truncate font-mono text-xs">{subject}</DialogDescription>
          </div>
          {onReviewNext && (
            <Button size="sm" className="mr-8 shrink-0 text-xs" onClick={() => go(onReviewNext)}>
              <StepForward />
              Review next file
            </Button>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Files changed" value={n(entries.length)}>
              {[
                types.new && `${types.new} new`,
                types.change && `${types.change} modified`,
                types.deleted && `${types.deleted} deleted`,
                types.renamed && `${types.renamed} renamed`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Tile>
            <Tile
              label="Lines"
              value={
                <>
                  <span className="text-added">+{n(add)}</span> <span className="text-deleted">−{n(del)}</span>
                </>
              }
            >
              net {add - del >= 0 ? '+' : '−'}
              {n(Math.abs(add - del))}
            </Tile>
            <Tile label="Reading time" value={`≈ ${duration(work.minutes)}`}>
              {plural(work.lines, 'line')} to read
              {work.moved > 0 && ` · ${n(work.moved)} moved`}
            </Tile>
            <Tile label="Reviewed" value={`${done}%`}>
              <span className="flex items-center gap-2">
                <Progress value={done} className="h-1" aria-label="Reviewed" />
                <span className="shrink-0">
                  {viewed}/{entries.length} files
                </span>
              </span>
            </Tile>
            <Tile label="Comments" value={n(open_.length)}>
              {comments.length
                ? [
                    comments.length - open_.length && `${comments.length - open_.length} code changed`,
                    comments.filter((c) => c.sent).length && `${comments.filter((c) => c.sent).length} on GitHub`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'open'
                : 'none yet'}
            </Tile>
            <Tile label="Commits" value={commits.length ? n(commits.length) : '—'}>
              {commits.length ? `by ${plural(authors, 'author')}` : 'not a commit range'}
            </Tile>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              title="Changes by area"
              className="lg:col-span-3"
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
                        className="max-w-32 truncate hover:text-foreground"
                        onClick={() => setPrefix(crumbs.slice(0, i + 1).join('/') + '/')}
                      >
                        {c}
                      </button>
                    </span>
                  ))}
                </nav>
              }
            >
              <ul className="flex max-h-72 flex-col overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.path} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                      title={r.deeper ? `Open ${r.path}` : `Go to ${r.path}`}
                      onClick={() =>
                        r.deeper ? setPrefix(r.path) : go(() => onFile(entries.find((e) => e.file.name === r.path)!.id))
                      }
                    >
                      <span className="flex items-center gap-3 text-sm">
                        <span className="min-w-0 truncate font-mono text-[13px]">
                          {r.name}
                          {r.deeper && <span className="text-muted-foreground">/</span>}
                        </span>
                        <span className="ml-auto flex shrink-0 gap-3 text-xs text-muted-foreground tabular-nums">
                          {r.deeper && (
                            <span>
                              {r.viewed}/{r.files} viewed
                            </span>
                          )}
                          <span className="w-24 text-right">
                            <span className="text-added">+{n(r.add)}</span> <span className="text-deleted">−{n(r.del)}</span>
                          </span>
                        </span>
                      </span>
                      <ChangeBar add={r.add} del={r.del} max={maxArea} />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={`Show only ${r.path} in the file tree`}
                      className={cn('opacity-0 group-hover:opacity-100', !r.deeper && 'invisible')}
                      onClick={() => go(() => onFilter(r.path))}
                    >
                      <ListFilter />
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="By kind" className="lg:col-span-2">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
                <Donut
                  slices={kinds.map((k) => ({
                    id: k.id,
                    label: k.label,
                    value: k.add + k.del,
                    color: KIND_COLOR[k.id],
                    detail: (
                      <div className="tabular-nums">
                        <span className="text-added">+{n(k.add)}</span> <span className="text-deleted">−{n(k.del)}</span>
                      </div>
                    ),
                  }))}
                  center={n(add + del)}
                  sub="lines changed"
                  onSelect={(id) => go(() => onFilter(`is:${id}`))}
                />
                <ul className="flex w-full min-w-0 flex-col gap-0.5 text-sm">
                  {kinds.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        title={`Show only ${k.label.toLowerCase()} files`}
                        onClick={() => go(() => onFilter(`is:${k.id}`))}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/60"
                      >
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: KIND_COLOR[k.id] }} />
                        <span>{k.label}</span>
                        <span className="ml-auto text-xs tabular-nums">
                          <span className="text-added">+{n(k.add)}</span> <span className="text-deleted">−{n(k.del)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          {commits.length > 1 && (
            <Panel
              title="Commits"
              aside={
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px] bg-added" /> added
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px] bg-deleted" /> removed
                  </span>
                  {commit && onCommit && (
                    <Button variant="ghost" size="xs" onClick={() => go(() => onCommit(undefined))}>
                      Show all commits
                    </Button>
                  )}
                </span>
              }
            >
              <CommitBars commits={commits} selected={commit} onSelect={onCommit && ((sha) => go(() => onCommit(sha)))} />
            </Panel>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel title="Largest files" className="lg:col-span-3">
              <ul className="flex flex-col">
                {largest.map((e) => {
                  const { name, dir } = split(e.file.name)
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => go(() => onFile(e.id))}
                        className="grid w-full grid-cols-[1fr_5rem_6rem_1rem] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileIcon type={e.file.type} className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate font-mono text-[13px]">
                            <span className="text-muted-foreground">{dir}</span>
                            {name}
                          </span>
                          <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                            {kindOf(e)}
                          </Badge>
                        </span>
                        <ChangeBar add={e.add} del={e.del} max={maxFile} />
                        <span className="text-right text-xs tabular-nums">
                          <span className="text-added">+{n(e.add)}</span> <span className="text-deleted">−{n(e.del)}</span>
                        </span>
                        {isViewed(e) ? <Check className="size-4 text-muted-foreground" aria-label="Viewed" /> : <span />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title="Worth a closer look" className="lg:col-span-2">
              {flags.length ? (
                <ul className="flex flex-col gap-3">
                  {flags.map((f) => (
                    <li key={f.id} className="flex gap-2.5">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium">{f.label}</span>
                        <span className="text-xs text-muted-foreground">{f.detail}</span>
                        {f.files.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {f.files.slice(0, 5).map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => go(() => onFile(e.id))}
                                className="max-w-full truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                              >
                                {e.file.name}
                              </button>
                            ))}
                            {f.files.length > 5 && (
                              <span className="text-[11px] text-muted-foreground">+{f.files.length - 5} more</span>
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing stands out.</p>
              )}
            </Panel>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
