/** The slice of fetch the site needs, so the network can be swapped out in tests. */
export type Fetcher = (url: string, init?: { next?: { revalidate?: number }; signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>
