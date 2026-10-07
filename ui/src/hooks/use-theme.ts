import { useCallback, useState } from 'react'

/** Dark mode. index.html applies the stored (or system) preference before first paint. */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }, [])
  return [dark, toggle] as const
}
