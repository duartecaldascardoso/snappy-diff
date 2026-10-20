import { useCallback, useState } from 'react'
import { type Commit, type Source, WORKTREE } from '@/lib/diff'

const storageKey = (s?: Source) =>
  s?.kind === 'git' && s.head !== WORKTREE && !s.commit ? `last-review:${s.base}...${s.head}` : null

function read(key: string | null) {
  try {
    return key ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

/**
 * The branch tip you last reviewed, per range, so new commits on top of it can
 * be reviewed on their own ("3 new commits since your review").
 */
export function useLastReview(source: Source | undefined, commits: Commit[]) {
  const key = storageKey(source)
  const [state, setState] = useState(() => ({ key, sha: read(key) }))
  // Another range: swap in what was remembered for it, during render.
  if (state.key !== key) setState({ key, sha: read(key) })
  const sha = state.key === key ? state.sha : null

  const tip = commits[0]?.sha
  /** Remembers the current tip; called whenever you review something. */
  const markReviewed = useCallback(() => {
    if (!key || !tip || tip === sha) return
    try {
      localStorage.setItem(key, tip)
    } catch {
      // Without storage there's no "since your review", and nothing else breaks.
    }
    setState({ key, sha: tip })
  }, [key, tip, sha])

  // Commits listed newest first: the reviewed tip's position is how many are new.
  const newer = sha ? commits.findIndex((c) => c.sha === sha) : -1
  return { since: newer > 0 ? { sha: sha!, count: newer } : null, markReviewed }
}
