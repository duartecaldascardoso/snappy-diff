import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'
import { memo, useEffect, useRef } from 'react'
import { useHotkey } from '@/hooks/use-hotkey'
import { useLatest } from '@/hooks/use-latest'
import { ICON_PACKS, type Prefs } from '@/hooks/use-prefs'
import type { Entry } from '@/lib/diff'

const STATUS = {
  new: 'added',
  deleted: 'deleted',
  change: 'modified',
  'rename-pure': 'renamed',
  'rename-changed': 'renamed',
} as const

export const Sidebar = memo(function Sidebar({
  entries,
  activePath,
  icons,
  onSelect,
}: {
  entries: Entry[]
  /** The file currently at the top of the diff view. */
  activePath?: string
  icons: Prefs['icons']
  onSelect: (path: string) => void
}) {
  const select = useLatest(onSelect)
  const following = useRef(false)

  const { model } = useFileTree({
    paths: [],
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    density: 'compact',
    search: true,
    fileTreeSearchMode: 'hide-non-matches',
    searchBlurBehavior: 'retain',
    icons: ICON_PACKS[icons].icons,
    // Like GitHub: names stay neutral; only the status marker takes the color.
    unsafeCSS: `[data-item-git-status] > [data-item-section="content"] { color: var(--trees-fg); }
      [data-item-git-status] > [data-item-section="icon"] > :not([data-icon-name="file-tree-icon-chevron"]) { color: revert-layer; }`,
    onSelectionChange: (paths) => {
      const path = paths.at(-1)
      if (path && !path.endsWith('/') && !following.current) select.current(path)
    },
  })

  useEffect(() => {
    const status = new Map<string, GitStatusEntry>()
    for (const { file } of entries) status.set(file.name, { path: file.name, status: STATUS[file.type] })
    model.resetPaths([...status.keys()])
    model.setGitStatus([...status.values()])
  }, [model, entries])

  // Follow the diff view as it scrolls, without scrolling it back.
  useEffect(() => {
    const item = activePath ? model.getItem(activePath) : null
    if (!item || item.isSelected()) return
    following.current = true
    for (const path of model.getSelectedPaths()) model.getItem(path)?.deselect()
    item.select()
    following.current = false
    model.scrollToPath(item.getPath(), { focus: false })
  }, [model, activePath, entries])

  useEffect(() => model.setIcons(ICON_PACKS[icons].icons), [model, icons])

  useHotkey('/', () => model.openSearch())
  useHotkey('mod+k', () => model.openSearch())

  return <FileTree model={model} className="tree h-full" />
})
