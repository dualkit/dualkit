import { cpSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url))
const GIT_ID = ['-c', 'user.email=test@dualkit.dev', '-c', 'user.name=dualkit test']

/** Copies a fixture to a temp dir, makes it a git repo with one commit, and returns the path. */
export function fixtureRepo(name: 'next-app' | 'vite-app', root: string = FIXTURES): string {
  const dir = mkdtempSync(join(tmpdir(), `dualkit-${name}-`))
  cpSync(join(root, name), dir, { recursive: true })
  const git = (...args: string[]): void => void execFileSync('git', [...GIT_ID, ...args], { cwd: dir, stdio: 'ignore' })
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'fixture')
  return dir
}
