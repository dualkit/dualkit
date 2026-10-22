import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { FIXTURES } from './fixtures'
import { closeBrowser, modelOf, probedModelOf } from './helpers/browser'

afterAll(closeBrowser)

describe('every rule has fixtures', () => {
  it('covers all thirty-four rules', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(RULES.map((r) => r.id).sort())
  })
})

describe.each(RULES.map((r) => [r.id, r] as const))('%s in a real browser', (id, rule) => {
  const read = (html: string) => (FIXTURES[id]!.probe ? probedModelOf(html) : modelOf(html))
  it('catches the bad page', async () => {
    const found = runRules(await read(FIXTURES[id]!.bad), { rules: [rule] })
    expect(found.length).toBeGreaterThan(0)
  })
  it('catches every other bad page', async () => {
    for (const html of FIXTURES[id]!.moreBad ?? []) expect(runRules(await read(html), { rules: [rule] }).length).toBeGreaterThan(0)
  })
  it('stays quiet on the good page', async () => {
    expect(runRules(await read(FIXTURES[id]!.good), { rules: [rule] })).toEqual([])
  })
  it('stays quiet on every other good page', async () => {
    for (const html of FIXTURES[id]!.moreGood ?? []) expect(runRules(await read(html), { rules: [rule] })).toEqual([])
  })
})
