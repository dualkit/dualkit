/** Statuses that mean the page is shut to this visitor, as with a login or a feature that needs a database. */
const CLOSED = new Set([401, 403, 404])
const STATUS_TIMEOUT_MS = 60_000

const closedStatus = async (url: string): Promise<number | null> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS), redirect: 'manual' })
    return CLOSED.has(res.status) ? res.status : null
  } catch {
    // A page that cannot be asked about stays in the checks, which then report it.
    return null
  }
}

/**
 * The routes whose English page is shut, so an Arabic check of them would measure nothing. A 5xx stays in the checks,
 * since convert can cause one. The English screenshot comparison still runs on these routes, so a page convert broke
 * into a 404 fails there instead of being skipped.
 */
export async function closedRoutes(base: string, routes: string[]): Promise<{ route: string; reason: string }[]> {
  const found: { route: string; reason: string }[] = []
  for (const route of routes) {
    const status = await closedStatus(`${base}${route}`)
    if (status) found.push({ route, reason: `the English page returns ${status}, so its Arabic page was not checked` })
  }
  return found
}
