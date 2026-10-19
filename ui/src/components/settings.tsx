import { Settings2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Prefs, SetPref } from '@/hooks/use-prefs'
import { BUNDLED_FONTS, installedFonts } from '@/lib/fonts'
import { THEMES } from '@/lib/themes'

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
  const [installed] = useState(installedFonts)
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
          <ToggleGroup
            value={prefs.diffStyle}
            options={[
              ['split', 'Split'],
              ['unified', 'Unified'],
            ]}
            onChange={(v) => setPref('diffStyle', v)}
          />
        </Row>
        <Row label="Mode">
          <ToggleGroup
            value={dark ? 'dark' : 'light'}
            options={[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(v) => (v === 'dark') !== dark && onToggleDark()}
          />
        </Row>
        <Row label="Theme">
          <NativeSelect value={prefs.theme} onChange={(e) => setPref('theme', e.target.value)}>
            {THEMES.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Code font">
          <NativeSelect value={prefs.font} onChange={(e) => setPref('font', e.target.value)}>
            <option value="">Default</option>
            <optgroup label="Bundled">
              {BUNDLED_FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </optgroup>
            {installed.length > 0 && (
              <optgroup label="Installed">
                {installed.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
        </Row>
        <Row label="Wrap lines">
          <Switch aria-label="Wrap lines" checked={prefs.wrap} onChange={(v) => setPref('wrap', v)} />
        </Row>
        <Row label="Show full files">
          <Switch
            aria-label="Show full files"
            checked={prefs.fullFiles}
            disabled={!canShowFullFiles}
            onChange={(v) => setPref('fullFiles', v)}
          />
        </Row>
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
