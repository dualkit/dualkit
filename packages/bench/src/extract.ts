const FENCE = /```([\w-]*)[^\n]*\n([\s\S]*?)(?:\n```|$(?![\s\S]))/g
const THINK = /<think>[\s\S]*?<\/think>/gi
const DOCUMENT = /<!doctype html|<html[\s>]/i

/** The page a model built, or null when the reply holds none. */
export function extractHtml(reply: string): string | null {
  const text = reply.replace(THINK, '')
  const blocks = [...text.matchAll(FENCE)].map((m) => ({ lang: (m[1] ?? '').toLowerCase(), body: (m[2] ?? '').trim() }))
  const longest = (list: typeof blocks) => list.reduce<string | null>((best, b) => (best === null || b.body.length > best.length ? b.body : best), null)
  const tagged = blocks.filter((b) => b.lang === 'html' && b.body.length > 0)
  if (tagged.length > 0) return longest(tagged)
  const documents = blocks.filter((b) => DOCUMENT.test(b.body))
  if (documents.length > 0) return longest(documents)
  const bare = text.trim()
  return /^(<!doctype html|<html[\s>])/i.test(bare) ? bare : null
}
