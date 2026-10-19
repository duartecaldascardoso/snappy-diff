import { ArrowLeftRight, Check, ChevronsDownUp, ChevronsUpDown, FileUp, PanelLeft, Pilcrow, RotateCw, Sparkles, X } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Picker } from '@/components/picker'
import { options } from '@/lib/options'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
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
  const all = useMemo(
    () => [...new Set([...refs, source.base, source.head])].filter((r) => r !== WORKTREE),
    [refs, source],
  )
  const heads = useMemo(() => [{ options: [{ value: WORKTREE, label: 'Working tree' }] }, ...options(all)], [all])
  const commitGroups = useMemo(
    () => [
      {
        options: [
          { value: '', label: `All ${commits.length} commits` },
          ...commits.map((c) => ({ value: c.sha, label: `${c.sha.slice(0, 7)} ${c.subject}`, title: `${c.author}, ${c.date}` })),
        ],
      },
    ],
    [commits],
  )
  // Picking another base or head drops a commit narrowed down to.
  return (
    <>
      <Picker
        aria-label="Base"
        value={source.base}
        groups={options(all)}
        onChange={(base) => onLoad({ ...source, base, commit: undefined })}
        className="font-mono"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        title="Swap base and head"
        disabled={source.head === WORKTREE}
        onClick={() => onLoad({ ...source, base: source.head, head: source.base, commit: undefined })}
      >
        <ArrowLeftRight />
      </Button>
      <Picker
        aria-label="Head"
        value={source.head}
        groups={heads}
        onChange={(head) => onLoad({ ...source, head, commit: undefined })}
        className="font-mono"
      />
      {commits.length > 1 && (
        <Picker
          aria-label="Commit"
          value={source.commit ?? ''}
          groups={commitGroups}
          onChange={(sha) => onLoad({ ...source, commit: sha || undefined })}
          className="max-w-64"
        />
      )}
      <Button variant="ghost" size="icon-sm" title="Reload" onClick={() => onLoad(source)}>
        <RotateCw />
      </Button>
      <Toggle
        size="sm"
        title="Ignore whitespace"
        pressed={!!source.ignoreWhitespace}
        onPressedChange={(ignoreWhitespace) => onLoad({ ...source, ignoreWhitespace })}
      >
        <Pilcrow />
      </Toggle>
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

/** Copies the comments as a prompt for an AI agent; shown once there are any. */
function ReviewActions({ count, onCopy, onClear }: { count: number; onCopy: () => Promise<void>; onClear: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!count) return null
  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        size="sm"
        title="Copy your comments as a prompt to paste into your AI agent"
        className="rounded-r-none text-xs"
        onClick={async () => {
          await onCopy()
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <Sparkles />}
        {copied ? 'Copied, paste into your AI' : `Copy for AI (${count})`}
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        title="Delete all comments"
        className="rounded-l-none border-l-0"
        onClick={onClear}
      >
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
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-2">
      <Button variant="ghost" size="icon-sm" title="Toggle sidebar (⌘B)" onClick={onToggleSidebar}>
        <PanelLeft />
      </Button>
      <span className="mr-1 text-sm font-semibold tracking-tight whitespace-nowrap">snappy diff</span>

      {source?.kind === 'git' && <RefPicker source={source} refs={refs} commits={commits} onLoad={onLoad} />}
      {source?.kind === 'patch' && (
        <span className="truncate font-mono text-xs text-muted-foreground">{source.name}</span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Stats entries={entries} viewed={viewed} ms={ms} />
        <ReviewActions count={comments} onCopy={onCopyReview} onClear={onClearComments} />
        <Button
          variant="ghost"
          size="icon-sm"
          title={allCollapsed ? 'Expand all files' : 'Collapse all files'}
          onClick={onToggleAll}
        >
          {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </Button>
        {children}
        <Button variant="outline" size="sm" className="text-xs" onClick={onOpen}>
          <FileUp />
          Open diff
        </Button>
      </div>
    </header>
  )
}
