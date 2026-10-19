import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Commit,
  type Entry,
  fetchCommits,
  fetchPatch,
  gitQuery,
  isWorktree,
  type Meta,
  parsePatch,
  reviewKey,
  type Source,
} from '@/lib/diff'

type State = {
  source?: Source
  /** Identifies what is under review; see `reviewKey`. */
  key: string
  entries: Entry[]
  loading: boolean
  error?: string
  ms?: number
}

const REFRESH_MS = 1500

export function useDiff() {
  const [refs, setRefs] = useState<string[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [state, setState] = useState<State>({ key: '', entries: [], loading: true })
  const request = useRef(0)
  const last = useRef({ text: '', entries: [] as Entry[] })

  const load = useCallback(async (source: Source) => {
    const rev = ++request.current
    const started = performance.now()
    setState((s) => ({ ...s, source, loading: true, error: undefined }))
    history.replaceState(null, '', location.pathname + gitQuery(source))
    if (source.kind === 'git') fetchCommits(source).then((c) => rev === request.current && setCommits(c))
    else setCommits([])
    let next: State
    try {
      const text = await fetchPatch(source)
      const entries = parsePatch(text, rev)
      last.current = { text, entries }
      next = { source, key: reviewKey(source, text), entries, loading: false, ms: performance.now() - started }
    } catch (e) {
      next = { source, key: '', entries: [], loading: false, error: e instanceof Error ? e.message : String(e) }
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
          load({
            kind: 'git',
            base: params.get('base') ?? meta.base,
            head: params.get('head') ?? meta.head,
            commit: params.get('commit') ?? undefined,
            ignoreWhitespace: params.has('w'),
          })
        else setState({ key: '', entries: [], loading: false })
      })
      .catch((e) => setState({ key: '', entries: [], loading: false, error: String(e) }))
  }, [load])

  // Uncommitted changes move under our feet: re-diff while the page is visible
  // and whenever it regains focus. Unchanged output costs one cheap request.
  const { source, loading } = state
  useEffect(() => {
    if (loading || !source || !isWorktree(source)) return
    let busy = false
    const refresh = async () => {
      if (busy || document.hidden) return
      busy = true
      const rev = request.current
      try {
        const text = await fetchPatch(source)
        if (rev !== request.current || text === last.current.text) return
        const entries = parsePatch(text, ++request.current, last.current.entries)
        last.current = { text, entries }
        setState((s) => ({ ...s, entries }))
      } catch {
        // Keep showing the last good diff; the next tick retries.
      } finally {
        busy = false
      }
    }
    const timer = setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [source, loading])

  return { ...state, refs, commits, load }
}
