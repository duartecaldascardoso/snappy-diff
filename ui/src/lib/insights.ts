import type { Entry } from '@/lib/diff'
import type { Moves } from '@/lib/moved'

export type Kind = 'code' | 'tests' | 'config' | 'ci' | 'docs' | 'generated'

/** In the order the overview stacks and lists them. */
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'code', label: 'Code' },
  { id: 'tests', label: 'Tests' },
  { id: 'config', label: 'Config' },
  { id: 'ci', label: 'CI' },
  { id: 'docs', label: 'Docs' },
  { id: 'generated', label: 'Generated' },
]

const TEST = /(^|\/)(tests?|__tests__|specs?|e2e|testdata|fixtures)\/|\.(test|spec)\.[^/]+$|_test\.[a-z]+$|(^|\/)test_[^/]+\.py$/
const CI = /^\.github\/|^\.gitlab-ci|^\.circleci\/|(^|\/)Jenkinsfile$|^\.buildkite\//
const DOCS = /\.(md|mdx|rst|adoc|txt)$|^docs?\//i
const CONFIG =
  /(^|\/)(Dockerfile|Makefile|Procfile|\.env[^/]*|\.[^/]*rc|\.editorconfig|\.gitignore)$|\.(json|ya?ml|toml|ini|cfg|conf|lock)$|(^|\/)[^/]*\.config\.[a-z]+$/

export function kindOf(e: Entry): Kind {
  const path = e.file.name
  if (e.generated) return 'generated'
  if (TEST.test(path)) return 'tests'
  if (CI.test(path)) return 'ci'
  if (DOCS.test(path)) return 'docs'
  if (CONFIG.test(path)) return 'config'
  return 'code'
}

/** Squares in a size bar, like GitHub's diffstat. */
export const STAT_BOXES = 5

/**
 * How many squares of a size bar to fill green, red and gray. Size is on a log
 * scale against the biggest in view, so one huge file doesn't flatten the rest.
 */
export function diffstat(add: number, del: number, max: number) {
  const size = add + del
  if (!size) return { add: 0, del: 0, empty: STAT_BOXES }
  const filled = Math.min(STAT_BOXES, Math.max(1, Math.ceil((STAT_BOXES * Math.log(size + 1)) / Math.log(max + 1))))
  let green = Math.round((filled * add) / size)
  // Both kinds of change stay visible once there is room for both.
  if (add && !green && filled > 1) green = 1
  if (del && green === filled && filled > 1) green--
  return { add: green, del: filled - green, empty: STAT_BOXES - filled }
}

export type Area = { path: string; name: string; add: number; del: number; files: number; viewed: number; deeper: boolean }

/** Changes grouped by the next folder below `prefix` (files directly in it group as themselves). */
export function areas(entries: Entry[], prefix: string, isViewed: (e: Entry) => boolean): Area[] {
  const out = new Map<string, Area>()
  for (const e of entries) {
    if (!e.file.name.startsWith(prefix)) continue
    const rest = e.file.name.slice(prefix.length)
    const slash = rest.indexOf('/')
    const name = slash < 0 ? rest : rest.slice(0, slash)
    const path = prefix + name + (slash < 0 ? '' : '/')
    const a = out.get(path) ?? { path, name, add: 0, del: 0, files: 0, viewed: 0, deeper: slash >= 0 }
    a.add += e.add
    a.del += e.del
    a.files++
    if (isViewed(e)) a.viewed++
    out.set(path, a)
  }
  return [...out.values()].sort((a, b) => b.add + b.del - (a.add + a.del))
}

/** A reviewer reads roughly this many changed lines an hour, carefully. */
const LINES_PER_HOUR = 400

export type Effort = { lines: number; skipped: number; moved: number; minutes: number; viewedLines: number }

/** Lines that need reading: not generated, not pure renames, not moved. */
export function effort(entries: Entry[], moves: Moves, isViewed: (e: Entry) => boolean): Effort {
  let lines = 0
  let skipped = 0
  let viewedLines = 0
  for (const e of entries) {
    const size = e.add + e.del
    if (e.generated || e.file.type === 'rename-pure') {
      skipped += size
      continue
    }
    const own = Math.max(0, size - (moves.perFile.get(e.id) ?? 0))
    lines += own
    if (isViewed(e)) viewedLines += own
  }
  return { lines, skipped, moved: moves.total, minutes: Math.max(1, Math.round((lines / LINES_PER_HOUR) * 60)), viewedLines }
}

export type Hint = { id: string; label: string; detail: string; files: Entry[] }

const DEPENDENCIES =
  /(^|\/)(package\.json|Cargo\.toml|go\.mod|pyproject\.toml|requirements[^/]*\.txt|Gemfile|pom\.xml|build\.gradle(\.kts)?|composer\.json|mix\.exs|Package\.swift)$/
const SENSITIVE = /(auth|secur|crypt|password|secret|token|permission|session|oauth|\.env)/i

/** Things worth a closer look, each with the files behind it. */
export function hints(entries: Entry[], churn: Map<string, number>): Hint[] {
  const by = (test: (e: Entry) => boolean) => entries.filter(test)
  const out: Hint[] = []
  const add = (id: string, label: string, detail: string, files: Entry[]) => files.length && out.push({ id, label, detail, files })
  add('deps', 'Dependencies changed', 'Manifests that add, remove or bump packages', by((e) => DEPENDENCIES.test(e.file.name)))
  add('ci', 'CI or automation changed', 'Workflows run with repository permissions', by((e) => kindOf(e) === 'ci'))
  add('sensitive', 'Security-sensitive paths', 'Auth, secrets, tokens or permissions in the path', by((e) => SENSITIVE.test(e.file.name)))
  add('deleted', 'Files deleted', 'Make sure nothing still depends on them', by((e) => e.file.type === 'deleted'))
  add('mode', 'File mode changed', 'Executable bit or file type changed', by((e) => !!e.file.prevMode && !!e.file.mode && e.file.prevMode !== e.file.mode))
  add('large', 'Very large files', 'Over 500 changed lines; consider splitting', by((e) => !e.generated && e.add + e.del > 500))
  add('churn', 'Reworked across commits', 'Changed in three or more commits of the range', by((e) => (churn.get(e.file.name) ?? 0) >= 3))
  const code = entries.filter((e) => kindOf(e) === 'code').reduce((n, e) => n + e.add, 0)
  if (code > 50 && !entries.some((e) => kindOf(e) === 'tests'))
    out.push({ id: 'tests', label: 'No test changes', detail: `${code} lines of code added, no tests touched`, files: [] })
  return out
}

const RANK: Record<Kind, number> = { code: 2, tests: 1, config: 3, ci: 3, docs: 4, generated: 5 }
const CONTRACT = /(^|\/)(types?|interfaces?|schemas?|api|proto|migrations?)(\/|\.)|\.d\.ts$|\.(proto|graphql|sql)$/

/** Review order: contracts first, then tests, code, config, docs; generated last. */
export function reviewOrder(entries: Entry[]): Entry[] {
  const rank = (e: Entry) => (CONTRACT.test(e.file.name) && !e.generated ? 0 : RANK[kindOf(e)])
  return entries.map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => a.r - b.r || a.i - b.i).map(({ e }) => e)
}
