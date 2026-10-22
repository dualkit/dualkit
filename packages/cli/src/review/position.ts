import type { Finding, NodeRef, ScreenModel } from '@dualkit/rules'
import type { ReviewRule } from './rules'

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
export const REVIEW_DOCS = 'https://github.com/dualkit/dualkit/blob/main/packages/cli/README.md#review'

/** Arabic text runs, icons and fields, deduped by id and in reading order, capped at `limit`. */
export function candidates(model: ScreenModel, limit = 150): NodeRef[] {
  const all: NodeRef[] = [...model.texts.filter((t) => t.blockHasArabic || ARABIC.test(t.text)), ...model.icons, ...model.fields]
  const seen = new Set<string>()
  const unique = all.filter((n) => !seen.has(n.id) && !!seen.add(n.id))
  return unique
    .map(({ id, snippet, box }) => ({ id, snippet, box }))
    .sort((a, b) => a.box.y - b.box.y || b.box.x - a.box.x)
    .slice(0, limit)
}

const parseJson = (reply: string): unknown => {
  const body = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(body) } catch { return null }
}
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Turns the model's reply into findings. Anything unknown, out of range or without a message is dropped. */
export function findingsFrom(reply: string, cands: NodeRef[], rules: ReviewRule[]): Finding[] {
  const parsed = parseJson(reply)
  const list = isObject(parsed) && Array.isArray(parsed.findings) ? parsed.findings : []
  return list.flatMap((entry): Finding[] => {
    if (!isObject(entry)) return []
    const rule = rules.find((r) => r.id === entry.rule)
    const el = entry.element
    const message = typeof entry.message === 'string' ? entry.message.trim() : ''
    if (!rule || !message || typeof el !== 'number' || !Number.isInteger(el) || el < 0 || el >= cands.length) return []
    const confidence = typeof entry.confidence === 'number' && Number.isFinite(entry.confidence) ? Math.min(1, Math.max(0, entry.confidence)) : 0
    return [{
      rule: rule.id, group: rule.group, severity: 'warning', title: rule.title, message, fix: rule.fix, docs: REVIEW_DOCS,
      node: cands[el], source: 'review', confidence, line: null,
    }]
  })
}

type Tag = { name: string; attrs: Map<string, string>; closed: boolean }

const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

/** First opening tag in `text`, with attributes lowercased by name and whitespace squeezed. A tag cut off before `>` is `closed: false`. */
function parseTag(text: string): Tag | null {
  const m = /^<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(>?)/.exec(text)
  if (!m) return null
  const attrs = new Map<string, string>()
  const closed = m[3] === '>'
  let rest = m[2].replace(/\/\s*$/, '')
  // A cut-off tag may end in a half-written attribute; leave it out.
  if (!closed) rest = rest.replace(/\s+[^\s"'=]*(?:\s*=\s*(?:"[^"]*|'[^']*|[^\s"']*))?$/, '')
  for (const a of rest.matchAll(ATTR)) attrs.set(a[1].toLowerCase(), (a[2] ?? a[3] ?? a[4] ?? '').replace(/\s+/g, ' ').trim())
  return { name: m[1].toLowerCase(), attrs, closed }
}

function matches(want: Tag, have: Tag): boolean {
  if (want.name !== have.name) return false
  for (const [k, v] of want.attrs) if (have.attrs.get(k) !== v) return false
  return !want.closed || want.attrs.size === have.attrs.size
}

/** 1-based line of the node's opening tag when exactly one tag in the source matches it, else null. */
export function lineOf(source: string, node: NodeRef): number | null {
  const want = parseTag(node.snippet.trim())
  if (!want) return null
  const hits: number[] = []
  for (const m of source.matchAll(/<[a-zA-Z][^]*?(?=<|$)/g)) {
    const have = parseTag(m[0])
    if (have && matches(want, have)) hits.push(source.slice(0, m.index).split('\n').length)
  }
  return hits.length === 1 ? hits[0] : null
}
