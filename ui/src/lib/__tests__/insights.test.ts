import { describe, expect, it } from 'vitest'
import { diffstat, fileMatches, kindOf, reviewOrder, STAT_BOXES } from '@/lib/insights'
import { entries, patch } from './fixtures'

const one = (path: string) => entries(patch(path, ['+x']))[0]

describe('kindOf', () => {
  it.each([
    ['src/app.ts', 'code'],
    ['src/app.test.ts', 'tests'],
    ['tests/app.py', 'tests'],
    ['pkg/server_test.go', 'tests'],
    ['.github/workflows/ci.yml', 'ci'],
    ['README.md', 'docs'],
    ['docs/guide.txt', 'docs'],
    ['package.json', 'config'],
    ['vite.config.ts', 'config'],
    ['package-lock.json', 'generated'],
    ['Cargo.lock', 'generated'],
  ])('%s is %s', (path, kind) => expect(kindOf(one(path))).toBe(kind))
})

describe('fileMatches', () => {
  const tests = one('src/app.test.ts')
  it('matches path text, case-insensitively', () => expect(fileMatches(tests, 'APP.test')).toBe(true))
  it('matches is:<kind>', () => {
    expect(fileMatches(tests, 'is:tests')).toBe(true)
    expect(fileMatches(tests, 'is:code')).toBe(false)
  })
  it('needs every term', () => expect(fileMatches(tests, 'is:tests lib/')).toBe(false))
})

describe('diffstat', () => {
  it('always shows five squares', () => {
    for (const [a, d] of [[0, 0], [1, 0], [3, 7], [5000, 2]]) {
      const b = diffstat(a, d, 5000)
      expect(b.add + b.del + b.empty).toBe(STAT_BOXES)
    }
  })
  it('shows both colors once there is room', () => expect(diffstat(1, 400, 400)).toMatchObject({ add: 1, del: 4 }))
})

describe('reviewOrder', () => {
  it('puts contracts and tests before code, generated last', () => {
    const order = reviewOrder(
      entries(
        patch('package-lock.json', ['+x']),
        patch('src/app.ts', ['+x']),
        patch('src/app.test.ts', ['+x']),
        patch('src/types.ts', ['+x']),
      ),
    ).map((e) => e.file.name)
    expect(order).toEqual(['src/types.ts', 'src/app.test.ts', 'src/app.ts', 'package-lock.json'])
  })
})
