import { useCallback, useEffect, useState } from 'react'
import { type Chrome, chromeFor, themeNamed } from '@/lib/themes'

const CHROME_KEY = 'chrome'

function apply(chrome: Chrome) {
  const root = document.documentElement
  root.removeAttribute('style')
  for (const [k, v] of Object.entries(chrome.vars)) root.style.setProperty(k, v)
  root.classList.toggle('dark', chrome.dark)
}

/**
 * Light/dark mode and the syntax theme, which also colors the rest of the app.
 * The resolved colors are cached so index.html can paint them before React loads.
 */
export function useAppearance(themeName: string) {
  // index.html already applied the stored (or system) mode.
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  })
  const theme = themeNamed(themeName)
  const variant = dark ? theme.dark : theme.light

  useEffect(() => {
    let current = true
    chromeFor(variant).then((chrome) => {
      if (!current) return
      apply(chrome)
      localStorage.setItem(CHROME_KEY, JSON.stringify(chrome))
    })
    return () => {
      current = false
    }
  }, [variant])

  const toggleDark = useCallback(() => {
    localStorage.setItem('theme', dark ? 'light' : 'dark')
    setDark(!dark)
  }, [dark])

  return { dark, toggleDark, theme }
}
