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
import { fetchPr, type PullRequest } from '@/lib/github'

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
  const [canOpen, setCanOpen] = useState(false)
  // The PR and the head it belongs to: it applies only while that head is shown.
  const [pr, setPr] = useState<{ pr: PullRequest; head: string } | null>(null)
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
        setCanOpen(meta.canOpen)
        const params = new URLSearchParams(location.search)
        if (meta.mode === 'patch') load({ kind: 'patch', name: meta.patchName ?? 'patch' })
        else if (meta.mode === 'git') {
          const first: Source = {
            kind: 'git',
            base: params.get('base') ?? meta.base,
            head: params.get('head') ?? meta.head,
            commit: params.get('commit') ?? undefined,
            ignoreWhitespace: params.has('w'),
          }
          load(first)
          const rev = request.current
          // Looked up after the first diff shows, so it never slows startup.
          fetchPr().then(({ pr, base }) => {
            if (!pr) return
            setPr({ pr, head: meta.head })
            // A detected PR knows its real base; switch unless you've moved on.
            if (base && base !== first.base && !params.has('base') && rev === request.current) load({ ...first, base })
          })
        }
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

  // Only while its branch is what's shown, in full.
  const s = state.source
  const activePr = pr && s?.kind === 'git' && s.head === pr.head && !s.commit ? pr.pr : undefined

  return { ...state, refs, commits, canOpen, pr: activePr, load }
}
