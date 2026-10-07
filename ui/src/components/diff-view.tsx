import { CodeView, type CodeViewHandle, type CodeViewItem, type FileDiffContentsLoader } from '@pierre/diffs/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { type Entry, THEME } from '@/lib/diff'

export type DiffViewHandle = { scrollToFile: (id: string) => void }

export function DiffView({
  ref,
  entries,
  collapsed,
  onToggle,
  onActiveChange,
  diffStyle,
  dark,
  loadFiles,
}: {
  ref: Ref<DiffViewHandle>
  entries: Entry[]
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Called with the index of the file at the top of the viewport. */
  onActiveChange: (index: number) => void
  diffStyle: 'split' | 'unified'
  dark: boolean
  /** Fetches full files so folded lines can be expanded. */
  loadFiles?: FileDiffContentsLoader
}) {
  const view = useRef<CodeViewHandle<undefined, undefined>>(null)

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

  // A freshly loaded diff starts at the top.
  useEffect(() => {
    view.current?.scrollTo({ type: 'position', position: 0, behavior: 'instant' })
  }, [entries])

  const items = useMemo<CodeViewItem<undefined>[]>(
    () =>
      entries.map((e) => {
        const isCollapsed = collapsed.has(e.id)
        // CodeView only re-reads an item when its version changes.
        return { id: e.id, type: 'diff', fileDiff: e.file, collapsed: isCollapsed, version: e.rev * 2 + +isCollapsed }
      }),
    [entries, collapsed],
  )

  const options = useMemo(
    () => ({
      theme: THEME,
      themeType: dark ? ('dark' as const) : ('light' as const),
      diffStyle,
      overflow: 'wrap' as const,
      hunkSeparators: 'line-info' as const,
      // Unchanged lines stay folded until asked for.
      expandUnchanged: false,
      loadDiffFiles: loadFiles,
      stickyHeaders: true,
    }),
    [dark, diffStyle, loadFiles],
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
    (item: CodeViewItem<undefined>) => (
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

  return (
    <CodeView
      ref={view}
      items={items}
      options={options}
      onScroll={onScroll}
      renderHeaderPrefix={renderHeaderPrefix}
      className="h-full overflow-auto"
    />
  )
}
