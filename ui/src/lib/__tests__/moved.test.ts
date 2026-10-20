import { describe, expect, it } from 'vitest'
import { findMoves, isMoved } from '@/lib/moved'
import { entries, patch } from './fixtures'

const fn = ['function total(items) {', '  let sum = 0', '  for (const i of items) sum += i.price', '  return sum', '}']

describe('findMoves', () => {
  it('finds a block cut from one file and pasted in another', () => {
    const moves = findMoves(
      entries(
        patch('a.js', [' // a', ...fn.map((l) => '-' + l)]),
        patch('b.js', [' // b', ...fn.map((l) => '+' + l)]),
      ),
    )
    expect(moves.total).toBe(10)
    expect(isMoved(moves, 'b.js', 'additions', 2)).toBe(true)
    expect(isMoved(moves, 'a.js', 'deletions', 2)).toBe(true)
  })

  it('ignores re-indentation when matching', () => {
    const moves = findMoves(
      entries(patch('a.js', [...fn.map((l) => '-' + l), ...fn.map((l) => '+    ' + l)])),
    )
    expect(moves.total).toBe(10)
  })

  it('does not count new code, or runs of braces, as moved', () => {
    const moves = findMoves(
      entries(patch('a.js', ['-}', '-}', '-}', '+}', '+}', '+}', '+const brandNew = true'])),
    )
    expect(moves.total).toBe(0)
  })
})
