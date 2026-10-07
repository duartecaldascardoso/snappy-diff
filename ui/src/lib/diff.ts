import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs'

export const THEME = { dark: 'pierre-dark', light: 'pierre-light' } as const

export type Meta = {
  mode: 'git' | 'patch' | 'empty'
  refs: string[]
  base: string
  head: string
  patchName: string | null
}

/** As a head, compares against uncommitted changes instead of a ref. */
export const WORKTREE = ''

export type Source =
  | { kind: 'git'; base: string; head: string; ignoreWhitespace?: boolean }
  /** `text` is absent when the patch was handed to the CLI and lives on the server. */
  | { kind: 'patch'; name: string; text?: string }

export type Entry = { id: string; rev: number; file: FileDiffMetadata; add: number; del: number }

export const gitQuery = (s: Source) =>
  s.kind === 'git'
    ? `?${new URLSearchParams({ base: s.base, head: s.head, ...(s.ignoreWhitespace && { w: '1' }) })}`
    : ''

export async function fetchPatch(source: Source): Promise<string> {
  if (source.kind === 'patch' && source.text != null) return source.text
  const res = await fetch(`/api/diff${gitQuery(source)}`)
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  return text
}

/** `rev` identifies the load, so the viewer can tell reloaded files from stale ones. */
export function parsePatch(text: string, rev: number): Entry[] {
  const seen = new Map<string, number>()
  return parsePatchFiles(text).flatMap((patch) =>
    patch.files.map((file) => {
      // A multi-commit patch can touch the same path more than once.
      const n = seen.get(file.name) ?? 0
      seen.set(file.name, n + 1)
      let add = 0
      let del = 0
      for (const h of file.hunks) {
        add += h.additionLines
        del += h.deletionLines
      }
      return { id: n ? `${file.name}#${n}` : file.name, rev, file, add, del }
    }),
  )
}

const exists = (oid?: string): oid is string => !!oid && !/^0+$/.test(oid)

async function fetchText(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  return res.text()
}

/**
 * Fetches both sides of a file so its folded lines can be expanded. Uncommitted
 * contents have no blob yet, so a working-tree head is read from disk.
 */
export const fileLoader = (worktree: boolean) => async (file: FileDiffMetadata) => {
  const [prev, next] = await Promise.all([
    exists(file.prevObjectId) ? fetchText(`/api/blob/${file.prevObjectId}`) : null,
    !exists(file.newObjectId)
      ? ''
      : fetchText(worktree ? `/api/file?${new URLSearchParams({ path: file.name })}` : `/api/blob/${file.newObjectId}`),
  ])
  const newFile = { name: file.name, contents: next }
  return prev == null
    ? { oldFile: null, newFile }
    : { oldFile: { name: file.prevName ?? file.name, contents: prev }, newFile }
}
