// Best effort: each serverless instance keeps its own count, which is enough to stop a loop of repeat sends.

/** Returns a check that is true once an ip has used up `max` sends inside `windowMs`. */
export function rateLimiter(windowMs: number, max: number): (ip: string, now: number) => boolean {
  const recent = new Map<string, number[]>()
  return (ip, now) => {
    const hits = (recent.get(ip) ?? []).filter((t) => now - t < windowMs)
    recent.set(ip, [...hits, now])
    return hits.length >= max
  }
}
