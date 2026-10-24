import { cpSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UnsupportedError, detectProject } from '../src/project'
import { fixtureRepo } from './helpers'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dualkit-project-'))
const write = (dir: string, file: string, text: string): void => {
  mkdirSync(join(dir, file, '..'), { recursive: true })
  writeFileSync(join(dir, file), text)
}
const pkg = (deps: Record<string, string>): string => JSON.stringify({ dependencies: deps })

describe('detectProject', () => {
  it('detects the Next App Router fixture', () => {
    const dir = fixtureRepo('next-app')
    const project = detectProject(dir)
    expect(project).toMatchObject({
      root: dir, framework: 'next-app', appDir: 'app', entry: 'app/layout.tsx', i18n: null, packageManager: 'npm',
    })
    expect(project.tailwind).toMatch(/^4\./)
  })

  it('finds an app moved to src/app', () => {
    const dir = fixtureRepo('next-app')
    mkdirSync(join(dir, 'src'))
    renameSync(join(dir, 'app'), join(dir, 'src/app'))
    expect(detectProject(dir)).toMatchObject({ appDir: 'src/app', entry: 'src/app/layout.tsx' })
  })

  it('finds the [locale] layout of an app convert already wired, under app and src/app', () => {
    const dir = fixtureRepo('next-app')
    mkdirSync(join(dir, 'app/[locale]'))
    renameSync(join(dir, 'app/layout.tsx'), join(dir, 'app/[locale]/layout.tsx'))
    expect(detectProject(dir)).toMatchObject({ appDir: 'app', entry: 'app/[locale]/layout.tsx' })
    mkdirSync(join(dir, 'src'))
    renameSync(join(dir, 'app'), join(dir, 'src/app'))
    expect(detectProject(dir)).toMatchObject({ appDir: 'src/app', entry: 'src/app/[locale]/layout.tsx' })
  })

  it('detects the Vite fixture and its createRoot entry', () => {
    const project = detectProject(fixtureRepo('vite-app'))
    expect(project).toMatchObject({ framework: 'vite-react', appDir: null, entry: 'src/main.tsx' })
    expect(project.tailwind).toMatch(/^3\./)
  })

  it('finds a createRoot file with another name', () => {
    const dir = fixtureRepo('vite-app')
    renameSync(join(dir, 'src/main.tsx'), join(dir, 'src/boot.tsx'))
    write(dir, 'index.html', '<script type="module" src="/src/boot.tsx"></script>')
    expect(detectProject(dir).entry).toBe('src/boot.tsx')
  })

  it('detects an app inside a workspace and reads the root lockfile', () => {
    const repo = tmp()
    write(repo, 'package.json', JSON.stringify({ workspaces: ['apps/*'] }))
    write(repo, 'pnpm-lock.yaml', '')
    const web = join(repo, 'apps/web')
    cpSync(join(fixtureRepo('next-app')), web, { recursive: true, filter: (s) => !s.includes('.git') })
    rmSync(join(web, 'package-lock.json'))
    expect(detectProject(web)).toMatchObject({ framework: 'next-app', packageManager: 'pnpm' })
  })

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ] as const)('maps %s to %s', (lockfile, manager) => {
    const dir = fixtureRepo('vite-app')
    rmSync(join(dir, 'package-lock.json'))
    write(dir, lockfile, '')
    expect(detectProject(dir).packageManager).toBe(manager)
  })

  it('reads i18n libraries from dependencies', () => {
    const dir = fixtureRepo('next-app')
    write(dir, 'package.json', pkg({ next: '^15.0.0', react: '^19.0.0', 'next-intl': '^3.0.0' }))
    expect(detectProject(dir).i18n).toBe('next-intl')
    write(dir, 'package.json', pkg({ next: '^15.0.0', react: '^19.0.0', 'react-i18next': '^15.0.0' }))
    expect(detectProject(dir).i18n).toBe('react-i18next')
  })

  it('returns a null tailwind when the app does not declare it', () => {
    const dir = fixtureRepo('vite-app')
    write(dir, 'package.json', pkg({ react: '^18.0.0', vite: '^6.0.0' }))
    expect(detectProject(dir).tailwind).toBeNull()
  })
})

describe('detectProject refusals', () => {
  const refuse = (files: Record<string, string>, message: RegExp): void => {
    const dir = tmp()
    for (const [file, text] of Object.entries(files)) write(dir, file, text)
    expect(() => detectProject(dir)).toThrow(UnsupportedError)
    expect(() => detectProject(dir)).toThrow(message)
  }

  it('refuses a Pages Router only Next app, naming App Router', () => {
    refuse({ 'package.json': pkg({ next: '^15.0.0', react: '^19.0.0' }), 'pages/index.tsx': '' }, /App Router/)
  })

  it('refuses a Next app with no layout', () => {
    refuse({ 'package.json': pkg({ next: '^15.0.0', react: '^19.0.0' }) }, /App Router/)
  })

  it.each([
    ['Remix', { '@remix-run/react': '^2.0.0', react: '^18.0.0' }],
    ['Remix', { '@remix-run/dev': '^2.0.0', react: '^18.0.0' }],
    ['Create React App', { 'react-scripts': '5.0.1', react: '^18.0.0' }],
    ['Vue', { vue: '^3.0.0' }],
    ['Svelte', { svelte: '^5.0.0' }],
    ['Angular', { '@angular/core': '^18.0.0' }],
  ])('refuses %s', (name, deps) => {
    refuse({ 'package.json': pkg(deps) }, new RegExp(`not ${name}`))
  })

  it('refuses an app without React', () => {
    refuse({ 'package.json': pkg({ express: '^4.0.0' }) }, /does not use React/)
  })

  it('refuses a React app with neither Next nor Vite', () => {
    refuse({ 'package.json': pkg({ react: '^18.0.0' }) }, /neither Next.js nor Vite/)
  })

  it('refuses a Vite app with no createRoot file', () => {
    refuse({ 'package.json': pkg({ react: '^18.0.0', vite: '^6.0.0' }), 'src/main.tsx': 'export {}' }, /createRoot/)
  })

  it('refuses a folder with no package.json', () => {
    refuse({ 'readme.md': 'x' }, /No package\.json/)
  })

  it('refuses a malformed package.json', () => {
    refuse({ 'package.json': '{' }, /not valid JSON/)
  })

  it.each(['null', '[]', '"app"', '3'])('refuses a package.json that holds %s instead of an object', (text) => {
    refuse({ 'package.json': text }, /package\.json in .* must hold a JSON object/)
  })

  it('ignores a dependency field that is not an object', () => {
    refuse({ 'package.json': JSON.stringify({ dependencies: 'react' }) }, /does not use React/)
  })
})
