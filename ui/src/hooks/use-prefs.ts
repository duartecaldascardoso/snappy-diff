import type { FileTreeIcons } from '@pierre/trees'
import { useCallback, useEffect, useState } from 'react'
import type { EditorId } from '@/lib/editor'

/** The file tree's built-in icon sets, plain or colored by file type. */
export const ICON_PACKS = {
  'standard-colored': { label: 'Standard, colored', icons: { set: 'standard', colored: true } },
  standard: { label: 'Standard', icons: { set: 'standard', colored: false } },
  'complete-colored': { label: 'Complete, colored', icons: { set: 'complete', colored: true } },
  complete: { label: 'Complete', icons: { set: 'complete', colored: false } },
  minimal: { label: 'Minimal', icons: { set: 'minimal', colored: false } },
} satisfies Record<string, { label: string; icons: FileTreeIcons }>

export type Prefs = {
  diffStyle: 'split' | 'unified'
  wrap: boolean
  /** Show whole files instead of folding unchanged lines. */
  fullFiles: boolean
  /** Code font; empty means the default. */
  font: string
  /** Syntax theme family, see THEMES. */
  theme: string
  icons: keyof typeof ICON_PACKS
  /** Where "open in editor" goes. */
  editor: EditorId
}

const DEFAULTS: Prefs = { diffStyle: 'split', wrap: true, fullFiles: false, font: '', theme: 'Pierre', icons: 'standard-colored', editor: 'vscode' }

function read(): Prefs {
  try {
    const prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('prefs') ?? '{}') }
    return prefs.icons in ICON_PACKS ? prefs : { ...prefs, icons: DEFAULTS.icons }
  } catch {
    return DEFAULTS
  }
}

/** Viewer preferences, kept in localStorage. */
export function usePrefs() {
  const [prefs, setPrefs] = useState(read)
  useEffect(() => localStorage.setItem('prefs', JSON.stringify(prefs)), [prefs])
  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => setPrefs((p) => ({ ...p, [key]: value })), [])
  return [prefs, set] as const
}

export type SetPref = ReturnType<typeof usePrefs>[1]
