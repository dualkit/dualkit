import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { FIXTURES } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

afterAll(closeBrowser)

describe('every rule has fixtures', () => {
  it('covers all twenty-nine rules', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(RULES.map((r) => r.id).sort())
  })
})

describe.each(RULES.map((r) => [r.id, r] as const))('%s in a real browser', (id, rule) => {
  it('catches the bad page', async () => {
    const found = runRules(await modelOf(FIXTURES[id]!.bad), { rules: [rule] })
    expect(found.length).toBeGreaterThan(0)
  })
  it('stays quiet on the good page', async () => {
    expect(runRules(await modelOf(FIXTURES[id]!.good), { rules: [rule] })).toEqual([])
  })
})
