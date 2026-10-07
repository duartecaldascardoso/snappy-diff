import { FileUp } from 'lucide-react'
import type { Source } from '@/lib/diff'

export function EmptyState({
  source,
  loading,
  error,
  onOpen,
}: {
  source?: Source
  loading: boolean
  error?: string
  onOpen: () => void
}) {
  if (loading) return null
  if (error) return <pre className="max-w-xl text-xs whitespace-pre-wrap text-destructive">{error}</pre>
  if (source?.kind === 'git')
    return (
      <p className="text-muted-foreground">
        No changes between <code>{source.base}</code> and <code>{source.head}</code>.
      </p>
    )
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-12 py-10 text-muted-foreground hover:bg-accent/50"
    >
      <FileUp className="size-5" />
      <span className="text-sm text-foreground">Drop, paste or open a .diff / .patch file</span>
      <span className="text-xs">
        or run <code>snappy-diff main feature</code> inside a git repository
      </span>
    </button>
  )
}
