import { rss } from '@/lib/rss'
import { RELEASES } from '@/lib/updates'

export const dynamic = 'force-static'

export function GET() {
  return new Response(rss(RELEASES, 'https://dualkit.dev'), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
