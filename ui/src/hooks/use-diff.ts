import { useCallback, useEffect, useRef, useState } from 'react'
import { type Entry, fetchPatch, gitQuery, type Meta, parsePatch, type Source } from '@/lib/diff'

type State = { source?: Source; entries: Entry[]; loading: boolean; error?: string; ms?: number }

export function useDiff() {
  const [refs, setRefs] = useState<string[]>([])
  const [state, setState] = useState<State>({ entries: [], loading: true })
  const request = useRef(0)

  const load = useCallback(async (source: Source) => {
    const rev = ++request.current
    const started = performance.now()
    setState((s) => ({ ...s, source, loading: true, error: undefined }))
    history.replaceState(null, '', location.pathname + gitQuery(source))
    let next: State
    try {
      const entries = parsePatch(await fetchPatch(source), rev)
      next = { source, entries, loading: false, ms: performance.now() - started }
    } catch (e) {
      next = { source, entries: [], loading: false, error: e instanceof Error ? e.message : String(e) }
    }
    // A newer load supersedes this one.
    if (rev === request.current) setState(next)
  }, [])

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then((meta: Meta) => {
        setRefs(meta.refs)
        const params = new URLSearchParams(location.search)
        if (meta.mode === 'patch') load({ kind: 'patch', name: meta.patchName ?? 'patch' })
        else if (meta.mode === 'git')
          load({ kind: 'git', base: params.get('base') ?? meta.base, head: params.get('head') ?? meta.head })
        else setState({ entries: [], loading: false })
      })
      .catch((e) => setState({ entries: [], loading: false, error: String(e) }))
  }, [load])

  return { ...state, refs, load }
}
