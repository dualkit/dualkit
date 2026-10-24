import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createTailwindVersion } from '@dualkit/lint'
import { isRecord } from './guards'
import type { Project } from './types'

/** Thrown when the app is not one convert can handle. The message names what is supported. */
export class UnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedError'
  }
}

const SUPPORTED = 'Next.js App Router and Vite React apps'

const REFUSED: ReadonlyArray<readonly [string, string]> = [
  ['@remix-run/react', 'Remix'],
  ['@remix-run/dev', 'Remix'],
  ['react-scripts', 'Create React App'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['@angular/core', 'Angular'],
]

const LOCKFILES: ReadonlyArray<readonly [string, Project['packageManager']]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
]

const ENTRY_NAMES = ['main', 'index']
const EXTENSIONS = ['tsx', 'jsx', 'ts', 'js']

const unsupported = (what: string): UnsupportedError =>
  new UnsupportedError(`Convert supports ${SUPPORTED}, not ${what}.`)

function readDeps(root: string): Record<string, string> {
  const path = join(root, 'package.json')
  if (!existsSync(path)) throw new UnsupportedError(`No package.json in ${root}. Convert supports ${SUPPORTED}.`)
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new UnsupportedError(`The package.json in ${root} is not valid JSON. Convert supports ${SUPPORTED}.`)
  }
  if (!isRecord(json)) throw new UnsupportedError(`The package.json in ${root} must hold a JSON object. Convert supports ${SUPPORTED}.`)
  const deps: Record<string, string> = {}
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const list = json[field]
    if (isRecord(list)) Object.assign(deps, list)
  }
  return deps
}

/** The first of `base.{tsx,jsx,ts,js}` that exists under root, as a root-relative path. */
function withExtension(root: string, base: string): string | null {
  const ext = EXTENSIONS.find((e) => existsSync(join(root, `${base}.${e}`)))
  return ext ? `${base}.${ext}` : null
}

function nextLayout(root: string): { appDir: string; entry: string } {
  for (const appDir of ['app', 'src/app']) {
    const entry = withExtension(root, `${appDir}/[locale]/layout`) ?? withExtension(root, `${appDir}/layout`)
    if (entry) return { appDir, entry }
  }
  const hasPages = ['pages', 'src/pages'].some((d) => existsSync(join(root, d)))
  throw new UnsupportedError(
    hasPages
      ? `This Next.js app uses the Pages Router. Convert supports the App Router only, so there is no app/layout file to start from.`
      : `No root layout found in app or src/app. Convert supports the Next.js App Router and Vite React apps.`,
  )
}

/** The file that calls createRoot, looked for in the usual entry names under src and the root. */
function viteEntry(root: string): string {
  const candidates = ['src', '.'].flatMap((dir) => ENTRY_NAMES.map((name) => (dir === '.' ? name : `${dir}/${name}`)))
  for (const base of candidates) {
    const entry = withExtension(root, base)
    if (entry && readFileSync(join(root, entry), 'utf8').includes('createRoot')) return entry
  }
  const src = join(root, 'src')
  const files = existsSync(src) ? readdirSync(src).filter((f) => /\.(tsx|jsx|ts|js)$/.test(f)) : []
  const found = files.find((f) => readFileSync(join(src, f), 'utf8').includes('createRoot'))
  if (found) return `src/${found}`
  throw new UnsupportedError(`No file calling createRoot found in this Vite app. Convert supports ${SUPPORTED}.`)
}

/** Lockfile in root, else in the nearest ancestor up to the repository or workspace top. */
function detectPackageManager(root: string): Project['packageManager'] {
  for (let dir = root; ; dir = dirname(dir)) {
    const hit = LOCKFILES.find(([file]) => existsSync(join(dir, file)))
    if (hit) return hit[1]
    const top = existsSync(join(dir, '.git')) || (dir !== root && existsSync(join(dir, 'package.json')))
    if (top || dirname(dir) === dir) return 'npm'
  }
}

function detectI18n(deps: Record<string, string>): Project['i18n'] {
  if ('next-intl' in deps) return 'next-intl'
  if ('react-i18next' in deps) return 'react-i18next'
  return null
}

/** Reads the app at root and says which framework, entry, styling and tooling it uses. Throws UnsupportedError for anything else. */
export function detectProject(root: string): Project {
  const deps = readDeps(root)
  const refused = REFUSED.find(([name]) => name in deps)
  if (refused) throw unsupported(refused[1])
  if (!('react' in deps)) throw new UnsupportedError(`This app does not use React. Convert supports ${SUPPORTED}.`)

  const tailwind = createTailwindVersion()(join(root, 'package.json'), root)
  const common = { root, tailwind, i18n: detectI18n(deps), packageManager: detectPackageManager(root) }

  if ('next' in deps) {
    const { appDir, entry } = nextLayout(root)
    return { ...common, framework: 'next-app', appDir, entry }
  }
  if ('vite' in deps) return { ...common, framework: 'vite-react', appDir: null, entry: viteEntry(root) }
  throw new UnsupportedError(`This React app uses neither Next.js nor Vite. Convert supports ${SUPPORTED}.`)
}
