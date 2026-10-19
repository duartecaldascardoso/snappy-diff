import { ArrowLeftRight, Check, ChevronsDownUp, ChevronsUpDown, FileUp, MessageSquare, PanelLeft, Pilcrow, RotateCw, X } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { type Commit, type Entry, type GitSource, type Source, WORKTREE } from '@/lib/diff'

function RefPicker({
  source,
  refs,
  commits,
  onLoad,
}: {
  source: GitSource
  refs: string[]
  commits: Commit[]
  onLoad: (source: Source) => void
}) {
  // The CLI accepts any revision, so the current pair may not be a listed ref.
  const options = useMemo(
    () => [...new Set([...refs, source.base, source.head])].filter((r) => r !== WORKTREE),
    [refs, source],
  )
  // Picking another base or head drops a commit narrowed down to.
  const select = (side: 'base' | 'head') => (
    <NativeSelect
      aria-label={side}
      value={source[side]}
      onChange={(e) => onLoad({ ...source, [side]: e.target.value, commit: undefined })}
    >
      {side === 'head' && <option value={WORKTREE}>Working tree</option>}
      {options.map((r) => (
        <option key={r}>{r}</option>
      ))}
    </NativeSelect>
  )
  return (
    <>
      {select('base')}
      <Button
        size="icon"
        title="Swap base and head"
        disabled={source.head === WORKTREE}
        onClick={() => onLoad({ ...source, base: source.head, head: source.base, commit: undefined })}
      >
        <ArrowLeftRight />
      </Button>
      {select('head')}
      {commits.length > 1 && (
        <NativeSelect
          aria-label="commit"
          value={source.commit ?? ''}
          onChange={(e) => onLoad({ ...source, commit: e.target.value || undefined })}
        >
          <option value="">All {commits.length} commits</option>
          {commits.map((c) => (
            <option key={c.sha} value={c.sha} title={`${c.author}, ${c.date}`}>
              {c.sha.slice(0, 7)} {c.subject}
            </option>
          ))}
        </NativeSelect>
      )}
      <Button size="icon" title="Reload" onClick={() => onLoad(source)}>
        <RotateCw />
      </Button>
      <Button
        size="icon"
        title="Ignore whitespace"
        aria-pressed={!!source.ignoreWhitespace}
        onClick={() => onLoad({ ...source, ignoreWhitespace: !source.ignoreWhitespace })}
      >
        <Pilcrow />
      </Button>
    </>
  )
}

function Stats({ entries, viewed, ms }: { entries: Entry[]; viewed: number; ms?: number }) {
  const { add, del } = useMemo(
    () => entries.reduce((t, e) => ({ add: t.add + e.add, del: t.del + e.del }), { add: 0, del: 0 }),
    [entries],
  )
  if (!entries.length) return null
  return (
    <span className="mr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      <span title="Files viewed">
        {viewed}/{entries.length} viewed
      </span>
      <span className="ml-2 text-added">+{add}</span>
      <span className="ml-1 text-deleted">−{del}</span>
      {ms != null && <span className="ml-2">{ms.toFixed(0)} ms</span>}
    </span>
  )
}

/** Copies the review as Markdown; shown once there is something to copy. */
function ReviewActions({ count, onCopy, onClear }: { count: number; onCopy: () => Promise<void>; onClear: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!count) return null
  return (
    <div className="flex items-center rounded-md border">
      <Button
        title="Copy review as Markdown"
        className="rounded-r-none"
        onClick={async () => {
          await onCopy()
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <MessageSquare />}
        {copied ? 'Copied' : `Copy review (${count})`}
      </Button>
      <Button size="icon" title="Delete all comments" className="rounded-l-none border-l" onClick={onClear}>
        <X />
      </Button>
    </div>
  )
}

export function Toolbar({
  source,
  refs,
  commits,
  entries,
  viewed,
  comments,
  ms,
  onLoad,
  onOpen,
  onToggleSidebar,
  allCollapsed,
  onToggleAll,
  onCopyReview,
  onClearComments,
  children,
}: {
  source?: Source
  refs: string[]
  commits: Commit[]
  entries: Entry[]
  viewed: number
  comments: number
  ms?: number
  onLoad: (source: Source) => void
  onOpen: () => void
  onToggleSidebar: () => void
  allCollapsed: boolean
  onToggleAll: () => void
  onCopyReview: () => Promise<void>
  onClearComments: () => void
  /** Extra controls, placed before "Open diff". */
  children?: ReactNode
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-2">
      <Button size="icon" title="Toggle sidebar (⌘B)" onClick={onToggleSidebar}>
        <PanelLeft />
      </Button>
      <span className="mr-1 font-semibold tracking-tight whitespace-nowrap">snappy diff</span>

      {source?.kind === 'git' && <RefPicker source={source} refs={refs} commits={commits} onLoad={onLoad} />}
      {source?.kind === 'patch' && (
        <span className="truncate font-mono text-xs text-muted-foreground">{source.name}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Stats entries={entries} viewed={viewed} ms={ms} />
        <ReviewActions count={comments} onCopy={onCopyReview} onClear={onClearComments} />
        <Button size="icon" title={allCollapsed ? 'Expand all files' : 'Collapse all files'} onClick={onToggleAll}>
          {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </Button>
        {children}
        <Button variant="outline" onClick={onOpen}>
          <FileUp />
          Open diff
        </Button>
      </div>
    </header>
  )
}
