import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { convert } from '../src/convert'
import { finish, type FinishIo } from '../src/finish'
import { readLedger, writeLedger } from '../src/ledger'
import { STATE_FILE } from '../src/state'
import { fixtureRepo } from './helpers'

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const read = (dir: string, rel: string): string | null => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), 'utf8') : null)
const png = (): Buffer => { const i = new PNG({ width: 10, height: 10 }); i.data.fill(255); return PNG.sync.write(i) }
const freePort = (): Promise<number> => new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, () => { const { port } = probe.address() as { port: number }; probe.close(() => resolve(port)) })
})
const serve = (port: number): string => `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
const quiet = { log: () => {}, run: async () => ({ code: 0, out: '' }), config: {} }
const io = (start: string, port: number): FinishIo =>
  ({ ...quiet, config: { start, port }, shoot: async () => png(), audit: async () => ({ score: 100, errors: 0, warnings: 0 }), lint: async () => 0 })

/** A converted Next fixture with every ledger entry drafted, left uncommitted as a person would. */
async function drafted(): Promise<string> {
  const dir = fixtureRepo('next-app')
  await convert({ root: dir, mode: 'bilingual', install: false, baseline: false }, quiet)
  writeLedger(dir, readLedger(dir).map((e) => ({ ...e, status: 'drafted' as const, ar: `ar:${e.en}` })))
  return dir
}

describe('finish rollback', () => {
  it('puts its own files back and commits nothing when the start command fails', async () => {
    const dir = await drafted()
    const head = git(dir, 'rev-parse', 'HEAD')
    const ledger = read(dir, 'dualkit-strings.json')
    const state = read(dir, STATE_FILE)
    const error = (await finish({ root: dir }, io('echo nope; exit 3', await freePort())).catch((e: unknown) => e)) as Error
    expect(error.message).toMatch(/^finish failed at starting the app: Could not start the app with "echo nope; exit 3"\..*\. Nothing was committed\.$/s)
    expect(error.message).not.toMatch(/also failed/)
    expect(error.message.split('\n')).toHaveLength(1)
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(dir, 'diff', 'HEAD', '--name-only')).toBe('dualkit-strings.json')
    expect(git(dir, 'diff', '--cached', '--name-only')).toBe('')
    expect(existsSync(join(dir, 'dualkit-convert.md'))).toBe(false)
    expect(read(dir, 'dualkit-strings.json')).toBe(ledger)
    expect(read(dir, STATE_FILE)).toBe(state)
  }, 30_000)

  it('restores the report, the config and the index when the commit fails on a second finish', async () => {
    const dir = await drafted()
    const port = await freePort()
    await finish({ root: dir }, io(serve(port), port))
    const head = git(dir, 'rev-parse', 'HEAD')
    const report = read(dir, 'dualkit-convert.md')
    const state = read(dir, STATE_FILE)
    writeLedger(dir, readLedger(dir).map((e, i) => (i === 0 ? { ...e, ar: 'changed' } : e)))
    const ledger = read(dir, 'dualkit-strings.json')
    const hook = join(dir, '.git/hooks/pre-commit')
    writeFileSync(hook, '#!/bin/sh\nexit 1\n')
    chmodSync(hook, 0o755)
    const port2 = await freePort()
    const error = (await finish({ root: dir, configAnswers: { start: serve(port2), port: port2 } }, io(serve(port2), port2)).catch((e: unknown) => e)) as Error
    expect(error.message).toMatch(/^finish failed at committing: .*Nothing was committed\.$/s)
    expect(error.message).not.toMatch(/also failed/)
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(dir, 'diff', '--cached', '--name-only')).toBe('')
    expect(read(dir, 'dualkit-convert.md')).toBe(report)
    expect(read(dir, STATE_FILE)).toBe(state)
    expect(existsSync(join(dir, 'dualkit.config.json'))).toBe(false)
    expect(read(dir, 'dualkit-strings.json')).toBe(ledger)
  }, 60_000)
})
