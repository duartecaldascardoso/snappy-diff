import { describe, expect, it } from 'vitest'
import type { Comment } from '@/lib/review'
import { relocate, reviewPrompt } from '@/lib/review'
import { entries, patch } from './fixtures'

const comment = (over: Partial<Comment>): Comment => ({
  id: 'c1',
  file: 'a.ts',
  side: 'additions',
  start: 2,
  end: 2,
  text: 'Rename this',
  code: 'const b = 2',
  ...over,
})

describe('relocate', () => {
  it('keeps a comment whose code is still on its line', () => {
    const e = entries(patch('a.ts', [' const a = 1', '+const b = 2', ' const c = 3']))
    expect(relocate([comment({})], e)[0]).toMatchObject({ start: 2, end: 2, outdated: false })
  })

  it('follows its code when lines are added above', () => {
    const e = entries(patch('a.ts', ['+// one', '+// two', ' const a = 1', '+const b = 2', ' const c = 3']))
    expect(relocate([comment({})], e)[0]).toMatchObject({ start: 4, end: 4, outdated: false })
  })

  it('marks it outdated when the code is gone', () => {
    const e = entries(patch('a.ts', [' const a = 1', '+const b = 20', ' const c = 3']))
    expect(relocate([comment({})], e)[0].outdated).toBe(true)
  })

  it('marks it outdated when the file left the diff', () => {
    const e = entries(patch('other.ts', ['+x']))
    expect(relocate([comment({})], e)[0].outdated).toBe(true)
  })

  it('leaves comments without an anchor alone', () => {
    const e = entries(patch('a.ts', ['+anything']))
    const c = comment({ code: undefined })
    expect(relocate([c], e)[0]).toBe(c)
  })
})

describe('reviewPrompt', () => {
  const e = entries(patch('src/a.ts', [' const a = 1', '+const b = 2', '+const c = 3']))

  it('lists each comment with path:lines, its code and the ask', () => {
    const text = reviewPrompt('my uncommitted changes', [comment({ file: 'src/a.ts', start: 2, end: 3 })], e)
    expect(text).toContain('Please address these review comments on my uncommitted changes.')
    expect(text).toContain('1. `src/a.ts:2-3`')
    expect(text).toContain('```ts\nconst b = 2\nconst c = 3\n```')
    expect(text).toContain('Rename this')
  })

  it('leaves out comments that were already addressed', () => {
    const text = reviewPrompt('x', [comment({ file: 'src/a.ts', outdated: true })], e)
    expect(text).not.toContain('src/a.ts')
  })

  it('says when a comment is on removed lines', () => {
    const removed = entries(patch('src/a.ts', ['-const gone = 1', ' const a = 1']))
    const text = reviewPrompt('x', [comment({ file: 'src/a.ts', side: 'deletions', start: 1, end: 1, code: 'const gone = 1' })], removed)
    expect(text).toContain('`src/a.ts:1` (removed lines')
  })
})
