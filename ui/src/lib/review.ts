import type { AnnotationSide } from '@pierre/diffs'
import type { Entry } from '@/lib/diff'
import { linesText, sideLines } from '@/lib/lines'

export type Comment = {
  id: string
  /** The entry id of the file. */
  file: string
  side: AnnotationSide
  start: number
  end: number
  text: string
  /** The commented lines as they read when the comment was left: its anchor. */
  code?: string
  /** Set when that code is no longer in the diff, most likely because it was addressed. */
  outdated?: boolean
}

export type Review = {
  /** Entry id → the signature it had when marked viewed. */
  viewed: Record<string, string>
  comments: Comment[]
}

export const EMPTY_REVIEW: Review = { viewed: {}, comments: [] }

const storageKey = (key: string) => `review:${key}`

export function readReview(key: string): Review {
  try {
    const raw = key && localStorage.getItem(storageKey(key))
    return raw ? { ...EMPTY_REVIEW, ...JSON.parse(raw) } : EMPTY_REVIEW
  } catch {
    return EMPTY_REVIEW
  }
}

export function writeReview(key: string, review: Review) {
  if (!key) return
  const empty = !review.comments.length && !Object.keys(review.viewed).length
  if (empty) localStorage.removeItem(storageKey(key))
  else localStorage.setItem(storageKey(key), JSON.stringify(review))
}

/**
 * Moves comments to follow the code they were left on, so they survive edits
 * (an agent's, say) and live refreshes. A comment whose lines still read the
 * same stays; one whose code moved goes with it, to the nearest match; one
 * whose code is gone is marked outdated.
 */
export function relocate(comments: Comment[], entries: Entry[]): Comment[] {
  if (!entries.length) return comments
  const files = new Map(entries.map((e) => [e.id, e.file]))
  return comments.map((c) => {
    if (c.code == null) return c
    const file = files.get(c.file)
    if (!file) return { ...c, outdated: true }
    if (linesText(file, c.side, c.start, c.end) === c.code) return { ...c, outdated: false }
    const lines = sideLines(file, c.side)
    const want = c.code.split('\n')
    let best: number | null = null
    for (const n of lines.keys()) {
      if (!want.every((text, i) => lines.get(n + i) === text)) continue
      if (best == null || Math.abs(n - c.start) < Math.abs(best - c.start)) best = n
    }
    return best == null
      ? { ...c, outdated: true }
      : { ...c, start: best, end: best + want.length - 1, outdated: false }
  })
}

/**
 * The comments as a prompt for a coding agent: one numbered item per comment,
 * pointing at `path:line` (which agents can open), with the code and the ask.
 * `subject` names what was reviewed, e.g. "my uncommitted changes".
 */
export function reviewPrompt(subject: string, comments: Comment[], entries: Entry[]) {
  const order = new Map(entries.map((e, i) => [e.id, i]))
  const files = new Map(entries.map((e) => [e.id, e.file]))
  // Outdated comments were most likely addressed already.
  const sorted = comments.filter((c) => !c.outdated).toSorted((a, b) => (order.get(a.file) ?? 0) - (order.get(b.file) ?? 0) || a.end - b.end)
  const out = [
    `Please address these review comments on ${subject}.`,
    'Each one gives the file and lines, the code it refers to, and what to change.',
  ]
  sorted.forEach((c, i) => {
    const file = files.get(c.file)
    const path = file?.name ?? c.file
    const lines = c.start === c.end ? `${c.end}` : `${c.start}-${c.end}`
    const removed = c.side === 'deletions' ? ' (removed lines; numbers are from before the change)' : ''
    out.push('', `${i + 1}. \`${path}:${lines}\`${removed}`)
    const code = file && linesText(file, c.side, c.start, c.end)
    if (code) out.push('```' + path.split('.').pop(), code, '```')
    out.push(c.text)
  })
  return out.join('\n')
}
