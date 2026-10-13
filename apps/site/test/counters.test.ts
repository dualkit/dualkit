import { describe, expect, it } from 'vitest'
import { compactCount, fetchStars, fetchWeeklyDownloads } from '../lib/counters'
import { fakeFetch } from './fake-fetch'

describe('fetchStars', () => {
  it('reads the star count from the GitHub repo API', async () => {
    const f = fakeFetch({ 'https://api.github.com/repos/dualkit/dualkit': { status: 200, body: { stargazers_count: 42 } } })
    expect(await fetchStars(f, 'dualkit/dualkit')).toBe(42)
  })

  it('returns null when the repo does not exist yet', async () => {
    const f = fakeFetch({ 'https://api.github.com/repos/dualkit/dualkit': { status: 404, body: {} } })
    expect(await fetchStars(f, 'dualkit/dualkit')).toBeNull()
  })

  it('returns null when the network fails', async () => {
    expect(await fetchStars(fakeFetch({}), 'dualkit/dualkit')).toBeNull()
  })

  it('gives up after a timeout instead of hanging the page', async () => {
    let signal: AbortSignal | undefined
    const f: Parameters<typeof fetchStars>[0] = async (_url, init) => { signal = init?.signal; throw new DOMException('timed out', 'TimeoutError') }
    expect(await fetchStars(f, 'dualkit/dualkit')).toBeNull()
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('returns null when the payload is not a number', async () => {
    const f = fakeFetch({ 'https://api.github.com/repos/dualkit/dualkit': { status: 200, body: { stargazers_count: 'lots' } } })
    expect(await fetchStars(f, 'dualkit/dualkit')).toBeNull()
  })
})

describe('fetchWeeklyDownloads', () => {
  it('reads last week from the npm downloads API', async () => {
    const f = fakeFetch({ 'https://api.npmjs.org/downloads/point/last-week/@dualkit/format': { status: 200, body: { downloads: 318 } } })
    expect(await fetchWeeklyDownloads(f, '@dualkit/format')).toBe(318)
  })

  it('returns null before the package is published', async () => {
    const f = fakeFetch({ 'https://api.npmjs.org/downloads/point/last-week/@dualkit/format': { status: 404, body: { error: 'not found' } } })
    expect(await fetchWeeklyDownloads(f, '@dualkit/format')).toBeNull()
  })
})

describe('compactCount', () => {
  it.each([[0, '0'], [7, '7'], [999, '999'], [1000, '1k'], [1234, '1.2k'], [15400, '15k'], [2_300_000, '2.3m']])('%i reads as %s', (n, out) => {
    expect(compactCount(n)).toBe(out)
  })
})
