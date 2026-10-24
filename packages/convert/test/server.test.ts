import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ServerError, startServer } from '../src/server'

const dir = (): string => mkdtempSync(join(tmpdir(), 'dualkit-server-'))
const listener = (port: number): string =>
  `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
const inUse = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(true))
    probe.listen(port, () => probe.close(() => resolve(false)))
  })

const stops: Array<() => Promise<void>> = []
afterEach(async () => {
  await Promise.all(stops.splice(0).map((stop) => stop()))
})

describe('startServer', () => {
  it('resolves once the port answers and stop frees it', async () => {
    const server = await startServer(listener(4517), 4517, dir(), 20_000)
    stops.push(server.stop)
    expect(server.url).toBe('http://localhost:4517')
    expect((await fetch(server.url)).status).toBe(200)
    await server.stop()
    expect(await inUse(4517)).toBe(false)
  })

  it('throws ServerError with the output when the command exits at once', async () => {
    const error = await startServer('echo boom-output; exit 3', 4518, dir(), 20_000).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ServerError)
    expect((error as Error).message).toContain('boom-output')
  })

  it('throws when the port is already in use and leaves the other process alone', async () => {
    const blocker = createServer()
    await new Promise<void>((resolve) => blocker.listen(4519, resolve))
    try {
      const error = await startServer(listener(4519), 4519, dir(), 5_000).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ServerError)
      expect((error as Error).message).toContain('already in use')
    } finally {
      blocker.close()
    }
  })

  it('throws on timeout and leaves no child running', async () => {
    const cwd = dir()
    const cmd = `node -e "require('fs').writeFileSync('pid',String(process.pid));setInterval(()=>{},1000)"`
    const error = await startServer(cmd, 4520, cwd, 1_500).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ServerError)
    expect((error as Error).message).toContain('did not answer')
    const pid = Number(readFileSync(join(cwd, 'pid'), 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('rejects with ServerError when the cwd does not exist', async () => {
    const error = await startServer(listener(4521), 4521, join(dir(), 'missing'), 5_000).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ServerError)
    expect((error as Error).message).toMatch(/ENOENT|missing/)
  })

  it('kills grandchildren in the group', async () => {
    const cmd = `sh -c 'node -e "require(\\"http\\").createServer((q,s)=>s.end(1)).listen(4522)" & wait'`
    const server = await startServer(cmd, 4522, dir(), 20_000)
    stops.push(server.stop)
    expect(await inUse(4522)).toBe(true)
    await server.stop()
    expect(await inUse(4522)).toBe(false)
  })
})
