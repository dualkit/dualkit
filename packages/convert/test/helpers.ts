import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, type Dirent } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url))
const GIT_ID: ReadonlyArray<readonly [string, string]> = [['user.email', 'test@example.com'], ['user.name', 'dualkit test'], ['commit.gpgsign', 'false']]

/** Copies a fixture to a temp dir, makes it a git repo with a local test identity and one commit, and returns the path. */
export function fixtureRepo(name: 'next-app' | 'vite-app', root: string = FIXTURES): string {
  const dir = mkdtempSync(join(tmpdir(), `dualkit-${name}-`))
  cpSync(join(root, name), dir, { recursive: true })
  const git = (...args: string[]): void => void execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  for (const [key, value] of GIT_ID) git('config', key, value)
  git('add', '.')
  git('commit', '-q', '-m', 'fixture')
  return dir
}

/** Every file under root as root-relative paths, and a reader that returns a file's text or null. */
export function projectFiles(root: string): { paths: string[]; files: (rel: string) => string | null } {
  const paths = (readdirSync(root, { recursive: true, withFileTypes: true }) as Dirent[])
    .filter((d) => d.isFile())
    .map((d) => relative(root, join(d.parentPath, d.name)).split(sep).join('/'))
    .filter((p) => !p.startsWith('node_modules/'))
    .sort()
  const files = (rel: string): string | null => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null)
  return { paths, files }
}

/** The fixture directory for a fixture name. */
export const fixtureDir = (name: 'next-app' | 'vite-app'): string => join(FIXTURES, name)
