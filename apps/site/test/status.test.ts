import { describe, expect, it } from 'vitest'
import { CHECKS, overall, runChecks } from '../lib/status'
import { fakeFetch } from './fake-fetch'

const allUp = Object.fromEntries(CHECKS.map((c) => [c.url, { status: 200, body: { 'dist-tags': { latest: '0.1.0-beta.0' } } }]))

describe('runChecks', () => {
  it('reports every check as up when each endpoint answers', async () => {
    const results = await runChecks(fakeFetch(allUp))
    expect(results.map((r) => r.ok)).toEqual(CHECKS.map(() => true))
  })

  it('names the published npm version', async () => {
    const results = await runChecks(fakeFetch(allUp))
    expect(results.find((r) => r.id === 'npm')?.detail).toBe('0.1.0-beta.0')
  })

  it('marks a check down on a server error, and says why', async () => {
    const npm = CHECKS.find((c) => c.id === 'npm')!
    const results = await runChecks(fakeFetch({ ...allUp, [npm.url]: { status: 503, body: {} } }))
    const r = results.find((x) => x.id === 'npm')!
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('HTTP 503')
  })

  it('treats a rate limit as unchecked, not as an outage', async () => {
    const repo = CHECKS.find((c) => c.id === 'repo')!
    for (const status of [403, 429]) {
      const results = await runChecks(fakeFetch({ ...allUp, [repo.url]: { status, body: {} } }))
      const r = results.find((x) => x.id === 'repo')!
      expect(r.ok).toBeNull()
      expect(r.detail).toBe('Not checked, rate limited')
      expect(overall(results)).toBe('normal')
    }
  })

  it('marks the package down when npm stops serving it', async () => {
    const npm = CHECKS.find((c) => c.id === 'npm')!
    const results = await runChecks(fakeFetch({ ...allUp, [npm.url]: { status: 404, body: {} } }))
    const r = results.find((x) => x.id === 'npm')!
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('HTTP 404')
  })

  it('marks a check down when the network fails', async () => {
    const results = await runChecks(fakeFetch({}))
    expect(results.every((r) => !r.ok && r.detail === 'Unreachable')).toBe(true)
  })

  it('records how long each check took', async () => {
    const results = await runChecks(fakeFetch(allUp))
    expect(results.every((r) => typeof r.ms === 'number' && r.ms >= 0)).toBe(true)
  })
})

describe('overall', () => {
  it('ignores unchecked results', () => {
    expect(overall([{ ok: true }, { ok: null }])).toBe('normal')
    expect(overall([{ ok: false }, { ok: null }])).toBe('down')
  })

  it('is normal only when every check is up', () => {
    expect(overall([{ ok: true }, { ok: true }])).toBe('normal')
    expect(overall([{ ok: true }, { ok: false }])).toBe('degraded')
    expect(overall([{ ok: false }, { ok: false }])).toBe('down')
  })
})
