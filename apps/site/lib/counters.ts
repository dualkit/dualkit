import type { Fetcher } from './fetcher'

const HOUR = 3600
const TIMEOUT_MS = 5000

async function readJson(fetcher: Fetcher, url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetcher(url, { next: { revalidate: HOUR }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    const body = await res.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const asCount = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

/** Real GitHub stars, or null when the repo is not reachable. Never a placeholder. */
export async function fetchStars(fetcher: Fetcher, repo: string): Promise<number | null> {
  const body = await readJson(fetcher, `https://api.github.com/repos/${repo}`)
  return asCount(body?.stargazers_count)
}

/** Real npm downloads for the last seven days, or null before the package exists. */
export async function fetchWeeklyDownloads(fetcher: Fetcher, pkg: string): Promise<number | null> {
  const body = await readJson(fetcher, `https://api.npmjs.org/downloads/point/last-week/${pkg}`)
  return asCount(body?.downloads)
}

/** 1234 reads as 1.2k, 15400 as 15k. */
export function compactCount(n: number): string {
  const unit = (value: number, suffix: string) => {
    const fixed = value < 10 ? value.toFixed(1) : Math.round(value).toString()
    return fixed.replace(/\.0$/, '') + suffix
  }
  if (n >= 1_000_000) return unit(n / 1_000_000, 'm')
  if (n >= 1000) return unit(n / 1000, 'k')
  return String(n)
}
