import type { Fetcher } from '../lib/fetcher'

type Reply = { status: number; body: unknown }

/** A fetch that answers from a table and fails like a dropped connection for any other URL. */
export function fakeFetch(table: Record<string, Reply>): Fetcher {
  return async (url) => {
    const reply = table[url]
    if (!reply) throw new TypeError('fetch failed')
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, json: async () => reply.body }
  }
}
