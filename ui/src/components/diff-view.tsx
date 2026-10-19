import type { SelectedLineRange } from '@pierre/diffs'
import {
  CodeView,
  type CodeViewHandle,
  type CodeViewItem,
  type DiffLineAnnotation,
  type FileDiffContentsLoader,
  type LineAnnotation,
} from '@pierre/diffs/react'
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { CommentCard, CommentEditor } from '@/components/comment'
import type { ReviewState } from '@/hooks/use-review'
import type { Prefs } from '@/hooks/use-prefs'
import { type Entry, hash, THEME } from '@/lib/diff'
import type { Comment } from '@/lib/review'

export type DiffViewHandle = { scrollToFile: (id: string) => void }

/** A comment shown under its last line, possibly open for editing. */
type Note = { comment: Comment; editing: boolean }

export function DiffView({
  ref,
  viewKey,
  entries,
  collapsed,
  onToggle,
  onActiveChange,
  review,
  onToggleViewed,
  prefs,
  dark,
  loadFiles,
}: {
  ref: Ref<DiffViewHandle>
  /** Changes when a different diff is shown, which starts back at the top. */
  viewKey: string
  entries: Entry[]
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Called with the index of the file at the top of the viewport. */
  onActiveChange: (index: number) => void
  review: ReviewState
  onToggleViewed: (e: Entry) => void
  prefs: Prefs
  dark: boolean
  /** Fetches full files so folded lines can be expanded. */
  loadFiles?: FileDiffContentsLoader
}) {
  const view = useRef<CodeViewHandle<Note, undefined>>(null)
  const [editing, setEditing] = useState<Comment | null>(null)

  useImperativeHandle(ref, () => ({
    scrollToFile: (id) => {
      // Wrapped lines make the height of unrendered files an estimate, so
      // re-aim for a few frames while the files above get measured.
      let frames = 4
      const aim = () => {
        view.current?.scrollTo({ type: 'item', id, align: 'start', behavior: 'instant' })
        if (--frames) requestAnimationFrame(aim)
      }
      aim()
    },
  }))

  useEffect(() => {
    view.current?.scrollTo({ type: 'position', position: 0, behavior: 'instant' })
  }, [viewKey])

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const { comments, isViewed, saveComment, deleteComment } = review

  const items = useMemo<CodeViewItem<Note>[]>(() => {
    const byFile = Map.groupBy(comments, (c) => c.file)
    return entries.map((e) => {
      const notes: Note[] = (byFile.get(e.id) ?? [])
        .filter((c) => c.id !== editing?.id)
        .map((comment) => ({ comment, editing: false }))
      if (editing?.file === e.id) notes.push({ comment: editing, editing: true })
      const isCollapsed = collapsed.has(e.id)
      // CodeView only re-reads an item when its version changes.
      const state = notes.map((n) => `${n.comment.id}${n.editing}${n.comment.text}`).join()
      return {
        id: e.id,
        type: 'diff',
        fileDiff: e.file,
        collapsed: isCollapsed,
        annotations: notes.map((n) => ({ side: n.comment.side, lineNumber: n.comment.end, metadata: n })),
        version: hash(`${e.rev}|${+isCollapsed}|${+isViewed(e)}|${state}`),
      }
    })
  }, [entries, collapsed, comments, editing, isViewed])

  const options = useMemo(
    () => ({
      theme: THEME,
      themeType: dark ? ('dark' as const) : ('light' as const),
      diffStyle: prefs.diffStyle,
      overflow: prefs.wrap ? ('wrap' as const) : ('scroll' as const),
      hunkSeparators: 'line-info' as const,
      expandUnchanged: prefs.fullFiles && !!loadFiles,
      loadDiffFiles: loadFiles,
      stickyHeaders: true,
      // The gutter's + button (drag it for a range) starts a comment.
      enableGutterUtility: true,
      onGutterUtilityClick: (range: SelectedLineRange, { item }: { item: CodeViewItem<Note> }) =>
        setEditing({
          id: crypto.randomUUID(),
          file: item.id,
          side: range.endSide ?? range.side ?? 'additions',
          start: Math.min(range.start, range.end),
          end: Math.max(range.start, range.end),
          text: '',
        }),
    }),
    [dark, prefs.diffStyle, prefs.wrap, prefs.fullFiles, loadFiles],
  )

  const onScroll = useCallback(
    (scrollTop: number, viewer: { getTopForItem(id: string): number | undefined }) => {
      // Binary search for the last file starting at or above the viewport top.
      let lo = 0
      let hi = entries.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if ((viewer.getTopForItem(entries[mid].id) ?? Infinity) <= scrollTop + 1) lo = mid
        else hi = mid - 1
      }
      onActiveChange(lo)
    },
    [entries, onActiveChange],
  )

  const renderHeaderPrefix = useCallback(
    (item: CodeViewItem<Note>) => (
      <button
        type="button"
        aria-label={item.collapsed ? 'Expand file' : 'Collapse file'}
        onClick={() => onToggle(item.id)}
        className="mr-1 inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        {item.collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
    ),
    [onToggle],
  )

  const renderHeaderFilenameSuffix = useCallback(
    (item: CodeViewItem<Note>) => {
      const e = byId.get(item.id)
      const label = e?.generated ? 'generated' : e?.large ? 'large' : null
      return label && <span className="ml-2 rounded-sm bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{label}</span>
    },
    [byId],
  )

  const renderHeaderMetadata = useCallback(
    (item: CodeViewItem<Note>) => {
      const e = byId.get(item.id)
      if (!e) return null
      const count = item.annotations?.length ?? 0
      return (
        <span className="flex items-center gap-3 font-sans text-xs">
          {count > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="size-3.5" />
              {count}
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={isViewed(e)}
              onChange={() => onToggleViewed(e)}
              className="accent-foreground"
            />
            Viewed
          </label>
        </span>
      )
    },
    [byId, isViewed, onToggleViewed],
  )

  const closeEditor = useCallback(() => {
    setEditing(null)
    view.current?.clearSelectedLines()
  }, [])

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<Note> | LineAnnotation<Note>) => {
      const { comment, editing } = annotation.metadata
      return editing ? (
        <CommentEditor
          key={comment.id}
          comment={comment}
          onSave={(c) => {
            saveComment(c)
            closeEditor()
          }}
          onCancel={closeEditor}
        />
      ) : (
        <CommentCard comment={comment} onEdit={() => setEditing(comment)} onDelete={() => deleteComment(comment.id)} />
      )
    },
    [saveComment, deleteComment, closeEditor],
  )

  return (
    <CodeView
      ref={view}
      items={items}
      options={options}
      onScroll={onScroll}
      renderHeaderPrefix={renderHeaderPrefix}
      renderHeaderFilenameSuffix={renderHeaderFilenameSuffix}
      renderHeaderMetadata={renderHeaderMetadata}
      renderAnnotation={renderAnnotation}
      className="h-full overflow-auto"
    />
  )
}
