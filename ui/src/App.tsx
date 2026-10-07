import { WorkerPoolContextProvider } from '@pierre/diffs/react'
import DiffWorker from '@pierre/diffs/worker/worker.js?worker'
import { type CSSProperties, useCallback, useMemo, useRef, useState } from 'react'
import { DiffView, type DiffViewHandle } from '@/components/diff-view'
import { EmptyState } from '@/components/empty-state'
import { Sidebar } from '@/components/sidebar'
import { Toolbar } from '@/components/toolbar'
import { useCollapsed } from '@/hooks/use-collapsed'
import { useDiff } from '@/hooks/use-diff'
import { useHotkey } from '@/hooks/use-hotkey'
import { usePatchInput } from '@/hooks/use-patch-input'
import { usePersisted } from '@/hooks/use-persisted'
import { useTheme } from '@/hooks/use-theme'
import { fileLoader, THEME, WORKTREE } from '@/lib/diff'
import { cn } from '@/lib/utils'

// Syntax highlighting runs off the main thread.
const POOL = {
  workerFactory: () => new DiffWorker(),
  poolSize: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)),
}
const HIGHLIGHTER = { theme: THEME }

export default function App() {
  const { source, refs, entries, loading, error, ms, load } = useDiff()
  const { collapsed, allCollapsed, toggle, expand, toggleAll } = useCollapsed(entries)
  const [active, setActive] = useState(0)
  const [diffStyle, setDiffStyle] = usePersisted<'split' | 'unified'>('diffStyle', 'split')
  const [sidebar, setSidebar] = usePersisted<'open' | 'closed'>('sidebar', 'open')
  const [dark, toggleDark] = useTheme()
  const [font, setFont] = usePersisted<string>('font', '')
  const view = useRef<DiffViewHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const openPatch = useCallback((name: string, text: string) => load({ kind: 'patch', name, text }), [load])
  const dragging = usePatchInput(openPatch)
  const openFilePicker = () => fileInput.current?.click()
  const toggleSidebar = () => setSidebar(sidebar === 'open' ? 'closed' : 'open')
  useHotkey('mod+b', toggleSidebar)

  const worktree = source?.kind === 'git' ? source.head === WORKTREE : undefined
  const loadFiles = useMemo(() => (worktree == null ? undefined : fileLoader(worktree)), [worktree])

  const jumpToFile = useCallback(
    (id: string) => {
      expand(id)
      view.current?.scrollToFile(id)
    },
    [expand],
  )
  const step = (by: number) => {
    const next = entries[active + by]
    if (next) jumpToFile(next.id)
  }
  useHotkey('j', () => step(1))
  useHotkey('k', () => step(-1))

  return (
    <WorkerPoolContextProvider poolOptions={POOL} highlighterOptions={HIGHLIGHTER}>
      <div className="flex h-full flex-col">
        <Toolbar
          source={source}
          refs={refs}
          entries={entries}
          ms={ms}
          onLoad={load}
          onOpen={openFilePicker}
          onToggleSidebar={toggleSidebar}
          allCollapsed={allCollapsed}
          onToggleAll={toggleAll}
          diffStyle={diffStyle}
          onToggleDiffStyle={() => setDiffStyle(diffStyle === 'split' ? 'unified' : 'split')}
          dark={dark}
          onToggleDark={toggleDark}
          font={font}
          onFontChange={setFont}
        />

        <div className="flex min-h-0 flex-1">
          <aside className={cn('w-72 shrink-0 border-r', sidebar === 'closed' && 'hidden')}>
            <Sidebar entries={entries} activePath={entries[active]?.file.name} onSelect={jumpToFile} />
          </aside>
          <main
            className="min-w-0 flex-1"
            style={font ? ({ '--diffs-font-family': `"${font}", monospace` } as CSSProperties) : undefined}
          >
            {entries.length > 0 ? (
              <DiffView
                ref={view}
                entries={entries}
                collapsed={collapsed}
                onToggle={toggle}
                onActiveChange={setActive}
                diffStyle={diffStyle}
                dark={dark}
                loadFiles={loadFiles}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState source={source} loading={loading} error={error} onOpen={openFilePicker} />
              </div>
            )}
          </main>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".diff,.patch,.txt,text/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) openPatch(file.name, await file.text())
          }}
        />
        {dragging && (
          <div className="pointer-events-none fixed inset-2 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-ring bg-background/80 text-sm">
            Drop a diff to view it
          </div>
        )}
      </div>
    </WorkerPoolContextProvider>
  )
}
