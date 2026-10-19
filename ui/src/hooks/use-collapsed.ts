import { useCallback, useMemo, useState } from 'react'
import type { Entry } from '@/lib/diff'

const NONE: ReadonlyMap<string, boolean> = new Map()

/**
 * Which files are collapsed. Files follow `byDefault` (viewed, generated…)
 * until toggled by hand; switching to another diff (`key`) forgets the toggles.
 */
export function useCollapsed(key: string, entries: Entry[], byDefault: (e: Entry) => boolean) {
  const [state, setState] = useState({ key, overrides: NONE })
  const overrides = state.key === key ? state.overrides : NONE

  const collapsed = useMemo(
    () => new Set(entries.filter((e) => overrides.get(e.id) ?? byDefault(e)).map((e) => e.id)),
    [entries, overrides, byDefault],
  )

  /** `undefined` hands the files back to their default. */
  const set = useCallback(
    (ids: string[], value?: boolean) =>
      setState((prev) => {
        const next = new Map(prev.key === key ? prev.overrides : NONE)
        for (const id of ids) {
          if (value == null) next.delete(id)
          else next.set(id, value)
        }
        return { key, overrides: next }
      }),
    [key],
  )

  const allCollapsed = entries.length > 0 && collapsed.size === entries.length
  return {
    collapsed,
    allCollapsed,
    toggle: useCallback((id: string) => set([id], !collapsed.has(id)), [set, collapsed]),
    expand: useCallback((id: string) => set([id], false), [set]),
    reset: useCallback((id: string) => set([id]), [set]),
    toggleAll: () => set(entries.map((e) => e.id), !allCollapsed),
  }
}
