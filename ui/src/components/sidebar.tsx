import type { GitStatusEntry } from '@pierre/trees'
import { FileTree, useFileTree } from '@pierre/trees/react'
import { memo, useEffect } from 'react'
import { useHotkey } from '@/hooks/use-hotkey'
import { useLatest } from '@/hooks/use-latest'
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
  onSelect,
}: {
  entries: Entry[]
  onSelect: (path: string) => void
}) {
  const select = useLatest(onSelect)

  const { model } = useFileTree({
    paths: [],
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    density: 'compact',
    search: true,
    fileTreeSearchMode: 'hide-non-matches',
    searchBlurBehavior: 'retain',
    onSelectionChange: (paths) => {
      const path = paths.at(-1)
      if (path && !path.endsWith('/')) select.current(path)
    },
  })

  useEffect(() => {
    const status = new Map<string, GitStatusEntry>()
    for (const { file } of entries) status.set(file.name, { path: file.name, status: STATUS[file.type] })
    model.resetPaths([...status.keys()])
    model.setGitStatus([...status.values()])
  }, [model, entries])

  useHotkey('/', () => model.openSearch())
  useHotkey('mod+k', () => model.openSearch())

  return <FileTree model={model} className="tree h-full" />
})
