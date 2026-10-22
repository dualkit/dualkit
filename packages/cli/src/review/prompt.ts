import type { Finding, NodeRef } from '@dualkit/rules'
import type { Ask } from './model'
import type { ReviewRule } from './rules'

/** Bump this whenever the prompt or the reflection text (reflect.ts) changes, because the eval's review cache keys on it. */
export const REVIEW_PROMPT_VERSION = '1'

const SYSTEM = [
  'You review screenshots of a right-to-left Arabic screen for problems an Arabic reader would see as wrong.',
  'Only report what you can see in the images. Do not guess. Reply with JSON only, with no other text.',
].join(' ')

const REPLY = '{ "findings": [{ "rule": "<rule id>", "element": <number from the list>, "message": "<one plain sentence on what is wrong>", "confidence": <0 to 1> }] }'

const describeBox = ({ x, y, width, height }: NodeRef['box']): string => `x ${Math.round(x)}, y ${Math.round(y)}, ${Math.round(width)} by ${Math.round(height)}`

export function buildAsk({ tiles, cands, rules, already }: { tiles: string[]; cands: NodeRef[]; rules: ReviewRule[]; already: Finding[] }): Ask {
  const parts = [
    `The ${tiles.length} image${tiles.length === 1 ? ' is' : 's are'} the page from top to bottom, one screen high each.`,
    `Elements on the page, numbered. Boxes are in page pixels:\n${cands.map((c, i) => `[${i}] ${c.snippet} (${describeBox(c.box)})`).join('\n')}`,
    `Rules to check. Report a problem only under one of these ids:\n${rules.map((r) => `- ${r.id}: ${r.ask}`).join('\n')}`,
    already.length === 0
      ? 'No problems have been reported yet.'
      : `These problems were already reported. Do not repeat them or report the same thing again:\n${already.map((f) => `- ${f.rule}${f.node ? ` on ${f.node.id}` : ''}: ${f.message}`).join('\n')}`,
    `Reply with JSON in exactly this shape, and an empty list when you find nothing:\n${REPLY}`,
  ]
  return { system: SYSTEM, text: parts.join('\n\n'), images: tiles.map((base64) => ({ mime: 'image/png' as const, base64 })) }
}
