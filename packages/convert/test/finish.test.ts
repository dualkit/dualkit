import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { baselinePath } from '../src/baseline'
import { convert } from '../src/convert'
import { finish, type FinishIo } from '../src/finish'
import { LEDGER_FILE, readLedger, writeLedger } from '../src/ledger'
import { readState } from '../src/state'
import { fixtureRepo } from './helpers'

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')
const server = (port: number): string => `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
const inUse = (port: number): Promise<boolean> => fetch(`http://localhost:${port}`).then(() => true, () => false)

/** A solid PNG, optionally with `bad` percent of its pixels set to a different colour. */
function png(bad = 0, size = 100): Buffer {
  const img = new PNG({ width: size, height: size })
  const n = Math.round(size * size * (bad / 100))
  for (let i = 0; i < size * size; i++) img.data.set(i < n ? [0, 0, 0, 255] : [255, 255, 255, 255], i * 4)
  return PNG.sync.write(img)
}

type Seen = { shots: string[]; audits: { url: string; width: number; cookies?: Record<string, string> }[] }

function finishIo(port: number, over: Partial<FinishIo> = {}): FinishIo & Seen {
  const seen: Seen = { shots: [], audits: [] }
  return Object.assign(seen, {
    log: () => {},
    run: async () => ({ code: 0, out: '' }),
    config: { start: server(port), port },
    shoot: async (url: string) => { seen.shots.push(url); return png() },
    audit: async (url: string, width: number, options?: { cookies?: Record<string, string> }) => {
      seen.audits.push({ url, width, ...(options?.cookies ? { cookies: options.cookies } : {}) })
      return { score: 100, errors: 0, warnings: 0 }
    },
    lint: async () => 0,
    ...over,
  }) as FinishIo & Seen
}

/** A converted fixture with the given ledger status set on every entry, and baselines for the Next fixture's pages. */
async function converted(name: 'next-app' | 'vite-app', mode: 'bilingual' | 'arabic', status: 'pending' | 'drafted', baselines: string[] = []): Promise<string> {
  const dir = fixtureRepo(name)
  await convert({ root: dir, mode, install: false, baseline: false }, { log: () => {}, run: async () => ({ code: 0, out: '' }), config: {} })
  writeLedger(dir, readLedger(dir).map((e) => ({ ...e, status, ar: status === 'drafted' ? `ar:${e.en}` : '' })))
  mkdirSync(join(dir, '.dualkit/baseline'), { recursive: true })
  for (const route of baselines) for (const width of [390, 1280]) writeFileSync(join(dir, baselinePath(route, width)), png())
  return dir
}

describe('finish refusals', () => {
  it('refuses without convert state', async () => {
    const dir = fixtureRepo('next-app')
    await expect(finish({ root: dir }, finishIo(4601))).rejects.toThrow(/Run dualkit convert first/)
  })

  it('refuses on the wrong branch', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted')
    git(dir, 'checkout', '-q', '-b', 'elsewhere')
    await expect(finish({ root: dir }, finishIo(4602))).rejects.toThrow(/dualkit\/bilingual/)
  })

  it('refuses with pending entries and names the count', async () => {
    const dir = await converted('next-app', 'bilingual', 'pending')
    const count = readLedger(dir).length
    expect(count).toBeGreaterThan(0)
    await expect(finish({ root: dir }, finishIo(4603))).rejects.toThrow(new RegExp(`${count} strings? (is|are) still pending`))
  })

  it('refuses without a start command', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted')
    await expect(finish({ root: dir }, finishIo(4604, { config: {} }))).rejects.toThrow(/start command/)
  })
})

describe('finish --force', () => {
  it('writes both messages files with English for pending entries, lists them, and commits', async () => {
    const dir = await converted('next-app', 'bilingual', 'pending', ['/', '/pricing', '/settings'])
    const { reportPath, passed } = await finish({ root: dir, force: true }, finishIo(4605))
    const en = JSON.parse(read(dir, 'messages/en.json')) as Record<string, unknown>
    expect(JSON.parse(read(dir, 'messages/ar.json'))).toEqual(en)
    expect(read(dir, 'dualkit-convert.md')).toContain('| pending |')
    expect(reportPath).toBe(join(dir, 'dualkit-convert.md'))
    expect(passed).toBe(true)
    expect(git(dir, 'log', '-1', '--format=%s')).toBe('dualkit: finish bilingual conversion')
    expect(git(dir, 'status', '--porcelain')).toBe('')
  })
})

describe('finish checks', () => {
  it('passes a clean bilingual run, audits Arabic at /ar, sets finished and keeps generated', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/pricing', '/settings'])
    const before = readState(dir)!
    const io = finishIo(4606)
    const result = await finish({ root: dir }, io)
    expect(result.passed).toBe(true)
    expect(io.audits.map((a) => new URL(a.url).pathname)).toEqual(['/ar', '/ar', '/ar/pricing', '/ar/pricing', '/ar/settings', '/ar/settings'])
    expect(readState(dir)).toEqual({ ...before, phase: 'finished' })
    expect(read(dir, 'dualkit-convert.md')).toContain('Could not reach /orders/\\[id\\]')
    expect(JSON.parse(read(dir, 'messages/ar.json'))).not.toEqual(JSON.parse(read(dir, 'messages/en.json')))
    expect(await finish({ root: dir }, finishIo(4607))).toMatchObject({ passed: true })
  })

  it('fails when English differs by 1 percent, lists the page and writes the diff under .dualkit/diff', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/pricing', '/settings'])
    const io = finishIo(4608, { shoot: async (url: string) => png(new URL(url).pathname === '/pricing' ? 1 : 0) })
    const result = await finish({ root: dir }, io)
    expect(result.passed).toBe(false)
    const report = read(dir, 'dualkit-convert.md')
    expect(report).toContain('/pricing at 390px: fail')
    expect(report).toContain('.dualkit/diff/pricing-390.png')
    expect(existsSync(join(dir, '.dualkit/diff/pricing-1280.png'))).toBe(true)
    expect(git(dir, 'status', '--porcelain')).toBe('')
  })

  it('fails on an Arabic audit error', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/pricing', '/settings'])
    const io = finishIo(4609, { audit: async () => ({ score: 50, errors: 2, warnings: 0 }) })
    expect((await finish({ root: dir }, io)).passed).toBe(false)
  })

  it('lists pages with no baseline without failing', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/settings'])
    const result = await finish({ root: dir }, finishIo(4610))
    expect(result.passed).toBe(true)
    expect(read(dir, 'dualkit-convert.md')).toContain('/pricing at 390px: no English baseline was taken')
  })

  it('fails when the app tests fail, and puts their output in the report', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/pricing', '/settings'])
    const io = finishIo(4611, { config: { start: server(4611), port: 4611, test: 'npm test' }, run: async () => ({ code: 1, out: 'FAIL boom' }) })
    expect((await finish({ root: dir }, io)).passed).toBe(false)
    expect(read(dir, 'dualkit-convert.md')).toContain('FAIL boom')
  })

  it('stops the server when an audit throws', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted', ['/', '/pricing', '/settings'])
    const io = finishIo(4612, { audit: async () => { throw new Error('audit broke') } })
    await expect(finish({ root: dir }, io)).rejects.toThrow('audit broke')
    expect(await inUse(4612)).toBe(false)
  })

  it('names the start command and its output when the server will not start', async () => {
    const dir = await converted('next-app', 'bilingual', 'drafted')
    const io = finishIo(4613, { config: { start: 'echo cannot-start-here; exit 2', port: 4613 } })
    const error = (await finish({ root: dir }, io).catch((e: unknown) => e)) as Error
    expect(error.message).toContain('echo cannot-start-here')
    expect(error.message).toContain('cannot-start-here')
  })

  it('audits the Vite app with the dk-locale cookie and shoots English with none', async () => {
    const dir = await converted('vite-app', 'bilingual', 'drafted', ['/'])
    const io = finishIo(4614, { config: { start: server(4614), port: 4614, routes: ['/'] } })
    expect((await finish({ root: dir }, io)).passed).toBe(true)
    expect(io.audits.every((a) => a.cookies?.['dk-locale'] === 'ar' && new URL(a.url).pathname === '/')).toBe(true)
  })

  it('audits / in arabic mode, not /ar/, and takes no English shots', async () => {
    const dir = await converted('vite-app', 'arabic', 'drafted')
    const io = finishIo(4615, { config: { start: server(4615), port: 4615, routes: ['/'] } })
    await finish({ root: dir }, io)
    expect(io.audits.map((a) => a.url)).toEqual(['http://localhost:4615/', 'http://localhost:4615/'])
    expect(io.shots).toEqual([])
    expect(io.audits.every((a) => a.cookies === undefined)).toBe(true)
  })
})
