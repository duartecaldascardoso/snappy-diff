import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'
import { Search, SearchCode, X } from 'lucide-react'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Keys } from '@/components/keys'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { useHotkey } from '@/hooks/use-hotkey'
import { useLatest } from '@/hooks/use-latest'
import { ICON_PACKS, type Prefs } from '@/hooks/use-prefs'
import type { Entry } from '@/lib/diff'
import { diffstat, fileMatches } from '@/lib/insights'
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

const BOX = '▪'
// Keep the squares of a size bar snug, like one small bar.
const SIZE_BARS = `[data-item-section="decoration"] { letter-spacing: -1px; }`

/** Added and removed lines for every file and folder (folders end in "/"). */
function sizes(entries: Entry[]) {
  const byPath = new Map<string, { add: number; del: number }>()
  let maxFile = 1
  let maxDir = 1
  const bump = (path: string, e: Entry) => {
    const s = byPath.get(path) ?? { add: 0, del: 0 }
    s.add += e.add
    s.del += e.del
    byPath.set(path, s)
    return s.add + s.del
  }
  for (const e of entries) {
    maxFile = Math.max(maxFile, bump(e.file.name, e))
    const parts = e.file.name.split('/')
    for (let i = 1; i < parts.length; i++) maxDir = Math.max(maxDir, bump(parts.slice(0, i).join('/') + '/', e))
  }
  return { byPath, maxFile, maxDir }
}

export const Sidebar = memo(function Sidebar({
  entries,
  activePath,
  icons,
  filter,
  onFilterChange: setFilter,
  onSelect,
  onGoTo,
}: {
  entries: Entry[]
  /** The file currently at the top of the diff view. */
  activePath?: string
  icons: Prefs['icons']
  /** Narrows the tree; kept by the app so the overview can set it too. */
  filter: string
  onFilterChange: (filter: string) => void
  onSelect: (path: string) => void
  onGoTo: () => void
}) {
  const select = useLatest(onSelect)
  const following = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  // Change sizes per file and per folder, for the size bars.
  const stats = useLatest(useMemo(() => sizes(entries), [entries]))

  const { model } = useFileTree({
    paths: [],
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    density: 'compact',
    icons: ICON_PACKS[icons].icons,
    unsafeCSS: NEUTRAL_NAMES + SIZE_BARS,
    renderRowDecoration: ({ item }) => {
      const { byPath, maxFile, maxDir } = stats.current
      const s = byPath.get(item.kind === 'directory' && !item.path.endsWith('/') ? `${item.path}/` : item.path)
      if (!s) return null
      const b = diffstat(s.add, s.del, item.kind === 'directory' ? maxDir : maxFile)
      return {
        text: '',
        title: `+${s.add} −${s.del}`,
        parts: [
          { text: BOX.repeat(b.add), color: 'var(--added)' },
          { text: BOX.repeat(b.del), color: 'var(--deleted)' },
          { text: BOX.repeat(b.empty), color: 'var(--border)' },
        ],
      }
    },
    onSelectionChange: (paths) => {
      const path = paths.at(-1)
      if (path && !path.endsWith('/') && !following.current) select.current(path)
    },
  })

  const shown = useMemo(
    () => (filter.trim() ? entries.filter((e) => fileMatches(e, filter)) : entries),
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
            placeholder="Filter files, or is:tests"
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
