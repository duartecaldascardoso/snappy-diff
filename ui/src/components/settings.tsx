import { Settings2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Picker } from '@/components/picker'
import { options } from '@/lib/options'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ICON_PACKS, type Prefs, type SetPref } from '@/hooks/use-prefs'
import { BUNDLED_FONTS, installedFonts } from '@/lib/fonts'
import { THEMES } from '@/lib/themes'

const SHORTCUTS = [
  [['j', 'k'], 'Next / previous file'],
  [['v'], 'Mark file as viewed'],
  [['⌘', 'K'], 'Go to a file, commit or action'],
  [['/'], 'Filter the file tree'],
  [['⌘', 'B'], 'Toggle sidebar'],
  [['⌘', 'V'], 'View a diff from the clipboard'],
  [['?'], 'This panel'],
] as const

/** Every control in a row shares this width, so the panel lines up. */
const CONTROL = 'w-40'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T
  items: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      // Radix reports '' when the pressed item is clicked again; keep the value.
      onValueChange={(v) => v && onChange(v as T)}
      className={CONTROL}
    >
      {items.map(([v, label]) => (
        <ToggleGroupItem key={v} value={v} className="flex-1 text-xs">
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function Settings({
  prefs,
  setPref,
  dark,
  onToggleDark,
  canShowFullFiles,
  open,
  onOpenChange,
}: {
  prefs: Prefs
  setPref: SetPref
  dark: boolean
  onToggleDark: () => void
  /** Full files need the repository; a pasted patch only has its hunks. */
  canShowFullFiles: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [installed] = useState(installedFonts)

  const fonts = [
    { options: [{ value: '', label: 'Default' }] },
    { label: 'Bundled', options: BUNDLED_FONTS.map((f) => ({ value: f, label: f })) },
    ...(installed.length ? [{ label: 'Installed', options: installed.map((f) => ({ value: f, label: f })) }] : []),
  ]

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Settings and shortcuts (?)">
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 text-xs">
        <Row label="Layout">
          <Segmented
            value={prefs.diffStyle}
            items={[
              ['split', 'Split'],
              ['unified', 'Unified'],
            ]}
            onChange={(v) => setPref('diffStyle', v)}
          />
        </Row>
        <Row label="Mode">
          <Segmented
            value={dark ? 'dark' : 'light'}
            items={[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(v) => (v === 'dark') !== dark && onToggleDark()}
          />
        </Row>
        <Row label="Theme">
          <Picker
            aria-label="Theme"
            value={prefs.theme}
            groups={options(THEMES.map((t) => t.name))}
            onChange={(v) => setPref('theme', v)}
            className={CONTROL}
          />
        </Row>
        <Row label="Code font">
          <Picker aria-label="Code font" value={prefs.font} groups={fonts} onChange={(v) => setPref('font', v)} className={CONTROL} />
        </Row>
        <Row label="File icons">
          <Picker
            aria-label="File icons"
            value={prefs.icons}
            groups={[{ options: Object.entries(ICON_PACKS).map(([value, { label }]) => ({ value, label })) }]}
            onChange={(v) => setPref('icons', v as Prefs['icons'])}
            className={CONTROL}
          />
        </Row>
        <Row label="Wrap lines">
          <Switch aria-label="Wrap lines" checked={prefs.wrap} onCheckedChange={(v) => setPref('wrap', v)} />
        </Row>
        <Row label="Show full files">
          <Switch
            aria-label="Show full files"
            checked={prefs.fullFiles}
            disabled={!canShowFullFiles}
            onCheckedChange={(v) => setPref('fullFiles', v)}
          />
        </Row>
        <Separator className="my-2" />
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action} className="flex h-7 items-center justify-between">
            <span className="text-muted-foreground">{action}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
