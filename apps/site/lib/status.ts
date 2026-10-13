import type { Fetcher } from './fetcher'

export type Check = { id: string; name: string; url: string; read?: (body: Record<string, unknown>) => string; pendingOn404?: string }
/** ok is null when the check could not run, for example because an API rate-limited us. */
export type CheckResult = { id: string; name: string; ok: boolean | null; ms: number; detail: string }
export type Overall = 'normal' | 'degraded' | 'down'

export const REPO = 'dualkit/dualkit'
export const PACKAGE = '@dualkit/format'

/** What /status watches. Each is a real request to a real service, run at most every five minutes. */
export const CHECKS: readonly Check[] = [
  {
    id: 'npm', name: '@dualkit/format on npm', url: `https://registry.npmjs.org/${PACKAGE.replace('/', '%2f')}`,
    read: (b) => String((b['dist-tags'] as Record<string, unknown> | undefined)?.latest ?? 'published'),
    // Until npm clears the first publish, a 404 means not published yet rather than an outage.
    pendingOn404: 'Not on npm yet, install from GitHub',
  },
  { id: 'repo', name: 'GitHub repository', url: `https://api.github.com/repos/${REPO}`, read: () => 'Reachable' },
  { id: 'skills', name: 'Skills for Claude Code and Cursor', url: `https://raw.githubusercontent.com/${REPO}/main/.claude-plugin/marketplace.json`, read: () => 'Installable' },
]

const TIMEOUT_MS = 5000
const RATE_LIMITED = new Set([403, 429])

async function runOne(fetcher: Fetcher, check: Check): Promise<CheckResult> {
  const started = Date.now()
  const base = { id: check.id, name: check.name }
  try {
    const res = await fetcher(check.url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const ms = Date.now() - started
    if (RATE_LIMITED.has(res.status)) return { ...base, ok: null, ms, detail: 'Not checked, rate limited' }
    if (res.status === 404 && check.pendingOn404) return { ...base, ok: null, ms, detail: check.pendingOn404 }
    if (!res.ok) return { ...base, ok: false, ms, detail: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    const detail = check.read ? check.read((body ?? {}) as Record<string, unknown>) : 'Up'
    return { ...base, ok: true, ms, detail }
  } catch {
    return { ...base, ok: false, ms: Date.now() - started, detail: 'Unreachable' }
  }
}

export const runChecks = (fetcher: Fetcher): Promise<CheckResult[]> => Promise.all(CHECKS.map((c) => runOne(fetcher, c)))

export function overall(results: readonly { ok: boolean | null }[]): Overall {
  const checked = results.filter((r) => r.ok !== null)
  const up = checked.filter((r) => r.ok).length
  if (up === checked.length) return 'normal'
  return up === 0 ? 'down' : 'degraded'
}

export const OVERALL_LABEL: Record<Overall, string> = {
  normal: 'All systems normal',
  degraded: 'Some systems degraded',
  down: 'Systems down',
}
