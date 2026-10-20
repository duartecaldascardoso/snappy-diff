import type { Entry } from '@/lib/diff'
import type { Comment } from '@/lib/review'

export type PullRequest = { number: number; title: string; url: string; baseRefName: string; headRefOid: string }

/** The PR under review, and the base to diff against if it was just detected. */
export async function fetchPr(): Promise<{ pr: PullRequest | null; base: string | null }> {
  const res = await fetch('/api/pr')
  return res.ok ? res.json() : { pr: null, base: null }
}

/** Posts comments to the PR as a submitted comment review; resolves to the review's URL. */
export async function sendReview(comments: Comment[], entries: Entry[]): Promise<string> {
  const paths = new Map(entries.map((e) => [e.id, e.file.name]))
  const res = await fetch('/api/github/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comments: comments.map((c) => ({
        path: paths.get(c.file) ?? c.file,
        line: c.end,
        side: c.side,
        startLine: c.start < c.end ? c.start : undefined,
        body: c.text,
      })),
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  return text
}
