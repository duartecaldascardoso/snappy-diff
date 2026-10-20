import type { AnnotationSide } from '@pierre/diffs'
import { MessageSquarePlus } from 'lucide-react'
import { type RefObject, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useHotkey } from '@/hooks/use-hotkey'

export type LineRange = { file: string; side: AnnotationSide; start: number; end: number }

type Selected = LineRange & { x: number; y: number }

const lineOf = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-line]')

const sideOf = (line: HTMLElement): AnnotationSide =>
  line.closest('[data-deletions]') || (!line.closest('[data-additions]') && line.dataset.lineType?.includes('deletion'))
    ? 'deletions'
    : 'additions'

/**
 * Reads which lines of which file a text selection covers. The diff renders in
 * shadow roots, so this needs `getComposedRanges` to see inside them.
 */
function readSelection(container: HTMLElement): Selected | null {
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || !selection.getComposedRanges) return null
  const roots = [...container.querySelectorAll('diffs-container')].flatMap((h) => h.shadowRoot ?? [])
  const [range] = selection.getComposedRanges({ shadowRoots: roots })
  if (!range) return null
  let first = lineOf(range.startContainer)
  let last = lineOf(range.endContainer)
  if (!first || !last) return null
  const host = (first.getRootNode() as ShadowRoot).host
  if ((last.getRootNode() as ShadowRoot).host !== host) return null
  const file = host.querySelector('[data-file]')?.getAttribute('data-file')
  const side = sideOf(last)
  if (!file) return null
  // Across sides (unified view), keep to the side the selection ends on.
  if (sideOf(first) !== side) last = first = last
  let start = Number(first.dataset.line)
  let end = Number(last.dataset.line)
  // Selecting whole lines ends at the very start of the next one; don't count it.
  if (range.endOffset === 0 && end > start) end--
  if (start > end) [start, end] = [end, start]
  const caret = document.createRange()
  caret.setStart(range.endContainer, range.endOffset)
  const rect = caret.getBoundingClientRect()
  return { file, side, start, end, x: rect.right, y: rect.bottom }
}

/** A "Comment" button at the end of a text selection in the diff (or press `c`). */
export function SelectionComment({
  container,
  onComment,
}: {
  container: RefObject<HTMLElement | null>
  onComment: (range: LineRange) => void
}) {
  const [selected, setSelected] = useState<Selected | null>(null)

  useEffect(() => {
    const el = container.current
    if (!el) return
    // Read once the selection settles, not on every move while dragging.
    const settle = () => requestAnimationFrame(() => setSelected(readSelection(el)))
    const clear = () => document.getSelection()?.isCollapsed && setSelected(null)
    const hide = () => setSelected(null)
    el.addEventListener('pointerup', settle)
    el.addEventListener('keyup', settle)
    el.addEventListener('scroll', hide, { passive: true })
    document.addEventListener('selectionchange', clear)
    return () => {
      el.removeEventListener('pointerup', settle)
      el.removeEventListener('keyup', settle)
      el.removeEventListener('scroll', hide)
      document.removeEventListener('selectionchange', clear)
    }
  }, [container])

  const comment = () => {
    if (!selected) return
    onComment(selected)
    document.getSelection()?.removeAllRanges()
    setSelected(null)
  }
  useHotkey('c', comment)

  if (!selected) return null
  return (
    <Button
      size="xs"
      style={{ position: 'fixed', left: selected.x + 4, top: selected.y + 4 }}
      className="z-20 shadow-md"
      // Keep the selection while clicking.
      onMouseDown={(e) => e.preventDefault()}
      onClick={comment}
    >
      <MessageSquarePlus />
      Comment
    </Button>
  )
}
