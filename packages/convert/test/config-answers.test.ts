import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { convert } from '../src/convert'
import { finish, type FinishIo } from '../src/finish'
import { readLedger, writeLedger } from '../src/ledger'
import { fixtureRepo } from './helpers'

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const io = { log: () => {}, run: async () => ({ code: 0, out: '' }), config: {} }
const options = (root: string) => ({ root, mode: 'bilingual' as const, install: false, baseline: false })
const CONFIG = 'dualkit.config.json'
const answers = { start: 'npm run dev', port: 4010 }
const text = (obj: unknown): string => `${JSON.stringify(obj, null, 2)}\n`
const commitAll = (dir: string): void => { git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'config') }
const failHook = (dir: string): void => { const h = join(dir, '.git/hooks/pre-commit'); writeFileSync(h, '#!/bin/sh\nexit 1\n'); chmodSync(h, 0o755) }

describe('convert configAnswers', () => {
  it('commits the answers into an existing config and keeps its other keys', async () => {
    const dir = fixtureRepo('next-app')
    writeFileSync(join(dir, CONFIG), JSON.stringify({ ignore: ['type/arabic-size'], convert: { test: 'npm test' } }))
    commitAll(dir)
    await convert({ ...options(dir), configAnswers: answers }, io)
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(git(dir, 'show', `HEAD:${CONFIG}`)).toBe(text({ ignore: ['type/arabic-size'], convert: { test: 'npm test', ...answers } }).trimEnd())
    expect(git(dir, 'show', '--name-only', '--format=', 'HEAD')).toContain(CONFIG)
  })

  it('writes the answers to the config file it is given', async () => {
    const dir = fixtureRepo('next-app')
    await convert({ ...options(dir), configAnswers: answers, configFile: 'config/dk.json' }, io)
    expect(git(dir, 'status', '--porcelain', '--untracked-files=all')).toBe('')
    expect(JSON.parse(git(dir, 'show', 'HEAD:config/dk.json'))).toEqual({ convert: answers })
    expect(existsSync(join(dir, CONFIG))).toBe(false)
  })

  it('creates the config when there is none, and uses the answers for the baseline', async () => {
    const dir = fixtureRepo('next-app')
    const port = await freePort()
    const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
    const shots: string[] = []
    await convert({ ...options(dir), baseline: true, configAnswers: { start, port } }, { ...io, shoot: async (url) => { shots.push(url); return png() } })
    expect(shots.length).toBeGreaterThan(0)
    expect(JSON.parse(readFileSync(join(dir, CONFIG), 'utf8'))).toEqual({ convert: { start, port } })
    expect(readFileSync(join(dir, CONFIG), 'utf8').endsWith('}\n')).toBe(true)
    expect(git(dir, 'show', '--name-only', '--format=', 'HEAD')).toContain(CONFIG)
    expect(git(dir, 'status', '--porcelain')).toBe('')
  }, 30_000)

  it('refuses a config whose top level is not an object', async () => {
    const dir = fixtureRepo('next-app')
    writeFileSync(join(dir, CONFIG), '[1]')
    commitAll(dir)
    await expect(convert({ ...options(dir), configAnswers: answers }, io)).rejects.toThrow(/dualkit\.config\.json/)
    expect(git(dir, 'branch', '--list', 'dualkit/*')).toBe('')
  })

  it('rollback restores an existing config', async () => {
    const dir = fixtureRepo('next-app')
    const original = JSON.stringify({ ignore: [] })
    writeFileSync(join(dir, CONFIG), original)
    commitAll(dir)
    failHook(dir)
    await expect(convert({ ...options(dir), configAnswers: answers }, io)).rejects.toThrow(/back on main/)
    expect(readFileSync(join(dir, CONFIG), 'utf8')).toBe(original)
    expect(git(dir, 'status', '--porcelain')).toBe('')
  })

  it('rollback removes a config convert created', async () => {
    const dir = fixtureRepo('next-app')
    failHook(dir)
    await expect(convert({ ...options(dir), configAnswers: answers }, io)).rejects.toThrow(/back on main/)
    expect(existsSync(join(dir, CONFIG))).toBe(false)
    expect(git(dir, 'status', '--porcelain', '--untracked-files=all')).toBe('')
  })
})

const freePort = (): Promise<number> => new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, () => { const { port } = probe.address() as { port: number }; probe.close(() => resolve(port)) })
})
const png = (): Buffer => { const i = new PNG({ width: 10, height: 10 }); i.data.fill(255); return PNG.sync.write(i) }

describe('finish configAnswers', () => {
  it('uses the answers as the start command and commits the config with the report', async () => {
    const port = await freePort()
    const dir = fixtureRepo('next-app')
    await convert(options(dir), io)
    writeLedger(dir, readLedger(dir).map((e) => ({ ...e, status: 'drafted' as const, ar: `ar:${e.en}` })))
    mkdirSync(join(dir, '.dualkit'), { recursive: true })
    const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
    const finishIo: FinishIo = { ...io, shoot: async () => png(), audit: async () => ({ score: 100, errors: 0, warnings: 0 }), lint: async () => 0 }
    await finish({ root: dir, configAnswers: { start, port } }, finishIo)
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(JSON.parse(git(dir, 'show', `HEAD:${CONFIG}`))).toEqual({ convert: { start, port } })
    expect(git(dir, 'show', '--name-only', '--format=', 'HEAD')).toContain(CONFIG)
  }, 30_000)

  it('writes and commits the answers to the config file it is given, even when that file was staged', async () => {
    const port = await freePort()
    const dir = fixtureRepo('next-app')
    await convert(options(dir), io)
    writeLedger(dir, readLedger(dir).map((e) => ({ ...e, status: 'drafted' as const, ar: `ar:${e.en}` })))
    mkdirSync(join(dir, 'config'), { recursive: true })
    writeFileSync(join(dir, 'config/dk.json'), text({ ignore: [] }))
    git(dir, 'add', 'config/dk.json')
    const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
    const finishIo: FinishIo = { ...io, shoot: async () => png(), audit: async () => ({ score: 100, errors: 0, warnings: 0 }), lint: async () => 0 }
    await finish({ root: dir, configAnswers: { start, port }, configFile: 'config/dk.json' }, finishIo)
    expect(git(dir, 'status', '--porcelain', '--untracked-files=all')).toBe('')
    expect(JSON.parse(git(dir, 'show', 'HEAD:config/dk.json'))).toEqual({ ignore: [], convert: { start, port } })
    expect(existsSync(join(dir, CONFIG))).toBe(false)
  }, 30_000)

  it('leaves an unrelated uncommitted config edit alone when there are no answers', async () => {
    const port = await freePort()
    const dir = fixtureRepo('next-app')
    writeFileSync(join(dir, CONFIG), JSON.stringify({ ignore: [] }))
    commitAll(dir)
    await convert(options(dir), io)
    writeLedger(dir, readLedger(dir).map((e) => ({ ...e, status: 'drafted' as const, ar: `ar:${e.en}` })))
    const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
    const edited = JSON.stringify({ ignore: ['type/arabic-size'] })
    writeFileSync(join(dir, CONFIG), edited)
    const finishIo: FinishIo = { ...io, config: { start, port }, shoot: async () => png(), audit: async () => ({ score: 100, errors: 0, warnings: 0 }), lint: async () => 0 }
    await finish({ root: dir }, finishIo)
    expect(git(dir, 'show', '--name-only', '--format=', 'HEAD')).not.toContain(CONFIG)
    expect(readFileSync(join(dir, CONFIG), 'utf8')).toBe(edited)
    expect(git(dir, 'status', '--porcelain')).toContain(CONFIG)
  }, 30_000)
})
