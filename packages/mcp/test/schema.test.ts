import { RULES } from '@dualkit/rules'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { JSDOM_CHECKED, JSDOM_NOT_CHECKED } from '../src/jsdom-coverage'
import { firstProblem, handle, unexpected } from '../src/schema'

describe('jsdom coverage', () => {
  it('classifies every rule exactly once, so a new rule needs a decision', () => {
    const classified = [...JSDOM_CHECKED, ...Object.keys(JSDOM_NOT_CHECKED)]
    expect(new Set(classified).size).toBe(classified.length)
    expect(classified.sort()).toEqual(RULES.map((r) => r.id).sort())
  })
})

describe('error sentences', () => {
  it('keeps a message that is already a sentence', () => {
    expect(firstProblem(z.string({ error: 'Add a name.' }).safeParse(1).error!)).toBe('Add a name.')
  })

  it('turns a bare zod message into a sentence that names the field', () => {
    const error = z.object({ a: z.string() }).safeParse({ a: 1 }).error!
    expect(firstProblem(error)).toMatch(/^The input is not valid \(a\): .+\.$/)
  })

  it('words a thrown error by its first line, never its stack', () => {
    expect(unexpected(new Error('Broke\n    at x (y.js:1:1)'))).toBe('Broke.')
    expect(unexpected(new Error('Already a sentence.'))).toBe('Already a sentence.')
    expect(unexpected('not an error')).toBe('Something went wrong. Try again with different input.')
  })

  it('turns a throwing handler into a tool error', () => {
    const run = handle(z.object({}), () => { throw new RangeError('toHijri needs a valid date') })
    expect(run({})).toEqual({ content: [{ type: 'text', text: 'toHijri needs a valid date.' }], isError: true })
  })
})
