import type { Entry } from '@/lib/diff'
import { diffLines } from '@/lib/lines'

/** Shortest run of identical lines that counts as moved rather than coincidence. */
const MIN_RUN = 3

/** Lines too generic to anchor a move on their own: blank, braces, `end`, … */
const trivial = (text: string) => text.length < 4 || /^[\s{}()[\];,.<>/*\-#'"`|]*(end|fi|done|else)?[\s{}()[\];,]*$/.test(text)

const key = (file: string, side: string, n: number) => `${file}\0${side}\0${n}`

export type Moves = {
  /** `file\0side\0line` of every removed or added line that was only moved. */
  lines: Set<string>
  /** Moved lines per file (both sides counted). */
  perFile: Map<string, number>
  total: number
}

/**
 * Code that was moved rather than written: runs of at least three removed lines
 * that reappear, identical but for indentation, as added lines anywhere in the
 * diff. Those need far less reading than new code.
 */
export function findMoves(entries: Entry[]): Moves {
  type L = { file: string; n: number; text: string }
  const removed: L[] = []
  const added: L[] = []
  for (const e of entries) {
    if (e.generated) continue
    for (const l of diffLines(e.file)) {
      if (!l.changed) continue
      const line = { file: e.id, n: l.n, text: l.text.trim() }
      ;(l.side === 'deletions' ? removed : added).push(line)
    }
  }
  // Where each meaningful removed line sits, by its text.
  const at = new Map<string, number[]>()
  removed.forEach((l, i) => {
    if (!trivial(l.text)) (at.get(l.text) ?? at.set(l.text, []).get(l.text)!).push(i)
  })

  const lines = new Set<string>()
  const perFile = new Map<string, number>()
  const mark = (l: L, side: string) => {
    const k = key(l.file, side, l.n)
    if (lines.has(k)) return
    lines.add(k)
    perFile.set(l.file, (perFile.get(l.file) ?? 0) + 1)
  }

  for (let i = 0; i < added.length; ) {
    let best = { len: 0, from: -1 }
    for (const from of at.get(added[i].text) ?? []) {
      let len = 0
      while (
        i + len < added.length &&
        from + len < removed.length &&
        added[i + len].text === removed[from + len].text &&
        added[i + len].file === added[i].file &&
        removed[from + len].file === removed[from].file
      )
        len++
      if (len > best.len) best = { len, from }
    }
    // Enough real lines in the run, not just a match on braces.
    const meaningful = best.len && added.slice(i, i + best.len).filter((l) => !trivial(l.text)).length
    if (best.len >= MIN_RUN && meaningful >= 2) {
      for (let j = 0; j < best.len; j++) {
        mark(added[i + j], 'additions')
        mark(removed[best.from + j], 'deletions')
      }
      i += best.len
    } else i++
  }
  return { lines, perFile, total: lines.size }
}

export const isMoved = (moves: Moves, file: string, side: string, n: number) => moves.lines.has(key(file, side, n))
