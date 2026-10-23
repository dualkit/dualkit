import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { writeFileAtomic } from './atomic.js'

it('writes the file and leaves no temp file behind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-'))
  const file = join(dir, 'x.json')
  writeFileAtomic(file, 'one')
  writeFileAtomic(file, 'two')
  expect(readFileSync(file, 'utf8')).toBe('two')
  expect(readdirSync(dir)).toEqual(['x.json'])
})
