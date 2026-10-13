import { fetchStars, fetchWeeklyDownloads } from './counters'
import type { Fetcher } from './fetcher'
import { PACKAGE, REPO, overall, runChecks } from './status'

// GITHUB_TOKEN is optional: without it, shared server IPs can hit GitHub's anonymous rate limit.
const token = process.env.GITHUB_TOKEN
const headers = (url: string): Record<string, string> => ({
  'user-agent': 'dualkit.dev',
  ...(token && url.startsWith('https://api.github.com/') ? { authorization: `Bearer ${token}` } : {}),
})
const fetcher: Fetcher = (url, init) => fetch(url, { ...init, headers: headers(url) })

/** Everything the chrome shows that comes from outside: stars, downloads, and the status summary. */
export async function liveData() {
  const [stars, downloads, checks] = await Promise.all([fetchStars(fetcher, REPO), fetchWeeklyDownloads(fetcher, PACKAGE), runChecks(fetcher)])
  return { stars, downloads, checks, status: overall(checks) }
}
