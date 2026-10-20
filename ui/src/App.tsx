import { WorkerPoolContextProvider } from '@pierre/diffs/react'
import DiffWorker from '@pierre/diffs/worker/worker.js?worker'
import { ChartNoAxesColumn } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DiffView, type DiffViewHandle } from '@/components/diff-view'
import { EmptyState } from '@/components/empty-state'
import { GoTo, type GoToKind } from '@/components/goto'
import { Overview } from '@/components/overview'
import { Button } from '@/components/ui/button'
import { gotoActions } from '@/components/goto-actions'
import { Settings } from '@/components/settings'
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
import { type Entry, fetchChurn, fileLoader, type Source, WORKTREE } from '@/lib/diff'
import { firstChange, openInEditor } from '@/lib/editor'
import { sendReview } from '@/lib/github'
import { fontFamily } from '@/lib/fonts'
import { fileMatches, type Kind, reviewOrder } from '@/lib/insights'
import { findMoves } from '@/lib/moved'
import { reviewPrompt } from '@/lib/review'
import { cn } from '@/lib/utils'

// Syntax highlighting runs off the main thread.
const POOL = {
  workerFactory: () => new DiffWorker(),
  poolSize: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)),
}

/** What is under review, as a heading shows it. */
const titleOf = (s?: Source) =>
  s?.kind !== 'git' ? (s?.name ?? '') : `${s.base}...${s.head || 'working tree'}${s.commit ? ` @ ${s.commit.slice(0, 7)}` : ''}`

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
  const { source, key, refs, commits, canOpen, pr, entries, loading, error, ms, load } = useDiff()
  const review = useReview(key, entries)
  const { isViewed, toggleViewed: flipViewed, comments, active: activeComments, markSent, clearComments } = review
  // Viewed, generated and huge files start collapsed.
  const byDefault = useCallback((e: Entry) => isViewed(e) || e.generated || e.large, [isViewed])
  const { collapsed, allCollapsed, toggle, expand, reset, toggleAll } = useCollapsed(key, entries, byDefault)
  const [active, setActive] = useState(0)
  const [prefs, setPref] = usePrefs()
  const [sidebar, setSidebar] = usePersisted<'open' | 'closed'>('sidebar', 'open')
  const { dark, toggleDark, theme } = useAppearance(prefs.theme)
  // The worker pool is created once, warmed up with the theme in use at startup.
  const [highlighter] = useState(() => ({ theme: { light: theme.light, dark: theme.dark } }))
  const [goto, setGoto] = useState<GoToKind | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [churn, setChurn] = useState(new Map<string, number>())
  // Moved code, found once per diff.
  const moves = useMemo(() => findMoves(entries), [entries])

  // Commit counts per file only matter for the overview; fetch them when it opens.
  useEffect(() => {
    if (overviewOpen && source?.kind === 'git') fetchChurn(source).then(setChurn)
  }, [overviewOpen, source])
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

  // Moving between files keeps to what the file filter shows.
  const visible = useMemo(
    () => (filter.trim() ? entries.filter((e) => fileMatches(e, filter)) : entries),
    [entries, filter],
  )
  const step = (by: number) => {
    const index = new Map(entries.map((e, i) => [e.id, i]))
    const next =
      by > 0 ? visible.find((e) => index.get(e.id)! > active) : visible.findLast((e) => index.get(e.id)! < active)
    if (next) jumpToFile(next.id)
  }
  // The most important file you haven't viewed: contracts, tests, code, config, docs.
  const reviewNext = () => {
    const pending = reviewOrder(visible).filter((e) => !isViewed(e))
    const next = pending.find((e) => e.id !== entries[active]?.id) ?? pending[0]
    if (next) jumpToFile(next.id)
  }

  const toggleViewedActive = () => {
    const e = entries[active]
    if (!e) return
    toggleViewed(e)
    // Marking a file viewed moves on to the next one.
    if (!isViewed(e)) step(1)
  }
  const openFile = useMemo(
    () =>
      canOpen
        ? (e: Entry) => e.file.type !== 'deleted' && openInEditor(prefs.editor, e.file.name, firstChange(e.file))
        : undefined,
    [canOpen, prefs.editor],
  )
  const unsent = activeComments.filter((c) => !c.sent)
  const sendToGitHub = pr
    ? async () => {
        const url = await sendReview(unsent, entries)
        markSent(unsent.map((c) => c.id))
        return url
      }
    : undefined
  const copyForAI = () => navigator.clipboard.writeText(reviewPrompt(subjectOf(source), comments, entries))

  // Built only while the menu is open: App re-renders on every scroll.
  const actions = () =>
    gotoActions({
      prefs,
      dark,
      sidebarOpen: sidebar === 'open',
      allCollapsed,
      hasComments: activeComments.length > 0,
      ignoreWhitespace: source?.kind === 'git' ? !!source.ignoreWhitespace : undefined,
      canShowFullFiles: !!loadFiles,
      do: {
        toggleSidebar,
        toggleAll,
        next: () => step(1),
        previous: () => step(-1),
        toggleViewed: toggleViewedActive,
        copyForAI,
        toggleDiffStyle: () => setPref('diffStyle', prefs.diffStyle === 'split' ? 'unified' : 'split'),
        toggleDark,
        toggleWhitespace: () => source?.kind === 'git' && load({ ...source, ignoreWhitespace: !source.ignoreWhitespace }),
        toggleFullFiles: () => setPref('fullFiles', !prefs.fullFiles),
        toggleWrap: () => setPref('wrap', !prefs.wrap),
        reload: () => source && load(source),
        openFile: openFilePicker,
      reviewNext,
      openOverview: () => setOverviewOpen(true),
      openInEditor: openFile && entries[active] ? () => openFile(entries[active]) : undefined,
      sendToGitHub: sendToGitHub && unsent.length ? () => void sendToGitHub() : undefined,
        openSettings: () => setSettingsOpen(true),
      },
    })

  useHotkey('mod+k', () => setGoto((g) => (g ? null : 'all')))
  // The browser's find can't see rows the virtualized diff hasn't drawn; search them all instead.
  useHotkey('mod+f', () => setGoto('lines'))
  useHotkey('?', () => setSettingsOpen((o) => !o))
  useHotkey('o', () => entries[active] && openFile?.(entries[active]))
  useHotkey('n', reviewNext)
  useHotkey('j', () => step(1))
  useHotkey('k', () => step(-1))
  useHotkey('mod+b', toggleSidebar)
  useHotkey('v', toggleViewedActive)

  return (
    <WorkerPoolContextProvider poolOptions={POOL} highlighterOptions={highlighter}>
      <div className="flex h-full flex-col">
        <Toolbar
          source={source}
          refs={refs}
          commits={commits}
          entries={entries}
          viewed={review.viewedCount}
          comments={activeComments.length}
          ms={ms}
          onLoad={load}
          onOpen={openFilePicker}
          onToggleSidebar={toggleSidebar}
          allCollapsed={allCollapsed}
          onToggleAll={toggleAll}
          onCopyReview={copyForAI}
          onClearComments={clearComments}
          onKind={(kind: Kind) => {
            setFilter(`is:${kind}`)
            if (sidebar === 'closed') setSidebar('open')
          }}
          pr={pr}
          unsent={unsent.length}
          onSendToGitHub={sendToGitHub}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            title="Overview: where the changes are and what to review"
            disabled={!entries.length}
            onClick={() => setOverviewOpen(true)}
          >
            <ChartNoAxesColumn />
          </Button>
          <Settings
            prefs={prefs}
            setPref={setPref}
            dark={dark}
            onToggleDark={toggleDark}
            canShowFullFiles={!!loadFiles}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        </Toolbar>

        <div className="flex min-h-0 flex-1">
          <aside className={cn('w-72 shrink-0 border-r', sidebar === 'closed' && 'hidden')}>
            <Sidebar
              entries={entries}
              activePath={entries[active]?.file.name}
              icons={prefs.icons}
              filter={filter}
              onFilterChange={setFilter}
              onSelect={jumpToFile}
              onGoTo={() => setGoto('all')}
            />
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
                onOpen={openFile}
                moves={moves}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState source={source} loading={loading} error={error} onOpen={openFilePicker} />
              </div>
            )}
          </main>
        </div>

        <Overview
          open={overviewOpen}
          onOpenChange={setOverviewOpen}
          subject={titleOf(source)}
          commits={source?.kind === 'git' ? commits : []}
          commit={source?.kind === 'git' ? source.commit : undefined}
          comments={comments}
          onCommit={source?.kind === 'git' ? (commit) => load({ ...source, commit }) : undefined}
          entries={entries}
          isViewed={isViewed}
          moves={moves}
          churn={churn}
          onFile={jumpToFile}
          onFilter={(next) => {
            setFilter(next)
            if (sidebar === 'closed') setSidebar('open')
          }}
          onReviewNext={entries.some((e) => !isViewed(e)) ? reviewNext : undefined}
        />
        <GoTo
          open={goto}
          onOpenChange={setGoto}
          reviewKey={key}
          entries={entries}
          commits={source?.kind === 'git' ? commits : []}
          commit={source?.kind === 'git' ? source.commit : undefined}
          comments={comments}
          actions={actions}
          onFile={jumpToFile}
          onCommit={(commit) => source?.kind === 'git' && load({ ...source, commit })}
          onComment={(c) => {
            expand(c.file)
            view.current?.scrollToLine(c.file, c.end, c.side)
          }}
          onLine={(file, line, side) => {
            expand(file)
            view.current?.scrollToLine(file, line, side)
          }}
        />
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
