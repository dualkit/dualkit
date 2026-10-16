# Rules engine and `dualkit check` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@dualkit/rules` (a screen model, a browser reader and 20 Arabic and RTL rules) and the `dualkit` CLI that audits any page and writes a shareable Gulf-ready report, plus a GitHub Action.

**Architecture:** Rules are pure functions over a normalized `ScreenModel`, so they are fast to unit test and can later run on Figma layers through a second reader. The DOM reader runs inside a real Chromium page (injected as an IIFE bundle) and produces the model. The CLI drives Playwright, runs the reader, scores the findings and renders a self-contained HTML report.

**Tech Stack:** TypeScript 5.9 strict, tsup 8, vitest 3, esbuild (bundled with tsup), Playwright 1.55.0 (Chromium), Node 18+.

**Spec:** `docs/plans/2026-10-16-next-level-design.md`, sections 1 and 2.

## Global Constraints

- Free to use and free to run: no hosted service, no paid API.
- No location anywhere in copy. The maker credit stays "Sam Santos".
- Copy rules: no em dashes, sentence case, plain sentences.
- Node `>=18`. Packages are ESM with CJS where the existing packages do it.
- Workspace packages follow `packages/format`: `tsconfig` strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, vitest, tsup, `prepublishOnly` runs typecheck, test, build.
- New package names: `@dualkit/rules` (library) and `dualkit` (CLI, unscoped, bin `dualkit`). Both start at `0.1.0-beta.0`.
- Playwright is pinned to exactly `1.55.0` in the CLI and the Action so the browser download matches.
- Real counters only: the site test counter is recounted after the suites change.
- Thresholds come from the type-pairing skill: Arabic line height below 1.5 on multi-line text is flagged; Arabic UI text below 14px is flagged.

**Deliberate changes from the spec, decided while planning:**
- "Dates without a time zone" cannot be seen in a rendered page, so `content/placeholder-text` takes its slot.
- "Fixed-direction flex or grid" becomes `layout/arabic-ltr-block` (Arabic laid out left to right), which is what the bug looks like on screen.
- "Synthetic bold or italic" becomes `type/arabic-italic`; synthetic bold cannot be detected from the DOM.
- Report links point at `packages/rules/RULES.md` anchors until the `/patterns` pages exist.
- The Action writes a job summary and, when allowed, a PR comment.

## Review Focus

1. **Cross-origin stylesheets** (CSS from a CDN) cannot be read, so physical-property rules would silently miss them. Expected: the reader counts them and the summary and report say "N stylesheets could not be read". Pinned in Task 8.
2. **Pages that never go network-idle** (polling, analytics, websockets). Expected: the audit finishes, it does not hang. Pinned in Task 10 (wait for `load`, then settle).
3. **Very large pages** with hundreds of findings. Expected: the report stays readable, at most 20 instances per rule with "and N more". Pinned in Task 11.
4. **Hostile page content** in snippets (`</script>`, `<img onerror>`). Expected: the report escapes everything and stays inert. Pinned in Task 11.
5. **Bad user input**: an invalid `exclude` selector, an unknown rule id in `ignore`, a target that is neither a URL nor a file, Chromium not installed. Expected: a clear message and exit code 2, never a stack trace. Pinned in Tasks 8, 10 and 12.

---

## File structure

```
packages/rules/
  package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, README.md, RULES.md (generated)
  src/model.ts          ScreenModel and node types
  src/text.ts           script detection and patterns
  src/rule.ts           Rule, Finding, defineRule, pick
  src/run.ts            runRules, score, docsUrl
  src/docs.ts           renderRulesMarkdown
  src/rules/bidi.ts     4 rules
  src/rules/layout.ts   4 rules
  src/rules/icons.ts    2 rules
  src/rules/type.ts     5 rules
  src/rules/content.ts  5 rules
  src/rules/index.ts    RULES
  src/index.ts          public API
  src/dom/reader.ts     readScreen(document, options): ScreenModel
  src/dom/entry.ts      IIFE entry, sets globalThis.dualkitReader
  test/helpers/model.ts      builders for unit tests
  test/helpers/browser.ts    Chromium + reader bundle for browser tests
  test/fixtures.ts           bad and good HTML per rule
  test/text.test.ts, test/run.test.ts, test/rules/*.test.ts, test/reader.test.ts, test/fixtures.test.ts, test/docs.test.ts
packages/cli/
  package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, README.md
  src/config.ts   loadConfig
  src/target.ts   toUrl
  src/audit.ts    audit
  src/summary.ts  formatSummary
  src/report.ts   renderReport
  src/cli.ts      run(argv, io) and the bin entry
  test/*.test.ts, test/fixtures/page.html
action/action.yml
.github/workflows/ci.yml (modify), .github/workflows/action-selftest.yml (create), .github/workflows/publish.yml (modify)
apps/site/app/docs/page.tsx, apps/site/lib/updates.ts, apps/site/lib/copy.ts, README.md (modify, Task 13)
```

---

### Task 1: Scaffold `@dualkit/rules`, the model and text helpers

**Files:**
- Create: `packages/rules/package.json`, `packages/rules/tsconfig.json`, `packages/rules/tsup.config.ts`, `packages/rules/vitest.config.ts`
- Create: `packages/rules/src/model.ts`, `packages/rules/src/text.ts`
- Test: `packages/rules/test/text.test.ts`

**Interfaces:**
- Produces: all types in `model.ts`; `hasArabic(s)`, `arabicShare(s)`, `firstStrong(s)`, `excerpt(s, n?)`, and the regexes `GROUPED_NUMBER`, `LATIN_TOKEN`, `ENDS_WITH_PUNCTUATION`, `WESTERN_DIGIT`, `ARABIC_INDIC_DIGIT`, `PLACEHOLDER`, `ARABIC_FONT`.

- [ ] **Step 1: Create the package files**

`packages/rules/package.json`:
```json
{
  "name": "@dualkit/rules",
  "version": "0.1.0-beta.0",
  "description": "Rules that catch Arabic and right-to-left bugs in rendered interfaces.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./reader": "./dist/reader.global.js",
    "./package.json": "./package.json"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "RULES.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run typecheck && npm test && npm run build"
  },
  "devDependencies": {
    "@types/node": "^22.20.5",
    "@vitest/coverage-v8": "^3.2.7",
    "esbuild": "^0.25.0",
    "playwright": "1.55.0",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vitest": "^3.2.7"
  },
  "keywords": ["arabic", "rtl", "bidi", "accessibility", "lint", "gulf"],
  "author": "Sam Santos (https://snts.im)",
  "homepage": "https://dualkit.dev",
  "repository": { "type": "git", "url": "git+https://github.com/dualkit/dualkit.git", "directory": "packages/rules" },
  "bugs": { "url": "https://github.com/dualkit/dualkit/issues" },
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=18" }
}
```

`packages/rules/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

`packages/rules/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig([
  { entry: { index: 'src/index.ts' }, format: ['esm', 'cjs'], dts: true, clean: true },
  // The reader runs inside the audited page, so it ships as one self-contained script.
  { entry: { reader: 'src/dom/entry.ts' }, format: ['iife'], minify: true, platform: 'browser' },
])
```

`packages/rules/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The reader runs in Chromium, where v8 coverage cannot see it; its tests are behavioural.
    coverage: { provider: 'v8', include: ['src'], exclude: ['src/dom/**'], thresholds: { lines: 90, branches: 85 } },
  },
})
```

Run: `npm install` at the repo root, then `npx playwright@1.55.0 install chromium`.

- [ ] **Step 2: Write the model types**

`packages/rules/src/model.ts`:
```ts
// A screen, reduced to what the rules need. The DOM reader fills it today; a Figma reader will later.
export type Direction = 'ltr' | 'rtl'
export type Rect = { x: number; y: number; width: number; height: number }

/** Every node carries a selector-like id, a short HTML snippet and where it sits on the page. */
export type NodeRef = { id: string; snippet: string; box: Rect }

export type Font = {
  families: string[]
  size: number
  /** Pixels, or null when the page leaves it as `normal`. */
  lineHeight: number | null
  letterSpacing: number
  style: 'normal' | 'italic' | 'oblique'
  weight: number
}

export type TextRun = NodeRef & {
  text: string
  /** The nearest block ancestor: the bidi paragraph this text belongs to. */
  blockId: string
  blockText: string
  blockDir: Direction
  dir: Direction
  lang: string | null
  /** Inside <bdi>, an element with a dir attribute, or unicode-bidi isolate or plaintext, below its block. */
  isolated: boolean
  isLastInBlock: boolean
  font: Font
  lines: number
}

export type PhysicalDeclaration = { property: string; value: string }

export type LayoutNode = NodeRef & {
  dir: Direction
  textAlign: string
  hasOwnText: boolean
  /** Physical properties the author wrote that render differently on the left and right. */
  physical: PhysicalDeclaration[]
}

export type IconNode = NodeRef & { name: string | null; dir: Direction; mirrored: boolean }

export type FieldKind = 'email' | 'tel' | 'url' | 'number' | 'code' | 'text'
export type FieldNode = NodeRef & { kind: FieldKind; dir: Direction; dirAttr: string | null }

export type ScreenModel = {
  root: { lang: string | null; dir: string | null }
  texts: TextRun[]
  layouts: LayoutNode[]
  icons: IconNode[]
  fields: FieldNode[]
  unreadableStylesheets: number
}
```

- [ ] **Step 3: Write the failing text tests**

`packages/rules/test/text.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  ARABIC_FONT, ARABIC_INDIC_DIGIT, ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, LATIN_TOKEN, PLACEHOLDER, WESTERN_DIGIT,
  arabicShare, excerpt, firstStrong, hasArabic,
} from '../src/text'

describe('script detection', () => {
  it('finds Arabic letters but not Arabic-Indic digits alone', () => {
    expect(hasArabic('مرحبا')).toBe(true)
    expect(hasArabic('hello')).toBe(false)
    expect(arabicShare('١٢٣')).toBe(0)
  })

  it('measures how much of the text is Arabic', () => {
    expect(arabicShare('مرحبا')).toBe(1)
    expect(arabicShare('hello')).toBe(0)
    expect(arabicShare('مرحبا hello')).toBeCloseTo(0.5)
    expect(arabicShare('123 !')).toBe(0)
  })

  it('reads the first strong direction', () => {
    expect(firstStrong('  مرحبا hello')).toBe('rtl')
    expect(firstStrong('123 hello مرحبا')).toBe('ltr')
    expect(firstStrong('١٢٣ ...')).toBeNull()
  })
})

describe('patterns', () => {
  it.each(['050 123 4567', '+971501234567', '٠٥٠ ١٢٣ ٤٥٦٧', '4111 1111 1111 1111'])('flags %s as a number that can reverse', (s) => {
    expect(GROUPED_NUMBER.test(s)).toBe(true)
  })

  it.each(['1,234.50', '050-123-4567', '18/02/2026', 'AED 99'])('leaves %s alone', (s) => {
    expect(GROUPED_NUMBER.test(s)).toBe(false)
  })

  it.each(['hi@example.com', 'https://dualkit.dev/docs', 'www.example.com', 'ORDER-2041', 'AB12'])('flags %s as a Latin token', (s) => {
    expect(LATIN_TOKEN.test(s)).toBe(true)
  })

  it('does not treat ordinary words as tokens', () => {
    expect(LATIN_TOKEN.test('React')).toBe(false)
  })

  it('spots trailing punctuation, digit systems, placeholders and Arabic fonts', () => {
    expect(ENDS_WITH_PUNCTUATION.test('Hello world!')).toBe(true)
    expect(ENDS_WITH_PUNCTUATION.test('Hello world')).toBe(false)
    expect(WESTERN_DIGIT.test('50')).toBe(true)
    expect(ARABIC_INDIC_DIGIT.test('٥٠')).toBe(true)
    expect(ARABIC_INDIC_DIGIT.test('۵۰')).toBe(true)
    expect(PLACEHOLDER.test('Lorem ipsum dolor')).toBe(true)
    expect(PLACEHOLDER.test('لوريم إيبسوم')).toBe(true)
    expect(ARABIC_FONT.test('IBM Plex Sans Arabic')).toBe(true)
    expect(ARABIC_FONT.test('Tajawal')).toBe(true)
    expect(ARABIC_FONT.test('Inter')).toBe(false)
  })

  it('shortens long text for messages', () => {
    expect(excerpt('a'.repeat(60))).toBe(`${'a'.repeat(40)}…`)
    expect(excerpt('short')).toBe('short')
  })
})
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run test/text.test.ts` in `packages/rules`
Expected: FAIL, `Cannot find module '../src/text'`.

- [ ] **Step 5: Write `text.ts`**

`packages/rules/src/text.ts`:
```ts
const ARABIC_CHAR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const ARABIC_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g
const INDIC_CHARS = /[٠-٩۰-۹]/g
const LATIN_CHARS = /[A-Za-zÀ-ɏ]/g
const RTL_STRONG = /[֐-׿؀-ٟ٪-ۯۺ-ࣿיִ-﷿ﹰ-﻿]/
const LTR_STRONG = /[A-Za-zÀ-ɏ]/
const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]'

export const WESTERN_DIGIT = /[0-9]/
export const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/

/** Digit groups split by spaces, or a leading plus: the shapes the bidi algorithm reorders inside RTL text. */
export const GROUPED_NUMBER = new RegExp(`${DIGIT}+(?:[ \\u00A0]+${DIGIT}+)+|\\+${DIGIT}`)
/** Emails, URLs and codes such as ORDER-2041. */
export const LATIN_TOKEN = /[\w.+-]+@[\w-]+\.[\w.]{2,}|https?:\/\/\S+|www\.\S+|\b[A-Z]{2,}[-_]?\d{2,}\b/
export const ENDS_WITH_PUNCTUATION = /[.!?:;,)\]]\s*$/
export const PLACEHOLDER = /lorem ipsum|dolor sit amet|لوريم إيبسوم|هذا النص هو مثال/i
export const ARABIC_FONT =
  /arab|kufi|naskh|cairo|tajawal|almarai|readex|amiri|vazir|alexandria|rubik|geeza|dubai|lateef|scheherazade|harmattan|lalezar|messiri|changa|mada|zain|janna|noto sans arabic|plex sans arabic|segoe ui|system-ui|-apple-system/i

export const hasArabic = (s: string): boolean => {
  const letters = (s.match(ARABIC_CHARS) ?? []).length - (s.match(INDIC_CHARS) ?? []).length
  return letters > 0 && ARABIC_CHAR.test(s)
}

/** Arabic letters as a share of all letters, ignoring digits, spaces and punctuation. */
export function arabicShare(s: string): number {
  const arabic = (s.match(ARABIC_CHARS) ?? []).length - (s.match(INDIC_CHARS) ?? []).length
  const latin = (s.match(LATIN_CHARS) ?? []).length
  return arabic + latin === 0 ? 0 : arabic / (arabic + latin)
}

/** The direction a paragraph of this text would take on its own, from its first strong character. */
export function firstStrong(s: string): 'ltr' | 'rtl' | null {
  for (const ch of s) {
    if (RTL_STRONG.test(ch)) return 'rtl'
    if (LTR_STRONG.test(ch)) return 'ltr'
  }
  return null
}

export const excerpt = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max)}…` : s)
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run test/text.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/rules package-lock.json
git commit -m "feat(rules): screen model and script helpers"
```

---

### Task 2: The rule framework, scoring and test builders

**Files:**
- Create: `packages/rules/src/rule.ts`, `packages/rules/src/run.ts`, `packages/rules/test/helpers/model.ts`
- Test: `packages/rules/test/run.test.ts`

**Interfaces:**
- Consumes: `ScreenModel`, `NodeRef` from Task 1.
- Produces:
  - `type Severity = 'error' | 'warning' | 'note'`, `type Group = 'bidi' | 'layout' | 'icons' | 'type' | 'content'`
  - `type Hit = { node: NodeRef | null; message: string }`
  - `type Rule = { id: string; group: Group; severity: Severity; title: string; why: string; fix: string; check: (m: ScreenModel) => Hit[] }`
  - `type Finding = { rule: string; group: Group; severity: Severity; title: string; message: string; fix: string; docs: string; node: NodeRef | null }`
  - `defineRule(rule: Rule): Rule`, `pick(node: NodeRef): NodeRef`
  - `runRules(model: ScreenModel, options?: { ignore?: readonly string[]; rules?: readonly Rule[] }): Finding[]`
  - `score(findings: readonly Finding[]): number`, `WEIGHT`, `PER_RULE_CAP`, `docsUrl(ruleId: string): string`
  - Test builders: `screen(p?)`, `text(p?)`, `layout(p?)`, `icon(p?)`, `field(p?)`

- [ ] **Step 1: Write the builders used by every rule test**

`packages/rules/test/helpers/model.ts`:
```ts
import type { FieldNode, IconNode, LayoutNode, ScreenModel, TextRun } from '../../src/model'

const base = { id: 'p', snippet: '<p>', box: { x: 0, y: 0, width: 100, height: 20 } }

export const text = (p: Partial<TextRun> = {}): TextRun => ({
  ...base, text: 'مرحبا', blockId: 'p', blockText: p.text ?? 'مرحبا', blockDir: 'rtl', dir: 'rtl', lang: 'ar',
  isolated: false, isLastInBlock: true,
  font: { families: ['IBM Plex Sans Arabic', 'sans-serif'], size: 16, lineHeight: 27, letterSpacing: 0, style: 'normal', weight: 400 },
  lines: 1, ...p,
})
export const layout = (p: Partial<LayoutNode> = {}): LayoutNode => ({ ...base, dir: 'rtl', textAlign: 'start', hasOwnText: true, physical: [], ...p })
export const icon = (p: Partial<IconNode> = {}): IconNode => ({ ...base, name: 'arrow-right', dir: 'rtl', mirrored: false, ...p })
export const field = (p: Partial<FieldNode> = {}): FieldNode => ({ ...base, kind: 'email', dir: 'rtl', dirAttr: null, ...p })
export const screen = (p: Partial<ScreenModel> = {}): ScreenModel => ({
  root: { lang: 'ar', dir: 'rtl' }, texts: [], layouts: [], icons: [], fields: [], unreadableStylesheets: 0, ...p,
})
```

- [ ] **Step 2: Write the failing framework tests**

`packages/rules/test/run.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { defineRule, pick } from '../src/rule'
import { PER_RULE_CAP, WEIGHT, docsUrl, runRules, score } from '../src/run'
import { screen, text } from './helpers/model'

const always = (id: string, severity: 'error' | 'warning' | 'note', hits = 1) =>
  defineRule({ id, group: 'bidi', severity, title: id, why: 'w', fix: 'f', check: () => Array.from({ length: hits }, () => ({ node: null, message: 'm' })) })

describe('runRules', () => {
  it('turns hits into findings with the rule metadata and a docs link', () => {
    const [f] = runRules(screen(), { rules: [always('bidi/x', 'error')] })
    expect(f).toEqual({ rule: 'bidi/x', group: 'bidi', severity: 'error', title: 'bidi/x', message: 'm', fix: 'f', docs: docsUrl('bidi/x'), node: null })
  })

  it('skips ignored rules', () => {
    expect(runRules(screen(), { rules: [always('bidi/x', 'error')], ignore: ['bidi/x'] })).toEqual([])
  })

  it('sorts errors first, then by rule id', () => {
    const out = runRules(screen(), { rules: [always('b/note', 'note'), always('z/err', 'error'), always('a/err', 'error')] })
    expect(out.map((f) => f.rule)).toEqual(['a/err', 'z/err', 'b/note'])
  })
})

describe('score', () => {
  it('starts at 100 and caps how much one rule can cost', () => {
    expect(score([])).toBe(100)
    const many = runRules(screen(), { rules: [always('bidi/x', 'error', 10)] })
    expect(score(many)).toBe(100 - WEIGHT.error * PER_RULE_CAP)
  })

  it('never goes below zero', () => {
    const rules = Array.from({ length: 20 }, (_, i) => always(`r/${i}`, 'error', 3))
    expect(score(runRules(screen(), { rules }))).toBe(0)
  })
})

describe('helpers', () => {
  it('pick keeps only the node reference', () => {
    expect(Object.keys(pick(text()))).toEqual(['id', 'snippet', 'box'])
  })

  it('docsUrl points at the rule anchor in RULES.md', () => {
    expect(docsUrl('bidi/unisolated-number')).toBe('https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#bidi-unisolated-number')
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run test/run.test.ts`
Expected: FAIL, `Cannot find module '../src/rule'`.

- [ ] **Step 4: Write `rule.ts` and `run.ts`**

`packages/rules/src/rule.ts`:
```ts
import type { NodeRef, ScreenModel } from './model'

export type Severity = 'error' | 'warning' | 'note'
export type Group = 'bidi' | 'layout' | 'icons' | 'type' | 'content'
export type Hit = { node: NodeRef | null; message: string }

export type Rule = {
  id: string
  group: Group
  severity: Severity
  title: string
  /** One sentence on what goes wrong for the person using the screen. */
  why: string
  /** One sentence on the fix. */
  fix: string
  check: (model: ScreenModel) => Hit[]
}

export type Finding = {
  rule: string
  group: Group
  severity: Severity
  title: string
  message: string
  fix: string
  docs: string
  node: NodeRef | null
}

export const defineRule = (rule: Rule): Rule => rule

/** Findings carry only the reference, not the whole text run or layout node. */
export const pick = ({ id, snippet, box }: NodeRef): NodeRef => ({ id, snippet, box })
```

`packages/rules/src/run.ts`:
```ts
import type { ScreenModel } from './model'
import type { Finding, Rule, Severity } from './rule'
import { RULES } from './rules'

export const WEIGHT: Record<Severity, number> = { error: 10, warning: 4, note: 1 }
/** One rule repeated across a page costs at most three instances, so one habit cannot zero the score. */
export const PER_RULE_CAP = 3
const ORDER: Record<Severity, number> = { error: 0, warning: 1, note: 2 }

export const docsUrl = (ruleId: string): string =>
  `https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#${ruleId.replace(/[^a-z0-9]+/g, '-')}`

export function runRules(model: ScreenModel, options: { ignore?: readonly string[]; rules?: readonly Rule[] } = {}): Finding[] {
  const ignore = new Set(options.ignore ?? [])
  return (options.rules ?? RULES)
    .filter((rule) => !ignore.has(rule.id))
    .flatMap((rule) =>
      rule.check(model).map((hit) => ({
        rule: rule.id, group: rule.group, severity: rule.severity, title: rule.title,
        message: hit.message, fix: rule.fix, docs: docsUrl(rule.id), node: hit.node,
      })),
    )
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.rule.localeCompare(b.rule))
}

export function score(findings: readonly Finding[]): number {
  const counts = new Map<string, { n: number; weight: number }>()
  for (const f of findings) {
    const c = counts.get(f.rule) ?? { n: 0, weight: WEIGHT[f.severity] }
    counts.set(f.rule, { ...c, n: c.n + 1 })
  }
  let lost = 0
  for (const c of counts.values()) lost += c.weight * Math.min(c.n, PER_RULE_CAP)
  return Math.max(0, 100 - lost)
}
```

Create a temporary `packages/rules/src/rules/index.ts` so the import resolves (Task 7 fills it):
```ts
import type { Rule } from '../rule'

export const RULES: readonly Rule[] = []
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/run.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/rules
git commit -m "feat(rules): rule framework, findings and scoring"
```

---

### Task 3: The four bidi rules

**Files:**
- Create: `packages/rules/src/rules/bidi.ts`
- Test: `packages/rules/test/rules/bidi.test.ts`

**Interfaces:**
- Consumes: `defineRule`, `pick` (Task 2); `GROUPED_NUMBER`, `LATIN_TOKEN`, `ENDS_WITH_PUNCTUATION`, `excerpt`, `firstStrong` (Task 1).
- Produces: `bidiRules: Rule[]` with ids `bidi/unisolated-number`, `bidi/unisolated-latin`, `bidi/punctuation-flip`, `bidi/field-direction`.

- [ ] **Step 1: Write the failing tests**

`packages/rules/test/rules/bidi.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { bidiRules } from '../../src/rules/bidi'
import { runRules } from '../../src/run'
import { field, screen, text } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: bidiRules }).map((f) => f.rule)

describe('bidi/unisolated-number', () => {
  it('flags a spaced phone number in RTL text', () => {
    expect(ids(screen({ texts: [text({ text: 'الهاتف 050 123 4567' })] }))).toEqual(['bidi/unisolated-number'])
  })
  it('passes when it is isolated or the paragraph is LTR', () => {
    expect(ids(screen({ texts: [text({ text: '050 123 4567', isolated: true })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: '050 123 4567', blockText: 'Phone 050 123 4567', blockDir: 'ltr' })] }))).toEqual([])
  })
})

describe('bidi/unisolated-latin', () => {
  it('flags an email inside Arabic', () => {
    expect(ids(screen({ texts: [text({ text: 'راسلنا على hi@example.com', blockText: 'راسلنا على hi@example.com' })] }))).toContain('bidi/unisolated-latin')
  })
  it('passes when isolated', () => {
    expect(ids(screen({ texts: [text({ text: 'hi@example.com', isolated: true })] }))).toEqual([])
  })
})

describe('bidi/punctuation-flip', () => {
  it('flags English ending in punctuation inside an RTL block', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello world!', blockText: 'Hello world!' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('flags Arabic ending in punctuation inside an LTR block', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!', blockDir: 'ltr' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('passes when the text matches its block, or is not last', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!' })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: 'Hi!', blockText: 'Hi! مرحبا', isLastInBlock: false })] }))).toEqual([])
  })
})

describe('bidi/field-direction', () => {
  it('flags an email field that inherits RTL', () => {
    expect(ids(screen({ fields: [field()] }))).toEqual(['bidi/field-direction'])
  })
  it('passes with a dir attribute, LTR direction, or a free-text field', () => {
    expect(ids(screen({ fields: [field({ dirAttr: 'auto' }), field({ dir: 'ltr' }), field({ kind: 'text' })] }))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/rules/bidi.test.ts`
Expected: FAIL, `Cannot find module '../../src/rules/bidi'`.

- [ ] **Step 3: Write `bidi.ts`**

`packages/rules/src/rules/bidi.ts`:
```ts
import { defineRule, pick } from '../rule'
import { ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, LATIN_TOKEN, excerpt, firstStrong } from '../text'

export const unisolatedNumber = defineRule({
  id: 'bidi/unisolated-number', group: 'bidi', severity: 'error',
  title: 'A number that will show in reverse',
  why: 'Inside right-to-left text the bidi algorithm reorders digit groups split by spaces, so 050 123 4567 shows as 4567 123 050.',
  fix: 'Wrap the number in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated && GROUPED_NUMBER.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is not isolated, so its groups can show in reverse order.` })),
})

export const unisolatedLatin = defineRule({
  id: 'bidi/unisolated-latin', group: 'bidi', severity: 'error',
  title: 'An email, link or code that will scramble',
  why: 'Punctuation inside emails, URLs and codes takes the direction of the Arabic around it, so dots and slashes jump to the wrong end.',
  fix: 'Wrap it in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated && LATIN_TOKEN.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" sits in right-to-left text without isolation.` })),
})

export const punctuationFlip = defineRule({
  id: 'bidi/punctuation-flip', group: 'bidi', severity: 'warning',
  title: 'Punctuation at the wrong end',
  why: 'When a paragraph runs in the opposite direction to its words, the closing mark shows at the start: "Hello world!" becomes "!Hello world".',
  fix: 'Give the block the direction of its own text, with dir="ltr", dir="rtl" or dir="auto".',
  check: (m) => m.texts
    .filter((t) => {
      if (!t.isLastInBlock || t.isolated || !ENDS_WITH_PUNCTUATION.test(t.blockText)) return false
      const natural = firstStrong(t.blockText)
      return natural !== null && natural !== t.blockDir
    })
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.blockText)}" runs ${t.blockDir === 'rtl' ? 'right to left' : 'left to right'}, so its last mark moves to the start.` })),
})

export const fieldDirection = defineRule({
  id: 'bidi/field-direction', group: 'bidi', severity: 'warning',
  title: 'A left-to-right field typed right to left',
  why: 'Emails, phone numbers, links and codes typed into a right-to-left field jump around as each character lands.',
  fix: 'Add dir="ltr" to the input, or dir="auto" if people may type Arabic too.',
  check: (m) => m.fields
    .filter((f) => f.kind !== 'text' && f.dir === 'rtl' && f.dirAttr === null)
    .map((f) => ({ node: pick(f), message: `This ${f.kind} field inherits right to left.` })),
})

export const bidiRules = [unisolatedNumber, unisolatedLatin, punctuationFlip, fieldDirection]
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/rules/bidi.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/rules/bidi.ts packages/rules/test/rules/bidi.test.ts
git commit -m "feat(rules): bidi rules"
```

---

### Task 4: The four layout rules

**Files:**
- Create: `packages/rules/src/rules/layout.ts`
- Test: `packages/rules/test/rules/layout.test.ts`

**Interfaces:**
- Consumes: `defineRule`, `pick`, `arabicShare`, `excerpt`.
- Produces: `layoutRules: Rule[]` with ids `layout/physical-spacing`, `layout/physical-inset`, `layout/text-align-left`, `layout/arabic-ltr-block`.

- [ ] **Step 1: Write the failing tests**

`packages/rules/test/rules/layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { layoutRules } from '../../src/rules/layout'
import { runRules } from '../../src/run'
import { layout, screen, text } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: layoutRules }).map((f) => f.rule)

describe('physical properties', () => {
  it('flags margin-left in RTL once per element', () => {
    const l = layout({ physical: [{ property: 'margin-left', value: '16px' }, { property: 'padding-right', value: '8px' }] })
    expect(ids(screen({ layouts: [l] }))).toEqual(['layout/physical-spacing'])
  })
  it('flags left, float and border sides as insets', () => {
    expect(ids(screen({ layouts: [layout({ physical: [{ property: 'left', value: '8px' }] })] }))).toEqual(['layout/physical-inset'])
  })
  it('ignores LTR elements', () => {
    expect(ids(screen({ layouts: [layout({ dir: 'ltr', physical: [{ property: 'margin-left', value: '16px' }] })] }))).toEqual([])
  })
})

describe('layout/text-align-left', () => {
  it('flags text-align left on RTL text', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'left' })] }))).toEqual(['layout/text-align-left'])
  })
  it('passes start, right, or elements without text', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'start' }), layout({ textAlign: 'right' }), layout({ textAlign: 'left', hasOwnText: false })] }))).toEqual([])
  })
})

describe('layout/arabic-ltr-block', () => {
  it('flags an Arabic paragraph laid out left to right, once per block', () => {
    const t = { text: 'مرحبا بكم', blockText: 'مرحبا بكم في المتجر', blockDir: 'ltr' as const, blockId: 'b1' }
    expect(ids(screen({ texts: [text(t), text(t)] }))).toEqual(['layout/arabic-ltr-block'])
  })
  it('passes mostly-English LTR blocks', () => {
    expect(ids(screen({ texts: [text({ text: 'Welcome مرحبا to the shop', blockText: 'Welcome مرحبا to the shop', blockDir: 'ltr' })] }))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/rules/layout.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `layout.ts`**

`packages/rules/src/rules/layout.ts`:
```ts
import type { LayoutNode } from '../model'
import { defineRule, pick, type Hit } from '../rule'
import { arabicShare, excerpt } from '../text'

const SPACING = /^(margin|padding)-(left|right)$/

const firstPhysical = (layouts: LayoutNode[], match: (property: string) => boolean): Hit[] =>
  layouts
    .filter((l) => l.dir === 'rtl')
    .flatMap((l) => {
      const p = l.physical.find((d) => match(d.property))
      return p ? [{ node: pick(l), message: `${p.property}: ${p.value} stays on the same side in Arabic.` }] : []
    })

export const physicalSpacing = defineRule({
  id: 'layout/physical-spacing', group: 'layout', severity: 'warning',
  title: 'Spacing that does not mirror',
  why: 'margin-left and padding-right stay put when the layout flips, so gaps end up on the wrong side.',
  fix: 'Use margin-inline-start, padding-inline-end and the other logical properties.',
  check: (m) => firstPhysical(m.layouts, (p) => SPACING.test(p)),
})

export const physicalInset = defineRule({
  id: 'layout/physical-inset', group: 'layout', severity: 'warning',
  title: 'Position, float or border that does not mirror',
  why: 'left, right, float and one-sided borders or corners stay on the same side when the layout flips.',
  fix: 'Use inset-inline-start, float: inline-start, border-inline-start and border-start-start-radius.',
  check: (m) => firstPhysical(m.layouts, (p) => !SPACING.test(p)),
})

export const textAlignLeft = defineRule({
  id: 'layout/text-align-left', group: 'layout', severity: 'error',
  title: 'Arabic text forced to the left',
  why: 'text-align: left pins right-to-left text to the wrong edge.',
  fix: 'Use text-align: start.',
  check: (m) => m.layouts
    .filter((l) => l.dir === 'rtl' && l.hasOwnText && l.textAlign === 'left')
    .map((l) => ({ node: pick(l), message: 'This right-to-left text is aligned left.' })),
})

export const arabicLtrBlock = defineRule({
  id: 'layout/arabic-ltr-block', group: 'layout', severity: 'error',
  title: 'Arabic laid out left to right',
  why: 'A mostly Arabic paragraph in a left-to-right box starts on the wrong side and puts its punctuation at the wrong end.',
  fix: 'Set dir="rtl" on the page or the element, and lang="ar".',
  check: (m) => {
    const seen = new Set<string>()
    return m.texts
      .filter((t) => t.blockDir === 'ltr' && arabicShare(t.blockText) > 0.5 && !seen.has(t.blockId) && Boolean(seen.add(t.blockId)))
      .map((t) => ({ node: pick(t), message: `"${excerpt(t.blockText)}" is laid out left to right.` }))
  },
})

export const layoutRules = [physicalSpacing, physicalInset, textAlignLeft, arabicLtrBlock]
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/rules/layout.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/rules/layout.ts packages/rules/test/rules/layout.test.ts
git commit -m "feat(rules): layout rules"
```

---

### Task 5: The two icon rules

**Files:**
- Create: `packages/rules/src/rules/icons.ts`
- Test: `packages/rules/test/rules/icons.test.ts`

**Interfaces:**
- Produces: `iconRules: Rule[]` with ids `icons/not-mirrored`, `icons/mirrored-by-mistake`; exported regexes `DIRECTIONAL_ICON`, `NEVER_MIRROR_ICON`.

- [ ] **Step 1: Write the failing tests**

`packages/rules/test/rules/icons.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { iconRules } from '../../src/rules/icons'
import { runRules } from '../../src/run'
import { icon, screen } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: iconRules }).map((f) => f.rule)

describe('icons/not-mirrored', () => {
  it.each(['arrow-right', 'chevron-left', 'lucide-chevron-right', 'back', 'send', 'caret_left'])('flags %s in RTL when not mirrored', (name) => {
    expect(ids(screen({ icons: [icon({ name })] }))).toEqual(['icons/not-mirrored'])
  })
  it('passes mirrored icons, LTR icons, unnamed and non-directional icons', () => {
    expect(ids(screen({ icons: [icon({ mirrored: true }), icon({ dir: 'ltr' }), icon({ name: null }), icon({ name: 'search' })] }))).toEqual([])
  })
})

describe('icons/mirrored-by-mistake', () => {
  it.each(['play', 'check', 'clock', 'brand-logo', 'help'])('flags a mirrored %s', (name) => {
    expect(ids(screen({ icons: [icon({ name, mirrored: true })] }))).toEqual(['icons/mirrored-by-mistake'])
  })
  it('does not confuse playlist or checkout with play and check', () => {
    expect(ids(screen({ icons: [icon({ name: 'playlist', mirrored: true }), icon({ name: 'checkout', mirrored: true })] }))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/rules/icons.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `icons.ts`**

`packages/rules/src/rules/icons.ts`:
```ts
import { defineRule, pick } from '../rule'

export const DIRECTIONAL_ICON =
  /(arrow|chevron|caret|angle|triangle)[-_ ]?(left|right|back|forward|start|end)|(^|[-_ ])(back|forward|next|prev|previous|reply|send|undo|redo)([-_ ]|$)/i
export const NEVER_MIRROR_ICON = /(^|[-_ ])(play|pause|check|checkmark|tick|clock|logo|brand|help|question)([-_ ]|$)/i

export const notMirrored = defineRule({
  id: 'icons/not-mirrored', group: 'icons', severity: 'warning',
  title: 'A direction icon that points the wrong way',
  why: 'Back, forward and chevron icons describe reading order, so in Arabic they must point the other way.',
  fix: 'Mirror it in RTL with a :dir(rtl) { transform: scaleX(-1) } rule, or swap to the opposite icon.',
  check: (m) => m.icons
    .filter((i) => i.dir === 'rtl' && !i.mirrored && i.name !== null && DIRECTIONAL_ICON.test(i.name))
    .map((i) => ({ node: pick(i), message: `"${i.name}" is not mirrored in right-to-left. Check it points the way the reader moves.` })),
})

export const mirroredByMistake = defineRule({
  id: 'icons/mirrored-by-mistake', group: 'icons', severity: 'error',
  title: 'An icon that must never mirror',
  why: 'Play, check marks, clocks and logos mean the same thing in every language, and flipped they look wrong.',
  fix: 'Remove the flip from this icon.',
  check: (m) => m.icons
    .filter((i) => i.mirrored && i.name !== null && NEVER_MIRROR_ICON.test(i.name))
    .map((i) => ({ node: pick(i), message: `"${i.name}" is mirrored.` })),
})

export const iconRules = [notMirrored, mirroredByMistake]
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/rules/icons.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/rules/icons.ts packages/rules/test/rules/icons.test.ts
git commit -m "feat(rules): icon rules"
```

---

### Task 6: The five type rules

**Files:**
- Create: `packages/rules/src/rules/type.ts`
- Test: `packages/rules/test/rules/type.test.ts`

**Interfaces:**
- Produces: `typeRules: Rule[]` with ids `type/arabic-leading`, `type/arabic-tracking`, `type/arabic-italic`, `type/arabic-font`, `type/arabic-size`; constants `MIN_ARABIC_LEADING = 1.5`, `MIN_ARABIC_SIZE = 14`.

- [ ] **Step 1: Write the failing tests**

`packages/rules/test/rules/type.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { typeRules } from '../../src/rules/type'
import { runRules } from '../../src/run'
import { screen, text } from '../helpers/model'

const font = text().font
const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: typeRules }).map((f) => f.rule)

describe('type rules', () => {
  it('passes well-set Arabic', () => {
    expect(ids(screen({ texts: [text()] }))).toEqual([])
  })
  it('flags tight leading only on multi-line Arabic', () => {
    expect(ids(screen({ texts: [text({ lines: 3, font: { ...font, lineHeight: 19 } })] }))).toEqual(['type/arabic-leading'])
    expect(ids(screen({ texts: [text({ lines: 1, font: { ...font, lineHeight: 19 } })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ lines: 3, font: { ...font, lineHeight: null } })] }))).toEqual([])
  })
  it('flags letter-spacing, italics and small sizes', () => {
    expect(ids(screen({ texts: [text({ font: { ...font, letterSpacing: 1.6 } })] }))).toEqual(['type/arabic-tracking'])
    expect(ids(screen({ texts: [text({ font: { ...font, style: 'italic' } })] }))).toEqual(['type/arabic-italic'])
    expect(ids(screen({ texts: [text({ font: { ...font, size: 12 } })] }))).toEqual(['type/arabic-size'])
  })
  it('flags a font stack with no Arabic face, once per stack', () => {
    const latin = { ...font, families: ['Inter', 'sans-serif'] }
    expect(ids(screen({ texts: [text({ font: latin }), text({ font: latin })] }))).toEqual(['type/arabic-font'])
  })
  it('ignores Latin text', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello', font: { ...font, size: 11, letterSpacing: 2, style: 'italic', families: ['Inter'] } })] }))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/rules/type.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `type.ts`**

`packages/rules/src/rules/type.ts`:
```ts
import type { ScreenModel } from '../model'
import { defineRule, pick } from '../rule'
import { ARABIC_FONT, excerpt, hasArabic } from '../text'

export const MIN_ARABIC_LEADING = 1.5
export const MIN_ARABIC_SIZE = 14

const arabicRuns = (m: ScreenModel) => m.texts.filter((t) => hasArabic(t.text))

export const arabicLeading = defineRule({
  id: 'type/arabic-leading', group: 'type', severity: 'warning',
  title: 'Arabic lines set too tight',
  why: 'Arabic has tall ascenders, deep descenders and dots, which clip or collide at Latin line heights.',
  fix: 'Give Arabic body text a line height of about 1.6 to 1.8, for example :lang(ar) { line-height: 1.7 }.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.lineHeight !== null && t.lines >= 2 && t.font.lineHeight / t.font.size < MIN_ARABIC_LEADING)
    .map((t) => ({ node: pick(t), message: `Line height is ${((t.font.lineHeight ?? 0) / t.font.size).toFixed(2)} on "${excerpt(t.text)}".` })),
})

export const arabicTracking = defineRule({
  id: 'type/arabic-tracking', group: 'type', severity: 'error',
  title: 'Letter-spacing on Arabic',
  why: 'Arabic letters join, and letter-spacing pulls the joins apart.',
  fix: 'Set letter-spacing: 0 on Arabic, for example :lang(ar) { letter-spacing: 0 }.',
  check: (m) => arabicRuns(m)
    .filter((t) => Math.abs(t.font.letterSpacing) > 0.01)
    .map((t) => ({ node: pick(t), message: `${t.font.letterSpacing}px letter-spacing on "${excerpt(t.text)}".` })),
})

export const arabicItalic = defineRule({
  id: 'type/arabic-italic', group: 'type', severity: 'warning',
  title: 'Slanted Arabic',
  why: 'Arabic has no italic, so the browser slants the letters, which reads as broken.',
  fix: 'Set font-style: normal on Arabic and use weight or colour for emphasis.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.style !== 'normal')
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is set in ${t.font.style}.` })),
})

export const arabicFont = defineRule({
  id: 'type/arabic-font', group: 'type', severity: 'warning',
  title: 'No Arabic font in the stack',
  why: 'With no Arabic face listed, every device falls back to its own font, so the design looks different everywhere.',
  fix: 'Add an Arabic family to the font stack, for example "IBM Plex Sans Arabic".',
  check: (m) => {
    const seen = new Set<string>()
    return arabicRuns(m)
      .filter((t) => {
        const key = t.font.families.join(',')
        if (seen.has(key) || t.font.families.some((f) => ARABIC_FONT.test(f))) return false
        seen.add(key)
        return true
      })
      .map((t) => ({ node: pick(t), message: `Arabic falls back from ${t.font.families.join(', ')}.` }))
  },
})

export const arabicSize = defineRule({
  id: 'type/arabic-size', group: 'type', severity: 'warning',
  title: 'Arabic set too small',
  why: 'At the same pixel size Arabic reads smaller than Latin, and its dots blur below 14px.',
  fix: 'Keep Arabic UI text at 14px or more, and body text at 16px.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.size < MIN_ARABIC_SIZE)
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is ${t.font.size}px.` })),
})

export const typeRules = [arabicLeading, arabicTracking, arabicItalic, arabicFont, arabicSize]
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/rules/type.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/rules/type.ts packages/rules/test/rules/type.test.ts
git commit -m "feat(rules): type rules"
```

---

### Task 7: The five content rules, `RULES`, the public API and RULES.md

**Files:**
- Create: `packages/rules/src/rules/content.ts`, `packages/rules/src/docs.ts`, `packages/rules/src/index.ts`
- Modify: `packages/rules/src/rules/index.ts` (replace the placeholder from Task 2)
- Test: `packages/rules/test/rules/content.test.ts`, `packages/rules/test/docs.test.ts`
- Generate: `packages/rules/RULES.md`

**Interfaces:**
- Produces: `contentRules`; `RULES` (20 rules); `renderRulesMarkdown(rules: readonly Rule[]): string`; package exports `RULES`, `runRules`, `score`, `docsUrl`, `WEIGHT`, `PER_RULE_CAP`, and all types.

- [ ] **Step 1: Write the failing tests**

`packages/rules/test/rules/content.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { contentRules } from '../../src/rules/content'
import { RULES } from '../../src/rules'
import { runRules } from '../../src/run'
import { screen, text } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: contentRules }).map((f) => f.rule)

describe('content rules', () => {
  it('passes a tagged Arabic page', () => {
    expect(ids(screen({ texts: [text()] }))).toEqual([])
  })
  it('flags a page with no lang', () => {
    expect(ids(screen({ root: { lang: null, dir: 'rtl' } }))).toEqual(['content/missing-lang'])
  })
  it('flags an Arabic page with no dir="rtl"', () => {
    expect(ids(screen({ root: { lang: 'ar', dir: null }, texts: [text()] }))).toEqual(['content/missing-dir'])
  })
  it('flags Arabic text tagged as another language', () => {
    expect(ids(screen({ texts: [text({ lang: 'en' })] }))).toEqual(['content/lang-mismatch'])
  })
  it('flags the minority digit system when both appear in Arabic', () => {
    const out = runRules(screen({ texts: [text({ text: 'المبلغ 50', blockText: 'المبلغ 50' }), text({ text: 'المبلغ 60', blockText: 'المبلغ 60' }), text({ text: 'المبلغ ٥٠', blockText: 'المبلغ ٥٠' })] }), { rules: contentRules })
    expect(out.map((f) => f.rule)).toEqual(['content/mixed-digits'])
    expect(out[0]?.message).toContain('٥٠')
  })
  it('flags placeholder text', () => {
    expect(ids(screen({ texts: [text({ text: 'لوريم إيبسوم دولور' })] }))).toEqual(['content/placeholder-text'])
  })
})

describe('RULES', () => {
  it('ships twenty rules with unique ids, in five groups', () => {
    expect(RULES).toHaveLength(20)
    expect(new Set(RULES.map((r) => r.id)).size).toBe(20)
    expect(new Set(RULES.map((r) => r.group))).toEqual(new Set(['bidi', 'layout', 'icons', 'type', 'content']))
  })
  it('gives every rule a why and a fix with no em dash', () => {
    for (const r of RULES) {
      expect(r.why.length, r.id).toBeGreaterThan(20)
      expect(r.fix.length, r.id).toBeGreaterThan(10)
      expect(`${r.title}${r.why}${r.fix}`, r.id).not.toMatch(/—/)
    }
  })
})
```

`packages/rules/test/docs.test.ts`:
```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderRulesMarkdown } from '../src/docs'
import { RULES } from '../src/rules'

const FILE = new URL('../RULES.md', import.meta.url)

describe('RULES.md', () => {
  it('matches the rules in code', () => {
    const expected = renderRulesMarkdown(RULES)
    if (process.env.UPDATE_RULES_MD) writeFileSync(FILE, expected)
    expect(readFileSync(FILE, 'utf8')).toBe(expected)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/rules/content.test.ts test/docs.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `content.ts`, the rule index, `docs.ts` and `index.ts`**

`packages/rules/src/rules/content.ts`:
```ts
import { defineRule, pick } from '../rule'
import { ARABIC_INDIC_DIGIT, PLACEHOLDER, WESTERN_DIGIT, arabicShare, excerpt, hasArabic } from '../text'

export const missingLang = defineRule({
  id: 'content/missing-lang', group: 'content', severity: 'error',
  title: 'No page language',
  why: 'Without lang on <html>, screen readers guess the language and browsers pick the wrong fonts and line breaks.',
  fix: 'Add lang="ar" or lang="en" to <html>.',
  check: (m) => (m.root.lang ? [] : [{ node: null, message: 'The page has no lang attribute.' }]),
})

export const missingDir = defineRule({
  id: 'content/missing-dir', group: 'content', severity: 'error',
  title: 'An Arabic page without dir="rtl"',
  why: 'The page is mostly Arabic but the document still runs left to right, so the whole layout starts on the wrong side.',
  fix: 'Set dir="rtl" on <html> whenever lang is Arabic.',
  check: (m) => {
    const share = arabicShare(m.texts.map((t) => t.text).join(' '))
    return share > 0.3 && m.root.dir !== 'rtl' ? [{ node: null, message: `${Math.round(share * 100)}% of the text is Arabic, but <html> has no dir="rtl".` }] : []
  },
})

export const langMismatch = defineRule({
  id: 'content/lang-mismatch', group: 'content', severity: 'warning',
  title: 'Arabic tagged as another language',
  why: 'Screen readers read this Arabic with the wrong voice.',
  fix: 'Put lang="ar" on the element that holds the Arabic.',
  check: (m) => m.texts
    .filter((t) => arabicShare(t.text) > 0.5 && !(t.lang ?? '').toLowerCase().startsWith('ar'))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is tagged ${t.lang ?? 'with no language'}.` })),
})

export const mixedDigits = defineRule({
  id: 'content/mixed-digits', group: 'content', severity: 'warning',
  title: 'Two digit systems on one screen',
  why: 'Mixing 50 and ٥٠ in the same Arabic interface looks unfinished and makes numbers harder to compare.',
  fix: 'Pick one digit system for the product and format every number with it.',
  check: (m) => {
    const inArabic = m.texts.filter((t) => hasArabic(t.blockText))
    const western = inArabic.filter((t) => WESTERN_DIGIT.test(t.text))
    const indic = inArabic.filter((t) => ARABIC_INDIC_DIGIT.test(t.text))
    if (western.length === 0 || indic.length === 0) return []
    const minority = indic.length <= western.length ? indic : western
    return minority.map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" uses a different digit system from the rest of the screen.` }))
  },
})

export const placeholderText = defineRule({
  id: 'content/placeholder-text', group: 'content', severity: 'warning',
  title: 'Placeholder text left in',
  why: 'Lorem ipsum, in Latin or Arabic, hides how real copy will wrap and reads as unfinished.',
  fix: 'Replace it with real copy, or realistic Gulf sample data.',
  check: (m) => m.texts
    .filter((t) => PLACEHOLDER.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is placeholder text.` })),
})

export const contentRules = [missingLang, missingDir, langMismatch, mixedDigits, placeholderText]
```

`packages/rules/src/rules/index.ts`:
```ts
import type { Rule } from '../rule'
import { bidiRules } from './bidi'
import { contentRules } from './content'
import { iconRules } from './icons'
import { layoutRules } from './layout'
import { typeRules } from './type'

export const RULES: readonly Rule[] = [...bidiRules, ...layoutRules, ...iconRules, ...typeRules, ...contentRules]
```

`packages/rules/src/docs.ts`:
```ts
import type { Rule } from './rule'

const GROUP_TITLE = { bidi: 'Bidi', layout: 'Layout', icons: 'Icons', type: 'Type', content: 'Content' } as const

/** RULES.md, generated from the rules so the docs never drift. Run UPDATE_RULES_MD=1 npm test to refresh. */
export function renderRulesMarkdown(rules: readonly Rule[]): string {
  const lines = ['# Dualkit rules', '', 'Generated from `src/rules`. Each rule runs on the rendered page.', '']
  for (const group of Object.keys(GROUP_TITLE) as (keyof typeof GROUP_TITLE)[]) {
    lines.push(`## ${GROUP_TITLE[group]}`, '')
    for (const r of rules.filter((x) => x.group === group)) {
      lines.push(`<a id="${r.id.replace(/[^a-z0-9]+/g, '-')}"></a>`, `### \`${r.id}\` ${r.title}`, '', `**${r.severity}.** ${r.why}`, '', `**Fix:** ${r.fix}`, '')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}
```

`packages/rules/src/index.ts`:
```ts
export type { Direction, FieldKind, FieldNode, Font, IconNode, LayoutNode, NodeRef, PhysicalDeclaration, Rect, ScreenModel, TextRun } from './model'
export type { Finding, Group, Hit, Rule, Severity } from './rule'
export { RULES } from './rules'
export { PER_RULE_CAP, WEIGHT, docsUrl, runRules, score } from './run'
export { renderRulesMarkdown } from './docs'
```

- [ ] **Step 4: Generate RULES.md and run the tests**

Run: `UPDATE_RULES_MD=1 npx vitest run test/docs.test.ts && npx vitest run`
Expected: PASS for every file so far. `RULES.md` exists with 20 rule headings.

- [ ] **Step 5: Commit**

```bash
git add packages/rules
git commit -m "feat(rules): content rules, the full rule set and RULES.md"
```

---

### Task 8: The DOM reader and its browser tests

**Files:**
- Create: `packages/rules/src/dom/reader.ts`, `packages/rules/src/dom/entry.ts`, `packages/rules/test/helpers/browser.ts`
- Test: `packages/rules/test/reader.test.ts`

**Interfaces:**
- Consumes: model types (Task 1).
- Produces: `readScreen(doc: Document, options?: ReadOptions): ScreenModel`, `type ReadOptions = { exclude?: string[] }`; the IIFE sets `globalThis.dualkitReader = { readScreen }`. Test helpers `modelOf(html, options?)`, `modelAt(url, routes, options?)`, `closeBrowser()`.

- [ ] **Step 1: Write the browser helper**

`packages/rules/test/helpers/browser.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium, type Browser, type Page } from 'playwright'
import type { ReadOptions } from '../../src/dom/reader'
import type { ScreenModel } from '../../src/model'

let browser: Promise<Browser> | null = null
let source: Promise<string> | null = null

export const readerSource = (): Promise<string> =>
  (source ??= build({
    entryPoints: [fileURLToPath(new URL('../../src/dom/entry.ts', import.meta.url))],
    bundle: true, format: 'iife', platform: 'browser', write: false,
  }).then((r) => r.outputFiles[0]!.text))

const page = async (): Promise<Page> => (await (browser ??= chromium.launch())).newPage({ viewport: { width: 1024, height: 768 } })

const read = async (p: Page, options: ReadOptions): Promise<ScreenModel> => {
  await p.addScriptTag({ content: await readerSource() })
  return p.evaluate((o) => (globalThis as unknown as { dualkitReader: { readScreen: (d: Document, o: ReadOptions) => ScreenModel } }).dualkitReader.readScreen(document, o), options)
}

export async function modelOf(html: string, options: ReadOptions = {}): Promise<ScreenModel> {
  const p = await page()
  try {
    await p.setContent(html)
    return await read(p, options)
  } finally {
    await p.close()
  }
}

/** Serves fake origins, so tests can load a cross-origin stylesheet without a network. */
export async function modelAt(url: string, routes: Record<string, { body: string; type: string }>, options: ReadOptions = {}): Promise<ScreenModel> {
  const p = await page()
  try {
    await p.route('**/*', (route) => {
      const hit = routes[route.request().url()]
      return hit ? route.fulfill({ body: hit.body, contentType: hit.type }) : route.abort()
    })
    await p.goto(url)
    return await read(p, options)
  } finally {
    await p.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) await (await browser).close()
  browser = null
}
```

- [ ] **Step 2: Write the failing reader tests**

`packages/rules/test/reader.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, modelAt, modelOf } from './helpers/browser'

afterAll(closeBrowser)

const doc = (body: string, css = '', attrs = 'lang="ar" dir="rtl"') =>
  `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>body{font:16px/1.7 "IBM Plex Sans Arabic",sans-serif}${css}</style></head><body>${body}</body></html>`

describe('root and texts', () => {
  it('reads lang and dir from <html>', async () => {
    expect((await modelOf(doc(''))).root).toEqual({ lang: 'ar', dir: 'rtl' })
    expect((await modelOf(doc('', '', ''))).root).toEqual({ lang: null, dir: null })
  })

  it('reads a text run with its block, direction, language and font', async () => {
    const m = await modelOf(doc('<p>مرحبا <b>بكم</b></p>'))
    const b = m.texts.find((t) => t.text === 'بكم')!
    expect(b).toMatchObject({ blockText: 'مرحبا بكم', blockDir: 'rtl', dir: 'rtl', lang: 'ar', isolated: false, isLastInBlock: true, lines: 1 })
    expect(b.font).toMatchObject({ size: 16, lineHeight: 27.2, letterSpacing: 0, style: 'normal', weight: 700 })
    expect(b.font.families[0]).toBe('IBM Plex Sans Arabic')
  })

  it.each([
    ['<bdi>050 123 4567</bdi>'],
    ['<span dir="ltr">050 123 4567</span>'],
    ['<span style="unicode-bidi:isolate">050 123 4567</span>'],
  ])('treats %s as isolated', async (inner) => {
    const m = await modelOf(doc(`<p>الهاتف ${inner}</p>`))
    expect(m.texts.find((t) => t.text === '050 123 4567')?.isolated).toBe(true)
  })

  it('counts wrapped lines', async () => {
    const m = await modelOf(doc('<p style="width:80px">نص عربي طويل يمتد على عدة أسطر</p>'))
    expect(m.texts[0]!.lines).toBeGreaterThan(1)
  })

  it('skips hidden, script and style text', async () => {
    const m = await modelOf(doc('<p hidden>مخفي</p><p style="display:none">مخفي</p><script>var a = 1</script><p>ظاهر</p>'))
    expect(m.texts.map((t) => t.text)).toEqual(['ظاهر'])
  })
})

describe('layouts', () => {
  it('records physical properties that render asymmetric', async () => {
    const m = await modelOf(doc('<div id="one" class="a">نص</div><div id="two" class="b">نص</div>', '.a{margin-left:16px}.b{margin:0 8px}'))
    expect(m.layouts.find((l) => l.id === 'div#one')?.physical).toEqual([{ property: 'margin-left', value: '16px' }])
    expect(m.layouts.some((l) => l.id === 'div#two')).toBe(false)
  })

  it('reads inline styles and logical properties correctly', async () => {
    const m = await modelOf(doc('<div style="padding-right:4px">نص</div><div style="margin-inline-start:16px">نص</div>'))
    expect(m.layouts).toHaveLength(1)
    expect(m.layouts[0]!.physical[0]!.property).toBe('padding-right')
  })

  it('counts cross-origin stylesheets it cannot read', async () => {
    const m = await modelAt('http://a.test/', {
      'http://a.test/': { body: doc('<p>نص</p>').replace('</head>', '<link rel="stylesheet" href="http://b.test/x.css"></head>'), type: 'text/html' },
      'http://b.test/x.css': { body: 'p{margin-left:4px}', type: 'text/css' },
    })
    expect(m.unreadableStylesheets).toBe(1)
  })
})

describe('icons and fields', () => {
  it('names icons from data attributes, classes, <use> and alt text, and sees mirroring', async () => {
    const svg = (attrs: string) => `<svg ${attrs} width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg>`
    const m = await modelOf(doc([
      svg('data-icon="arrow-right"'),
      svg('class="lucide lucide-chevron-left" style="transform:scaleX(-1)"'),
      '<svg width="16" height="16"><use href="#back"></use></svg>',
      '<img alt="play" width="16" height="16" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
    ].join('')))
    expect(m.icons.map((i) => [i.name, i.mirrored])).toEqual([['arrow-right', false], ['chevron-left', true], ['back', false], ['play', false]])
  })

  it('classifies fields and reads their direction', async () => {
    const m = await modelOf(doc('<input type="email"><input type="tel" dir="ltr"><input name="iban"><input>'))
    expect(m.fields.map((f) => [f.kind, f.dir, f.dirAttr])).toEqual([['email', 'rtl', null], ['tel', 'ltr', 'ltr'], ['code', 'rtl', null], ['text', 'rtl', null]])
  })
})

describe('options', () => {
  it('skips excluded regions and survives an invalid selector', async () => {
    const m = await modelOf(doc('<div class="skip"><p>تخطى</p></div><p>اقرأ</p>'), { exclude: ['.skip', '[[['] })
    expect(m.texts.map((t) => t.text)).toEqual(['اقرأ'])
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run test/reader.test.ts`
Expected: FAIL, esbuild cannot resolve `src/dom/entry.ts`.

- [ ] **Step 4: Write the reader and its entry**

`packages/rules/src/dom/reader.ts`:
```ts
import type { Direction, FieldKind, FieldNode, Font, IconNode, LayoutNode, NodeRef, PhysicalDeclaration, Rect, ScreenModel, TextRun } from '../model'

export type ReadOptions = { exclude?: string[] }

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
const PHYSICAL = /^(margin|padding)-(left|right)$|^(left|right|float)$|^border-(left|right)-width$|^border-(top|bottom)-(left|right)-radius$/
const ICON_CLASS = /^(lucide-|fa-|icon-|bi-|ri-|ti-|i-)(.+)$/
const ICON_CLASS_SKIP = /^(fa-(solid|regular|light|thin|duotone|brands|sharp)|fa-\d?x|fa-fw|icon-(sm|md|lg))$/
const CODE_FIELD = /iban|card|cc-number|otp|one-time-code|postal|zip|code/i

export function readScreen(doc: Document, options: ReadOptions = {}): ScreenModel {
  const win = doc.defaultView!
  const style = (el: Element) => win.getComputedStyle(el)
  const exclude = (options.exclude ?? []).filter((sel) => {
    try { doc.querySelector(sel); return true } catch { return false }
  })
  const skipped = (el: Element) => exclude.some((sel) => el.closest(sel) !== null)
  const visible = (el: Element) => {
    const s = style(el)
    const r = el.getBoundingClientRect()
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
  }
  const rect = (r: DOMRect): Rect => ({ x: r.x + win.scrollX, y: r.y + win.scrollY, width: r.width, height: r.height })
  const ref = (el: Element, box: Rect = rect(el.getBoundingClientRect())): NodeRef => ({ id: pathOf(el), snippet: el.outerHTML.slice(0, 160), box })

  const { authored, unreadable } = authoredPhysical(doc, win)
  return {
    root: { lang: doc.documentElement.getAttribute('lang') || null, dir: doc.documentElement.getAttribute('dir') || doc.body?.getAttribute('dir') || null },
    texts: readTexts(doc, style, skipped, visible, ref, rect),
    layouts: readLayouts(doc, style, skipped, visible, ref, authored),
    icons: readIcons(doc, style, skipped, visible, ref),
    fields: readFields(doc, style, skipped, visible, ref),
    unreadableStylesheets: unreadable,
  }
}

type Style = (el: Element) => CSSStyleDeclaration
type Pred = (el: Element) => boolean
type Ref = (el: Element, box?: Rect) => NodeRef

function pathOf(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && parts.length < 4 && node.tagName !== 'HTML') {
    const tag = node.tagName.toLowerCase()
    if (node.id) { parts.unshift(`${tag}#${node.id}`); break }
    const cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/)[0] : ''
    const parent: Element | null = node.parentElement
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : ''
    parts.unshift(`${tag}${cls ? `.${cls}` : ''}${nth}`)
    node = parent
  }
  return parts.join(' > ')
}

const dirOf = (s: CSSStyleDeclaration): Direction => (s.direction === 'rtl' ? 'rtl' : 'ltr')
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

function blockOf(el: Element, style: Style): Element {
  let node: Element | null = el
  while (node) {
    const d = style(node).display
    if (d !== 'inline' && d !== 'contents') return node
    node = node.parentElement
  }
  return el
}

function isolatedBelow(el: Element, block: Element, style: Style): boolean {
  let node: Element | null = el
  while (node && node !== block) {
    if (node.tagName === 'BDI' || node.hasAttribute('dir') || /isolate|plaintext/.test(style(node).unicodeBidi)) return true
    node = node.parentElement
  }
  return false
}

function fontOf(s: CSSStyleDeclaration): Font {
  return {
    families: s.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')),
    size: parseFloat(s.fontSize),
    lineHeight: s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight),
    letterSpacing: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
    style: s.fontStyle.startsWith('oblique') ? 'oblique' : s.fontStyle === 'italic' ? 'italic' : 'normal',
    weight: parseInt(s.fontWeight, 10),
  }
}

function readTexts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, rect: (r: DOMRect) => Rect): TextRun[] {
  const runs: TextRun[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = clean(node.textContent ?? '')
    if (!parent || !text || SKIP_TEXT.has(parent.tagName) || parent.closest('svg') || skipped(parent) || !visible(parent)) continue
    const range = doc.createRange()
    range.selectNodeContents(node)
    const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size
    const block = blockOf(parent, style)
    const blockText = clean(block.textContent ?? '')
    const s = style(parent)
    runs.push({
      ...ref(parent, rect(range.getBoundingClientRect())),
      text, blockId: pathOf(block), blockText, blockDir: dirOf(style(block)), dir: dirOf(s),
      lang: parent.closest('[lang]')?.getAttribute('lang') ?? null,
      isolated: isolatedBelow(parent, block, style), isLastInBlock: blockText.endsWith(text),
      font: fontOf(s), lines: Math.max(1, lines),
    })
  }
  return runs
}

type Authored = Map<Element, Set<string>>

function authoredPhysical(doc: Document, win: Window): { authored: Authored; unreadable: number } {
  const authored: Authored = new Map()
  let unreadable = 0
  const add = (el: Element, decl: CSSStyleDeclaration) => {
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i)
      if (PHYSICAL.test(name)) authored.set(el, (authored.get(el) ?? new Set()).add(name))
    }
  }
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ('media' in rule && rule.media instanceof win.MediaList && !win.matchMedia(rule.media.mediaText || 'all').matches) continue
      if ('selectorText' in rule && 'style' in rule) {
        let els: Element[] = []
        try { els = Array.from(doc.querySelectorAll(String(rule.selectorText))) } catch { els = [] }
        for (const el of els) add(el, rule.style as CSSStyleDeclaration)
      }
      if ('cssRules' in rule && rule.cssRules) walk(rule.cssRules as CSSRuleList)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try { walk(sheet.cssRules) } catch { unreadable++ }
  }
  for (const el of Array.from(doc.querySelectorAll('[style]'))) add(el, (el as HTMLElement).style)
  return { authored, unreadable }
}

const ASYMMETRIC: Record<string, (s: CSSStyleDeclaration) => boolean> = {
  'margin-left': (s) => s.marginLeft !== s.marginRight,
  'margin-right': (s) => s.marginLeft !== s.marginRight,
  'padding-left': (s) => s.paddingLeft !== s.paddingRight,
  'padding-right': (s) => s.paddingLeft !== s.paddingRight,
  left: (s) => s.position !== 'static' && s.left !== s.right,
  right: (s) => s.position !== 'static' && s.left !== s.right,
  float: (s) => s.float === 'left' || s.float === 'right',
  'border-left-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-right-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-top-left-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-top-right-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-bottom-left-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
  'border-bottom-right-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
}

function readLayouts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, authored: Authored): LayoutNode[] {
  const out: LayoutNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (el.closest('svg') || SKIP_TEXT.has(el.tagName) || skipped(el) || !visible(el)) continue
    const s = style(el)
    const physical: PhysicalDeclaration[] = Array.from(authored.get(el) ?? [])
      .filter((p) => ASYMMETRIC[p]?.(s))
      .map((p) => ({ property: p, value: s.getPropertyValue(p) }))
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && clean(n.textContent ?? '') !== '')
    const textAlign = s.textAlign
    if (physical.length > 0 || (hasOwnText && (textAlign === 'left' || textAlign === 'right'))) {
      out.push({ ...ref(el), dir: dirOf(s), textAlign, hasOwnText, physical })
    }
  }
  return out
}

function iconName(el: Element): string | null {
  const attr = el.getAttribute('aria-label') ?? el.getAttribute('data-icon') ?? el.getAttribute('data-lucide')
  if (attr) return attr.toLowerCase()
  const use = el.querySelector('use')?.getAttribute('href') ?? el.querySelector('use')?.getAttribute('xlink:href')
  if (use) return use.replace(/^.*#/, '').toLowerCase()
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).find((c) => ICON_CLASS.test(c) && !ICON_CLASS_SKIP.test(c))
  if (cls) return cls.replace(ICON_CLASS, '$2').toLowerCase()
  if (el.tagName === 'IMG') {
    const img = el as HTMLImageElement
    return (img.alt || img.getAttribute('src')?.split('/').pop()?.replace(/\.\w+$/, '') || '').toLowerCase() || null
  }
  if (/material-(icons|symbols)/.test(el.getAttribute('class') ?? '')) return clean(el.textContent ?? '').toLowerCase() || null
  return null
}

function mirrored(el: Element, style: Style): boolean {
  let node: Element | null = el
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const s = style(node)
    const m = /matrix(?:3d)?\(([^)]+)\)/.exec(s.transform)
    if (m && parseFloat(m[1]!.split(',')[0]!) < 0) return true
    if (s.scale && s.scale !== 'none' && parseFloat(s.scale) < 0) return true
  }
  return false
}

function readIcons(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): IconNode[] {
  const candidates = doc.body.querySelectorAll('svg, img, i, span[class*="icon"], [data-icon], [data-lucide], .material-icons, .material-symbols-outlined')
  const out: IconNode[] = []
  for (const el of Array.from(candidates)) {
    if (el.parentElement?.closest('svg') || skipped(el) || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 64 || r.height > 64) continue
    out.push({ ...ref(el), name: iconName(el), dir: dirOf(style(el)), mirrored: mirrored(el, style) })
  }
  return out
}

function fieldKind(el: HTMLInputElement | HTMLTextAreaElement): FieldKind {
  const type = el.getAttribute('type')?.toLowerCase()
  if (type === 'email' || type === 'tel' || type === 'url' || type === 'number') return type
  const hints = [el.getAttribute('name'), el.id, el.getAttribute('autocomplete'), el.getAttribute('inputmode')].join(' ')
  return CODE_FIELD.test(hints) ? 'code' : 'text'
}

function readFields(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): FieldNode[] {
  const out: FieldNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))) {
    const type = el.getAttribute('type')?.toLowerCase()
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit' || type === 'button') continue
    if (skipped(el) || !visible(el)) continue
    out.push({ ...ref(el), kind: fieldKind(el), dir: dirOf(style(el)), dirAttr: el.getAttribute('dir') })
  }
  return out
}
```

`packages/rules/src/dom/entry.ts`:
```ts
import { readScreen } from './reader'

;(globalThis as unknown as { dualkitReader: { readScreen: typeof readScreen } }).dualkitReader = { readScreen }
```

- [ ] **Step 5: Run the reader tests to see them pass**

Run: `npx vitest run test/reader.test.ts`
Expected: PASS, 13 tests. If `lineHeight` reads `27.2` as `27.200000762939453`, change that expectation to `toBeCloseTo(27.2)`; do not change the reader.

- [ ] **Step 6: Commit**

```bash
git add packages/rules/src/dom packages/rules/test/helpers/browser.ts packages/rules/test/reader.test.ts
git commit -m "feat(rules): DOM reader that builds the screen model in Chromium"
```

---

### Task 9: Good and bad HTML fixtures for all 20 rules

**Files:**
- Create: `packages/rules/test/fixtures.ts`
- Test: `packages/rules/test/fixtures.test.ts`

**Interfaces:**
- Consumes: `RULES`, `runRules` (Task 7); `modelOf`, `closeBrowser` (Task 8).
- Produces: nothing new; this is the end-to-end proof that each rule catches its bug in a real browser and stays quiet on the fix.

- [ ] **Step 1: Write the fixtures**

`packages/rules/test/fixtures.ts`:
```ts
type Page = { lang?: string | null; dir?: string | null; css?: string }

export const page = (body: string, o: Page = {}): string => {
  const lang = o.lang === undefined ? 'ar' : o.lang
  const dir = o.dir === undefined ? 'rtl' : o.dir
  const attrs = [lang === null ? '' : `lang="${lang}"`, dir === null ? '' : `dir="${dir}"`].join(' ')
  return `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>body{font-family:"IBM Plex Sans Arabic",sans-serif;font-size:16px;line-height:1.7}${o.css ?? ''}</style></head><body>${body}</body></html>`
}

const icon = (name: string, style = '') =>
  `<button><svg data-icon="${name}" style="${style}" width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg></button>`
const long = 'نص عربي طويل يمتد على عدة أسطر في هذه الفقرة الصغيرة'

export const FIXTURES: Record<string, { bad: string; good: string }> = {
  'bidi/unisolated-number': { bad: page('<p>رقم الهاتف 050 123 4567</p>'), good: page('<p>رقم الهاتف <bdi>050 123 4567</bdi></p>') },
  'bidi/unisolated-latin': { bad: page('<p>راسلنا على hi@example.com</p>'), good: page('<p>راسلنا على <bdi>hi@example.com</bdi></p>') },
  'bidi/punctuation-flip': { bad: page('<p>Hello world!</p>'), good: page('<p dir="ltr">Hello world!</p>') },
  'bidi/field-direction': { bad: page('<label>البريد <input type="email"></label>'), good: page('<label>البريد <input type="email" dir="ltr"></label>') },
  'layout/physical-spacing': { bad: page('<div class="x">نص</div>', { css: '.x{margin-left:16px}' }), good: page('<div class="x">نص</div>', { css: '.x{margin-inline-start:16px}' }) },
  'layout/physical-inset': {
    bad: page('<div class="x">نص</div>', { css: '.x{position:absolute;left:8px;top:0}' }),
    good: page('<div class="x">نص</div>', { css: '.x{position:absolute;inset-inline-start:8px;top:0}' }),
  },
  'layout/text-align-left': { bad: page('<p>مرحبا</p>', { css: 'p{text-align:left}' }), good: page('<p>مرحبا</p>', { css: 'p{text-align:start}' }) },
  'layout/arabic-ltr-block': { bad: page('<p dir="ltr">مرحبا بكم في المتجر</p>'), good: page('<p>مرحبا بكم في المتجر</p>') },
  'icons/not-mirrored': { bad: page(icon('arrow-right')), good: page(icon('arrow-right', 'transform:scaleX(-1)')) },
  'icons/mirrored-by-mistake': { bad: page(icon('play', 'transform:scaleX(-1)')), good: page(icon('play')) },
  'type/arabic-leading': { bad: page(`<p>${long}</p>`, { css: 'p{line-height:1.2;width:120px}' }), good: page(`<p>${long}</p>`, { css: 'p{line-height:1.7;width:120px}' }) },
  'type/arabic-tracking': { bad: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0.1em}' }), good: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0}' }) },
  'type/arabic-italic': { bad: page('<p><em>مرحبا</em></p>'), good: page('<p><em style="font-style:normal">مرحبا</em></p>') },
  'type/arabic-font': { bad: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter",sans-serif}' }), good: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter","IBM Plex Sans Arabic",sans-serif}' }) },
  'type/arabic-size': { bad: page('<p>مرحبا</p>', { css: 'p{font-size:12px}' }), good: page('<p>مرحبا</p>', { css: 'p{font-size:16px}' }) },
  'content/missing-lang': { bad: page('<p>مرحبا</p>', { lang: null }), good: page('<p>مرحبا</p>') },
  'content/missing-dir': { bad: page('<p>مرحبا بكم</p>', { dir: null }), good: page('<p>مرحبا بكم</p>') },
  'content/lang-mismatch': { bad: page('<p>مرحبا بكم</p>', { lang: 'en' }), good: page('<p>مرحبا بكم</p>') },
  'content/mixed-digits': { bad: page('<p>المبلغ 50 درهم</p><p>المبلغ ٥٠ درهم</p>'), good: page('<p>المبلغ 50 درهم</p><p>المبلغ 60 درهم</p>') },
  'content/placeholder-text': { bad: page('<p>لوريم إيبسوم دولور</p>'), good: page('<p>مرحبا</p>') },
}
```

- [ ] **Step 2: Write the harness test**

`packages/rules/test/fixtures.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { FIXTURES } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

afterAll(closeBrowser)

describe('every rule has fixtures', () => {
  it('covers all twenty rules', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(RULES.map((r) => r.id).sort())
  })
})

describe.each(RULES.map((r) => [r.id, r] as const))('%s in a real browser', (id, rule) => {
  it('catches the bad page', async () => {
    const found = runRules(await modelOf(FIXTURES[id]!.bad), { rules: [rule] })
    expect(found.length).toBeGreaterThan(0)
  })
  it('stays quiet on the good page', async () => {
    expect(runRules(await modelOf(FIXTURES[id]!.good), { rules: [rule] })).toEqual([])
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run test/fixtures.test.ts`
Expected: PASS, 41 tests. A failure here is a real gap between a rule and the reader: fix the reader or the rule, never the fixture, unless the fixture is not a fair example of the bug.

- [ ] **Step 4: Run the whole package with coverage, then build**

Run: `npm run coverage -w @dualkit/rules && npm run typecheck -w @dualkit/rules && npm run build -w @dualkit/rules && ls packages/rules/dist`
Expected: thresholds pass; `dist` has `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`, `reader.global.js`.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/test/fixtures.ts packages/rules/test/fixtures.test.ts
git commit -m "test(rules): bad and good browser fixtures for all twenty rules"
```

---

### Task 10: The `dualkit` CLI package: config, target and audit

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/tsup.config.ts`, `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/config.ts`, `packages/cli/src/target.ts`, `packages/cli/src/audit.ts`, `packages/cli/test/fixtures/page.html`
- Modify: `package.json` (root name)
- Test: `packages/cli/test/config.test.ts`, `packages/cli/test/target.test.ts`, `packages/cli/test/audit.test.ts`

**Interfaces:**
- Consumes: `RULES`, `runRules`, `score`, `Finding`, `ScreenModel` from `@dualkit/rules`; the reader at `@dualkit/rules/reader`.
- Produces:
  - `type Config = { ignore: string[]; exclude: string[] }`, `loadConfig(path?: string, cwd?: string): Config` (throws `UserError`)
  - `class UserError extends Error`
  - `toUrl(target: string, cwd?: string): string` (throws `UserError`)
  - `type AuditOptions = { url: string; width: number; height: number; config: Config }`
  - `type AuditResult = { url: string; date: string; width: number; height: number; score: number; findings: Finding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number }`
  - `audit(options: AuditOptions, launch?: () => Promise<Browser>): Promise<AuditResult>`

- [ ] **Step 1: Create the package files**

`packages/cli/package.json`:
```json
{
  "name": "dualkit",
  "version": "0.1.0-beta.0",
  "description": "Check any screen for Arabic and right-to-left bugs, and get a Gulf-ready report.",
  "license": "MIT",
  "type": "module",
  "bin": { "dualkit": "./dist/cli.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run typecheck && npm test && npm run build"
  },
  "dependencies": {
    "@dualkit/rules": "0.1.0-beta.0",
    "playwright": "1.55.0"
  },
  "devDependencies": {
    "@types/node": "^22.20.5",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vitest": "^3.2.7"
  },
  "keywords": ["arabic", "rtl", "bidi", "audit", "cli", "gulf"],
  "author": "Sam Santos (https://snts.im)",
  "homepage": "https://dualkit.dev",
  "repository": { "type": "git", "url": "git+https://github.com/dualkit/dualkit.git", "directory": "packages/cli" },
  "bugs": { "url": "https://github.com/dualkit/dualkit/issues" },
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=18" }
}
```

`packages/cli/tsconfig.json`: same as `packages/format/tsconfig.json` (lib `ES2022`, types `node`).

`packages/cli/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({ entry: { cli: 'src/cli.ts' }, format: ['esm'], target: 'node18', clean: true, banner: { js: '#!/usr/bin/env node' } })
```

`packages/cli/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000 } })
```

`packages/cli/test/fixtures/page.html`:
```html
<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><style>body{font-family:"IBM Plex Sans Arabic",sans-serif;font-size:16px;line-height:1.7}.note{margin-left:16px}</style></head>
<body>
  <h1>ملخص الدفع</h1>
  <p>رقم الهاتف 050 123 4567</p>
  <p class="note">المبلغ <bdi>AED 1,234.50</bdi></p>
</body>
</html>
```

The root `package.json` is also named `dualkit`, which would clash with this workspace. Rename the root to `"name": "dualkit-monorepo"` (it is private and never published).

Run: `npm install` at the repo root, then `npm run build -w @dualkit/rules`.

- [ ] **Step 2: Write the failing tests**

`packages/cli/test/config.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UserError, loadConfig } from '../src/config'

const dir = () => mkdtempSync(join(tmpdir(), 'dualkit-'))

describe('loadConfig', () => {
  it('returns defaults when there is no config file', () => {
    expect(loadConfig(undefined, dir())).toEqual({ ignore: [], exclude: [] })
  })
  it('reads dualkit.config.json from the working folder', () => {
    const d = dir()
    writeFileSync(join(d, 'dualkit.config.json'), JSON.stringify({ ignore: ['type/arabic-size'], exclude: ['.ads'] }))
    expect(loadConfig(undefined, d)).toEqual({ ignore: ['type/arabic-size'], exclude: ['.ads'] })
  })
  it('names an unknown rule id and lists where to find the real ones', () => {
    const d = dir()
    writeFileSync(join(d, 'dualkit.config.json'), JSON.stringify({ ignore: ['type/arabic-sise'] }))
    expect(() => loadConfig(undefined, d)).toThrow(/Unknown rule "type\/arabic-sise"/)
  })
  it('rejects broken JSON, wrong types and a missing explicit file', () => {
    const d = dir()
    writeFileSync(join(d, 'bad.json'), '{ ignore: ')
    writeFileSync(join(d, 'types.json'), JSON.stringify({ exclude: '.ads' }))
    expect(() => loadConfig(join(d, 'bad.json'))).toThrow(UserError)
    expect(() => loadConfig(join(d, 'types.json'))).toThrow(/exclude must be a list of CSS selectors/)
    expect(() => loadConfig(join(d, 'missing.json'))).toThrow(/Could not find/)
  })
})
```

`packages/cli/test/target.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { UserError } from '../src/config'
import { toUrl } from '../src/target'

describe('toUrl', () => {
  it('keeps http, https and file URLs', () => {
    expect(toUrl('https://example.com/ar')).toBe('https://example.com/ar')
    expect(toUrl('http://localhost:3000')).toBe('http://localhost:3000/')
  })
  it('turns an existing file path into a file URL', () => {
    expect(toUrl('test/fixtures/page.html', process.cwd())).toMatch(/^file:\/\/.+page\.html$/)
  })
  it('rejects anything else with a clear message', () => {
    expect(() => toUrl('not a page')).toThrow(UserError)
    expect(() => toUrl('ftp://example.com')).toThrow(/http, https or a local HTML file/)
  })
})
```

`packages/cli/test/audit.test.ts`:
```ts
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { audit } from '../src/audit'

const page = readFileSync(new URL('./fixtures/page.html', import.meta.url), 'utf8')
let server: Server
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/hang') return // never answers, like a long poll
    const html = req.url === '/polling' ? page.replace('</body>', '<script>fetch("/hang")</script></body>') : page
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
  })
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://localhost:${(server.address() as { port: number }).port}`
})
afterAll(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) }))

const options = (url: string) => ({ url, width: 1024, height: 768, config: { ignore: [], exclude: [] } })

describe('audit', () => {
  it('finds the bugs on a real page, scores it and takes a screenshot', async () => {
    const r = await audit(options(`${base}/`))
    expect(r.findings.map((f) => f.rule)).toEqual(expect.arrayContaining(['bidi/unisolated-number', 'layout/physical-spacing']))
    expect(r.score).toBeLessThan(100)
    expect(r.screenshot.length).toBeGreaterThan(1000)
    expect(r.pageHeight).toBeGreaterThan(0)
  })

  it('applies ignore from the config', async () => {
    const r = await audit({ ...options(`${base}/`), config: { ignore: ['bidi/unisolated-number'], exclude: [] } })
    expect(r.findings.some((f) => f.rule === 'bidi/unisolated-number')).toBe(false)
  })

  it('finishes on a page that never goes network-idle', async () => {
    const r = await audit(options(`${base}/polling`))
    expect(r.findings.length).toBeGreaterThan(0)
  })

  it('explains how to install Chromium when it is missing', async () => {
    const launch = () => Promise.reject(new Error("browserType.launch: Executable doesn't exist at /x"))
    await expect(audit(options(`${base}/`), launch)).rejects.toThrow(/npx playwright@1\.55\.0 install chromium/)
  })

  it('says which page could not be opened', async () => {
    await expect(audit(options('http://localhost:1/'))).rejects.toThrow(/Could not open http:\/\/localhost:1\//)
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run` in `packages/cli`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write `config.ts`, `target.ts` and `audit.ts`**

`packages/cli/src/config.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULES } from '@dualkit/rules'

export type Config = { ignore: string[]; exclude: string[] }

/** A problem the person can fix. The CLI prints its message and exits 2, never a stack trace. */
export class UserError extends Error {}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export function loadConfig(path?: string, cwd = process.cwd()): Config {
  const file = path ?? join(cwd, 'dualkit.config.json')
  if (!existsSync(file)) {
    if (path) throw new UserError(`Could not find the config file ${path}.`)
    return { ignore: [], exclude: [] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new UserError(`${file} is not valid JSON.`)
  }
  const { ignore = [], exclude = [] } = (raw ?? {}) as Record<string, unknown>
  if (!isStringList(ignore)) throw new UserError('ignore must be a list of rule ids, for example ["type/arabic-size"].')
  if (!isStringList(exclude)) throw new UserError('exclude must be a list of CSS selectors, for example [".ads"].')
  const known = new Set(RULES.map((r) => r.id))
  const unknown = ignore.find((id) => !known.has(id))
  if (unknown) throw new UserError(`Unknown rule "${unknown}" in ignore. The rule ids are listed in https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md`)
  return { ignore, exclude }
}
```

`packages/cli/src/target.ts`:
```ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { UserError } from './config'

export function toUrl(target: string, cwd = process.cwd()): string {
  const path = resolve(cwd, target)
  if (!/^[a-z]+:/i.test(target) && existsSync(path)) return pathToFileURL(path).href
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new UserError(`"${target}" is not a URL or a file. Use http, https or a local HTML file.`)
  }
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new UserError(`"${target}" is not supported. Use http, https or a local HTML file.`)
  return url.href
}
```

`packages/cli/src/audit.ts`:
```ts
import { createRequire } from 'node:module'
import { runRules, score, type Finding, type ScreenModel } from '@dualkit/rules'
import { chromium, type Browser } from 'playwright'
import { UserError, type Config } from './config'

export type AuditOptions = { url: string; width: number; height: number; config: Config }
export type AuditResult = {
  url: string; date: string; width: number; height: number
  score: number; findings: Finding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number
}

const READER = createRequire(import.meta.url).resolve('@dualkit/rules/reader')
const SETTLE_MS = 800
const MAX_SHOT_HEIGHT = 8000
export const PLAYWRIGHT_VERSION = '1.55.0'

async function open(launch: () => Promise<Browser>): Promise<Browser> {
  try {
    return await launch()
  } catch (e) {
    const missing = e instanceof Error && /Executable doesn't exist|browserType\.launch/.test(e.message)
    throw new UserError(missing
      ? `Chromium is not installed. Run: npx playwright@${PLAYWRIGHT_VERSION} install chromium`
      : `Could not start Chromium: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function audit(options: AuditOptions, launch: () => Promise<Browser> = () => chromium.launch()): Promise<AuditResult> {
  const browser = await open(launch)
  try {
    const page = await browser.newPage({ viewport: { width: options.width, height: options.height } })
    try {
      // `load`, not `networkidle`: pages that poll or stream never go idle.
      await page.goto(options.url, { waitUntil: 'load', timeout: 30_000 })
    } catch (e) {
      throw new UserError(`Could not open ${options.url}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    }
    await page.waitForTimeout(SETTLE_MS)
    await page.addScriptTag({ path: READER })
    const model = await page.evaluate(
      (exclude) => (globalThis as unknown as { dualkitReader: { readScreen: (d: Document, o: { exclude: string[] }) => ScreenModel } }).dualkitReader.readScreen(document, { exclude }),
      options.config.exclude,
    )
    const findings = runRules(model, { ignore: options.config.ignore })
    const pageHeight = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight))
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: options.width, height: pageHeight }, fullPage: true })
    return {
      url: options.url, date: new Date().toISOString(), width: options.width, height: options.height,
      score: score(findings), findings, screenshot: shot.toString('base64'), pageHeight,
      unreadableStylesheets: model.unreadableStylesheets,
    }
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run` in `packages/cli`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/cli package.json package-lock.json
git commit -m "feat(cli): config, targets and the browser audit"
```

---

### Task 11: The terminal summary and the Gulf-ready report

**Files:**
- Create: `packages/cli/src/summary.ts`, `packages/cli/src/report.ts`
- Test: `packages/cli/test/summary.test.ts`, `packages/cli/test/report.test.ts`

**Interfaces:**
- Consumes: `AuditResult` (Task 10), `Finding`, `RULES`.
- Produces: `formatSummary(result: AuditResult, color?: boolean): string`, `renderReport(result: AuditResult): string`, `MAX_PER_RULE = 20`, `escapeHtml(s: string): string`.

- [ ] **Step 1: Write the failing tests**

`packages/cli/test/report.test.ts`:
```ts
import type { Finding } from '@dualkit/rules'
import { describe, expect, it } from 'vitest'
import type { AuditResult } from '../src/audit'
import { MAX_PER_RULE, escapeHtml, renderReport } from '../src/report'
import { formatSummary } from '../src/summary'

const finding = (p: Partial<Finding> = {}): Finding => ({
  rule: 'bidi/unisolated-number', group: 'bidi', severity: 'error', title: 'A number that will show in reverse',
  message: '"050 123 4567" is not isolated.', fix: 'Wrap the number in <bdi>.', docs: 'https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#bidi-unisolated-number',
  node: { id: 'p', snippet: '<p>050 123 4567</p>', box: { x: 10, y: 20, width: 100, height: 20 } }, ...p,
})
const result = (findings: Finding[], extra: Partial<AuditResult> = {}): AuditResult => ({
  url: 'https://example.com/ar', date: '2026-10-16T12:00:00.000Z', width: 1280, height: 800, score: 72,
  findings, screenshot: 'iVBORw0KGgo=', pageHeight: 1600, unreadableStylesheets: 0, ...extra,
})

describe('renderReport', () => {
  it('shows the score, the page and each rule with its fix and docs link', () => {
    const html = renderReport(result([finding()]))
    expect(html).toContain('72')
    expect(html).toContain('https://example.com/ar')
    expect(html).toContain('A number that will show in reverse')
    expect(html).toContain('Wrap the number in &lt;bdi&gt;.')
    expect(html).toContain('RULES.md#bidi-unisolated-number')
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('escapes hostile page content so the report stays inert', () => {
    const html = renderReport(result([finding({ node: { id: 'x', snippet: '</script><img src=x onerror=alert(1)>', box: { x: 0, y: 0, width: 1, height: 1 } } })]))
    expect(html).not.toContain('<img src=x onerror')
    expect(html).toContain('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toMatch(/<script/i)
  })

  it(`shows at most ${MAX_PER_RULE} instances per rule, then says how many more`, () => {
    const html = renderReport(result(Array.from({ length: MAX_PER_RULE + 5 }, () => finding())))
    expect(html).toContain('And 5 more')
  })

  it('says when stylesheets could not be read, and celebrates a clean page', () => {
    expect(renderReport(result([], { unreadableStylesheets: 2 }))).toContain('2 stylesheets could not be read')
    expect(renderReport(result([], { score: 100 }))).toContain('No issues found')
  })

  it('loads nothing from the network', () => {
    const html = renderReport(result([finding()]))
    expect(html).not.toMatch(/<(link|script)[^>]+(src|href)=["']https?:/i)
  })

  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('formatSummary', () => {
  it('prints the score, counts and one line per rule without colour when asked', () => {
    const text = formatSummary(result([finding(), finding(), finding({ rule: 'type/arabic-size', severity: 'warning', title: 'Arabic set too small' })]), false)
    expect(text).toContain('Score 72/100')
    expect(text).toContain('1 rule with errors, 1 with warnings')
    expect(text).toContain('bidi/unisolated-number (2)')
    expect(text).not.toMatch(/\u001b\[/)
  })
  it('mentions unreadable stylesheets', () => {
    expect(formatSummary(result([], { unreadableStylesheets: 1 }), false)).toContain('1 stylesheet could not be read')
  })
})
```

Move the `formatSummary` describe into `packages/cli/test/summary.test.ts` with the same `finding` and `result` builders if the file grows past 150 lines.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/report.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `summary.ts` and `report.ts`**

`packages/cli/src/summary.ts`:
```ts
import type { Finding } from '@dualkit/rules'
import type { AuditResult } from './audit'

const paint = (on: boolean, code: number, s: string) => (on ? `\u001b[${code}m${s}\u001b[0m` : s)
const MARK = { error: '✖', warning: '▲', note: '·' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function groupByRule(findings: readonly Finding[]): Finding[][] {
  const groups = new Map<string, Finding[]>()
  for (const f of findings) groups.set(f.rule, [...(groups.get(f.rule) ?? []), f])
  return [...groups.values()]
}

export function formatSummary(result: AuditResult, color = Boolean(process.stdout.isTTY)): string {
  const groups = groupByRule(result.findings)
  const errors = groups.filter((g) => g[0]!.severity === 'error').length
  const warnings = groups.filter((g) => g[0]!.severity === 'warning').length
  const lines = [
    '',
    `${paint(color, 1, `Score ${result.score}/100`)}  ${result.url}`,
    groups.length === 0 ? 'No issues found.' : `${errors} rule${errors === 1 ? '' : 's'} with errors, ${warnings} with warnings`,
    '',
    ...groups.map((g) => {
      const f = g[0]!
      const code = f.severity === 'error' ? 31 : f.severity === 'warning' ? 33 : 2
      return `${paint(color, code, MARK[f.severity])} ${f.rule} (${g.length})  ${f.fix}`
    }),
  ]
  if (result.unreadableStylesheets > 0) lines.push('', `${plural(result.unreadableStylesheets, 'stylesheet')} could not be read, so layout checks may miss rules in them.`)
  return `${lines.join('\n')}\n`
}
```

`packages/cli/src/report.ts`:
```ts
import type { Finding } from '@dualkit/rules'
import type { AuditResult } from './audit'
import { groupByRule } from './summary'

export const MAX_PER_RULE = 20

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const pct = (n: number, of: number) => `${Math.max(0, Math.min(100, (n / of) * 100)).toFixed(3)}%`

function markers(result: AuditResult, numbered: Array<{ n: number; f: Finding }>): string {
  return numbered
    .filter(({ f }) => f.node && f.node.box.y < result.pageHeight)
    .map(({ n, f }) => {
      const b = f.node!.box
      return `<a class="mark ${f.severity}" href="#i${n}" style="left:${pct(b.x, result.width)};top:${pct(b.y, result.pageHeight)};width:${pct(b.width, result.width)};height:${pct(b.height, result.pageHeight)}"><span>${n}</span></a>`
    })
    .join('')
}

const CSS = `
:root{--ink:#09090b;--soft:#52525b;--line:#e4e4e7;--bg:#fafafa;--err:#dc2626;--warn:#d97706;--note:#71717a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:48px 24px}h1{font-size:28px;font-weight:500;margin:0 0 4px}
.meta{color:var(--soft);margin:0 0 32px;word-break:break-all}.score{font-size:72px;font-weight:500;letter-spacing:-.04em;line-height:1}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:start}
@media (max-width:900px){.grid{grid-template-columns:minmax(0,1fr)}}
.shot{position:relative;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}.shot img{display:block;width:100%}
.mark{position:absolute;outline:2px solid currentColor;outline-offset:1px;border-radius:2px}.mark span{position:absolute;inset-inline-start:-2px;top:-20px;background:currentColor;border-radius:4px;padding:0 5px;font-size:11px}
.mark span{color:#fff}.error{color:var(--err)}.warning{color:var(--warn)}.note{color:var(--note)}
section.rule{background:#fff;border-radius:6px;box-shadow:0 0 0 1px var(--line);padding:24px;margin-bottom:16px}
section.rule h2{font-size:17px;font-weight:500;margin:0}.id{font-family:ui-monospace,monospace;font-size:12px;color:var(--soft)}
.fix{margin:8px 0 12px}ol{margin:0;padding-inline-start:20px}li{margin:8px 0}code{font-family:ui-monospace,monospace;font-size:12px;background:var(--bg);padding:2px 4px;border-radius:3px;word-break:break-all}
.notice{color:var(--soft)}footer{margin-top:48px;color:var(--soft);font-size:13px}a{color:inherit}`

export function renderReport(result: AuditResult): string {
  let n = 0
  const numbered: Array<{ n: number; f: Finding }> = []
  const sections = groupByRule(result.findings).map((group) => {
    const f = group[0]!
    const shown = group.slice(0, MAX_PER_RULE).map((x) => ({ n: ++n, f: x }))
    numbered.push(...shown)
    const items = shown.map(({ n: i, f: x }) =>
      `<li id="i${i}"><strong>${i}.</strong> ${escapeHtml(x.message)}${x.node ? `<br><code>${escapeHtml(x.node.snippet)}</code>` : ''}</li>`).join('')
    const more = group.length > MAX_PER_RULE ? `<p class="notice">And ${group.length - MAX_PER_RULE} more.</p>` : ''
    return `<section class="rule"><p class="id ${f.severity}">${escapeHtml(f.severity)} · ${escapeHtml(f.rule)} · ${group.length}</p><h2>${escapeHtml(f.title)}</h2><p class="fix">${escapeHtml(f.fix)} <a href="${escapeHtml(f.docs)}">Why</a></p><ol>${items}</ol>${more}</section>`
  })
  const unreadable = result.unreadableStylesheets > 0
    ? `<p class="notice">${result.unreadableStylesheets} stylesheet${result.unreadableStylesheets === 1 ? '' : 's'} could not be read, so layout checks may miss rules in them.</p>`
    : ''
  const body = sections.length > 0 ? sections.join('') : '<p>No issues found. This screen is Gulf-ready by every Dualkit rule.</p>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gulf-ready report</title><style>${CSS}</style></head><body><main>
<h1>Gulf-ready report</h1><p class="meta">${escapeHtml(result.url)} · ${escapeHtml(result.date.slice(0, 10))} · ${result.width}px wide</p>
<div class="grid"><div><p class="score">${result.score}<span class="notice" style="font-size:20px">/100</span></p>${unreadable}${body}</div>
<div class="shot"><img alt="The audited screen" src="data:image/png;base64,${result.screenshot}">${markers(result, numbered)}</div></div>
<footer>Made with <a href="https://dualkit.dev">Dualkit</a>. Rules: <a href="https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md">RULES.md</a></footer>
</main></body></html>`
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run` in `packages/cli`
Expected: PASS for all files.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/summary.ts packages/cli/src/report.ts packages/cli/test
git commit -m "feat(cli): terminal summary and the Gulf-ready report"
```

---

### Task 12: The command line entry

**Files:**
- Create: `packages/cli/src/cli.ts`, `packages/cli/README.md`
- Test: `packages/cli/test/cli.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `UserError`, `toUrl`, `audit`, `AuditResult`, `formatSummary`, `renderReport`.
- Produces: `run(argv: string[], io?: Io): Promise<number>` with `type Io = { out: (s: string) => void; err: (s: string) => void; write: (path: string, data: string) => void; audit: typeof audit; cwd: string }`. Exit codes: `0` done, `1` score below `--min-score`, `2` usage or runtime problem.

- [ ] **Step 1: Write the failing tests**

`packages/cli/test/cli.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { AuditResult } from '../src/audit'
import { run } from '../src/cli'

const fake = (score = 80): AuditResult => ({
  url: 'https://example.com/', date: '2026-10-16T00:00:00.000Z', width: 1280, height: 800, score, findings: [],
  screenshot: '', pageHeight: 800, unreadableStylesheets: 0,
})

const io = (score = 80) => {
  const out: string[] = []
  const err: string[] = []
  const files: Record<string, string> = {}
  const calls: unknown[] = []
  return {
    out, err, files, calls,
    io: {
      out: (s: string) => out.push(s), err: (s: string) => err.push(s), write: (p: string, d: string) => { files[p] = d },
      audit: async (o: unknown) => { calls.push(o); return fake(score) }, cwd: process.cwd(),
    },
  }
}

describe('dualkit check', () => {
  it('audits, prints the summary and writes the report', async () => {
    const t = io()
    expect(await run(['check', 'https://example.com'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('Score 80/100')
    expect(Object.keys(t.files)).toEqual(['dualkit-report.html'])
    expect(t.calls[0]).toMatchObject({ url: 'https://example.com/', width: 1280, height: 800 })
  })

  it('takes width, height and an output path', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--width', '390', '--height', '844', '--out', 'r.html'], t.io)
    expect(t.calls[0]).toMatchObject({ width: 390, height: 844 })
    expect(Object.keys(t.files)).toEqual(['r.html'])
  })

  it('prints JSON with --json', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--json'], t.io)
    expect(JSON.parse(t.out.join('')).score).toBe(80)
  })

  it('exits 1 below --min-score', async () => {
    expect(await run(['check', 'https://example.com', '--min-score', '90'], io(80).io)).toBe(1)
  })

  it('exits 2 with a clear message on bad input', async () => {
    for (const argv of [[], ['lint', 'x'], ['check'], ['check', 'not a page'], ['check', 'https://x.com', '--width', 'wide']]) {
      const t = io()
      expect(await run(argv, t.io), argv.join(' ')).toBe(2)
      expect(t.err.join('').length, argv.join(' ')).toBeGreaterThan(0)
    }
  })

  it('prints help', async () => {
    const t = io()
    expect(await run(['--help'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('dualkit check <url or file>')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/cli.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `cli.ts`**

`packages/cli/src/cli.ts`:
```ts
import { realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { audit } from './audit'
import { UserError, loadConfig } from './config'
import { renderReport } from './report'
import { formatSummary } from './summary'
import { toUrl } from './target'

export type Io = { out: (s: string) => void; err: (s: string) => void; write: (path: string, data: string) => void; audit: typeof audit; cwd: string }

const HELP = `Usage: dualkit check <url or file> [options]

  --out <file>        Report path (default dualkit-report.html)
  --json              Print the result as JSON instead of the summary
  --width <px>        Viewport width (default 1280)
  --height <px>       Viewport height (default 800)
  --min-score <n>     Exit 1 when the score is below n
  --config <file>     Config file (default dualkit.config.json)

Rules: https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md
`

const defaultIo: Io = {
  out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s),
  write: (p, d) => writeFileSync(p, d), audit, cwd: process.cwd(),
}

const int = (name: string, value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new UserError(`--${name} must be a whole number, got "${value}".`)
  return n
}

export async function run(argv: string[], io: Io = defaultIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        out: { type: 'string' }, json: { type: 'boolean' }, width: { type: 'string' }, height: { type: 'string' },
        'min-score': { type: 'string' }, config: { type: 'string' }, help: { type: 'boolean', short: 'h' },
      },
    })
    if (values.help) { io.out(HELP); return 0 }
    const [command, target] = positionals
    if (command !== 'check' || !target) throw new UserError(`${command ? `Unknown command "${command}".` : 'Missing command.'}\n\n${HELP}`)
    const config = loadConfig(values.config, io.cwd)
    const result = await io.audit({
      url: toUrl(target, io.cwd), width: int('width', values.width, 1280), height: int('height', values.height, 800), config,
    })
    const out = resolve(io.cwd, values.out ?? 'dualkit-report.html')
    io.write(values.out ?? 'dualkit-report.html', renderReport(result))
    io.out(values.json ? `${JSON.stringify({ ...result, screenshot: undefined, report: out })}\n` : `${formatSummary(result)}\nReport: ${out}\n`)
    const min = int('min-score', values['min-score'], 0)
    return result.score < min ? 1 : 0
  } catch (e) {
    const message = e instanceof UserError || (e instanceof TypeError && 'code' in e) ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`
    io.err(`${message}\n`)
    return 2
  }
}

// npx runs the bin through a symlink, so compare real paths.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  run(process.argv.slice(2)).then((code) => process.exit(code))
}
```

The `TypeError` with a `code` is how `parseArgs` reports unknown options; its message is already readable.

`packages/cli/README.md`:
````md
# dualkit

Check any screen for Arabic and right-to-left bugs, and get a shareable Gulf-ready report.

```sh
npx playwright@1.55.0 install chromium   # once
npx dualkit check https://example.com/ar
```

It opens the page in Chromium, runs 20 rules (bidi, layout, icons, type, content), prints a summary and writes `dualkit-report.html` with a score out of 100 and every issue marked on a screenshot.

| Option | Default | |
| --- | --- | --- |
| `--out <file>` | `dualkit-report.html` | Where the report goes |
| `--json` | | Print the result as JSON |
| `--width`, `--height` | `1280`, `800` | Viewport, for example `--width 390 --height 844` for a phone |
| `--min-score <n>` | `0` | Exit 1 below this score, for CI |
| `--config <file>` | `dualkit.config.json` | Ignore rules or regions |

```json
{ "ignore": ["type/arabic-size"], "exclude": [".third-party-widget"] }
```

Every rule, why it matters and how to fix it: [RULES.md](https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md). Exit codes: 0 done, 1 below `--min-score`, 2 a problem with the input.
````

- [ ] **Step 4: Run the tests, build and try it for real**

Run: `npx vitest run && npm run typecheck && npm run build` in `packages/cli`, then `node packages/cli/dist/cli.js check packages/cli/test/fixtures/page.html --out /tmp/dk.html` from the repo root.
Expected: tests PASS; the command prints a score below 100 listing `bidi/unisolated-number` and `layout/physical-spacing`, and `/tmp/dk.html` opens in a browser with numbered marks on the screenshot.

- [ ] **Step 5: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): dualkit check command"
```

---

### Task 13: GitHub Action, CI, publishing, docs and the site

**Files:**
- Create: `action/action.yml`, `.github/workflows/action-selftest.yml`, `packages/rules/README.md`
- Modify: `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `README.md`, `apps/site/app/docs/page.tsx`, `apps/site/lib/updates.ts`, `apps/site/lib/copy.ts`

**Interfaces:**
- Consumes: the `dualkit` CLI and its exit codes and `--json` output (Task 12).
- Produces: `uses: dualkit/dualkit/action@main` with inputs `url` (required), `min-score` (default `0`), `width` (default `1280`), `config` (default empty), `comment` (default `true`), `command` (default `npx --yes dualkit@beta`), `github-token` (default `${{ github.token }}`); output `score`.

- [ ] **Step 1: Write the Action**

`action/action.yml`:
```yaml
name: Dualkit check
description: Check a page for Arabic and right-to-left bugs and attach a Gulf-ready report.
branding: { icon: check-circle, color: gray-dark }
inputs:
  url: { description: URL or HTML file to check, required: true }
  min-score: { description: Fail below this score, default: '0' }
  width: { description: Viewport width, default: '1280' }
  config: { description: Path to dualkit.config.json, default: '' }
  comment: { description: Comment the score on pull requests (needs pull-requests write), default: 'true' }
  command: { description: How to run the CLI, default: npx --yes dualkit@beta }
  github-token: { description: Token for the PR comment, default: '${{ github.token }}' }
outputs:
  score: { description: Score out of 100, value: '${{ steps.check.outputs.score }}' }
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with: { node-version: 22 }
    - shell: bash
      run: npx --yes playwright@1.55.0 install --with-deps chromium
    - id: check
      shell: bash
      env:
        URL: ${{ inputs.url }}
        MIN: ${{ inputs.min-score }}
        WIDTH: ${{ inputs.width }}
        CONFIG: ${{ inputs.config }}
        CMD: ${{ inputs.command }}
      run: |
        set +e
        ARGS=(check "$URL" --json --out dualkit-report.html --width "$WIDTH" --min-score "$MIN")
        [ -n "$CONFIG" ] && ARGS+=(--config "$CONFIG")
        $CMD "${ARGS[@]}" > dualkit.json
        CODE=$?
        set -e
        if [ "$CODE" = 2 ]; then cat dualkit.json; exit 2; fi
        SCORE=$(node -p "require('./dualkit.json').score")
        echo "score=$SCORE" >> "$GITHUB_OUTPUT"
        node -e "
          const r = require('./dualkit.json');
          const rules = [...new Set(r.findings.map(f => f.rule))];
          const lines = ['### Dualkit check: ' + r.score + '/100', '', r.url, '', ...rules.map(id => '- ' + id + ' (' + r.findings.filter(f => f.rule === id).length + ')'), '', 'Full report in the dualkit-report artifact.'];
          require('fs').writeFileSync('dualkit-summary.md', lines.join('\n'));
        "
        cat dualkit-summary.md >> "$GITHUB_STEP_SUMMARY"
        echo "code=$CODE" >> "$GITHUB_OUTPUT"
    - uses: actions/upload-artifact@v4
      with: { name: dualkit-report, path: dualkit-report.html }
    - if: inputs.comment == 'true' && github.event_name == 'pull_request'
      shell: bash
      env:
        GH_TOKEN: ${{ inputs.github-token }}
        PR: ${{ github.event.pull_request.number }}
      run: gh pr comment "$PR" --repo "$GITHUB_REPOSITORY" --body-file dualkit-summary.md || echo "Could not comment; grant pull-requests write to enable it."
    - if: steps.check.outputs.code == '1'
      shell: bash
      run: echo "Score is below ${{ inputs.min-score }}." && exit 1
```

`.github/workflows/action-selftest.yml`:
```yaml
name: Action self-test
on:
  pull_request:
    paths: [action/**, packages/cli/**, packages/rules/**]
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: write
jobs:
  selftest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build -w @dualkit/rules && npm run build -w dualkit
      - id: dk
        uses: ./action
        with:
          url: packages/cli/test/fixtures/page.html
          command: node packages/cli/dist/cli.js
      - run: test "${{ steps.dk.outputs.score }}" -lt 100
```

- [ ] **Step 2: Update CI and publishing**

In `.github/workflows/ci.yml`, after `- run: npm run build -w @dualkit/format` add:
```yaml
      - run: npm run build -w @dualkit/rules
      - run: npx playwright@1.55.0 install --with-deps chromium
```
and after `- run: npm run build -w @dualkit/starter && git diff --exit-code packages/starter/generated` add:
```yaml
      - run: npm run build -w dualkit
```

In `.github/workflows/publish.yml`, change the package options to `[format, starter, rules, cli]`, and replace the two package-specific steps with:
```yaml
      - name: Resolve the workspace
        id: ws
        run: |
          if [ "${{ inputs.package }}" = cli ]; then echo "name=dualkit" >> "$GITHUB_OUTPUT"; else echo "name=@dualkit/${{ inputs.package }}" >> "$GITHUB_OUTPUT"; fi
      - if: inputs.package == 'cli'
        run: npm run build -w @dualkit/rules
      - run: npm publish -w ${{ steps.ws.outputs.name }} --provenance --access public --tag ${{ inputs.tag }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Point latest at this version while it is the only one
        run: |
          VERSION=$(node -p "require('./packages/${{ inputs.package }}/package.json').version")
          npm dist-tag add "${{ steps.ws.outputs.name }}@$VERSION" latest
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
Keep the existing "Starter outputs must match the token file" step. Publish `rules` before `cli`.

- [ ] **Step 3: Docs and the site**

`packages/rules/README.md`:
````md
# @dualkit/rules

Twenty rules that catch Arabic and right-to-left bugs in a rendered interface: numbers that reverse, layouts that do not mirror, icons pointing the wrong way, cramped Arabic type, and missing language tags.

Most people want the CLI: `npx dualkit check <url>`. Use this package to run the rules yourself:

```ts
import { runRules, score } from '@dualkit/rules'
// model comes from the reader: inject require.resolve('@dualkit/rules/reader') into a page,
// then call globalThis.dualkitReader.readScreen(document).
const findings = runRules(model)
console.log(score(findings))
```

Every rule is documented in [RULES.md](./RULES.md).
````

In `README.md`, add a row to the package table after Starter:
```md
| **[Check](packages/cli/)** | Audit any page for Arabic and RTL bugs, with a shareable Gulf-ready report | `npx dualkit check <url>` |
```

In `apps/site/app/docs/page.tsx`, add a section before the Source section:
```tsx
        <section className="doc-block" id="check">
          <h2 className="h2">Check a screen</h2>
          <p className="soft">Point it at any page, local or live. It runs twenty Arabic and right-to-left rules and writes a report you can share.</p>
          <CopyCommand command="npx dualkit check https://example.com/ar" />
          <p className="small soft">Run <code>npx playwright@1.55.0 install chromium</code> once first. In CI, use <code>dualkit/dualkit/action@main</code>. Every rule is in <a href="https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md">RULES.md</a>.</p>
        </section>
```

In `apps/site/lib/updates.ts`, tick the roadmap steps that are now true on main for "Dualkit check": `['First 20 rules', true]`, `['CLI and report', true]`, `['GitHub Action', true]`. Leave `['Released', false]` until both packages are on npm, then tick it and add a release entry in `RELEASES`.

In `apps/site/lib/copy.ts`, recount the strip: run `npm test` at the root, add up the four (now six) suites' test counts, and set `['<total>', 'tests passing']`.

- [ ] **Step 4: Verify everything**

Run at the repo root: `npm ci && npm run build -w @dualkit/format && npm run build -w @dualkit/rules && npx playwright@1.55.0 install chromium && npm run typecheck && npm test && npm run build -w dualkit && npm run build`
Expected: every suite passes, the site builds. Then push a branch, open a PR and confirm the Action self-test comments a score below 100 on it.

- [ ] **Step 5: Commit**

```bash
git add action .github/workflows packages/rules/README.md README.md apps/site
git commit -m "feat: dualkit check GitHub Action, CI, publishing and docs"
```

- [ ] **Step 6: Release (with Sam)**

Run the "Publish a package" workflow for `rules`, wait for npm's staged review to clear (about 15 minutes for a new package), then run it for `cli`. Confirm with `npx dualkit@beta check https://dualkit.dev` from a clean folder. Tick `['Released', true]` on the roadmap and add the release entry.
