import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closedRoutes } from '../src/closed-routes'

const statuses: Record<string, number> = { '/open': 200, '/moved': 307, '/gone': 404, '/login': 401, '/broken': 500 }
const server = createServer((req, res) => { res.statusCode = statuses[req.url ?? ''] ?? 200; res.end() })
let base = ''

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, done))
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})
afterAll(() => { server.close() })

describe('closedRoutes', () => {
  it('names pages shut in English and keeps open, redirected and broken ones', async () => {
    const found = await closedRoutes(base, Object.keys(statuses))
    expect(found.map((f) => f.route)).toEqual(['/gone', '/login'])
    expect(found[0]!.reason).toContain('404')
  })
  it('keeps a route it cannot ask about', async () => {
    expect(await closedRoutes('http://localhost:1', ['/a'])).toEqual([])
  })
})
