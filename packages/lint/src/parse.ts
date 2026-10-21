import { parse as parseBabel, type ParserPlugin } from '@babel/parser'
import { parse as parseHtml, type DefaultTreeAdapterMap } from 'parse5'
import { parse as parseCss } from 'postcss'
import scss from 'postcss-scss'
import type { CssBlock, JsBlock, JsLang, Lang, SourceFile } from './types'

type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']

const BOM = '﻿'

const LANG_BY_EXT: Readonly<Record<string, Lang>> = {
  '.css': 'css', '.scss': 'scss', '.html': 'html', '.htm': 'html', '.vue': 'vue', '.svelte': 'svelte',
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx',
  '.ts': 'ts', '.mts': 'ts', '.cts': 'ts', '.tsx': 'tsx',
}

export function langOf(path: string): Lang | null {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? null : LANG_BY_EXT[path.slice(dot).toLowerCase()] ?? null
}

/** The text every offset refers to: a leading byte order mark is dropped, nothing else changes. */
export const stripBom = (text: string): string => (text.startsWith(BOM) ? text.slice(1) : text)

const PLUGINS: Readonly<Record<JsLang, ParserPlugin[]>> = {
  ts: ['typescript', 'decorators-legacy'],
  tsx: ['typescript', 'jsx', 'decorators-legacy'],
  js: ['jsx'],
  jsx: ['jsx'],
}

/** A `// @flow` or `/* @flow *\/` pragma comment. */
const FLOW_PRAGMA = /(?:\/\/|\/\*|^\s*\*)[ \t]*@flow\b/m

function parseJs(text: string, lang: JsLang, offset: number): JsBlock {
  const run = (plugins: ParserPlugin[]): JsBlock['ast'] =>
    parseBabel(text, { sourceType: 'unambiguous', errorRecovery: false, allowReturnOutsideFunction: true, plugins }) as JsBlock['ast']
  if (lang === 'ts' || lang === 'tsx') return { ast: run(PLUGINS[lang]), offset, lang }
  try {
    return { ast: run(PLUGINS[lang]), offset, lang }
  } catch (err) {
    // A file marked @flow holds Flow types, which only the Flow plugin reads.
    if (FLOW_PRAGMA.test(text)) return { ast: run(['flow', 'jsx']), offset, lang }
    // Plain JS can hold code that JSX reads differently, so a .js file gets one more try without it.
    if (lang === 'js') return { ast: run([]), offset, lang }
    throw err
  }
}

const parseStyle = (text: string, lang: 'css' | 'scss', offset: number): CssBlock =>
  ({ root: lang === 'scss' ? scss.parse(text) : parseCss(text), offset })

const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'text/jsx', 'text/babel'])

function* elements(node: Node): Generator<Element> {
  if ('tagName' in node) yield node
  if ('childNodes' in node) for (const child of node.childNodes) yield* elements(child)
  if ('content' in node) yield* elements(node.content)
}

/** The raw text between an element's start and end tags, and where it starts. */
function inner(el: Element, text: string): { text: string; offset: number } | null {
  const loc = el.sourceCodeLocation
  if (!loc?.startTag || !loc.endTag) return null
  const start = loc.startTag.endOffset
  return { text: text.slice(start, loc.endTag.startOffset), offset: start }
}

const attr = (el: Element, name: string): string =>
  (el.attrs.find((a) => a.name === name)?.value ?? '').trim().toLowerCase()

/** Style languages that are not CSS or SCSS: a component's block in one of these is skipped, not an error. */
const SKIPPED_STYLE_LANGS = new Set(['less', 'stylus', 'styl', 'sass'])

function parseHtmlFile(text: string, component = false): Pick<SourceFile, 'css' | 'js' | 'html'> {
  const html = parseHtml(text, { sourceCodeLocationInfo: true })
  const css: CssBlock[] = []
  const js: JsBlock[] = []
  for (const el of elements(html)) {
    if (el.tagName !== 'style' && el.tagName !== 'script') continue
    const body = inner(el, text)
    if (!body || body.text.trim() === '') continue
    if (el.tagName === 'style') {
      const styleLang = component ? attr(el, 'lang') : ''
      if (SKIPPED_STYLE_LANGS.has(styleLang)) continue
      css.push(parseStyle(body.text, styleLang === 'scss' ? 'scss' : 'css', body.offset))
      continue
    }
    if (component) {
      const scriptLang = attr(el, 'lang')
      js.push(parseJs(body.text, scriptLang === 'tsx' ? 'tsx' : scriptLang === 'ts' ? 'ts' : 'js', body.offset))
      continue
    }
    const type = (el.attrs.find((a) => a.name === 'type')?.value ?? '').trim().toLowerCase()
    if (JS_TYPES.has(type)) js.push(parseJs(body.text, type === 'text/jsx' || type === 'text/babel' ? 'jsx' : 'js', body.offset))
  }
  return { css, js, html }
}

export type ParseOutcome = { file: SourceFile } | { error: string }

/** The first line of a parser's message, without a stack. */
const oneLine = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  return (message.split(/\r?\n/)[0] ?? '').trim() || 'unknown error'
}

/** Parses a file into its blocks. Unknown extensions give an error naming the extension. */
export function parseSourceOutcome(path: string, rawText: string, abs: string = path): ParseOutcome {
  const lang = langOf(path)
  if (!lang) return { error: 'unsupported file type' }
  const text = stripBom(rawText)
  const base = { path, abs, lang, text }
  try {
    if (lang === 'css' || lang === 'scss') return { file: { ...base, css: [parseStyle(text, lang, 0)], js: [], html: null } }
    if (lang === 'html') return { file: { ...base, ...parseHtmlFile(text) } }
    if (lang === 'vue' || lang === 'svelte') return { file: { ...base, ...parseHtmlFile(text, true) } }
    return { file: { ...base, css: [], js: [parseJs(text, lang, 0)], html: null } }
  } catch (err) {
    return { error: oneLine(err) }
  }
}

/** The parsed file, or null when it does not parse. */
export function parseSource(path: string, text: string, abs: string = path): SourceFile | null {
  const outcome = parseSourceOutcome(path, text, abs)
  return 'file' in outcome ? outcome.file : null
}
