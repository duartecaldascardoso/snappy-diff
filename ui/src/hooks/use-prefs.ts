import { useCallback, useEffect, useState } from 'react'

export type Prefs = {
  diffStyle: 'split' | 'unified'
  wrap: boolean
  /** Show whole files instead of folding unchanged lines. */
  fullFiles: boolean
  /** Code font; empty means the default. */
  font: string
  /** Syntax theme family, see THEMES. */
  theme: string
}

const DEFAULTS: Prefs = { diffStyle: 'split', wrap: true, fullFiles: false, font: '', theme: 'Pierre' }

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('prefs') ?? '{}') }
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
