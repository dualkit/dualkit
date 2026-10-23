import { describe, expect, it } from 'vitest'
import { cacheKey } from './cache.js'

const parts = { aloneHtml: 'a', otherHtml: 'o', model: 'gemini:x', version: '1', checklist: '{"points":[1]}' }

describe('cacheKey', () => {
  it('is stable for the same inputs', () => {
    expect(cacheKey(parts)).toBe(cacheKey({ ...parts }))
  })
  it('changes when the checklist changes', () => {
    expect(cacheKey({ ...parts, checklist: '{"points":[2]}' })).not.toBe(cacheKey(parts))
  })
  it('changes with pages, model and version', () => {
    for (const change of [{ aloneHtml: 'b' }, { otherHtml: 'p' }, { model: 'gemini:y' }, { version: '2' }]) {
      expect(cacheKey({ ...parts, ...change })).not.toBe(cacheKey(parts))
    }
  })
})
