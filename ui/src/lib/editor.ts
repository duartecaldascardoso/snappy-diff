import type { FileDiffMetadata } from '@pierre/diffs'
import { diffLines } from '@/lib/lines'

export const EDITORS = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  zed: 'Zed',
  idea: 'IntelliJ IDEA',
} as const

export type EditorId = keyof typeof EDITORS

/** The first changed line on the new side, where opening a file should land. */
export const firstChange = (file: FileDiffMetadata) =>
  diffLines(file).find((l) => l.changed && l.side === 'additions')?.n ?? file.hunks[0]?.additionStart ?? 1

/** Asks the server to open a repository file in the editor; it goes through the OS, not the browser. */
export async function openInEditor(editor: EditorId, path: string, line: number) {
  await fetch('/api/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editor, path, line }),
  })
}
