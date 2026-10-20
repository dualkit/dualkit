import { describe, expect, it } from 'vitest'
import { RULES } from '../../src/rules'
import { lintText } from '../../src/run'

const ID = 'source/old-rial-sign'
const run = (code: string, path: string) => lintText(path, code, { rules: RULES.filter((r) => r.id === ID) })
const R = '﷼'
const cols = (code: string, path: string) => run(code, path).map((f) => [f.line, f.column])

describe('registration', () => {
  it('is a warning with no em dashes and verified wording', () => {
    const r = RULES.find((x) => x.id === ID)!
    expect(r.severity).toBe('warning')
    expect(`${r.title}${r.why}${r.fix}`).not.toContain('—')
    expect(r.why).toContain('U+FDFC')
    expect(r.fix).toContain('SAR')
  })
})

describe('JS and TS', () => {
  it('fires on a raw sign in a string, pointing at the character', () => {
    expect(cols(`const SIGN = '${R}'`, 'a.ts')).toEqual([[1, 15]])
  })
  it('fires on escapes, pointing at the literal', () => {
    expect(cols("const a = '\\uFDFC'", 'a.ts')).toEqual([[1, 11]])
    expect(cols("const a = '\\u{FDFC}'", 'a.js')).toEqual([[1, 11]])
    expect(cols("const a = '\\ufdfc'", 'a.js')).toEqual([[1, 11]])
  })
  it('fires in a template quasi, once per sign', () => {
    expect(cols(`const a = \`\${n} ${R}\``, 'a.ts')).toEqual([[1, 17]])
    expect(run(`const a = \`${R}\${n}${R}\``, 'a.ts')).toHaveLength(2)
  })
  it('fires in JSX text, attributes and entities', () => {
    expect(cols(`export const A = () => <span>{price} ${R}</span>`, 'a.tsx')).toEqual([[1, 38]])
    expect(cols(`const A = () => <i title="${R}" />`, 'a.jsx')).toEqual([[1, 27]])
    expect(cols('const A = () => <i>&#xFDFC;</i>', 'a.jsx')).toEqual([[1, 20]])
    expect(cols('const A = () => <i title="&#65020;" />', 'a.jsx')).toEqual([[1, 27]])
  })
  it('stays quiet on comments, SAR and the Arabic abbreviation', () => {
    expect(run(`// ${R}\n/* ${R} */\nconst a = 1`, 'a.ts')).toEqual([])
    expect(run("const a = 'SAR'; const b = 'ر.س'", 'a.ts')).toEqual([])
    expect(run(`const A = () => <i>{/* ${R} */}</i>`, 'a.tsx')).toEqual([])
  })
  it('does not read a regex or an escaped backslash sequence', () => {
    expect(run("const a = '\\\\uFDFC'", 'a.ts')).toEqual([])
  })
})

describe('HTML', () => {
  it('fires on text, attribute and entities at their source position', () => {
    expect(cols(`<p>${R}</p>`, 'a.html')).toEqual([[1, 4]])
    expect(cols(`<p title="${R}">x</p>`, 'a.html')).toEqual([[1, 11]])
    expect(cols('<p>1 &#xFDFC;</p>', 'a.html')).toEqual([[1, 6]])
    expect(cols('<p>1 &#xfdfc;</p>', 'a.html')).toEqual([[1, 6]])
    expect(cols('<p>1 &#65020;</p>', 'a.html')).toEqual([[1, 6]])
    expect(cols('<p title=\'&#xFDFC;\'>x</p>', 'a.html')).toEqual([[1, 11]])
    expect(cols(`<p>a</p>\n<p>${R} ${R}</p>`, 'a.html')).toEqual([[2, 4], [2, 6]])
  })
  it('stays quiet on HTML comments, SAR and similar entities', () => {
    expect(run(`<!-- ${R} &#xFDFC; --><p>SAR</p>`, 'a.html')).toEqual([])
    expect(run('<p>&#xFDFD; &#65021;</p>', 'a.html')).toEqual([])
  })
  it('reads inline scripts and styles once', () => {
    expect(cols(`<script>const a = '${R}'</script>`, 'a.html')).toEqual([[1, 20]])
    expect(cols(`<style>a::after { content: "${R}" }</style>`, 'a.html')).toEqual([[1, 29]])
    expect(run(`<script>// ${R}</script>`, 'a.html')).toEqual([])
  })
})

describe('CSS', () => {
  it('fires on a raw sign and CSS escapes in a content string', () => {
    expect(cols(`a::after { content: "${R}" }`, 'a.css')).toEqual([[1, 22]])
    expect(cols('a::after { content: "\\FDFC" }', 'a.css')).toEqual([[1, 22]])
    expect(cols('a::after { content: "\\fdfc " }', 'a.css')).toEqual([[1, 22]])
    expect(cols('a::after { content: "\\0FDFC" }', 'a.scss')).toEqual([[1, 22]])
  })
  it('stays quiet on comments and other escapes', () => {
    expect(run(`/* ${R} \\FDFC */ a { color: red }`, 'a.css')).toEqual([])
    expect(run(`// ${R}\na { color: red }`, 'a.scss')).toEqual([])
    expect(run('a::after { content: "\\FDFD" }', 'a.css')).toEqual([])
    expect(run('a::after { content: "\\FDFC1" }', 'a.css')).toEqual([])
  })
})
