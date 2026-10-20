import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Entry } from '@/lib/diff'
import { type Comment, EMPTY_REVIEW, readReview, relocate, type Review, writeReview } from '@/lib/review'

/** Viewed files and comments for the diff identified by `key`, kept in localStorage. */
export function useReview(key: string, entries: Entry[]) {
  const [state, setState] = useState(() => ({ key, review: readReview(key) }))
  // Switching diffs swaps in that diff's saved review during render.
  if (state.key !== key) setState({ key, review: readReview(key) })
  const review = state.key === key ? state.review : EMPTY_REVIEW

  useEffect(() => writeReview(state.key, state.review), [state])

  const update = useCallback(
    (change: (review: Review) => Review) => setState((s) => ({ key: s.key, review: change(s.review) })),
    [],
  )

  // Where each comment's code is now; derived, so the stored anchor stays the source of truth.
  const comments = useMemo(() => relocate(review.comments, entries), [review.comments, entries])
  const active = useMemo(() => comments.filter((c) => !c.outdated), [comments])

  const isViewed = useCallback((e: Entry) => review.viewed[e.id] === e.signature, [review.viewed])
  const viewedCount = useMemo(() => entries.filter(isViewed).length, [entries, isViewed])

  const toggleViewed = useCallback(
    (e: Entry) =>
      update((r) => {
        const viewed = { ...r.viewed }
        if (viewed[e.id] === e.signature) delete viewed[e.id]
        else viewed[e.id] = e.signature
        return { ...r, viewed }
      }),
    [update],
  )

  const saveComment = useCallback(
    (comment: Comment) =>
      update((r) => ({ ...r, comments: [...r.comments.filter((c) => c.id !== comment.id), comment] })),
    [update],
  )

  const deleteComment = useCallback(
    (id: string) => update((r) => ({ ...r, comments: r.comments.filter((c) => c.id !== id) })),
    [update],
  )

  const clearComments = useCallback(() => update((r) => ({ ...r, comments: [] })), [update])

  return { comments, active, isViewed, viewedCount, toggleViewed, saveComment, deleteComment, clearComments }
}

export type ReviewState = ReturnType<typeof useReview>
