import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listPairs } from './pairs.js'

let root: string
const put = (...parts: string[]) => {
  const file = join(root, ...parts)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, '<html></html>')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pairs-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('listPairs', () => {
  it('pairs need both sides', () => {
    put('2026-10', 'm', 'login', 'alone-1.html')
    put('2026-10', 'm', 'login', 'dualkit-1.html')
    put('2026-10', 'm', 'login', 'alone-2.html')
    const pairs = listPairs(root, '2026-10', 'dualkit')
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.run).toBe(1)
    expect(pairs[0]?.id).toBe('2026-10/m/login/1/dualkit')
  })

  it('loop pairs use the final loop page', () => {
    put('2026-10', 'm', 'login', 'alone-1.html')
    put('2026-10', 'm', 'login', 'loop-1.html')
    put('2026-10', 'm', 'login', 'loop-1-r1.html')
    const pairs = listPairs(root, '2026-10', 'loop')
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.otherHtml.endsWith('loop-1.html')).toBe(true)
  })

  it('missing month gives no pairs', () => {
    expect(listPairs(root, '2030-01', 'dualkit')).toEqual([])
  })
})
