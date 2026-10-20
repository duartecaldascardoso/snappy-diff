import { Command as CommandPrimitive } from 'cmdk'
import { Equal, GitCommitHorizontal, History, Layers, MessageSquare, Minus, Plus, X } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useDeferredValue, useMemo, useState } from 'react'
import { FileIcon } from '@/components/file-icon'
import { FootKey, Row, Section, TypeTab } from '@/components/goto/parts'
import { Keys } from '@/components/keys'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Commit, Entry } from '@/lib/diff'
import { recentFiles, rememberFile } from '@/lib/recents'
import { diffLines, type Line } from '@/lib/lines'
import { matches } from '@/lib/match'
import type { Comment } from '@/lib/review'

export type GoToKind = 'all' | 'files' | 'lines' | 'commits' | 'comments' | 'actions'
type Kind = GoToKind

/** Most matching lines listed at once; past that, the query should be sharper. */
const LINE_LIMIT = 200

/** Something to do from the menu, with the shortcut that does it outside. */
export type Action = { id: string; label: string; icon: ReactNode; keys?: string[]; words?: string; run: () => void }

// Substring matching instead of cmdk's fuzzy scoring, like the file filter.
const filter = (value: string, search: string) => (matches(value, search) ? 1 : 0)

const split = (path: string) => {
  const at = path.lastIndexOf('/')
  return at < 0 ? { name: path, dir: '' } : { name: path.slice(at + 1), dir: path.slice(0, at) }
}

function Stat({ e }: { e: Entry }) {
  return (
    <span className="tabular-nums">
      <span className="text-added">+{e.add}</span> <span className="text-deleted">−{e.del}</span>
    </span>
  )
}

/**
 * Go anywhere from the keyboard: a file by any part of its path, a commit of the
 * range, a comment, or something to do. It opens on the files you were just in,
 * shows one kind at a time from the tabs under the search, and says at its foot
 * which keys work. Modeled on complydoc's search menu.
 */
export function GoTo({
  open,
  onOpenChange,
  reviewKey,
  entries,
  commits,
  commit,
  comments,
  actions,
  onFile,
  onCommit,
  onComment,
  onLine,
}: {
  /** The tab it is open on, or null when closed. */
  open: Kind | null
  onOpenChange: (open: Kind | null) => void
  reviewKey: string
  entries: Entry[]
  /** The range's commits; empty when there is nothing to pick from. */
  commits: Commit[]
  /** The commit narrowed down to, if any. */
  commit?: string
  comments: Comment[]
  /** Called only while the menu is open. */
  actions: () => Action[]
  onFile: (id: string) => void
  onCommit: (sha?: string) => void
  onComment: (comment: Comment) => void
  onLine: (file: string, line: number, side: Line['side']) => void
}) {
  const [query, setQuery] = useState('')
  const kind = open ?? 'all'
  const setKind = (next: Kind) => onOpenChange(next)

  const kinds: { id: Kind; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'files', label: 'Files' },
    { id: 'lines', label: 'Lines' },
    ...(commits.length > 1 ? [{ id: 'commits' as const, label: 'Commits' }] : []),
    ...(comments.length ? [{ id: 'comments' as const, label: 'Comments' }] : []),
    { id: 'actions', label: 'Actions' },
  ]
  const shows = (which: Kind) => kind === 'all' || kind === which
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  // Where you have just been, while nothing is typed: read when the menu opens.
  const recents = useMemo(
    () => (open ? recentFiles(reviewKey).flatMap((id) => byId.get(id) ?? []) : []),
    [open, reviewKey, byId],
  )

  const change = (next: boolean) => {
    onOpenChange(next ? kind : null)
    if (!next) setQuery('')
  }

  // Every line of the diff, indexed once per diff and only while the menu is open.
  const lines = useMemo(
    () => (open ? entries.flatMap((e) => diffLines(e.file).map((line) => ({ e, line }))) : []),
    [open, entries],
  )
  // Typing stays instant; on huge diffs the search catches up a frame later.
  const search = useDeferredValue(query.trim())
  const lineMatches = useMemo(() => {
    if ((kind !== 'lines' && kind !== 'all') || search.length < (kind === 'lines' ? 2 : 3)) return []
    const limit = kind === 'lines' ? LINE_LIMIT : 20
    const out: typeof lines = []
    for (const hit of lines) if (matches(hit.line.text, search) && out.push(hit) >= limit) break
    return out
  }, [lines, search, kind])
  const waitingForLines = kind === 'lines' && search.length < 2
  const act = (run: () => void) => {
    change(false)
    run()
  }
  const openFile = (id: string) =>
    act(() => {
      rememberFile(reviewKey, id)
      onFile(id)
    })
  // With nothing typed the arrows change the kind shown; with text, they move in it.
  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (query || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    const at = kinds.findIndex((k) => k.id === kind)
    const next = kinds[(at + (event.key === 'ArrowRight' ? 1 : -1) + kinds.length) % kinds.length]
    if (next) setKind(next.id)
  }

  const fileRow = (e: Entry, value: string) => {
    const { name, dir } = split(e.file.name)
    return (
      <Row
        key={value}
        value={value}
        onSelect={() => openFile(e.id)}
        icon={<FileIcon type={e.file.type} />}
        aside={
          <>
            {dir && <span className="max-w-64 truncate">{dir}</span>}
            <Stat e={e} />
          </>
        }
      >
        {name}
      </Row>
    )
  }

  return (
    <Dialog open={open != null} onOpenChange={change}>
      <DialogHeader className="sr-only">
        <DialogTitle>Go to</DialogTitle>
        <DialogDescription>A file, a commit, a comment or something to do</DialogDescription>
      </DialogHeader>
      <DialogContent
        showCloseButton={false}
        className="top-[14vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
      >
        <CommandPrimitive
          loop
          filter={filter}
          label="Go to a file, commit, comment or action"
          // The dialog is a grid; without min-w-0 long rows widen it instead of truncating.
          className="flex min-w-0 flex-col"
        >
          <div className="flex items-center gap-3 px-5 pt-4">
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              onKeyDown={onInputKey}
              placeholder="Search"
              className="h-10 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => change(false)}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <div role="tablist" aria-label="Kind" className="flex flex-wrap gap-1 border-b px-4 pt-1 pb-3">
            {kinds.map((k) => (
              <TypeTab key={k.id} active={kind === k.id} onPick={() => setKind(k.id)}>
                {k.label}
              </TypeTab>
            ))}
          </div>
          <CommandPrimitive.List className="max-h-[min(56vh,30rem)] overflow-y-auto overscroll-contain px-2 pb-1">
            {!waitingForLines && (
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
                Nothing by that name.
              </CommandPrimitive.Empty>
            )}
            {kind === 'all' && !query && recents.length > 0 && (
              <Section heading="Recent">{recents.map((e) => fileRow(e, `recent ${e.file.name}`))}</Section>
            )}
            {shows('files') && entries.length > 0 && (
              <Section heading="Files">{entries.map((e) => fileRow(e, `file ${e.file.name}`))}</Section>
            )}
            {lineMatches.length > 0 && (
              <Section heading="Lines">
                {lineMatches.map(({ e, line }) => (
                  <Row
                    key={`${e.id}:${line.side}:${line.n}`}
                    value={`line ${line.text} ${e.file.name}`}
                    onSelect={() => act(() => onLine(e.id, line.n, line.side))}
                    icon={!line.changed ? <Equal /> : line.side === 'additions' ? <Plus /> : <Minus />}
                    aside={<span className="max-w-56 truncate font-mono">{`${split(e.file.name).name}:${line.n}`}</span>}
                  >
                    <span className="font-mono text-[13px]">{line.text.trim()}</span>
                  </Row>
                ))}
              </Section>
            )}
            {waitingForLines && (
              <p className="py-10 text-center text-sm text-muted-foreground">Search the code in this diff.</p>
            )}
            {shows('commits') && commits.length > 1 && (
              <Section heading="Commits">
                <Row
                  value="commit all"
                  onSelect={() => act(() => onCommit(undefined))}
                  icon={<Layers />}
                  aside={!commit && 'Showing'}
                >
                  All {commits.length} commits
                </Row>
                {commits.map((c) => (
                  <Row
                    key={c.sha}
                    value={`commit ${c.sha} ${c.subject} ${c.author}`}
                    onSelect={() => act(() => onCommit(c.sha))}
                    icon={c.sha === commit ? <History /> : <GitCommitHorizontal />}
                    aside={
                      <>
                        <span>{c.date}</span>
                        <span className="font-mono">{c.sha.slice(0, 7)}</span>
                      </>
                    }
                  >
                    {c.subject}
                  </Row>
                ))}
              </Section>
            )}
            {shows('comments') && comments.length > 0 && (
              <Section heading="Comments">
                {comments.map((c) => {
                  const path = byId.get(c.file)?.file.name ?? c.file
                  return (
                    <Row
                      key={c.id}
                      value={`comment ${c.text} ${path}`}
                      onSelect={() => act(() => onComment(c))}
                      icon={<MessageSquare />}
                      aside={<span className="max-w-64 truncate font-mono">{`${split(path).name}:${c.end}`}</span>}
                    >
                      {c.text}
                    </Row>
                  )
                })}
              </Section>
            )}
            {shows('actions') && (
              <Section heading="Actions">
                {actions().map((a) => (
                  <Row
                    key={a.id}
                    value={`action ${a.label} ${a.words ?? ''}`}
                    onSelect={() => act(a.run)}
                    icon={a.icon}
                    aside={a.keys && <Keys keys={a.keys} />}
                  >
                    {a.label}
                  </Row>
                ))}
              </Section>
            )}
          </CommandPrimitive.List>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-5 py-2.5 text-xs text-muted-foreground">
            <FootKey label="Close" keys={['Esc']} />
            <FootKey label="Change type" keys={['←', '→']} />
            <FootKey label="Move" keys={['↑', '↓']} />
            <FootKey label="Open" keys={['↵']} />
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
