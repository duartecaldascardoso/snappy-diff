import type { AnnotationSide, FileDiffMetadata } from '@pierre/diffs'

/** A line of one side of a diff: its number in that version of the file, and its text. */
export type Line = { n: number; text: string; side: AnnotationSide; changed: boolean }

const strip = (text: string) => text.replace(/\r?\n$/, '')

/**
 * Every line a diff shows, each once: context and added lines on the new side,
 * removed lines on the old side.
 */
export function diffLines(file: FileDiffMetadata): Line[] {
  const out: Line[] = []
  for (const h of file.hunks) {
    let add = h.additionStart
    let del = h.deletionStart
    for (const c of h.hunkContent) {
      if (c.type === 'context') {
        for (let i = 0; i < c.lines; i++)
          out.push({ n: add + i, text: strip(file.additionLines[c.additionLineIndex + i] ?? ''), side: 'additions', changed: false })
        add += c.lines
        del += c.lines
      } else {
        for (let i = 0; i < c.deletions; i++)
          out.push({ n: del + i, text: strip(file.deletionLines[c.deletionLineIndex + i] ?? ''), side: 'deletions', changed: true })
        for (let i = 0; i < c.additions; i++)
          out.push({ n: add + i, text: strip(file.additionLines[c.additionLineIndex + i] ?? ''), side: 'additions', changed: true })
        del += c.deletions
        add += c.additions
      }
    }
  }
  return out
}

/** All lines of one side the diff knows, by number. */
export function sideLines(file: FileDiffMetadata, side: AnnotationSide): Map<number, string> {
  const lines = side === 'additions' ? file.additionLines : file.deletionLines
  // A diff hydrated with whole files holds every line.
  if (!file.isPartial) return new Map(lines.map((text, i) => [i + 1, strip(text)]))
  const out = new Map<number, string>()
  for (const h of file.hunks) {
    const [start, count, index] =
      side === 'additions'
        ? [h.additionStart, h.additionCount, h.additionLineIndex]
        : [h.deletionStart, h.deletionCount, h.deletionLineIndex]
    for (let i = 0; i < count; i++) out.set(start + i, strip(lines[index + i] ?? ''))
  }
  return out
}

/** The text of lines `start`–`end` on one side, or null if the diff lacks any of them. */
export function linesText(file: FileDiffMetadata, side: AnnotationSide, start: number, end: number) {
  const lines = sideLines(file, side)
  const out: string[] = []
  for (let n = start; n <= end; n++) {
    const text = lines.get(n)
    if (text == null) return null
    out.push(text)
  }
  return out.join('\n')
}
