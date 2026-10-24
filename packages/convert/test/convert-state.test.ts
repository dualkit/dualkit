import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { convert } from '../src/convert'
import { finish, type FinishIo } from '../src/finish'
import { readLedger, writeLedger } from '../src/ledger'
import { fixtureRepo } from './helpers'

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const png = (): Buffer => { const i = new PNG({ width: 10, height: 10 }); i.data.fill(255); return PNG.sync.write(i) }
const freePort = (): Promise<number> => new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, () => { const { port } = probe.address() as { port: number }; probe.close(() => resolve(port)) })
})
const serve = (port: number): string => `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
const quiet = { log: () => {}, run: async () => ({ code: 0, out: '' }), config: {} }
const options = (root: string) => ({ root, mode: 'bilingual' as const, install: false, baseline: false })
const status = (dir: string): string => git(dir, 'status', '--porcelain', '--untracked-files=all')

describe('tracked convert state', () => {
  it('commits the state and summary with the conversion and ignores the rest of .dualkit', async () => {
    const dir = fixtureRepo('next-app')
    await convert(options(dir), quiet)
    const committed = git(dir, 'show', '--name-only', '--format=', 'HEAD').split('\n')
    expect(committed).toEqual(expect.arrayContaining(['.dualkit/convert.json', '.dualkit/summary.json', '.gitignore']))
    expect(status(dir)).toBe('')
  })

  it('leaves the base branch clean after a run with a baseline', async () => {
    const dir = fixtureRepo('next-app')
    const port = await freePort()
    await convert({ ...options(dir), baseline: true }, { ...quiet, config: { start: serve(port), port, routes: ['/'] }, shoot: async () => png() })
    expect(status(dir)).toBe('')
    git(dir, 'checkout', '-q', 'main')
    expect(git(dir, 'ls-files', '--others', '--ignored', '--exclude-standard', '.dualkit')).toContain('.dualkit/baseline/home-390.png')
    expect(status(dir)).toBe('')
    expect(readFileSync(join(dir, '.git/info/exclude'), 'utf8')).toContain('.dualkit/*')
  }, 30_000)

  it('lets a fresh clone of the branch re-run convert as a no-op and run finish', async () => {
    const dir = fixtureRepo('next-app')
    await convert(options(dir), quiet)
    const clone = join(mkdtempSync(join(tmpdir(), 'dualkit-clone-')), 'app')
    execFileSync('git', ['clone', '-q', '-b', 'dualkit/bilingual', dir, clone])
    for (const [key, value] of [['user.email', 'test@example.com'], ['user.name', 'dualkit test'], ['commit.gpgsign', 'false']]) git(clone, 'config', key!, value!)
    const head = git(clone, 'rev-parse', 'HEAD')
    const again = await convert(options(clone), quiet)
    expect(again.filesChanged).toBe(0)
    expect(git(clone, 'rev-parse', 'HEAD')).toBe(head)
    expect(status(clone)).toBe('')
    writeLedger(clone, readLedger(clone).map((e) => ({ ...e, status: 'drafted' as const, ar: `ar:${e.en}` })))
    const port = await freePort()
    const io: FinishIo = { ...quiet, config: { start: serve(port), port }, shoot: async () => png(), audit: async () => ({ score: 100, errors: 0, warnings: 0 }), lint: async () => 0 }
    await finish({ root: clone }, io)
    expect(git(clone, 'log', '-1', '--format=%s')).toBe('dualkit: finish bilingual conversion')
    expect(status(clone)).toBe('')
  }, 30_000)

  it('names the missing state when the person is already on the branch without it', async () => {
    const dir = fixtureRepo('next-app')
    git(dir, 'checkout', '-q', '-b', 'dualkit/bilingual')
    await expect(convert(options(dir), quiet)).rejects.toThrow('You are on dualkit/bilingual, but it has no convert state in .dualkit/convert.json. Switch back to the branch you started from, delete dualkit/bilingual, then run convert again.')
  })
})

describe('arabic mode baseline', () => {
  it('takes no English baseline, because finish never compares English in arabic mode', async () => {
    const dir = fixtureRepo('next-app')
    const shots: string[] = []
    const port = await freePort()
    await convert({ root: dir, mode: 'arabic', install: false, baseline: true }, { ...quiet, config: { start: serve(port), port, routes: ['/'] }, shoot: async (url) => { shots.push(url); return png() } })
    expect(shots).toEqual([])
  }, 30_000)
})
