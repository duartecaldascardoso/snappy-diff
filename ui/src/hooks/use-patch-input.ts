import { useEffect, useState } from 'react'

const LOOKS_LIKE_DIFF = /^(diff --git |--- |From [0-9a-f]{40} )/m

/** Accepts a diff dropped or pasted anywhere on the page. Returns whether a file is being dragged over it. */
export function usePatchInput(onPatch: (name: string, text: string) => void) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? ''
      if (LOOKS_LIKE_DIFF.test(text)) onPatch('pasted diff', text)
    }
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) onPatch(file.name, await file.text())
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onPatch])

  return dragging
}
