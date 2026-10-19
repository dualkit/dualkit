export type Fence = { skill: string; lang: string; code: string; section: string; index: number }

const SKIPPED_SECTION = 'Common mistakes'

/** Every fenced block in a skill, except those under "## Common mistakes". */
export function fencesOf(skill: string, markdown: string): Fence[] {
  const fences: Fence[] = []
  let section = ''
  let lang = ''
  let lines: string[] | null = null
  let index = 0
  for (const line of markdown.split('\n')) {
    if (lines) {
      if (line.trim() === '```') {
        if (section !== SKIPPED_SECTION) fences.push({ skill, lang, code: lines.join('\n') + '\n', section, index: index++ })
        lines = null
      } else lines = [...lines, line]
      continue
    }
    const start = /^```(\S*)/.exec(line)
    if (start) {
      lang = start[1] ?? ''
      lines = []
    }
    else {
      const heading = /^##\s+(.*)$/.exec(line)
      if (heading) section = (heading[1] ?? '').trim()
    }
  }
  return fences
}

const MIN_PX = 14
const BASE_PX = 16
const toPx = (n: string, unit: string): number => Number(n) * (unit === 'px' ? 1 : BASE_PX)
const SIZE = String.raw`(\d*\.?\d+)(px|rem|em)`

/** Banned type habits for Arabic: small sizes and tracking. Sizes under 14px, text-xs, tracking-* except tracking-normal. */
export function bannedIn(code: string): string[] {
  const hits: string[] = []
  for (const m of code.matchAll(/(?<![\w-])text-xs(?![\w-])/g)) hits.push(m[0])
  for (const m of code.matchAll(/(?<![\w-])tracking-(?!normal(?![\w-]))[\w[\].%-]+/g)) hits.push(m[0])
  for (const m of code.matchAll(new RegExp(String.raw`text-\[${SIZE}\]`, 'g')))
    if (toPx(m[1]!, m[2]!) < MIN_PX) hits.push(m[0])
  for (const m of code.matchAll(new RegExp(String.raw`(?<![\w-])(font-size|--[\w-]*(?:text|font|size)[\w-]*)\s*:\s*${SIZE}`, 'g'))) {
    if (m[1] === 'size-adjust') continue
    if (toPx(m[2]!, m[3]!) < MIN_PX) hits.push(m[0])
  }
  return hits
}

const KEYWORDS = ['if', 'for', 'while', 'switch', 'return', 'function', 'catch']
const GLOBALS = ['String', 'Number', 'Boolean', 'Array', 'Object', 'Math', 'Date', 'Intl', 'parseInt', 'parseFloat', 'encodeURIComponent']
const SKIP = new Set([...KEYWORDS, ...GLOBALS])

/** Bare identifiers called as functions that are neither known, global, keywords nor declared in the block. */
export function undefinedCalls(code: string, known: ReadonlySet<string>): string[] {
  const source = code.replace(/(^|\s)\/\/.*$/gm, '$1')
  const declared = new Set([...source.matchAll(/\b(?:const|let|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]!))
  const calls = [...source.matchAll(/(?<![.\w$])(?<!new )([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!)
  return [...new Set(calls)].filter((n) => !known.has(n) && !SKIP.has(n) && !declared.has(n))
}
