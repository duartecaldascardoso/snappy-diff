import type { FileDiffMetadata } from '@pierre/diffs'
import { FileDiff, FileMinus2, FilePlus2, FileSymlink } from 'lucide-react'

const ICONS = {
  new: FilePlus2,
  deleted: FileMinus2,
  change: FileDiff,
  'rename-pure': FileSymlink,
  'rename-changed': FileSymlink,
}

/** An icon for how the file changed: added, deleted, modified or renamed. */
export function FileIcon({ type, className }: { type: FileDiffMetadata['type']; className?: string }) {
  const Icon = ICONS[type]
  return <Icon className={className} />
}
