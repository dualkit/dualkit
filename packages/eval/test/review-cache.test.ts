import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { REVIEW_PROMPT_VERSION } from '../../cli/src/review/prompt'
import type { ReviewResult } from '../../cli/src/review'
import { cachedReview, reviewKey } from '../src/review-cache.js'

const dir = mkdtempSync(join(tmpdir(), 'eval-review-cache-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const gemini = { provider: 'gemini', model: 'm1' } as const
const done: ReviewResult = { findings: [], spentUsd: 0.02, skipped: null, unchecked: 0 }

describe('review cache', () => {
  it('keys on the page, the provider and model, and the prompt version', () => {
    expect(REVIEW_PROMPT_VERSION).toBe('1')
    const key = reviewKey('<p>a</p>', gemini)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(reviewKey('<p>b</p>', gemini)).not.toBe(key)
    expect(reviewKey('<p>a</p>', { provider: 'openrouter', model: 'm1' })).not.toBe(key)
    expect(reviewKey('<p>a</p>', { ...gemini, model: 'm2' })).not.toBe(key)
  })

  it('uses a stored result without calling the model again', async () => {
    let calls = 0
    const run = async () => { calls += 1; return done }
    const first = await cachedReview({ dir, content: 'page one', model: gemini, run })
    const second = await cachedReview({ dir, content: 'page one', model: gemini, run })
    expect(calls).toBe(1)
    expect(first.cached).toBe(false)
    expect(second).toEqual({ result: done, cached: true })
  })

  it('does not store a skipped result, so a run without a key never poisons the cache', async () => {
    const before = readdirSync(dir).length
    const skipped: ReviewResult = { findings: [], spentUsd: 0, skipped: 'No GEMINI_API_KEY', unchecked: 0 }
    await cachedReview({ dir, content: 'page two', model: gemini, run: async () => skipped })
    expect(readdirSync(dir).length).toBe(before)
    let calls = 0
    await cachedReview({ dir, content: 'page two', model: gemini, run: async () => { calls += 1; return done } })
    expect(calls).toBe(1)
  })
})
