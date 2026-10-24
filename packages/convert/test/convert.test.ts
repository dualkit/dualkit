import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { convert, problems, type ConvertIo } from '../src/convert'
import { LEDGER_FILE, type LedgerEntry } from '../src/ledger'
import { fixtureRepo, projectFiles } from './helpers'

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const commits = (dir: string): number => Number(git(dir, 'rev-list', '--count', 'HEAD'))
const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')

/** An io that logs nowhere and records the commands it was asked to run. */
function fakeIo(overrides: Partial<ConvertIo> = {}): ConvertIo & { ran: string[] } {
  const ran: string[] = []
  return { log: () => {}, run: async (cmd) => { ran.push(cmd); return { code: 0, out: '' } }, config: {}, ...overrides, ran }
}

/** Writes files into a repo and commits them with the repo's own identity. */
function commitFiles(dir: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'more')
}

const options = (root: string, mode: 'bilingual' | 'arabic' = 'bilingual') => ({ root, mode, install: false, baseline: false })

describe('convert refusals', () => {
  it('refuses a dirty tree', async () => {
    const dir = fixtureRepo('next-app')
    writeFileSync(join(dir, 'app/page.tsx'), '// changed\n', { flag: 'a' })
    await expect(convert(options(dir), fakeIo())).rejects.toThrow(/uncommitted/)
  })

  it('refuses a folder that is not a git repo', async () => {
    const dir = fixtureRepo('next-app')
    execFileSync('rm', ['-rf', join(dir, '.git')])
    await expect(convert(options(dir), fakeIo())).rejects.toThrow(/git repo/)
  })

  it('refuses when the dualkit/bilingual branch already exists', async () => {
    const dir = fixtureRepo('next-app')
    git(dir, 'branch', 'dualkit/bilingual')
    await expect(convert(options(dir), fakeIo())).rejects.toThrow(/dualkit\/bilingual/)
    expect(git(dir, 'branch', '--show-current')).toBe('main')
  })
})

describe('convert bilingual on Next.js', () => {
  it('converts on a new branch in one commit, and a second run changes nothing', async () => {
    const dir = fixtureRepo('next-app')
    const summary = await convert(options(dir), fakeIo())

    expect(git(dir, 'branch', '--show-current')).toBe('dualkit/bilingual')
    expect(summary.branch).toBe('dualkit/bilingual')
    expect(commits(dir)).toBe(2)
    expect(git(dir, 'log', '-1', '--format=%s %ae')).toBe('dualkit: convert to bilingual test@example.com')
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(existsSync(join(dir, 'app/[locale]/page.tsx'))).toBe(true)
    expect(existsSync(join(dir, 'app/page.tsx'))).toBe(false)
    expect(existsSync(join(dir, 'app/dualkit.css'))).toBe(true)
    expect(read(dir, 'app/[locale]/layout.tsx')).toContain("import '../dualkit.css'")

    const ledger = JSON.parse(read(dir, LEDGER_FILE)) as LedgerEntry[]
    expect(ledger.length).toBeGreaterThan(0)
    expect(ledger.every((e) => e.status === 'pending')).toBe(true)
    expect(ledger.map((e) => e.file)).toContain('app/[locale]/page.tsx')
    expect(summary.strings).toBe(ledger.length)
    expect(JSON.parse(read(dir, 'messages/en.json'))).toHaveProperty('home')

    const source = projectFiles(dir).paths.filter((p) => /\.(tsx|css)$/.test(p))
    expect(source.filter((p) => /\bml-\d/.test(read(dir, p)))).toEqual([])
    expect(read(dir, '.gitignore')).toContain('.dualkit/')
    expect(JSON.parse(read(dir, '.dualkit/convert.json'))).toMatchObject({ mode: 'bilingual', branch: 'dualkit/bilingual', base: 'main', framework: 'next-app', phase: 'converted' })
    expect(JSON.parse(read(dir, 'package.json')).dependencies['next-intl']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(summary.edits).toBeGreaterThan(0)
    expect(summary.filesChanged).toBeGreaterThan(0)

    const again = await convert(options(dir), fakeIo())
    expect(commits(dir)).toBe(2)
    expect(again.edits).toBe(0)
    expect(again.filesChanged).toBe(0)
    expect(again.strings).toBe(0)
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(again.flags.some((f) => f.kind === 'info')).toBe(true)
    expect(problems(again.flags).some((f) => f.kind === 'info')).toBe(false)
  })

  it('lists a file that does not parse in skipped and leaves its bytes alone', async () => {
    const dir = fixtureRepo('next-app')
    const broken = 'export function Broken() {\n  return <div className="ml-2">Oops</div\n}\n'
    commitFiles(dir, { 'components/broken.tsx': broken })
    const summary = await convert(options(dir), fakeIo())
    expect(summary.skipped.map((s) => s.file)).toContain('components/broken.tsx')
    expect(read(dir, 'components/broken.tsx')).toBe(broken)
  })

  it('leaves physical CSS alone in a file lint treats as generated', async () => {
    const dir = fixtureRepo('next-app')
    const generated = '/* @generated by a tool */\n.box {\n  margin-left: 4px;\n}\n'
    commitFiles(dir, { 'app/vendor.css': generated, 'app/own.css': '.box {\n  margin-left: 4px;\n}\n' })
    await convert(options(dir), fakeIo())
    expect(read(dir, 'app/vendor.css')).toBe(generated)
    expect(read(dir, 'app/own.css')).toContain('margin-inline-start: 4px')
  })

  it('runs the install with the detected package manager when asked', async () => {
    const dir = fixtureRepo('next-app')
    const io = fakeIo()
    await convert({ ...options(dir), install: true }, io)
    expect(io.ran).toEqual(['npm install'])
  })
})

describe('convert io', () => {
  it('turns a failed install into a flag and still commits', async () => {
    const dir = fixtureRepo('vite-app')
    const io = fakeIo({ run: async () => ({ code: 1, out: 'boom' }) })
    const summary = await convert({ ...options(dir), install: true }, io)
    expect(summary.flags.find((f) => f.file === 'package.json')?.message).toContain('npm install exited with code 1')
    expect(commits(dir)).toBe(2)
  })

  it('skips the baseline with a note when no start command is set', async () => {
    const dir = fixtureRepo('vite-app')
    const lines: string[] = []
    await convert({ ...options(dir), baseline: true }, fakeIo({ log: (l) => lines.push(l) }))
    expect(lines).toContain('No start command is set, so no English baseline was taken.')
    expect(existsSync(join(dir, '.dualkit/baseline'))).toBe(false)
  })
})

describe('convert arabic on Vite', () => {
  it('creates dualkit/arabic with i18n fixed to Arabic', async () => {
    const dir = fixtureRepo('vite-app')
    const summary = await convert(options(dir, 'arabic'), fakeIo())
    expect(summary.branch).toBe('dualkit/arabic')
    expect(git(dir, 'branch', '--show-current')).toBe('dualkit/arabic')
    expect(read(dir, 'src/i18n.ts')).toContain("lng: 'ar'")
    expect(existsSync(join(dir, 'src/dualkit.css'))).toBe(true)
    expect(read(dir, 'src/main.tsx')).toContain("import './dualkit.css'")
    expect(existsSync(join(dir, 'messages/ar.json'))).toBe(true)
    expect(commits(dir)).toBe(2)
    expect(git(dir, 'status', '--porcelain')).toBe('')
  })
})

describe('convert baseline', () => {
  it('shoots every reachable English page at both widths, then stops the server', async () => {
    const dir = fixtureRepo('next-app')
    const port = 4521
    const shots: string[] = []
    const io = fakeIo({
      config: { start: `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`, port },
      shoot: async (url, width) => { shots.push(`${url} ${width}`); return Buffer.from('png') },
    })
    await convert({ ...options(dir), baseline: true }, io)
    const url = `http://localhost:${port}`
    expect(shots).toEqual(['/', '/pricing', '/settings'].flatMap((route) => [`${url}${route} 390`, `${url}${route} 1280`]))
    expect(read(dir, '.dualkit/baseline/home-390.png')).toBe('png')
    expect(existsSync(join(dir, '.dualkit/baseline/pricing-1280.png'))).toBe(true)
    expect(git(dir, 'status', '--porcelain')).toBe('')
    await expect(fetch(`http://localhost:${port}/`)).rejects.toThrow()
  })
})
