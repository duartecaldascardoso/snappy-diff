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

const lineRange = (c: Comment) => (c.start === c.end ? `L${c.end}` : `L${c.start}-${c.end}`)

/** The review as Markdown, ready to paste into a pull request or an agent. */
export function reviewMarkdown(title: string, comments: Comment[], entries: Entry[]) {
  const files = new Map(entries.map((e) => [e.id, e.file]))
  const out = [`# Review of ${title}`]
  const byFile = Map.groupBy(comments, (c) => c.file)
  for (const [id, fileComments] of byFile) {
    const file = files.get(id)
    out.push('', `## ${file?.name ?? id}`)
    for (const c of fileComments.toSorted((a, b) => a.end - b.end)) {
      const side = c.side === 'deletions' ? ' (old)' : ''
      out.push('', `**${lineRange(c)}${side}**`)
      const code = file
        ? Array.from({ length: c.end - c.start + 1 }, (_, i) => lineText(file, c.side, c.start + i))
        : []
      if (code.length && code.every((l) => l != null))
        out.push('```' + (file?.name.split('.').pop() ?? ''), code.map((l) => l!.replace(/\r?\n$/, '')).join('\n'), '```')
      out.push(c.text)
    }
  }
  return out.join('\n')
}
