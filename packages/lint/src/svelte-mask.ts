/** Index of the `}` that closes the `{` at `open`, or -1 when it never closes. Strings, template literals and nested braces are skipped. */
function closingBrace(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '"' || ch === "'") {
      i = closingQuote(text, i)
      if (i === -1) return -1
    } else if (ch === '`') {
      i = closingTick(text, i)
      if (i === -1) return -1
    } else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i
  }
  return -1
}

function closingQuote(text: string, open: number): number {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === text[open]) return i
    else if (text[i] === '\n') return -1
  }
  return -1
}

function closingTick(text: string, open: number): number {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '`') return i
    else if (text[i] === '$' && text[i + 1] === '{') {
      i = closingBrace(text, i + 1)
      if (i === -1) return -1
    }
  }
  return -1
}

const blank = (s: string): string => s.replace(/[^\r\n]/g, 'x')

/** Where a quoted attribute value ends: the closing quote, stepping over any `{...}` inside it. */
function endOfValue(text: string, open: number): number {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === text[open]) return i
    if (text[i] === '{') {
      const end = closingBrace(text, i)
      if (end !== -1) i = end
    }
  }
  return text.length - 1
}

/** Index of the `>` that ends the start tag, stepping over quoted values and `{...}` and masking the latter. Returns [end, masked text so far]. */
function readTag(text: string, from: number, out: string[]): number {
  let i = from
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '>') return i
    if (ch === '"' || ch === "'") {
      const end = endOfValue(text, i)
      out.push(text.slice(i, end + 1))
      i = end + 1
    } else if (ch === '{') {
      const end = closingBrace(text, i)
      if (end === -1) {
        out.push(ch)
        i++
      } else {
        out.push(blank(text.slice(i, end + 1)))
        i = end + 1
      }
    } else {
      out.push(ch)
      i++
    }
  }
  return text.length
}

const RAW_TEXT = new Set(['script', 'style'])

/**
 * Svelte markup with every `{...}` expression replaced by x of the same length, so a `>` or a space inside
 * an attribute expression cannot end the tag or split the attribute for the HTML parser. Script and style
 * bodies, comments and quoted attribute values are left as they are; offsets and lines do not move.
 */
export function maskSvelteExpressions(text: string): string {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i)
      const stop = end === -1 ? text.length : end + 3
      out.push(text.slice(i, stop))
      i = stop
    } else if (ch === '<' && /[a-zA-Z]/.test(text[i + 1] ?? '')) {
      const name = /^[^\s/>]+/.exec(text.slice(i + 1))?.[0] ?? ''
      out.push(text.slice(i, i + 1 + name.length))
      i += 1 + name.length
      const end = readTag(text, i, out)
      i = end
      if (RAW_TEXT.has(name.toLowerCase()) && text[end - 1] !== '/') {
        const close = text.toLowerCase().indexOf(`</${name.toLowerCase()}`, end)
        const stop = close === -1 ? text.length : close
        out.push(text.slice(end, stop))
        i = stop
      }
    } else if (ch === '{') {
      const end = closingBrace(text, i)
      if (end === -1) {
        out.push(ch)
        i++
      } else {
        out.push(blank(text.slice(i, end + 1)))
        i = end + 1
      }
    } else {
      out.push(ch)
      i++
    }
  }
  return out.join('')
}
