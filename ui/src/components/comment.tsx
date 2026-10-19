import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
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
    <Card className="m-2 max-w-3xl gap-1 py-2 font-sans text-[13px]">
      <CardHeader className="items-center gap-0 px-3">
        <CardDescription className="text-xs">{lines(comment)}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="xs" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="xs" onClick={onDelete}>
            Delete
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3 whitespace-pre-wrap">{comment.text}</CardContent>
    </Card>
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
    <InputGroup className="m-2 w-auto max-w-3xl bg-background font-sans">
      <InputGroupTextarea
        autoFocus
        value={text}
        rows={3}
        placeholder="Leave a comment"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter saves; Shift+Enter breaks the line. Not while an IME is composing.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') onCancel()
        }}
        className="min-h-16 text-[13px]"
      />
      <InputGroupAddon align="block-end">
        <InputGroupText className="text-xs">{lines(comment)} · ↵ to save, ⇧↵ for a new line</InputGroupText>
        <InputGroupButton size="sm" className="ml-auto" onClick={onCancel}>
          Cancel
        </InputGroupButton>
        <InputGroupButton size="sm" variant="default" disabled={!text.trim()} onClick={save}>
          Comment
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
