import { Settings2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import type { Prefs, SetPref } from '@/hooks/use-prefs'
import { installedFonts } from '@/lib/fonts'

export const SETTINGS_ID = 'settings'

const SHORTCUTS = [
  ['j / k', 'Next / previous file'],
  ['v', 'Mark file as viewed'],
  ['/  ⌘K', 'Search files'],
  ['⌘B', 'Toggle sidebar'],
  ['⌘V', 'View a diff from the clipboard'],
  ['?', 'This panel'],
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-md border p-0.5">
      {options.map(([v, label]) => (
        <Button key={v} className="h-6" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </Button>
      ))}
    </div>
  )
}

const Switch = ({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) => (
  <input
    type="checkbox"
    checked={checked}
    disabled={disabled}
    onChange={(e) => onChange(e.target.checked)}
    className="size-4 accent-foreground disabled:opacity-50"
  />
)

export function Settings({
  prefs,
  setPref,
  dark,
  onToggleDark,
  canShowFullFiles,
}: {
  prefs: Prefs
  setPref: SetPref
  dark: boolean
  onToggleDark: () => void
  /** Full files need the repository; a pasted patch only has its hunks. */
  canShowFullFiles: boolean
}) {
  const [fonts] = useState(installedFonts)
  return (
    <>
      <Button size="icon" title="Settings and shortcuts (?)" popoverTarget={SETTINGS_ID}>
        <Settings2 />
      </Button>
      <div
        id={SETTINGS_ID}
        popover="auto"
        className="fixed inset-auto top-12 right-2 m-0 w-72 rounded-lg border bg-background p-3 text-xs text-foreground shadow-lg"
      >
        <Row label="Layout">
          <Choice
            value={prefs.diffStyle}
            options={[
              ['split', 'Split'],
              ['unified', 'Unified'],
            ]}
            onChange={(v) => setPref('diffStyle', v)}
          />
        </Row>
        <Row label="Theme">
          <Choice
            value={dark ? 'dark' : 'light'}
            options={[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(v) => (v === 'dark') !== dark && onToggleDark()}
          />
        </Row>
        <Row label="Wrap lines">
          <Switch checked={prefs.wrap} onChange={(v) => setPref('wrap', v)} />
        </Row>
        <Row label="Show full files">
          <Switch checked={prefs.fullFiles} disabled={!canShowFullFiles} onChange={(v) => setPref('fullFiles', v)} />
        </Row>
        {fonts.length > 0 && (
          <Row label="Code font">
            <NativeSelect value={prefs.font} onChange={(e) => setPref('font', e.target.value)}>
              <option value="">Default</option>
              {fonts.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </NativeSelect>
          </Row>
        )}
        <div className="mt-2 border-t pt-2">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="flex h-6 items-center justify-between">
              <span className="text-muted-foreground">{action}</span>
              <kbd className="font-mono">{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
