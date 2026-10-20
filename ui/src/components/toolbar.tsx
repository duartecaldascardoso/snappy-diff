import { ArrowLeftRight, Check, ChevronsDownUp, ChevronsUpDown, FileUp, PanelLeft, Pilcrow, RotateCw, Sparkles, X, GitPullRequest, History } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { GithubIcon } from '@/components/github-icon'
import { Picker } from '@/components/picker'
import { options } from '@/lib/options'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'
import { type Commit, type Entry, type GitSource, type Source, WORKTREE } from '@/lib/diff'
import type { PullRequest } from '@/lib/github'
import { breakdown, type Kind } from '@/lib/insights'

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
        onChange={(base) => onLoad({ ...source, base, commit: undefined, since: undefined })}
        className="font-mono"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        title="Swap base and head"
        disabled={source.head === WORKTREE}
        onClick={() => onLoad({ ...source, base: source.head, head: source.base, commit: undefined, since: undefined })}
      >
        <ArrowLeftRight />
      </Button>
      <Picker
        aria-label="Head"
        value={source.head}
        groups={heads}
        onChange={(head) => onLoad({ ...source, head, commit: undefined, since: undefined })}
        className="font-mono"
      />
      {commits.length > 1 && (
        <Picker
          aria-label="Commit"
          value={source.commit ?? ''}
          groups={commitGroups}
          onChange={(sha) => onLoad({ ...source, commit: sha || undefined, since: undefined })}
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

const n = (v: number) => v.toLocaleString()

/** One row of the breakdown: a kind (or the total) and its added and removed lines. */
function KindRow({ label, add, del, onClick }: { label: string; add: number; del: number; onClick?: () => void }) {
  const cells = (
    <>
      <span className="text-left">{label}</span>
      <span className="text-right text-added">+{n(add)}</span>
      <span className="text-right text-deleted">−{n(del)}</span>
    </>
  )
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={`Show only ${label.toLowerCase()} files`}
      className="col-span-3 grid grid-cols-subgrid rounded-md px-2 py-1 hover:bg-accent"
    >
      {cells}
    </button>
  ) : (
    <div className="col-span-3 grid grid-cols-subgrid px-2 py-1 font-medium">{cells}</div>
  )
}

function Stats({ entries, viewed, ms, onKind }: { entries: Entry[]; viewed: number; ms?: number; onKind: (kind: Kind) => void }) {
  const kinds = useMemo(() => breakdown(entries), [entries])
  if (!entries.length) return null
  const add = kinds.reduce((t, k) => t + k.add, 0)
  const del = kinds.reduce((t, k) => t + k.del, 0)
  return (
    <span className="mr-2 flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      <span title="Files viewed">
        {viewed}/{entries.length} viewed
      </span>
      {/* Hover for added and removed lines by kind: is it code, or mostly tests? */}
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button type="button" className="cursor-default underline decoration-muted-foreground/60 decoration-dotted underline-offset-4">
            <span className="text-added">+{n(add)}</span> <span className="text-deleted">−{n(del)}</span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="end" className="w-auto min-w-56 p-2 text-sm tabular-nums">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4">
            {kinds.map((k) => (
              <KindRow key={k.id} label={k.label} add={k.add} del={k.del} onClick={() => onKind(k.id)} />
            ))}
            <Separator className="col-span-3 my-1" />
            <KindRow label="Total" add={add} del={del} />
          </div>
        </HoverCardContent>
      </HoverCard>
      {ms != null && <span>{ms.toFixed(0)} ms</span>}
    </span>
  )
}

/** Posts unsent comments to the PR as a review, then says so for a moment. */
function SendToGitHub({ count, onSend }: { count: number; onSend: () => Promise<string> }) {
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'failed'; detail?: string }>({ status: 'idle' })
  const settle = (next: typeof state) => {
    setState(next)
    setTimeout(() => setState({ status: 'idle' }), next.status === 'failed' ? 4000 : 2500)
  }
  return (
    <Button
      variant="outline"
      size="sm"
      title={state.detail ?? 'Post your comments to the pull request as a review'}
      className={cn('rounded-none border-l-0 text-xs', state.status === 'failed' && 'text-destructive')}
      disabled={state.status === 'sending' || (!count && state.status === 'idle')}
      onClick={async () => {
        setState({ status: 'sending' })
        try {
          settle({ status: 'sent', detail: await onSend() })
        } catch (e) {
          settle({ status: 'failed', detail: e instanceof Error ? e.message : String(e) })
        }
      }}
    >
      {state.status === 'sent' ? <Check /> : <GithubIcon />}
      {{ idle: `Send to GitHub (${count})`, sending: 'Sending…', sent: 'Sent', failed: "Couldn't send" }[state.status]}
    </Button>
  )
}

/** Copies the comments as a prompt for an AI agent; shown once there are any. */
function ReviewActions({
  count,
  onCopy,
  onClear,
  unsent,
  onSend,
}: {
  count: number
  onCopy: () => Promise<void>
  onClear: () => void
  /** Comments not yet on the PR; with `onSend`, only when reviewing one. */
  unsent: number
  onSend?: () => Promise<string>
}) {
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
      {onSend && <SendToGitHub count={unsent} onSend={onSend} />}
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
  pr,
  unsent,
  onSendToGitHub,
  onKind,
  newSinceReview,
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
  pr?: PullRequest
  unsent: number
  onSendToGitHub?: () => Promise<string>
  /** Filters the file tree to one kind of change. */
  onKind: (kind: Kind) => void
  /** New commits on top of the tip you last reviewed, if any. */
  newSinceReview: { sha: string; count: number } | null
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
      {source?.kind === 'git' &&
        (source.since ? (
          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
            title="Showing only what changed since your last review; click to show everything"
            onClick={() => onLoad({ ...source, since: undefined })}
          >
            <History />
            Since your review
            <X className="text-muted-foreground" />
          </Button>
        ) : (
          newSinceReview && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              title="Show only what changed since you last reviewed this branch"
              onClick={() => onLoad({ ...source, since: newSinceReview.sha, commit: undefined })}
            >
              <History />
              {newSinceReview.count} new {newSinceReview.count === 1 ? 'commit' : 'commits'} since your review
            </Button>
          )
        ))}
      {pr && (
        <Button variant="ghost" size="sm" asChild className="min-w-0 text-xs text-muted-foreground">
          <a href={pr.url} target="_blank" rel="noreferrer" title={`Open #${pr.number} on GitHub`}>
            <GitPullRequest />
            <span className="font-medium text-foreground">#{pr.number}</span>
            <span className="max-w-56 truncate">{pr.title}</span>
          </a>
        </Button>
      )}
      {source?.kind === 'patch' && (
        <span className="truncate font-mono text-xs text-muted-foreground">{source.name}</span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Stats entries={entries} viewed={viewed} ms={ms} onKind={onKind} />
        <ReviewActions
          count={comments}
          onCopy={onCopyReview}
          onClear={onClearComments}
          unsent={unsent}
          onSend={onSendToGitHub}
        />
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
