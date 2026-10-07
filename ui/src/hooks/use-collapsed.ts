import { useCallback, useState } from 'react'
import type { Entry } from '@/lib/diff'

const NONE: ReadonlySet<string> = new Set()

/** Which files are collapsed. Tied to `entries`, so a new diff starts fully expanded. */
export function useCollapsed(entries: Entry[]) {
  const [state, setState] = useState({ entries, ids: NONE })
  const collapsed = state.entries === entries ? state.ids : NONE

  const update = useCallback(
    (change: (ids: Set<string>) => void) =>
      setState((prev) => {
        const ids = new Set(prev.entries === entries ? prev.ids : NONE)
        change(ids)
        return { entries, ids }
      }),
    [entries],
  )

  const allCollapsed = entries.length > 0 && collapsed.size === entries.length
  return {
    collapsed,
    allCollapsed,
    toggle: useCallback((id: string) => update((ids) => void (ids.delete(id) || ids.add(id))), [update]),
    expand: useCallback((id: string) => update((ids) => void ids.delete(id)), [update]),
    toggleAll: () => setState({ entries, ids: allCollapsed ? NONE : new Set(entries.map((e) => e.id)) }),
  }
}
