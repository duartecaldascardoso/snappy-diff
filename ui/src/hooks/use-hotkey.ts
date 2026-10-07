import { useEffect } from 'react'
import { useLatest } from '@/hooks/use-latest'

const isTyping = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')

/** `mod+b` matches ⌘B / Ctrl+B; a bare key like `/` is ignored while typing. */
export function useHotkey(combo: string, handler: () => void) {
  const latest = useLatest(handler)

  useEffect(() => {
    const mod = combo.startsWith('mod+')
    const key = mod ? combo.slice(4) : combo
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== key || (mod ? !(e.metaKey || e.ctrlKey) : isTyping(e))) return
      e.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, latest])
}
