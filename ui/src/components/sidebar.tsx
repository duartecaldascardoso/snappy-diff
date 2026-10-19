import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'
import { Search, SearchCode, X } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Keys } from '@/components/keys'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { useHotkey } from '@/hooks/use-hotkey'
import { useLatest } from '@/hooks/use-latest'
import { ICON_PACKS, type Prefs } from '@/hooks/use-prefs'
import type { Entry } from '@/lib/diff'
import { matches } from '@/lib/match'
import { MOD } from '@/lib/shortcut'

const STATUS = {
  new: 'added',
  deleted: 'deleted',
  change: 'modified',
  'rename-pure': 'renamed',
  'rename-changed': 'renamed',
} as const

// Like GitHub: names stay neutral; only the status marker takes the color.
const NEUTRAL_NAMES = `[data-item-git-status] > [data-item-section="content"] { color: var(--trees-fg); }
  [data-item-git-status] > [data-item-section="icon"] > :not([data-icon-name="file-tree-icon-chevron"]) { color: revert-layer; }`

export const Sidebar = memo(function Sidebar({
  entries,
  activePath,
  icons,
  onSelect,
  onGoTo,
}: {
  entries: Entry[]
  /** The file currently at the top of the diff view. */
  activePath?: string
  icons: Prefs['icons']
  onSelect: (path: string) => void
  onGoTo: () => void
}) {
  const select = useLatest(onSelect)
  const following = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  // Our own filter rather than the tree's search, which drops itself on every
  // click: this one stays until it is cleared.
  const [filter, setFilter] = useState('')

  const { model } = useFileTree({
    paths: [],
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    density: 'compact',
    icons: ICON_PACKS[icons].icons,
    unsafeCSS: NEUTRAL_NAMES,
    onSelectionChange: (paths) => {
      const path = paths.at(-1)
      if (path && !path.endsWith('/') && !following.current) select.current(path)
    },
  })

  const shown = useMemo(
    () => (filter.trim() ? entries.filter((e) => matches(e.file.name, filter.trim())) : entries),
    [entries, filter],
  )

  useEffect(() => {
    const status = new Map<string, GitStatusEntry>()
    for (const { file } of shown) status.set(file.name, { path: file.name, status: STATUS[file.type] })
    model.resetPaths([...status.keys()])
    model.setGitStatus([...status.values()])
  }, [model, shown])

  useEffect(() => model.setIcons(ICON_PACKS[icons].icons), [model, icons])

  // Follow the diff view as it scrolls, without scrolling it back.
  useEffect(() => {
    const item = activePath ? model.getItem(activePath) : null
    if (!item || item.isSelected()) return
    following.current = true
    for (const path of model.getSelectedPaths()) model.getItem(path)?.deselect()
    item.select()
    following.current = false
    model.scrollToPath(item.getPath(), { focus: false })
  }, [model, activePath, shown])

  useHotkey('/', () => input.current?.focus())

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1.5 p-2">
        <Button variant="ghost" size="sm" onClick={onGoTo} className="justify-start text-muted-foreground">
          <Search />
          Go to…
          <Keys keys={[MOD, 'K']} className="ml-auto" />
        </Button>
        <InputGroup className="h-8">
          <InputGroupAddon>
            <SearchCode />
          </InputGroupAddon>
          <InputGroupInput
            ref={input}
            value={filter}
            placeholder="Filter files"
            aria-label="Filter files"
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              setFilter('')
              input.current?.blur()
            }}
            className="text-xs"
          />
          {filter && (
            <InputGroupAddon align="inline-end">
              <span className="text-xs tabular-nums">
                {shown.length}/{entries.length}
              </span>
              <InputGroupButton size="icon-xs" aria-label="Clear filter" onClick={() => setFilter('')}>
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
      {shown.length ? (
        <FileTree model={model} className="tree min-h-0 flex-1" />
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">No files match “{filter}”.</p>
      )}
    </div>
  )
})
