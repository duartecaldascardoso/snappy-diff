import { ChevronDown } from 'lucide-react'
import { FileIcon } from '@/components/file-icon'
import { Checkbox } from '@/components/ui/checkbox'
import type { Entry } from '@/lib/diff'

/** Height of a file header in the diff view, which this bar stands in for. */
export const HEADER_HEIGHT = 44

/**
 * The header of the file at the top of the diff, pinned over the scroll area.
 * It lives outside the scroller, so unlike CSS-sticky headers inside a
 * virtualized list it can't lag behind the scroll (as it does in Firefox).
 */
export function PinnedHeader({
  entry,
  viewed,
  onCollapse,
  onToggleViewed,
}: {
  entry: Entry
  viewed: boolean
  onCollapse: () => void
  onToggleViewed: () => void
}) {
  return (
    <div
      style={{ height: HEADER_HEIGHT }}
      className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b bg-background px-4 text-sm shadow-xs"
    >
      <button
        type="button"
        aria-label="Collapse file"
        onClick={onCollapse}
        className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <FileIcon type={entry.file.type} className="size-4 text-muted-foreground" />
      <span className="min-w-0 truncate">{entry.file.name}</span>
      <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
        <span className="tabular-nums">
          <span className="text-deleted">−{entry.del}</span> <span className="text-added">+{entry.add}</span>
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground select-none">
          <Checkbox checked={viewed} onCheckedChange={onToggleViewed} />
          Viewed
        </label>
      </span>
    </div>
  )
}
