import {
  ArrowLeftRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns2,
  FileUp,
  Moon,
  PanelLeft,
  RotateCw,
  Rows2,
  Sun,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import type { Entry, Source } from '@/lib/diff'
import { installedFonts } from '@/lib/fonts'

type GitSource = Extract<Source, { kind: 'git' }>

function RefPicker({
  source,
  refs,
  onLoad,
}: {
  source: GitSource
  refs: string[]
  onLoad: (source: Source) => void
}) {
  // The CLI accepts any revision, so the current pair may not be a listed ref.
  const options = useMemo(() => [...new Set([...refs, source.base, source.head])], [refs, source])
  const select = (side: 'base' | 'head') => (
    <NativeSelect aria-label={side} value={source[side]} onChange={(e) => onLoad({ ...source, [side]: e.target.value })}>
      {options.map((r) => (
        <option key={r}>{r}</option>
      ))}
    </NativeSelect>
  )
  return (
    <>
      {select('base')}
      <Button
        size="icon"
        title="Swap base and head"
        onClick={() => onLoad({ kind: 'git', base: source.head, head: source.base })}
      >
        <ArrowLeftRight />
      </Button>
      {select('head')}
      <Button size="icon" title="Reload" onClick={() => onLoad(source)}>
        <RotateCw />
      </Button>
    </>
  )
}

function FontPicker({ font, onChange }: { font: string; onChange: (font: string) => void }) {
  const [fonts] = useState(installedFonts)
  if (!fonts.length) return null
  return (
    <NativeSelect aria-label="Code font" title="Code font" value={font} onChange={(e) => onChange(e.target.value)}>
      <option value="">Default font</option>
      {fonts.map((f) => (
        <option key={f}>{f}</option>
      ))}
    </NativeSelect>
  )
}

function Stats({ entries, ms }: { entries: Entry[]; ms?: number }) {
  const { add, del } = useMemo(
    () => entries.reduce((t, e) => ({ add: t.add + e.add, del: t.del + e.del }), { add: 0, del: 0 }),
    [entries],
  )
  if (!entries.length) return null
  return (
    <span className="mr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      {entries.length} {entries.length === 1 ? 'file' : 'files'}
      <span className="ml-2 text-added">+{add}</span>
      <span className="ml-1 text-deleted">−{del}</span>
      {ms != null && <span className="ml-2">{ms.toFixed(0)} ms</span>}
    </span>
  )
}

export function Toolbar({
  source,
  refs,
  entries,
  ms,
  onLoad,
  onOpen,
  onToggleSidebar,
  allCollapsed,
  onToggleAll,
  diffStyle,
  onToggleDiffStyle,
  dark,
  onToggleDark,
  font,
  onFontChange,
}: {
  source?: Source
  refs: string[]
  entries: Entry[]
  ms?: number
  onLoad: (source: Source) => void
  onOpen: () => void
  onToggleSidebar: () => void
  allCollapsed: boolean
  onToggleAll: () => void
  diffStyle: 'split' | 'unified'
  onToggleDiffStyle: () => void
  dark: boolean
  onToggleDark: () => void
  font: string
  onFontChange: (font: string) => void
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-2">
      <Button size="icon" title="Toggle sidebar (⌘B)" onClick={onToggleSidebar}>
        <PanelLeft />
      </Button>
      <span className="mr-1 font-semibold tracking-tight whitespace-nowrap">snappy diff</span>

      {source?.kind === 'git' && <RefPicker source={source} refs={refs} onLoad={onLoad} />}
      {source?.kind === 'patch' && (
        <span className="truncate font-mono text-xs text-muted-foreground">{source.name}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Stats entries={entries} ms={ms} />
        <FontPicker font={font} onChange={onFontChange} />
        <Button size="icon" title={allCollapsed ? 'Expand all files' : 'Collapse all files'} onClick={onToggleAll}>
          {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </Button>
        <Button
          size="icon"
          title={diffStyle === 'split' ? 'Switch to unified' : 'Switch to side by side'}
          onClick={onToggleDiffStyle}
        >
          {diffStyle === 'split' ? <Columns2 /> : <Rows2 />}
        </Button>
        <Button size="icon" title="Toggle theme" onClick={onToggleDark}>
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Button variant="outline" onClick={onOpen}>
          <FileUp />
          Open diff
        </Button>
      </div>
    </header>
  )
}
