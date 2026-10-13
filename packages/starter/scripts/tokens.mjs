// Reads the Starter's DTCG 2025.10 resolver and writes it out three ways:
// CSS custom properties, a Tailwind v4 theme and Figma variables. Pure apart
// from readResolver, which loads the token files from disk.
import { readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const PREFIX = '--dk-'
const ALIAS = /^\{([^{}]+)\}$/
const EXT = 'dev.dualkit'
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy'])

// Where each modifier's overrides land in CSS. The default context is :root.
const CSS_SELECTORS = {
  theme: { dark: ['@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])', ':root[data-theme="dark"]'] },
  script: { ar: [':lang(ar)'] },
}

// Where a modifier's default comes back inside an override: English text set
// inside an Arabic page gets English type again.
const CSS_RESTORE = {
  script: { ar: ':lang(ar) :not(:lang(ar))' },
}

// Each Figma collection takes one set; its modes come from one modifier.
// Mode names match what figma-render makes from the same resolver, so this
// file and a figma-render import never disagree.
const FIGMA_COLLECTIONS = [
  { name: 'Primitives', set: 'primitives' },
  { name: 'Semantic', set: 'semantic', modifier: 'theme', label: (ctx) => ctx.charAt(0).toUpperCase() + ctx.slice(1) },
  { name: 'Script', set: 'script', modifier: 'script' },
]

const tidy = (n) => Number(n.toFixed(4))
const aliasOf = (value) => (typeof value === 'string' ? value.match(ALIAS)?.[1] : undefined)

// ---------- reading ----------

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`starter: cannot read ${file}: ${err.message}`)
  }
}

const loadSources = (list, dir) => list.map((source) => (source.$ref ? readJson(resolve(dir, source.$ref)) : source))

function mergeMaps(maps) {
  return new Map(maps.flatMap((map) => [...map]))
}

export function readResolver(path) {
  const file = resolve(path)
  const doc = readJson(file)
  const dir = dirname(file)
  const load = (sources = []) => mergeMaps(loadSources(sources, dir).map((tree) => flatten(tree)))
  const sets = Object.fromEntries(Object.entries(doc.sets ?? {}).map(([name, set]) => [name, load(set.sources)]))
  const modifiers = Object.fromEntries(Object.entries(doc.modifiers ?? {}).map(([name, mod]) => [name, {
    default: mod.default,
    contexts: Object.fromEntries(Object.entries(mod.contexts).map(([ctx, sources]) => [ctx, load(sources)])),
  }]))
  const order = (doc.resolutionOrder ?? []).map((entry) => {
    const [, kind, name] = entry.$ref.split('/')
    return { kind, name }
  })
  return { file, sets, modifiers, order }
}

// ---------- flattening ----------

export function flatten(tree, ctx = { segments: [], type: undefined, unit: undefined }) {
  const tokens = Object.entries(tree ?? {})
    .filter(([key, child]) => !key.startsWith('$') && child && typeof child === 'object')
    .flatMap(([key, child]) => {
      const segments = [...ctx.segments, key]
      const type = child.$type ?? ctx.type
      const unit = child.$extensions?.[EXT]?.unit ?? ctx.unit
      if (!('$value' in child)) return [...flatten(child, { segments, type, unit })]
      const path = segments.join('.')
      if (!type) throw new Error(`starter: ${path} has no $type, on itself or a parent group`)
      return [[path, { path, type, value: child.$value, description: child.$description ?? '', ...(unit ? { unit } : {}) }]]
    })
  return new Map(tokens)
}

// ---------- resolving ----------

export function resolveValue(map, path, seen = []) {
  if (seen.includes(path)) throw new Error(`starter: alias cycle: ${[...seen, path].join(' -> ')}`)
  const token = map.get(path)
  const target = aliasOf(token?.value)
  if (!target) return token?.value
  if (!map.has(target)) throw new Error(`starter: ${path} points at ${target}, which does not exist`)
  return resolveValue(map, target, [...seen, path])
}

function contextOf(resolver, choice) {
  return Object.fromEntries(Object.entries(resolver.modifiers).map(([name, mod]) => {
    const ctx = choice[name] ?? mod.default
    if (!(ctx in mod.contexts)) throw new Error(`starter: modifier ${name} has no context ${ctx}`)
    return [name, ctx]
  }))
}

// Later layers win. A modifier override keeps the type of the token it replaces.
export function resolveContext(resolver, choice) {
  const picked = contextOf(resolver, choice)
  const layers = resolver.order.map(({ kind, name }) => (kind === 'sets' ? resolver.sets[name] : resolver.modifiers[name].contexts[picked[name]]))
  return layers.reduce((acc, layer) => new Map([...acc, ...[...layer].map(([path, token]) => [path, { ...acc.get(path), ...token }])]), new Map())
}

// ---------- CSS ----------

const kebab = (segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
export const cssName = (path) => PREFIX + path.split('.').map(kebab).join('-')

function cssColor(value) {
  const alpha = value.alpha ?? 1
  if (alpha === 1) return value.hex
  const [r, g, b] = value.components.map((c) => Math.round(c * 255))
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

const quoteFamily = (family) => (GENERIC_FAMILIES.has(family) ? family : `'${family}'`)

const CSS_VALUE = {
  color: cssColor,
  dimension: (v) => `${v.value}${v.unit}`,
  duration: (v) => `${v.value}${v.unit}`,
  fontFamily: (v) => [v].flat().map(quoteFamily).join(', '),
  fontWeight: (v) => String(v),
  number: (v, token) => `${v}${token.unit ?? ''}`,
  cubicBezier: (v) => `cubic-bezier(${v.join(', ')})`,
}

function cssValue(token) {
  const target = aliasOf(token.value)
  if (target) return `var(${cssName(target)})`
  const format = CSS_VALUE[token.type]
  if (!format) throw new Error(`starter: ${token.path} has type ${token.type}, which has no CSS form`)
  return format(token.value, token)
}

const declarations = (tokens, indent) => tokens.map((t) => `${indent}${cssName(t.path)}: ${cssValue(t)};`).join('\n')

function cssBlock(selector, tokens) {
  const nested = selector.startsWith('@media')
  const close = nested ? '  }\n}' : '}'
  return `${selector} {\n${declarations(tokens, nested ? '    ' : '  ')}\n${close}`
}

function overrideBlocks(resolver) {
  return Object.entries(CSS_SELECTORS).flatMap(([modifier, contexts]) => Object.entries(contexts).flatMap(([ctx, selectors]) => {
    const merged = resolveContext(resolver, { [modifier]: ctx })
    const tokens = [...resolver.modifiers[modifier].contexts[ctx].keys()].map((path) => merged.get(path))
    const blocks = selectors.map((selector) => cssBlock(selector, tokens))
    const restore = CSS_RESTORE[modifier]?.[ctx]
    if (!restore) return blocks
    const base = resolveContext(resolver, {})
    return [...blocks, cssBlock(restore, tokens.map((t) => base.get(t.path)))]
  }))
}

function header(resolver, what) {
  return `/* ${what}. Generated from tokens/${basename(resolver.file)} by scripts/build.mjs. Do not edit by hand. */`
}

export function toCss(resolver) {
  const base = [...resolveContext(resolver, {}).values()]
  return [header(resolver, 'Dualkit Starter tokens'), cssBlock(':root', base), ...overrideBlocks(resolver)].join('\n\n') + '\n'
}

// ---------- Tailwind v4 ----------

// Semantic and script tokens only: components bind roles, never raw ramps.
const TAILWIND_RULES = [
  [/^color\.(.+)$/, (m) => [`--color-${m[1]}`]],
  [/^radius\.(.+)$/, (m) => [`--radius-${m[1]}`]],
  [/^space\.(.+)$/, (m) => [`--spacing-${m[1]}`]],
  [/^motion\.easing\.(.+)$/, (m) => [`--ease-${m[1]}`]],
  [/^type\.([^.]+)\.family$/, (m) => [`--font-${m[1]}`]],
  [/^type\.([^.]+)\.size$/, (m) => [`--text-${m[1]}`]],
  [/^type\.([^.]+)\.leading$/, (m) => [`--text-${m[1]}--line-height`]],
  [/^type\.([^.]+)\.tracking$/, (m) => [`--text-${m[1]}--letter-spacing`]],
  [/^type\.([^.]+)\.weight$/, (m) => [`--text-${m[1]}--font-weight`]],
]

function tailwindNames(path) {
  const dashed = path.split('.').map(kebab).join('.')
  const rule = TAILWIND_RULES.find(([re]) => re.test(dashed))
  return rule ? rule[1](dashed.match(rule[0])).map((name) => name.replaceAll('.', '-')) : []
}

export function toTailwind(resolver) {
  const paths = ['semantic', 'script'].flatMap((set) => [...resolver.sets[set].keys()])
  const lines = paths.flatMap((path) => tailwindNames(path).map((name) => `  ${name}: var(${cssName(path)});`))
  const note = '/* Import tokens.css first. Every utility reads the live custom property, so dark mode and :lang(ar) carry through. */'
  return `${header(resolver, 'Dualkit Starter Tailwind v4 theme')}\n${note}\n@theme inline {\n${lines.join('\n')}\n}\n`
}

// ---------- Figma ----------

function figmaColor(value) {
  const [r, g, b] = value.components
  return { r, g, b, a: value.alpha ?? 1 }
}

const FIGMA_TYPE = {
  color: ['COLOR', figmaColor],
  dimension: ['FLOAT', (v) => v.value],
  duration: ['FLOAT', (v) => v.value],
  fontWeight: ['FLOAT', (v) => v],
  fontFamily: ['STRING', (v) => [v].flat()[0]],
  number: ['FLOAT', (v, token) => (token.unit === 'em' ? tidy(v * 100) : v)],
}

function collectionOfPath(resolver, path) {
  return FIGMA_COLLECTIONS.find((c) => resolver.sets[c.set].has(path))?.name
}

function figmaValue(resolver, map, path) {
  const token = map.get(path)
  const target = aliasOf(token.value)
  if (target) return { type: 'VARIABLE_ALIAS', collection: collectionOfPath(resolver, target), name: target.replaceAll('.', '/') }
  return FIGMA_TYPE[token.type][1](token.value, token)
}

function figmaCollection(resolver, { name, set, modifier, label = (ctx) => ctx }) {
  const contexts = modifier ? Object.keys(resolver.modifiers[modifier].contexts) : [undefined]
  const modes = contexts.map((ctx) => (ctx ? label(ctx) : 'Value'))
  const maps = Object.fromEntries(contexts.map((ctx, i) => [modes[i], resolveContext(resolver, ctx ? { [modifier]: ctx } : {})]))
  const variables = [...resolver.sets[set].values()].filter((t) => FIGMA_TYPE[t.type]).map((token) => ({
    name: token.path.replaceAll('.', '/'),
    type: FIGMA_TYPE[token.type][0],
    description: token.description,
    valuesByMode: Object.fromEntries(modes.map((mode) => [mode, figmaValue(resolver, maps[mode], token.path)])),
  }))
  return { name, modes, variables }
}

export function toFigma(resolver) {
  const skipped = Object.values(resolver.sets).flatMap((set) => [...set.values()]).filter((t) => !FIGMA_TYPE[t.type]).map((t) => t.path).sort()
  return { collections: FIGMA_COLLECTIONS.map((c) => figmaCollection(resolver, c)), skipped }
}

// ---------- build ----------

export function build(resolverPath) {
  const resolver = readResolver(resolverPath)
  return {
    'tokens.css': toCss(resolver),
    'theme.css': toTailwind(resolver),
    'figma-variables.json': JSON.stringify(toFigma(resolver), null, 2) + '\n',
  }
}

export const PACKAGE_ROOT = join(import.meta.dirname, '..')
