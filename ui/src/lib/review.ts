import type { AnnotationSide, FileDiffMetadata } from '@pierre/diffs'
import type { Entry } from '@/lib/diff'

export type Comment = {
  id: string
  /** The entry id of the file. */
  file: string
  side: AnnotationSide
  start: number
  end: number
  text: string
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

/** The text of line `n` on one side, if the diff contains it. */
function lineText(file: FileDiffMetadata, side: AnnotationSide, n: number) {
  const lines = side === 'additions' ? file.additionLines : file.deletionLines
  if (!file.isPartial) return lines[n - 1]
  for (const h of file.hunks) {
    const [start, count, index] =
      side === 'additions'
        ? [h.additionStart, h.additionCount, h.additionLineIndex]
        : [h.deletionStart, h.deletionCount, h.deletionLineIndex]
    if (n >= start && n < start + count) return lines[index + n - start]
  }
}

const codeOf = (file: FileDiffMetadata, c: Comment) => {
  const lines = Array.from({ length: c.end - c.start + 1 }, (_, i) => lineText(file, c.side, c.start + i))
  return lines.every((l) => l != null) ? lines.map((l) => l!.replace(/\r?\n$/, '')).join('\n') : null
}

/**
 * The comments as a prompt for a coding agent: one numbered item per comment,
 * pointing at `path:line` (which agents can open), with the code and the ask.
 * `subject` names what was reviewed, e.g. "my uncommitted changes".
 */
export function reviewPrompt(subject: string, comments: Comment[], entries: Entry[]) {
  const order = new Map(entries.map((e, i) => [e.id, i]))
  const files = new Map(entries.map((e) => [e.id, e.file]))
  const sorted = comments.toSorted((a, b) => (order.get(a.file) ?? 0) - (order.get(b.file) ?? 0) || a.end - b.end)
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
    const code = file && codeOf(file, c)
    if (code) out.push('```' + path.split('.').pop(), code, '```')
    out.push(c.text)
  })
  return out.join('\n')
}
