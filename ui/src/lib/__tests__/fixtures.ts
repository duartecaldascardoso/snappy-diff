import { parsePatch } from '@/lib/diff'

/** A one-file patch: `old` and `new` are the hunk's lines, prefixed ' ', '-' or '+'. */
export function patch(path: string, lines: string[], { start = 1, oids = ['1111111', '2222222'] } = {}) {
  const old = lines.filter((l) => !l.startsWith('+')).length
  const next = lines.filter((l) => !l.startsWith('-')).length
  return [
    `diff --git a/${path} b/${path}`,
    `index ${oids[0]}..${oids[1]} 100644`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${start},${old} +${start},${next} @@`,
    ...lines,
    '',
  ].join('\n')
}

export const entries = (...patches: string[]) => parsePatch(patches.join(''), 1)
