import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Comment } from '@/lib/review'

const lines = (c: Comment) => (c.start === c.end ? `Line ${c.end}` : `Lines ${c.start}–${c.end}`)

export function CommentCard({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="m-2 max-w-3xl rounded-md border bg-background px-3 py-2 font-sans text-[13px] shadow-xs">
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span className="mr-auto">{lines(comment)}</span>
        <Button className="h-6" onClick={onEdit}>
          Edit
        </Button>
        <Button className="h-6" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <p className="whitespace-pre-wrap">{comment.text}</p>
    </div>
  )
}

export function CommentEditor({
  comment,
  onSave,
  onCancel,
}: {
  comment: Comment
  onSave: (comment: Comment) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(comment.text)
  const save = () => text.trim() && onSave({ ...comment, text: text.trim() })
  return (
    <div className="m-2 max-w-3xl rounded-md border bg-background p-2 font-sans text-[13px] shadow-xs">
      <div className="mb-1 px-1 text-xs text-muted-foreground">{lines(comment)}</div>
      <Textarea
        autoFocus
        value={text}
        rows={3}
        placeholder="Leave a comment"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="mt-1 flex items-center justify-end gap-1">
        <span className="mr-auto px-1 text-xs text-muted-foreground">⌘↵ to save</span>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="outline" disabled={!text.trim()} onClick={save}>
          Comment
        </Button>
      </div>
    </div>
  )
}
