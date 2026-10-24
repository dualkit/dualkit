import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { run } from '../src/cli'
import { type ConvertApi, type ConvertEnv } from '../src/convert'
import { withInterrupt } from '../src/convert-env'

class Refused extends Error {}
const summary = { branch: 'dualkit/bilingual', filesChanged: 4, edits: 12, byKind: {}, changed: [], flags: [{ kind: 'info' }, { kind: 'computed-class' }], strings: 9, skipped: [] }

const setup = (over: Partial<ConvertApi> = {}, env: ConvertEnv = {}, config?: unknown) => {
  const cwd = mkdtempSync(join(tmpdir(), 'dualkit-convert-'))
  if (config !== undefined) writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify(config))
  const out: string[] = []
  const err: string[] = []
  const calls: { fn: string; args: unknown[] }[] = []
  const api: ConvertApi = {
    convert: async (...args) => { calls.push({ fn: 'convert', args }); return summary as never },
    finish: async (...args) => { calls.push({ fn: 'finish', args }); return { reportPath: '/r/dualkit-convert.md', passed: true } },
    refusals: [Refused], ...over,
  }
  const io = { out: (s: string) => out.push(s), err: (s: string) => err.push(s), write: () => {}, audit: async () => { throw new Error('unused') }, cwd, convert: { api, interactive: false, ...env } }
  return { io, out, err, calls, cwd }
}

describe('dualkit convert', () => {
  it('exits 2 and lists the allowed values for a bad --mode', async () => {
    const t = setup()
    expect(await run(['convert', '--mode', 'both'], t.io)).toBe(2)
    expect(t.err.join('')).toContain('bilingual or arabic')
    expect(t.calls).toEqual([])
  })

  it('exits 2 without a terminal and without --mode', async () => {
    const t = setup()
    expect(await run(['convert'], t.io)).toBe(2)
    expect(t.err.join('')).toBe('Pass --mode bilingual or --mode arabic.\n')
  })

  it('exits 2 when convert.port is not a number', async () => {
    const t = setup({}, {}, { convert: { port: 'x' } })
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(2)
    expect(t.err.join('')).toContain('convert.port')
  })

  it('names each bad convert field', () => {
    const bad: Record<string, unknown> = { start: 3, port: 0, test: '', routes: 'x', params: { id: 1 }, storageState: [] }
    for (const [field, value] of Object.entries(bad)) {
      const cwd = mkdtempSync(join(tmpdir(), 'dualkit-'))
      writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify({ convert: { [field]: value } }))
      expect(() => loadConfig(undefined, cwd), field).toThrow(`convert.${field}`)
    }
  })

  it('shows params as a dynamic route mapped to a sample path, the shape finish reads', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dualkit-'))
    writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify({ convert: { params: { '/orders/[id]': 42 } } }))
    expect(() => loadConfig(undefined, cwd)).toThrow('convert.params must map a dynamic route to a sample path, for example {"/orders/[id]": "/orders/42"}.')
  })

  it('accepts a full convert block', () => {
    const block = { start: 'npm run dev', port: 3000, test: 'npm test', routes: ['/'], params: { id: '1' }, storageState: 'auth.json' }
    const cwd = mkdtempSync(join(tmpdir(), 'dualkit-'))
    writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify({ convert: block }))
    expect(loadConfig(undefined, cwd).convert).toEqual(block)
  })

  it('runs phase 1, prints the branch, counts and the next step, and exits 0', async () => {
    const t = setup({}, { shoot: async () => Buffer.alloc(0) }, { convert: { start: 'npm run dev' } })
    expect(await run(['convert', '--mode', 'bilingual', '--no-install'], t.io)).toBe(0)
    const text = t.out.join('')
    expect(text).toContain('Branch: dualkit/bilingual')
    expect(text).toContain('4 files changed, 12 edits, 9 strings to translate, 1 place left for you.')
    expect(text).toContain('Fill the Arabic in dualkit-strings.json, or ask your agent to use the dualkit-convert skill, then run dualkit convert --finish.')
    expect(t.calls[0]?.args[0]).toMatchObject({ mode: 'bilingual', install: false, baseline: true })
  })

  it('hands the interrupt signal to convert so an interrupted install rolls back', async () => {
    const t = setup()
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(0)
    expect((t.calls[0]?.args[1] as { signal?: unknown }).signal).toBeInstanceOf(AbortSignal)
  })

  it('skips the baseline with a note when there is no start command', async () => {
    const t = setup()
    expect(await run(['convert', '--mode', 'bilingual'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('English baseline is skipped')
    expect(t.calls[0]?.args[0]).toMatchObject({ baseline: false })
  })

  it('asks for no baseline and prints no baseline note in arabic mode', async () => {
    const t = setup({}, { shoot: async () => Buffer.alloc(0) }, { convert: { start: 'npm run dev' } })
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(0)
    expect(t.calls[0]?.args[0]).toMatchObject({ baseline: false })
    const bare = setup()
    expect(await run(['convert', '--mode', 'arabic'], bare.io)).toBe(0)
    expect(bare.out.join('')).not.toContain('baseline')
  })

  it('asks once for the start command and port and hands them to convert without writing the config', async () => {
    const answers = ['bilingual', 'npm run dev', '5173']
    const asked: string[] = []
    const t = setup({}, { interactive: true, shoot: async () => Buffer.alloc(0), ask: async (q) => { asked.push(q); return answers.shift() ?? '' } }, { ignore: ['type/arabic-size'] })
    const before = readFileSync(join(t.cwd, 'dualkit.config.json'), 'utf8')
    expect(await run(['convert'], t.io)).toBe(0)
    expect(asked[0]).toBe('One app that switches between English and Arabic, or a separate Arabic version? [bilingual/arabic]')
    expect(readFileSync(join(t.cwd, 'dualkit.config.json'), 'utf8')).toBe(before)
    expect(t.calls[0]?.args[0]).toMatchObject({ baseline: true, configAnswers: { start: 'npm run dev', port: 5173 } })
    expect(t.calls[0]?.args[1]).toMatchObject({ config: { start: 'npm run dev', port: 5173 } })
  })

  it('saves --start and --port as config answers so finish can find them', async () => {
    const t = setup({}, { shoot: async () => Buffer.alloc(0) })
    expect(await run(['convert', '--mode', 'bilingual', '--start', 'npm start', '--port', '4610'], t.io)).toBe(0)
    expect(t.calls[0]?.args[0]).toMatchObject({ baseline: true, configAnswers: { start: 'npm start', port: 4610 } })
  })

  it('hands the --config file to convert and finish as a path relative to the app', async () => {
    const t = setup()
    mkdirSync(join(t.cwd, 'conf'))
    writeFileSync(join(t.cwd, 'conf/dk.json'), JSON.stringify({ convert: { start: 'npm run dev' } }))
    expect(await run(['convert', '--mode', 'arabic', '--config', 'conf/dk.json'], t.io)).toBe(0)
    expect(await run(['convert', '--finish', '--config', join(t.cwd, 'conf/dk.json')], t.io)).toBe(0)
    expect(t.calls.map((c) => (c.args[0] as { configFile?: string }).configFile)).toEqual(['conf/dk.json', 'conf/dk.json'])
  })

  it('exits 2 when the --config file is outside the app folder', async () => {
    const t = setup()
    const outside = join(mkdtempSync(join(tmpdir(), 'dualkit-outside-')), 'dk.json')
    writeFileSync(outside, '{}')
    expect(await run(['convert', '--mode', 'arabic', '--config', outside], t.io)).toBe(2)
    expect(t.err.join('')).toContain('inside the app folder')
    expect(t.calls).toEqual([])
  })

  it('hands the answers to finish too', async () => {
    const answers = ['npm run dev', '']
    const t = setup({}, { interactive: true, shoot: async () => Buffer.alloc(0), audit: async () => ({ score: 1, errors: 0, warnings: 0 }), ask: async () => answers.shift() ?? '' })
    expect(await run(['convert', '--finish'], t.io)).toBe(0)
    expect(t.calls[0]?.args[0]).toMatchObject({ configAnswers: { start: 'npm run dev' } })
  })

  it('uses singular and plural in the counts', async () => {
    const one = { ...summary, filesChanged: 1, edits: 1, strings: 1, flags: [] }
    const t = setup({ convert: async () => one as never })
    await run(['convert', '--mode', 'arabic'], t.io)
    expect(t.out.join('')).toContain('1 file changed, 1 edit, 1 string to translate, 0 places left for you.')
  })

  it('exits 2 when the config holds something other than an object', async () => {
    const t = setup({}, {}, [1])
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(2)
    expect(t.err.join('')).toContain('JSON object')
  })

  it('exits 130 on Ctrl-C at a prompt', async () => {
    const t = setup({}, { interactive: true, ask: () => new Promise<string>(() => { process.emit('SIGINT') }) })
    expect(await run(['convert'], t.io)).toBe(130)
    expect(process.listenerCount('SIGINT')).toBe(0)
  })

  it('treats an empty start answer as skipping the baseline and saves nothing', async () => {
    const answers = ['bilingual', '']
    const t = setup({}, { interactive: true, ask: async () => answers.shift() ?? '' })
    expect(await run(['convert'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('English baseline is skipped')
    expect(() => readFileSync(join(t.cwd, 'dualkit.config.json'))).toThrow()
  })

  it('prints the report path and exits 0 on a pass, 1 on a fail', async () => {
    const pass = setup({}, { shoot: async () => Buffer.alloc(0), audit: async () => ({ score: 1, errors: 0, warnings: 0 }) }, { convert: { start: 'x' } })
    expect(await run(['convert', '--finish'], pass.io)).toBe(0)
    expect(pass.out.join('')).toContain('Report: /r/dualkit-convert.md')
    const fail = setup({ finish: async () => ({ reportPath: '/r/x.md', passed: false }) }, { shoot: async () => Buffer.alloc(0), audit: async () => ({ score: 1, errors: 0, warnings: 0 }) })
    expect(await run(['convert', '--finish', '--force'], fail.io)).toBe(1)
    expect(fail.out.join('')).toContain('Failed.')
  })

  it('exits 2 on a refusal from convert', async () => {
    const t = setup({ convert: async () => { throw new Refused('The working tree is not clean.') } })
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(2)
    expect(t.err.join('')).toBe('The working tree is not clean.\n')
  })

  it('prints one line and the debug hint on an unexpected error, and exits 1', async () => {
    const t = setup({ convert: async () => { throw new Error('boom\nstack line') } })
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(1)
    expect(t.err.join('')).toBe('Something went wrong: boom\nRun with DEBUG=dualkit for details.\n')
  })

  it('exits 130 on SIGINT and lets the run clean up first', async () => {
    let cleaned = false
    const t = setup({
      convert: (_o, _io) => new Promise((_, reject) => {
        process.emit('SIGINT')
        setTimeout(() => { cleaned = true; reject(new Error('aborted')) }, 10)
      }),
    })
    expect(await run(['convert', '--mode', 'arabic'], t.io)).toBe(130)
    expect(cleaned).toBe(true)
    expect(process.listenerCount('SIGINT')).toBe(0)
  })

  it('gives up after the grace period if the run never settles', async () => {
    const pending = withInterrupt(() => new Promise<never>(() => process.emit('SIGTERM')), 20)
    await expect(pending).rejects.toMatchObject({ code: 130 })
    expect(process.listenerCount('SIGINT')).toBe(0)
    expect(process.listenerCount('SIGTERM')).toBe(0)
  })

  it('removes its handlers after a second signal', async () => {
    const pending = withInterrupt(() => new Promise<never>(() => { process.emit('SIGINT'); process.emit('SIGINT') }), 60_000)
    await expect(pending).rejects.toMatchObject({ code: 130 })
    expect(process.listenerCount('SIGINT')).toBe(0)
    expect(process.listenerCount('SIGTERM')).toBe(0)
  })

  it('rejects convert flags on other commands and extra arguments', async () => {
    expect(await run(['lint', '--mode', 'arabic'], setup().io)).toBe(2)
    expect(await run(['convert', 'extra'], setup().io)).toBe(2)
  })

  it('shows convert in the help', async () => {
    const t = setup()
    expect(await run(['--help'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('dualkit convert')
  })
})

describe('lint stays light', () => {
  it('does not load playwright or the convert package from the lint path', () => {
    const read = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    for (const f of ['cli.ts', 'convert.ts', 'convert-env.ts']) expect(read(f), f).not.toMatch(/^import (?!type).*from '(playwright|@dualkit\/convert)'/m)
    for (const f of ['cli.ts', 'convert.ts']) expect(read(f), f).not.toMatch(/^import (?!type).*from '\.\/audit'/m)
  })
})
