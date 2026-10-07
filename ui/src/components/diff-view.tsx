import { CodeView, type CodeViewHandle, type CodeViewItem } from '@pierre/diffs/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { type Entry, loadBlobs, THEME } from '@/lib/diff'

export type DiffViewHandle = { scrollToFile: (id: string) => void }

export function DiffView({
  ref,
  entries,
  collapsed,
  onToggle,
  diffStyle,
  dark,
  expandable,
}: {
  ref: Ref<DiffViewHandle>
  entries: Entry[]
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  diffStyle: 'split' | 'unified'
  dark: boolean
  /** Whether full files can be fetched to expand folded lines. */
  expandable: boolean
}) {
  const view = useRef<CodeViewHandle<undefined, undefined>>(null)

  useImperativeHandle(ref, () => ({
    scrollToFile: (id) => view.current?.scrollTo({ type: 'item', id, align: 'start', behavior: 'instant' }),
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
      hunkSeparators: 'line-info' as const,
      // Unchanged lines stay folded until asked for.
      expandUnchanged: false,
      loadDiffFiles: expandable ? loadBlobs : undefined,
      stickyHeaders: true,
    }),
    [dark, diffStyle, expandable],
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
      renderHeaderPrefix={renderHeaderPrefix}
      className="h-full overflow-auto"
    />
  )
}
