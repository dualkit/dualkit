import { RULES, docsUrl } from '@dualkit/rules'
import { describe, expect, it } from 'vitest'
import { expectPlainError, json, useClient } from './helpers'

const { call } = useClient()

describe('rules', () => {
  it('lists every rule with its severity, fix and docs link', async () => {
    const out = json(await call('rules', {})) as { rules: Record<string, string>[] }
    expect(out.rules).toHaveLength(RULES.length)
    expect(out.rules[0]).toEqual({
      id: RULES[0]!.id, group: RULES[0]!.group, severity: RULES[0]!.severity, title: RULES[0]!.title, fix: RULES[0]!.fix, docs: docsUrl(RULES[0]!.id),
    })
  })

  it('looks one rule up by id, with why it matters', async () => {
    const rule = RULES.find((r) => r.id === 'bidi/unisolated-number')!
    expect(json(await call('rules', { id: 'bidi/unisolated-number' }))).toEqual({
      id: rule.id, group: rule.group, severity: rule.severity, title: rule.title, why: rule.why, fix: rule.fix, docs: docsUrl(rule.id),
    })
  })

  it('says how to find the ids when one is unknown', async () => {
    expect(expectPlainError(await call('rules', { id: 'bidi/nope' }))).toMatch(/no rule called bidi\/nope/i)
  })

  it('needs the id as text', async () => {
    expect(expectPlainError(await call('rules', { id: 7 }))).toMatch(/id/)
  })
})
