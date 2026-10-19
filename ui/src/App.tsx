import { WorkerPoolContextProvider } from '@pierre/diffs/react'
import DiffWorker from '@pierre/diffs/worker/worker.js?worker'
import { type CSSProperties, useCallback, useMemo, useRef, useState } from 'react'
import { DiffView, type DiffViewHandle } from '@/components/diff-view'
import { EmptyState } from '@/components/empty-state'
import { Settings, SETTINGS_ID } from '@/components/settings'
import { Sidebar } from '@/components/sidebar'
import { Toolbar } from '@/components/toolbar'
import { useCollapsed } from '@/hooks/use-collapsed'
import { useDiff } from '@/hooks/use-diff'
import { useHotkey } from '@/hooks/use-hotkey'
import { usePatchInput } from '@/hooks/use-patch-input'
import { usePersisted } from '@/hooks/use-persisted'
import { usePrefs } from '@/hooks/use-prefs'
import { useReview } from '@/hooks/use-review'
import { useAppearance } from '@/hooks/use-appearance'
import { type Entry, fileLoader, type Source, WORKTREE } from '@/lib/diff'
import { fontFamily } from '@/lib/fonts'
import { reviewPrompt } from '@/lib/review'
import { cn } from '@/lib/utils'

// Syntax highlighting runs off the main thread.
const POOL = {
  workerFactory: () => new DiffWorker(),
  poolSize: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)),
}

/** How the prompt for an AI agent names what was reviewed. */
const subjectOf = (s?: Source) =>
  s?.kind !== 'git'
    ? `the patch \`${s?.name ?? 'diff'}\``
    : s.commit
      ? `commit ${s.commit.slice(0, 7)}`
      : s.head === WORKTREE
        ? `my uncommitted changes (against \`${s.base}\`)`
        : `the changes in \`${s.base}...${s.head}\``

export default function App() {
  const { source, key, refs, commits, entries, loading, error, ms, load } = useDiff()
  const review = useReview(key, entries)
  const { isViewed, toggleViewed: flipViewed, comments, clearComments } = review
  // Viewed, generated and huge files start collapsed.
  const byDefault = useCallback((e: Entry) => isViewed(e) || e.generated || e.large, [isViewed])
  const { collapsed, allCollapsed, toggle, expand, reset, toggleAll } = useCollapsed(key, entries, byDefault)
  const [active, setActive] = useState(0)
  const [prefs, setPref] = usePrefs()
  const [sidebar, setSidebar] = usePersisted<'open' | 'closed'>('sidebar', 'open')
  const { dark, toggleDark, theme } = useAppearance(prefs.theme)
  // The worker pool is created once, warmed up with the theme in use at startup.
  const [highlighter] = useState(() => ({ theme: { light: theme.light, dark: theme.dark } }))
  const view = useRef<DiffViewHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const openPatch = useCallback((name: string, text: string) => load({ kind: 'patch', name, text }), [load])
  const dragging = usePatchInput(openPatch)
  const openFilePicker = () => fileInput.current?.click()
  const toggleSidebar = () => setSidebar(sidebar === 'open' ? 'closed' : 'open')

  const worktree = source?.kind === 'git' ? source.head === WORKTREE && !source.commit : undefined
  const loadFiles = useMemo(() => (worktree == null ? undefined : fileLoader(worktree)), [worktree])

  const jumpToFile = useCallback(
    (id: string) => {
      expand(id)
      view.current?.scrollToFile(id)
    },
    [expand],
  )

  // A file follows its viewed state again (collapsing once viewed).
  const toggleViewed = useCallback(
    (e: Entry) => {
      flipViewed(e)
      reset(e.id)
    },
    [flipViewed, reset],
  )

  const step = (by: number) => {
    const next = entries[active + by]
    if (next) jumpToFile(next.id)
  }
  useHotkey('j', () => step(1))
  useHotkey('k', () => step(-1))
  useHotkey('mod+b', toggleSidebar)
  useHotkey('?', () => document.getElementById(SETTINGS_ID)?.togglePopover())
  useHotkey('v', () => {
    const e = entries[active]
    if (!e) return
    toggleViewed(e)
    // Marking a file viewed moves on to the next one.
    if (!isViewed(e)) step(1)
  })

  return (
    <WorkerPoolContextProvider poolOptions={POOL} highlighterOptions={highlighter}>
      <div className="flex h-full flex-col">
        <Toolbar
          source={source}
          refs={refs}
          commits={commits}
          entries={entries}
          viewed={review.viewedCount}
          comments={comments.length}
          ms={ms}
          onLoad={load}
          onOpen={openFilePicker}
          onToggleSidebar={toggleSidebar}
          allCollapsed={allCollapsed}
          onToggleAll={toggleAll}
          onCopyReview={() => navigator.clipboard.writeText(reviewPrompt(subjectOf(source), comments, entries))}
          onClearComments={clearComments}
        >
          <Settings
            prefs={prefs}
            setPref={setPref}
            dark={dark}
            onToggleDark={toggleDark}
            canShowFullFiles={!!loadFiles}
          />
        </Toolbar>

        <div className="flex min-h-0 flex-1">
          <aside className={cn('w-72 shrink-0 border-r', sidebar === 'closed' && 'hidden')}>
            <Sidebar entries={entries} activePath={entries[active]?.file.name} onSelect={jumpToFile} />
          </aside>
          <main
            className="min-w-0 flex-1"
            style={prefs.font ? ({ '--diffs-font-family': fontFamily(prefs.font) } as CSSProperties) : undefined}
          >
            {entries.length > 0 ? (
              <DiffView
                ref={view}
                viewKey={key}
                entries={entries}
                collapsed={collapsed}
                onToggle={toggle}
                onActiveChange={setActive}
                review={review}
                onToggleViewed={toggleViewed}
                prefs={prefs}
                theme={theme}
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
