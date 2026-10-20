import { type FileDiffMetadata, parsePatchFiles } from '@pierre/diffs'

export type Meta = {
  mode: 'git' | 'patch' | 'empty'
  refs: string[]
  base: string
  head: string
  patchName: string | null
  canOpen: boolean
}

export type Commit = { sha: string; subject: string; author: string; date: string }

/** As a head, compares against uncommitted changes instead of a ref. */
export const WORKTREE = ''

export type GitSource = {
  kind: 'git'
  base: string
  head: string
  /** Narrows the range to this one commit. */
  commit?: string
  ignoreWhitespace?: boolean
}

export type Source =
  | GitSource
  /** `text` is absent when the patch was handed to the CLI and lives on the server. */
  | { kind: 'patch'; name: string; text?: string }

export type Entry = {
  id: string
  /** Changes whenever the file's contents do. */
  signature: string
  /** The load this entry came from; a newer one means it must be redrawn. */
  rev: number
  file: FileDiffMetadata
  add: number
  del: number
  /** Lockfiles, minified bundles and the like. */
  generated: boolean
  /** Big enough that rendering it is rarely what you want first. */
  large: boolean
}

export const isWorktree = (s?: Source) => s?.kind === 'git' && s.head === WORKTREE && !s.commit

export const gitQuery = (s: Source) => {
  if (s.kind !== 'git') return ''
  const params = new URLSearchParams({ base: s.base, head: s.head })
  if (s.commit) params.set('commit', s.commit)
  if (s.ignoreWhitespace) params.set('w', '1')
  return `?${params}`
}

/** Identifies what is being reviewed, for remembering progress and comments. */
export const reviewKey = (s: Source, text: string) =>
  s.kind === 'git' ? `${s.base}...${s.head || 'worktree'}${s.commit ? `@${s.commit}` : ''}` : `patch:${hash(text).toString(36)}`

export async function fetchPatch(source: Source): Promise<string> {
  if (source.kind === 'patch' && source.text != null) return source.text
  const res = await fetch(`/api/diff${gitQuery(source)}`)
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  return text
}

/** How many commits of the range touched each file. */
export async function fetchChurn(s: GitSource): Promise<Map<string, number>> {
  if (s.head === WORKTREE) return new Map()
  const res = await fetch(`/api/churn?${new URLSearchParams({ base: s.base, head: s.head })}`)
  return new Map(Object.entries(res.ok ? await res.json() : {}))
}

export async function fetchCommits(s: GitSource): Promise<Commit[]> {
  if (s.head === WORKTREE) return []
  const res = await fetch(`/api/commits?${new URLSearchParams({ base: s.base, head: s.head })}`)
  return res.ok ? res.json() : []
}

const GENERATED =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock|go\.sum|Pipfile\.lock|flake\.lock)$|\.(min\.(js|css)|map|snap)$/

/** FNV-1a; enough to tell contents apart, and fast. */
export function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

const signatureOf = (file: FileDiffMetadata) =>
  file.prevObjectId || file.newObjectId
    ? `${file.prevObjectId}..${file.newObjectId}`
    : hash(file.deletionLines.join('') + '\0' + file.additionLines.join('')).toString(36)

/**
 * `rev` identifies the load. Files unchanged since `previous` keep their old
 * entry, so a live refresh only redraws what actually changed.
 */
export function parsePatch(text: string, rev: number, previous: Entry[] = []): Entry[] {
  const before = new Map(previous.map((e) => [e.id, e]))
  const seen = new Map<string, number>()
  return parsePatchFiles(text).flatMap((patch) =>
    patch.files.map((file) => {
      // A multi-commit patch can touch the same path more than once.
      const n = seen.get(file.name) ?? 0
      seen.set(file.name, n + 1)
      const id = n ? `${file.name}#${n}` : file.name
      const signature = signatureOf(file)
      const old = before.get(id)
      if (old?.signature === signature) return old
      let add = 0
      let del = 0
      for (const h of file.hunks) {
        add += h.additionLines
        del += h.deletionLines
      }
      return { id, signature, rev, file, add, del, generated: GENERATED.test(file.name), large: add + del > 2000 }
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
    file.type === 'deleted'
      ? ''
      : worktree
        ? fetchText(`/api/file?${new URLSearchParams({ path: file.name })}`)
        : exists(file.newObjectId)
          ? fetchText(`/api/blob/${file.newObjectId}`)
          : '',
  ])
  const newFile = { name: file.name, contents: next }
  return prev == null
    ? { oldFile: null, newFile }
    : { oldFile: { name: file.prevName ?? file.name, contents: prev }, newFile }
}
