# The Bench implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A monthly, automated benchmark that has free AI models build five Arabic screens alone and with the Dualkit skills, scores every build with `dualkit check`, commits the evidence, and publishes a /bench leaderboard on dualkit.dev.

**Architecture:** A private workspace `packages/bench` holds the prompts, the model list, provider adapters, a resumable runner and a summary builder. It renders and scores each build with the CLI's own `audit()` (imported from `packages/cli/src`), writes raw builds to `bench/runs/YYYY-MM/`, and writes the month summary to `apps/site/content/bench/YYYY-MM.json` plus WebP screenshots to `apps/site/public/bench/YYYY-MM/`. A scheduled GitHub Action runs it and pushes to main; Vercel redeploys the site, whose /bench page reads the committed JSON at build time.

**Tech Stack:** TypeScript (ESM, strict), tsx, vitest 3, Playwright 1.55.0 (Chromium), sharp, Next 15.5.27 / React 19.1.1, GitHub Actions.

**Spec:** `docs/plans/2026-10-19-bench-design.md`

## Global Constraints

- Playwright is pinned to `1.55.0` everywhere (`npx playwright@1.55.0 install chromium`).
- Node 22 in CI. Workspaces use the repo tsconfig style: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Every model call: temperature `0.4`, max output `8000` tokens.
- Every build is scored at `390` by `844` CSS px, network on.
- `3` runs per model, screen and condition. A cell needs at least `2` successful runs.
- Retries: at most `2` retries per call. Calls spaced to stay under `20` a minute.
- Schedule: `'17 4 1 * *'` (04:17 UTC on the 1st) plus `workflow_dispatch`.
- Screenshots: WebP, quality `90`, 1x (390 px wide).
- Rules total: `RULES.length` from `@dualkit/rules` (20 today); never hard-code 20 in code.
- Public copy: sentence case, no em dashes, no uppercase labels, no tiny mono section labels.
- The /bench page code waits for Sam's sign-off on Figma frames (Task 10).
- Commits use conventional commit format and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit API keys; keys are read only from `OPENROUTER_API_KEY` and `GEMINI_API_KEY`.
- The Write tool turns `\uXXXX` escapes into literal characters. Write any escape-bearing source through Python, or check code points after writing.

## Review Focus

1. **A model replies with prose and several code blocks** (a CSS block, then the HTML, then a JS block). Expected: the HTML block is chosen, not the first block. Pinned in Task 2.
2. **A model omits the hard parts** (no phone field, no IBAN) or returns a one-line page. Expected: the build is incomplete and scores 0, so it never beats an honest build. Pinned in Tasks 4 and 5.
3. **A 429 storm or a provider outage mid-run.** Expected: bounded retries, the run continues with other models, finished builds survive, a rerun only redoes failed builds. Pinned in Tasks 3 and 7.
4. **Runs that differ wildly** (20, 0, 18 rules passed). Expected: the cell shows a real build (lower-middle), never an average no build achieved, and the screenshot is that build. Pinned in Task 5.
5. **A model returns a page that never finishes loading or throws in script.** Expected: the build is scored or fails cleanly within the audit's timeouts; the run never hangs. Pinned in Task 4.

---

### Task 1: Scaffold the bench workspace, models and prompts

**Files:**
- Create: `packages/bench/package.json`, `packages/bench/tsconfig.json`, `packages/bench/vitest.config.ts`
- Create: `packages/bench/models.json`
- Create: `packages/bench/prompts/{payment-summary,otp,address-form,profile,order-history}.md` and `.json`
- Create: `packages/bench/src/config.ts`
- Test: `packages/bench/test/config.test.ts`

**Interfaces:**
- Produces:
  - `type Provider = 'openrouter' | 'gemini'`
  - `type ModelEntry = { id: string; provider: Provider; model: string; label: string; since: string }` (`since` is `YYYY-MM`)
  - `type RequiredPart = { label: string; selector?: string; text?: string; min?: number }` (`text` is a regex source, matched against `document.body.innerText`; `min` defaults to 1 and applies to the selector count)
  - `type Screen = { id: string; title: string; prompt: string; required: RequiredPart[] }`
  - `const SCREENS: readonly string[]` = `['payment-summary', 'otp', 'address-form', 'profile', 'order-history']`
  - `loadModels(file?: string): ModelEntry[]`, `loadScreens(dir?: string): Screen[]`, `class BenchError extends Error`
  - `const RUN = { temperature: 0.4, maxTokens: 8000, runs: 3, minRuns: 2, width: 390, height: 844 } as const`

- [ ] **Step 1: Create the package files**

`packages/bench/package.json`:
```json
{
  "name": "@dualkit/bench",
  "private": true,
  "type": "module",
  "scripts": {
    "bench": "tsx src/cli.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dualkit/rules": "*",
    "playwright": "1.55.0",
    "sharp": "^0.34.4"
  },
  "devDependencies": {
    "@types/node": "^22.20.5",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "vitest": "^3.2.7"
  }
}
```

`packages/bench/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

`packages/bench/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { testTimeout: 120_000, hookTimeout: 60_000 } })
```

Run `npm install` from the repo root so the workspace links and the lockfile updates.

- [ ] **Step 2: Write `models.json`**

Free model ids checked against `https://openrouter.ai/api/v1/models` on 19 Oct 2026. Before the first real run, confirm each id still lists, and confirm the Gemini id with `curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep flash`; pin the newest stable Flash id in place of the alias if one lists.

```json
[
  { "id": "gemini-flash", "provider": "gemini", "model": "gemini-flash-latest", "label": "Gemini Flash", "since": "2026-11" },
  { "id": "gemma-4-31b", "provider": "openrouter", "model": "google/gemma-4-31b-it:free", "label": "Gemma 4 31B", "since": "2026-11" },
  { "id": "nemotron-3-ultra", "provider": "openrouter", "model": "nvidia/nemotron-3-ultra-550b-a55b:free", "label": "Nemotron 3 Ultra", "since": "2026-11" },
  { "id": "inkling", "provider": "openrouter", "model": "thinkingmachines/inkling:free", "label": "Inkling", "since": "2026-11" },
  { "id": "laguna-s", "provider": "openrouter", "model": "poolside/laguna-s-2.1:free", "label": "Laguna S 2.1", "since": "2026-11" },
  { "id": "north-mini-code", "provider": "openrouter", "model": "cohere/north-mini-code:free", "label": "North Mini Code", "since": "2026-11" }
]
```

If the first run happens in October, set every `since` to `2026-10`.

- [ ] **Step 3: Write the five prompts**

Each `.md` is the exact user prompt. Each `.json` is `{ "title": string, "required": RequiredPart[] }`.

`prompts/payment-summary.md`:
```markdown
Build the payment summary screen of a UAE fintech app, in Arabic, for a phone.

It shows:
- a header with a back button and the title "Payment summary"
- the amount due, 1,234.50 AED
- the due date, 3 November 2026, in Gregorian and Hijri
- the line "You have 3 items in this order"
- a phone number field so the receipt can be sent by SMS, with the example 050 123 4567
- a "Pay now" button

Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.
```
`prompts/payment-summary.json`:
```json
{ "title": "Payment summary", "required": [
  { "label": "phone field", "selector": "input[type=tel], input[inputmode=tel], input[inputmode=numeric]" },
  { "label": "amount", "text": "(1[,٬]?234|١[٬,]?٢٣٤)" },
  { "label": "pay button", "selector": "button, [role=button], input[type=submit]" }
] }
```

`prompts/otp.md`:
```markdown
Build the one-time code screen of a Saudi banking app, in Arabic, for a phone.

It shows:
- the title "Enter the code" and the line "We sent a 6-digit code to +966 55 123 4567"
- six boxes for the code
- a countdown, "Resend in 0:45"
- a "Verify" button

Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.
```
`prompts/otp.json`:
```json
{ "title": "OTP", "required": [
  { "label": "code boxes", "selector": "input", "min": 1 },
  { "label": "phone number", "text": "(966|٩٦٦)" },
  { "label": "verify button", "selector": "button, [role=button], input[type=submit]" }
] }
```

`prompts/address-form.md`:
```markdown
Build the delivery address form of a Dubai grocery app, in Arabic, for a phone.

It has:
- fields for building or villa, street, area, and Makani number
- a picker for the emirate, defaulting to Dubai
- a phone number field with the example 050 123 4567
- a "Save address" button

Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.
```
`prompts/address-form.json`:
```json
{ "title": "Address form", "required": [
  { "label": "text fields", "selector": "input", "min": 4 },
  { "label": "emirate picker", "selector": "select, [role=listbox], [role=combobox], [role=radiogroup]" },
  { "label": "phone field", "selector": "input[type=tel], input[inputmode=tel], input[inputmode=numeric]" },
  { "label": "save button", "selector": "button, [role=button], input[type=submit]" }
] }
```

`prompts/profile.md`:
```markdown
Build the profile screen of a UAE payments app, in Arabic, for a phone.

It shows:
- the name Layla Al Mansouri and the email layla@example.com
- the phone number +971 50 123 4567
- the IBAN AE07 0331 2345 6789 0123 456
- an "Edit" action next to each of the three

Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.
```
`prompts/profile.json`:
```json
{ "title": "Profile", "required": [
  { "label": "IBAN", "text": "AE\\s?07" },
  { "label": "phone number", "text": "(971|٩٧١)" },
  { "label": "email", "text": "layla@example\\.com" }
] }
```

`prompts/order-history.md`:
```markdown
Build the order history screen of a Saudi shopping app, in Arabic, for a phone.

It lists four orders. Each shows an order number like #A-10293, the date in Gregorian and Hijri, the total in SAR, and a status: delivered, on the way, or cancelled.

Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.
```
`prompts/order-history.json`:
```json
{ "title": "Order history", "required": [
  { "label": "four orders", "text": "A-?\\d{5}[\\s\\S]*A-?\\d{5}[\\s\\S]*A-?\\d{5}[\\s\\S]*A-?\\d{5}" },
  { "label": "Hijri dates", "text": "(هـ|ه\\b|1448|١٤٤٨)" }
] }
```

- [ ] **Step 4: Write the failing test**

`packages/bench/test/config.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BenchError, loadModels, loadScreens, SCREENS } from '../src/config'

const tmp = () => mkdtempSync(join(tmpdir(), 'bench-'))

describe('loadModels', () => {
  it('loads the committed list with unique ids', () => {
    const models = loadModels()
    expect(models.length).toBeGreaterThanOrEqual(5)
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length)
  })
  it('rejects an unknown provider', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'openai', model: 'x', label: 'X', since: '2026-11' }]))
    expect(() => loadModels(file)).toThrow(BenchError)
  })
  it('rejects a bad since month', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'gemini', model: 'x', label: 'X', since: 'Nov' }]))
    expect(() => loadModels(file)).toThrow(/since/)
  })
})

describe('loadScreens', () => {
  it('loads all five screens in order, each with a prompt and required parts', () => {
    const screens = loadScreens()
    expect(screens.map((s) => s.id)).toEqual([...SCREENS])
    for (const s of screens) {
      expect(s.prompt.length).toBeGreaterThan(100)
      expect(s.required.length).toBeGreaterThan(0)
      for (const r of s.required) expect(r.selector ?? r.text).toBeTruthy()
    }
  })
  it('compiles every text pattern', () => {
    for (const s of loadScreens()) for (const r of s.required) if (r.text) expect(() => new RegExp(r.text!)).not.toThrow()
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- config`
Expected: FAIL, cannot find `../src/config`.

- [ ] **Step 6: Implement `src/config.ts`**

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Provider = 'openrouter' | 'gemini'
export type ModelEntry = { id: string; provider: Provider; model: string; label: string; since: string }
export type RequiredPart = { label: string; selector?: string; text?: string; min?: number }
export type Screen = { id: string; title: string; prompt: string; required: RequiredPart[] }

/** A problem with the bench's own files or arguments. The CLI prints it and exits 2. */
export class BenchError extends Error {}

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SCREENS = ['payment-summary', 'otp', 'address-form', 'profile', 'order-history'] as const
export const RUN = { temperature: 0.4, maxTokens: 8000, runs: 3, minRuns: 2, width: 390, height: 844 } as const
const PROVIDERS: readonly string[] = ['openrouter', 'gemini']
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new BenchError(`Could not read ${file}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export function loadModels(file = join(ROOT, 'models.json')): ModelEntry[] {
  const raw = readJson(file)
  if (!Array.isArray(raw)) throw new BenchError(`${file} must be a list of models.`)
  const models = raw.map((m: Record<string, unknown>, i) => {
    if (!isText(m.id) || !isText(m.model) || !isText(m.label)) throw new BenchError(`Model ${i} needs id, model and label.`)
    if (!PROVIDERS.includes(String(m.provider))) throw new BenchError(`Model ${m.id} has an unknown provider "${String(m.provider)}".`)
    if (!isText(m.since) || !MONTH.test(m.since)) throw new BenchError(`Model ${m.id} needs since as YYYY-MM.`)
    return { id: m.id, provider: m.provider as Provider, model: m.model, label: m.label, since: m.since }
  })
  if (new Set(models.map((m) => m.id)).size !== models.length) throw new BenchError('Model ids must be unique.')
  return models
}

const toPart = (p: Record<string, unknown>, screen: string): RequiredPart => {
  if (!isText(p.label) || (!isText(p.selector) && !isText(p.text))) throw new BenchError(`A required part in ${screen} needs a label and a selector or text.`)
  return {
    label: p.label,
    ...(isText(p.selector) ? { selector: p.selector } : {}),
    ...(isText(p.text) ? { text: p.text } : {}),
    ...(typeof p.min === 'number' ? { min: p.min } : {}),
  }
}

export function loadScreens(dir = join(ROOT, 'prompts')): Screen[] {
  return SCREENS.map((id) => {
    const meta = readJson(join(dir, `${id}.json`)) as { title?: unknown; required?: unknown }
    if (!isText(meta.title) || !Array.isArray(meta.required)) throw new BenchError(`${id}.json needs a title and a required list.`)
    const prompt = readFileSync(join(dir, `${id}.md`), 'utf8').trim()
    return { id, title: meta.title, prompt, required: meta.required.map((p) => toPart(p as Record<string, unknown>, id)) }
  })
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- config && npm run typecheck -w @dualkit/bench`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/bench package-lock.json
git commit -m "feat(bench): workspace, model list and the five prompts"
```

---

### Task 2: Extract the HTML from a reply

**Files:**
- Create: `packages/bench/src/extract.ts`
- Test: `packages/bench/test/extract.test.ts`

**Interfaces:**
- Produces: `extractHtml(reply: string): string | null`

Rules: prefer a fenced block tagged `html`; if several, the longest. Otherwise any fenced block whose body contains `<html` or `<!doctype`. Otherwise the whole reply when it starts (after whitespace) with `<!doctype` or `<html`. Otherwise `null`. Strip `<think>...</think>` reasoning before looking.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { extractHtml } from '../src/extract'

const page = '<!doctype html><html dir="rtl"><body>مرحبا</body></html>'
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

describe('extractHtml', () => {
  it('takes an html fenced block', () => {
    expect(extractHtml(`Here you go:\n${fence('html', page)}\nEnjoy.`)).toBe(page)
  })
  it('picks the html block, not the first block, when there are several', () => {
    const reply = [fence('css', 'body{}'), fence('html', page), fence('js', 'x()')].join('\n')
    expect(extractHtml(reply)).toBe(page)
  })
  it('picks the longest html block', () => {
    expect(extractHtml([fence('html', '<b>x</b>'), fence('html', page)].join('\n'))).toBe(page)
  })
  it('accepts an untagged block that holds a document', () => {
    expect(extractHtml(fence('', page))).toBe(page)
  })
  it('accepts a bare document', () => {
    expect(extractHtml(`\n  ${page}`)).toBe(page)
  })
  it('ignores reasoning blocks', () => {
    expect(extractHtml(`<think>${fence('html', '<p>draft</p>')}</think>${fence('html', page)}`)).toBe(page)
  })
  it('returns null for prose or an unrelated block', () => {
    expect(extractHtml('I cannot help with that.')).toBeNull()
    expect(extractHtml(fence('js', 'console.log(1)'))).toBeNull()
  })
  it('handles a reply cut off before the closing fence', () => {
    expect(extractHtml('```html\n' + page)).toBe(page)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- extract`
Expected: FAIL, cannot find `../src/extract`.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- extract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench/src/extract.ts packages/bench/test/extract.test.ts
git commit -m "feat(bench): pull the built page out of a model reply"
```

---

### Task 3: Providers, retries and pacing

**Files:**
- Create: `packages/bench/src/providers.ts`
- Test: `packages/bench/test/providers.test.ts`

**Interfaces:**
- Consumes: `ModelEntry`, `RUN` from Task 1.
- Produces:
  - `type Usage = { input: number; output: number }`
  - `type Generated = { ok: true; text: string; usage: Usage; ms: number } | { ok: false; error: string; ms: number }`
  - `type Generate = (model: ModelEntry, req: { system: string; prompt: string }) => Promise<Generated>`
  - `makeGenerate(opts: { env: Record<string, string | undefined>; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number }): Generate`
  - `const MAX_RETRIES = 2`, `const MIN_GAP_MS = 3100`

Behaviour:
- Missing key for the provider: `{ ok: false, error: 'No OPENROUTER_API_KEY' }` (or GEMINI), without calling fetch.
- Pacing: consecutive calls are at least `MIN_GAP_MS` apart (under 20 a minute).
- Retry on 429, 5xx and network errors, at most `MAX_RETRIES` times, waiting `Retry-After` seconds when given, otherwise 10 s then 30 s. 4xx other than 429 does not retry.
- A 200 with empty text is `{ ok: false, error: 'Empty reply' }`, no retry.
- Error strings carry the status and at most 200 characters of the body, never the key.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { ModelEntry } from '../src/config'
import { makeGenerate, MAX_RETRIES } from '../src/providers'

const or: ModelEntry = { id: 'g', provider: 'openrouter', model: 'google/gemma-4-31b-it:free', label: 'G', since: '2026-11' }
const gm: ModelEntry = { id: 'f', provider: 'gemini', model: 'gemini-flash-latest', label: 'F', since: '2026-11' }
const env = { OPENROUTER_API_KEY: 'or-secret', GEMINI_API_KEY: 'gm-secret' }
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

function fakeFetch(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses.shift()
    if (!r) throw new Error('no more responses')
    return r
  }) as unknown as typeof fetch
  return { f, calls }
}
const noSleep = { sleep: async () => {}, now: () => 0 }
const req = { system: 'sys', prompt: 'build it' }

describe('openrouter', () => {
  it('sends the model, messages, temperature and token cap, and reads the reply', async () => {
    const { f, calls } = fakeFetch([json(200, { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 5, completion_tokens: 7 } })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: true, text: 'hi', usage: { input: 5, output: 7 } })
    const body = JSON.parse(String(calls[0]!.init.body))
    expect(body).toMatchObject({ model: or.model, temperature: 0.4, max_tokens: 8000, messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'build it' }] })
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })
})

describe('gemini', () => {
  it('sends a system instruction and reads every text part', async () => {
    const { f, calls } = fakeFetch([json(200, { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(gm, req)
    expect(out).toMatchObject({ ok: true, text: 'ab', usage: { input: 1, output: 2 } })
    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent')
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ systemInstruction: { parts: [{ text: 'sys' }] }, generationConfig: { temperature: 0.4, maxOutputTokens: 8000 } })
  })
})

describe('failures', () => {
  it('skips a provider with no key without calling it', async () => {
    const { f, calls } = fakeFetch([])
    const out = await makeGenerate({ env: {}, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: 'No OPENROUTER_API_KEY' })
    expect(calls).toHaveLength(0)
  })
  it('retries a 429 at most MAX_RETRIES times, then gives up', async () => {
    const { f, calls } = fakeFetch(Array.from({ length: 5 }, () => json(429, { error: 'slow down' })))
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out.ok).toBe(false)
    expect(calls).toHaveLength(1 + MAX_RETRIES)
  })
  it('recovers when a retry succeeds', async () => {
    const { f } = fakeFetch([json(503, {}), json(200, { choices: [{ message: { content: 'ok' } }] })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(or, req)).toMatchObject({ ok: true, text: 'ok' })
  })
  it('does not retry a 400', async () => {
    const { f, calls } = fakeFetch([json(400, { error: 'bad model' }), json(200, {})])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false })
    expect(calls).toHaveLength(1)
  })
  it('never puts the key in an error', async () => {
    const { f } = fakeFetch([json(401, { error: 'bad key or-secret' })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(JSON.stringify(out)).not.toContain('or-secret')
  })
  it('treats an empty reply as a failure', async () => {
    const { f } = fakeFetch([json(200, { choices: [{ message: { content: '' } }] })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(or, req)).toMatchObject({ ok: false, error: 'Empty reply' })
  })
  it('honours Retry-After', async () => {
    const waits: number[] = []
    const { f } = fakeFetch([json(429, {}, { 'retry-after': '7' }), json(200, { choices: [{ message: { content: 'ok' } }] })])
    await makeGenerate({ env, fetch: f, sleep: async (ms) => { waits.push(ms) }, now: () => 0 })(or, req)
    expect(waits).toContain(7000)
  })
})

describe('pacing', () => {
  it('spaces consecutive calls at least MIN_GAP_MS apart', async () => {
    let clock = 0
    const waits: number[] = []
    const ok = () => json(200, { choices: [{ message: { content: 'x' } }] })
    const { f } = fakeFetch([ok(), ok()])
    const gen = makeGenerate({ env, fetch: f, sleep: async (ms) => { waits.push(ms); clock += ms }, now: () => clock })
    await gen(or, req)
    await gen(or, req)
    expect(waits.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3100)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- providers`
Expected: FAIL, cannot find `../src/providers`.

- [ ] **Step 3: Implement `src/providers.ts`**

```ts
import { RUN, type ModelEntry, type Provider } from './config'

export type Usage = { input: number; output: number }
export type Generated = { ok: true; text: string; usage: Usage; ms: number } | { ok: false; error: string; ms: number }
export type Generate = (model: ModelEntry, req: { system: string; prompt: string }) => Promise<Generated>
type Options = { env: Record<string, string | undefined>; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number }

export const MAX_RETRIES = 2
/** 20 a minute is the free-model cap; a little over 3 s apart stays under it. */
export const MIN_GAP_MS = 3100
const BACKOFF_MS = [10_000, 30_000]
const ERROR_BODY_CHARS = 200
const KEY: Record<Provider, string> = { openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY' }

type Call = { url: string; init: RequestInit; read: (body: any) => { text: string; usage: Usage } }

function request(model: ModelEntry, key: string, { system, prompt }: { system: string; prompt: string }): Call {
  if (model.provider === 'openrouter') return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    init: { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Dualkit Bench', 'http-referer': 'https://dualkit.dev/bench' },
      body: JSON.stringify({ model: model.model, temperature: RUN.temperature, max_tokens: RUN.maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) },
    read: (b) => ({ text: String(b?.choices?.[0]?.message?.content ?? ''), usage: { input: Number(b?.usage?.prompt_tokens ?? 0), output: Number(b?.usage?.completion_tokens ?? 0) } }),
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`,
    init: { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: RUN.temperature, maxOutputTokens: RUN.maxTokens } }) },
    read: (b) => ({
      text: (b?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''),
      usage: { input: Number(b?.usageMetadata?.promptTokenCount ?? 0), output: Number(b?.usageMetadata?.candidatesTokenCount ?? 0) },
    }),
  }
}

const retryable = (status: number) => status === 429 || status >= 500
const redact = (s: string, key: string) => s.split(key).join('***').slice(0, ERROR_BODY_CHARS)

export function makeGenerate({ env, fetch: f = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now }: Options): Generate {
  let last = -Infinity
  const pace = async () => {
    const wait = last + MIN_GAP_MS - now()
    if (wait > 0) await sleep(wait)
    last = now()
  }
  return async (model, req) => {
    const started = now()
    const key = env[KEY[model.provider]]
    if (!key) return { ok: false, error: `No ${KEY[model.provider]}`, ms: 0 }
    const call = request(model, key, req)
    let error = 'No attempt made'
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await pace()
      let res: Response
      try {
        res = await f(call.url, call.init)
      } catch (e) {
        error = redact(`Network error: ${e instanceof Error ? e.message : String(e)}`, key)
        if (attempt < MAX_RETRIES) await sleep(BACKOFF_MS[attempt] ?? 30_000)
        continue
      }
      if (res.ok) {
        const { text, usage } = call.read(await res.json().catch(() => null))
        return text.trim() ? { ok: true, text, usage, ms: now() - started } : { ok: false, error: 'Empty reply', ms: now() - started }
      }
      error = redact(`HTTP ${res.status}: ${await res.text().catch(() => '')}`, key)
      if (!retryable(res.status)) break
      const after = Number(res.headers.get('retry-after'))
      if (attempt < MAX_RETRIES) await sleep(after > 0 ? after * 1000 : BACKOFF_MS[attempt] ?? 30_000)
    }
    return { ok: false, error, ms: now() - started }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- providers && npm run typecheck -w @dualkit/bench`
Expected: PASS. If `any` in `read` trips a lint rule, keep it; the body is untrusted and every field is coerced.

- [ ] **Step 5: Commit**

```bash
git add packages/bench/src/providers.ts packages/bench/test/providers.test.ts
git commit -m "feat(bench): OpenRouter and Gemini adapters with bounded retries and pacing"
```

---

### Task 4: Score a build (audit plus required parts)

**Files:**
- Create: `packages/bench/src/score.ts`
- Create: `packages/bench/test/fixtures/{good,buggy,incomplete,hang}.html`
- Test: `packages/bench/test/score.test.ts`

**Interfaces:**
- Consumes: `RequiredPart`, `RUN` (Task 1); `audit` from `packages/cli/src/audit.ts` (`audit({ url, width, height, config: { ignore: [], exclude: [] } }) => Promise<AuditResult>`, throws `UserError` on failure); `RULES` from `@dualkit/rules`.
- Produces:
  - `type SlimFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }`
  - `type Scored = { ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[]; screenshot: string; pageHeight: number } | { ok: false; error: string }` (`screenshot` is PNG base64, 2x or 1x per the audit)
  - `scoreHtml(html: string, required: readonly RequiredPart[], opts?: { browser?: Browser }): Promise<Scored>`
  - `missingParts(page: Page, required: readonly RequiredPart[]): Promise<string[]>`
  - `const RULE_COUNT = RULES.length`

Implementation notes:
- Write the HTML to a temp file and pass its `file://` URL, so relative oddities cannot reach the repo.
- The CLI package has no exports for `audit`; import it by relative path: `import { audit } from '../../cli/src/audit'`. That pulls `@dualkit/rules` from its built `dist`, so `npm run build -w @dualkit/rules` must run before bench tests (CI already does this).
- `rulesPassed = RULE_COUNT - new Set(findings.map(f => f.rule)).size`.
- Required parts use their own Chromium page at the same viewport, after `load` (bounded to 10 s) and 800 ms settle, with a 30 s goto timeout.

- [ ] **Step 1: Write the fixtures**

`test/fixtures/good.html`: a correct Arabic payment summary.
```html
<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;font-size:17px;line-height:1.8;margin:0;padding:24px}
input,button{font:inherit;padding-block:12px;padding-inline:16px;inline-size:100%;box-sizing:border-box}</style></head>
<body>
<header><button aria-label="رجوع">→</button><h1>ملخص الدفع</h1></header>
<p>المبلغ المستحق: <bdi>1,234.50 د.إ</bdi></p>
<p>تاريخ الاستحقاق: ٣ نوفمبر ٢٠٢٦</p>
<p>لديك ٣ منتجات في هذا الطلب</p>
<label>رقم الجوال <input type="tel" dir="ltr" placeholder="050 123 4567"></label>
<button>ادفع الآن</button>
</body></html>
```

`test/fixtures/buggy.html`: same parts with known bugs (no `dir`, unisolated phone, physical margins, Arabic in a Latin-only font with tight leading).
```html
<!doctype html>
<html lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:Arial;font-size:12px;line-height:1.1;letter-spacing:.05em;margin-left:24px;text-align:left}</style></head>
<body>
<header><button>← رجوع</button><h1>ملخص الدفع</h1></header>
<p>المبلغ المستحق 1,234.50 AED</p>
<p>أرسل الإيصال إلى 050 123 4567.</p>
<input type="tel" placeholder="050 123 4567">
<button>ادفع الآن</button>
</body></html>
```

`test/fixtures/incomplete.html`: a one-line page.
```html
<!doctype html><html lang="ar" dir="rtl"><body><p>مرحبا</p></body></html>
```

`test/fixtures/hang.html`: a page whose image never loads and whose script throws.
```html
<!doctype html><html lang="ar" dir="rtl"><body><p>ملخص الدفع 1,234.50</p><input type="tel"><button>ادفع</button>
<img src="http://10.255.255.1/never.png"><script>throw new Error('boom')</script></body></html>
```

- [ ] **Step 2: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadScreens } from '../src/config'
import { RULE_COUNT, scoreHtml } from '../src/score'

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8')
const payment = loadScreens().find((s) => s.id === 'payment-summary')!
let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(async () => { await browser.close() })

describe('scoreHtml', () => {
  it('scores a good build high with nothing missing', async () => {
    const out = await scoreHtml(fixture('good'), payment.required, { browser })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.missing).toEqual([])
    expect(out.rulesPassed).toBeGreaterThanOrEqual(RULE_COUNT - 2)
    expect(out.screenshot.length).toBeGreaterThan(1000)
  })
  it('scores a buggy build lower than the good one', async () => {
    const good = await scoreHtml(fixture('good'), payment.required, { browser })
    const bad = await scoreHtml(fixture('buggy'), payment.required, { browser })
    if (!good.ok || !bad.ok) throw new Error('both should score')
    expect(bad.rulesPassed).toBeLessThan(good.rulesPassed)
    expect(bad.findings.every((f) => typeof f.rule === 'string')).toBe(true)
  })
  it('names every missing part of a one-line page', async () => {
    const out = await scoreHtml(fixture('incomplete'), payment.required, { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.missing).toEqual(['phone field', 'amount', 'pay button'])
  })
  it('scores a page with a hung image and a throwing script, within the audit timeouts', async () => {
    const started = Date.now()
    const out = await scoreHtml(fixture('hang'), payment.required, { browser })
    expect(out.ok).toBe(true)
    expect(Date.now() - started).toBeLessThan(60_000)
  })
  it('counts a selector with min', async () => {
    const out = await scoreHtml('<!doctype html><html dir="rtl"><body><input><input></body></html>', [{ label: 'four', selector: 'input', min: 4 }], { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.missing).toEqual(['four'])
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run build -w @dualkit/rules && npm test -w @dualkit/bench -- score`
Expected: FAIL, cannot find `../src/score`.

- [ ] **Step 4: Implement `src/score.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RULES } from '@dualkit/rules'
import { chromium, type Browser, type Page } from 'playwright'
// The CLI publishes only its binary, so the bench imports the audit from source, the same code `dualkit check` runs.
import { audit } from '../../cli/src/audit'
import { RUN, type RequiredPart } from './config'

export type SlimFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type Scored =
  | { ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[]; screenshot: string; pageHeight: number }
  | { ok: false; error: string }

export const RULE_COUNT = RULES.length
const GOTO_MS = 30_000
const LOAD_MS = 10_000
const SETTLE_MS = 800

export async function missingParts(page: Page, required: readonly RequiredPart[]): Promise<string[]> {
  return page.evaluate((parts) => {
    const text = document.body?.innerText ?? ''
    return parts.filter((p) => {
      const bySelector = p.selector ? document.querySelectorAll(p.selector).length >= (p.min ?? 1) : true
      const byText = p.text ? new RegExp(p.text).test(text) : true
      return !(bySelector && byText)
    }).map((p) => p.label)
  }, [...required])
}

async function checkRequired(browser: Browser, url: string, required: readonly RequiredPart[]): Promise<string[]> {
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS })
    await page.waitForLoadState('load', { timeout: LOAD_MS }).catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    return await missingParts(page, required)
  } finally {
    await context.close().catch(() => {})
  }
}

export async function scoreHtml(html: string, required: readonly RequiredPart[], opts: { browser?: Browser } = {}): Promise<Scored> {
  const dir = mkdtempSync(join(tmpdir(), 'bench-build-'))
  const file = join(dir, 'index.html')
  writeFileSync(file, html)
  const url = pathToFileURL(file).href
  const own = opts.browser ? null : await chromium.launch()
  const browser = opts.browser ?? own!
  try {
    // audit() closes the browser it is given, so it gets its own; the shared one stays for the required parts.
    const result = await audit({ url, width: RUN.width, height: RUN.height, config: { ignore: [], exclude: [] } })
    const missing = await checkRequired(browser, url, required)
    const findings = result.findings.map((f) => ({ rule: f.rule, title: f.title, severity: f.severity, box: f.node?.box ?? null }))
    return {
      ok: true, rulesPassed: RULE_COUNT - new Set(findings.map((f) => f.rule)).size, score: result.score,
      missing, findings, screenshot: result.screenshot, pageHeight: result.pageHeight,
    }
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? 'Render failed' }
  } finally {
    await own?.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  }
}
```

If `NodeRef.box` has a different shape than `{ x, y, width, height }`, map it explicitly; check `packages/rules/src/model.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- score && npm run typecheck -w @dualkit/bench`
Expected: PASS. If the good fixture fails a rule, read the finding and fix the fixture (it must be a genuinely correct page), not the threshold.

- [ ] **Step 6: Commit**

```bash
git add packages/bench/src/score.ts packages/bench/test/score.test.ts packages/bench/test/fixtures
git commit -m "feat(bench): score a build with the check audit and the prompt's required parts"
```

---

### Task 5: Cells, totals and lift

**Files:**
- Create: `packages/bench/src/cells.ts`
- Test: `packages/bench/test/cells.test.ts`

**Interfaces:**
- Consumes: `RUN.minRuns` (Task 1).
- Produces:
  - `type BuildScore = { run: number; rulesPassed: number; score: number; missing: string[] }`
  - `effective(b: BuildScore): { rulesPassed: number; score: number }` (incomplete means 0 and 0)
  - `type Cell = { ran: false; runs: number } | { ran: true; runs: number; median: BuildScore; rulesPassed: number; score: number }`
  - `cell(builds: readonly BuildScore[]): Cell`
  - `type Total = { rulesPassed: number; outOf: number; score: number }`
  - `type Scorable = { ran: false } | { ran: true; rulesPassed: number; score: number }` (a `Cell` and the site's `BenchCell` both fit)
  - `total(cells: readonly Scorable[], ruleCount: number): Total | null`
  - `lift(alone: Total | null, dualkit: Total | null): number | null`

Median rule: sort successful builds by effective `(rulesPassed, score, -run)` ascending and take index `floor((n - 1) / 2)`, the lower middle, so the cell is always a real build.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { cell, effective, lift, total, type BuildScore } from '../src/cells'

const b = (run: number, rulesPassed: number, score = rulesPassed * 5, missing: string[] = []): BuildScore => ({ run, rulesPassed, score, missing })

describe('effective', () => {
  it('zeroes an incomplete build', () => {
    expect(effective(b(1, 20, 100, ['phone field']))).toEqual({ rulesPassed: 0, score: 0 })
  })
})

describe('cell', () => {
  it('takes the middle of three', () => {
    const c = cell([b(1, 18), b(2, 9), b(3, 14)])
    expect(c).toMatchObject({ ran: true, runs: 3, rulesPassed: 14, median: { run: 3 } })
  })
  it('is a real build when runs differ wildly', () => {
    const c = cell([b(1, 20), b(2, 0), b(3, 18)])
    if (!c.ran) throw new Error('should run')
    expect([20, 0, 18]).toContain(c.rulesPassed)
    expect(c.rulesPassed).toBe(18)
  })
  it('takes the lower of two', () => {
    expect(cell([b(1, 18), b(2, 10)])).toMatchObject({ ran: true, runs: 2, rulesPassed: 10 })
  })
  it('does not run with fewer than two builds', () => {
    expect(cell([b(1, 18)])).toEqual({ ran: false, runs: 1 })
    expect(cell([])).toEqual({ ran: false, runs: 0 })
  })
  it('lets an incomplete build drag the cell down, never up', () => {
    const c = cell([b(1, 20, 100, ['IBAN']), b(2, 20, 100, ['IBAN']), b(3, 12)])
    expect(c).toMatchObject({ ran: true, rulesPassed: 0 })
  })
  it('breaks ties by score', () => {
    expect(cell([b(1, 15, 40), b(2, 15, 10), b(3, 15, 70)])).toMatchObject({ score: 40 })
  })
})

describe('total and lift', () => {
  const ran = (n: number, s = n * 5) => cell([b(1, n, s), b(2, n, s), b(3, n, s)])
  it('sums five screens and averages the score', () => {
    expect(total([ran(10), ran(12), ran(14), ran(16), ran(18)], 20)).toEqual({ rulesPassed: 70, outOf: 100, score: 70 })
  })
  it('is null when any screen did not run', () => {
    expect(total([ran(10), ran(12), cell([]), ran(16), ran(18)], 20)).toBeNull()
  })
  it('is the difference, or null when either side is missing', () => {
    expect(lift({ rulesPassed: 50, outOf: 100, score: 10 }, { rulesPassed: 82, outOf: 100, score: 60 })).toBe(32)
    expect(lift(null, { rulesPassed: 82, outOf: 100, score: 60 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- cells`
Expected: FAIL, cannot find `../src/cells`.

- [ ] **Step 3: Implement**

```ts
import { RUN } from './config'

export type BuildScore = { run: number; rulesPassed: number; score: number; missing: string[] }
export type Cell = { ran: false; runs: number } | { ran: true; runs: number; median: BuildScore; rulesPassed: number; score: number }
export type Total = { rulesPassed: number; outOf: number; score: number }

/** An incomplete build left out a part the prompt asked for, so it scores nothing: skipping the hard parts must never pay. */
export const effective = (b: BuildScore) => (b.missing.length > 0 ? { rulesPassed: 0, score: 0 } : { rulesPassed: b.rulesPassed, score: b.score })

export function cell(builds: readonly BuildScore[]): Cell {
  if (builds.length < RUN.minRuns) return { ran: false, runs: builds.length }
  const sorted = [...builds].sort((a, c) => {
    const ea = effective(a), ec = effective(c)
    return ea.rulesPassed - ec.rulesPassed || ea.score - ec.score || c.run - a.run
  })
  // The lower middle: with three it is the median, with two the worse one. Always a build that exists.
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!
  return { ran: true, runs: builds.length, median, ...effective(median) }
}

export type Scorable = { ran: false } | { ran: true; rulesPassed: number; score: number }

export function total(cells: readonly Scorable[], ruleCount: number): Total | null {
  const ran = cells.filter((c): c is Extract<Scorable, { ran: true }> => c.ran)
  if (ran.length !== cells.length || ran.length === 0) return null
  return {
    rulesPassed: ran.reduce((s, c) => s + c.rulesPassed, 0),
    outOf: ruleCount * ran.length,
    score: Math.round(ran.reduce((s, c) => s + c.score, 0) / ran.length),
  }
}

export const lift = (alone: Total | null, dualkit: Total | null): number | null => (alone && dualkit ? dualkit.rulesPassed - alone.rulesPassed : null)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- cells`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench/src/cells.ts packages/bench/test/cells.test.ts
git commit -m "feat(bench): median cells, row totals and lift"
```

---

### Task 6: The build store

**Files:**
- Create: `packages/bench/src/store.ts`
- Test: `packages/bench/test/store.test.ts`

**Interfaces:**
- Consumes: `SlimFinding` (Task 4), `Usage` (Task 3).
- Produces:
  - `type Condition = 'alone' | 'dualkit'`
  - `type BuildKey = { month: string; model: string; screen: string; condition: Condition; run: number }`
  - `type BuildRecord = BuildKey & { at: string; reply: string | null; usage: Usage | null; ms: number } & ({ ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[] } | { ok: false; error: string })`
  - `makeStore(root: string)` returning `{ paths(k: BuildKey): { json: string; html: string }; write(rec: BuildRecord, html: string | null): void; read(k: BuildKey): BuildRecord | null; isDone(k: BuildKey): boolean; list(month: string): BuildRecord[] }`
  - Default root: `<repo>/bench/runs`.

`isDone` is true only for `ok: true` records, so a rerun redoes failed builds and skips finished ones. `write` writes the HTML first and the JSON last, so a crash between them leaves the build not done. `read` returns null for an unreadable JSON file instead of throwing, and `list` skips such files.

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeStore, type BuildKey, type BuildRecord } from '../src/store'

const key: BuildKey = { month: '2026-11', model: 'gemma-4-31b', screen: 'otp', condition: 'alone', run: 1 }
const okRec = (k: BuildKey): BuildRecord => ({ ...k, at: '2026-11-01T04:20:00Z', reply: 'r', usage: { input: 1, output: 2 }, ms: 5, ok: true, rulesPassed: 12, score: 30, missing: [], findings: [] })
const failRec = (k: BuildKey): BuildRecord => ({ ...k, at: '2026-11-01T04:20:00Z', reply: null, usage: null, ms: 5, ok: false, error: 'HTTP 429' })

describe('store', () => {
  it('lays builds out by month, model, screen and condition', () => {
    const s = makeStore('/r')
    expect(s.paths(key)).toEqual({ json: '/r/2026-11/gemma-4-31b/otp/alone-1.json', html: '/r/2026-11/gemma-4-31b/otp/alone-1.html' })
  })
  it('round-trips a record', () => {
    const s = makeStore(mkdtempSync(join(tmpdir(), 'store-')))
    s.write(okRec(key), '<html></html>')
    expect(s.read(key)).toEqual(okRec(key))
  })
  it('counts only successful builds as done', () => {
    const s = makeStore(mkdtempSync(join(tmpdir(), 'store-')))
    s.write(failRec(key), null)
    expect(s.isDone(key)).toBe(false)
    s.write(okRec(key), '<html></html>')
    expect(s.isDone(key)).toBe(true)
  })
  it('treats a corrupt record as not done and leaves it out of the list', () => {
    const root = mkdtempSync(join(tmpdir(), 'store-'))
    const s = makeStore(root)
    s.write(okRec({ ...key, run: 2 }), '<html></html>')
    s.write(okRec(key), '<html></html>')
    writeFileSync(s.paths(key).json, '{ half')
    expect(s.isDone(key)).toBe(false)
    expect(s.list('2026-11').map((r) => r.run)).toEqual([2])
  })
  it('lists nothing for a month that never ran', () => {
    expect(makeStore(mkdtempSync(join(tmpdir(), 'store-'))).list('2026-12')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- store`
Expected: FAIL, cannot find `../src/store`.

- [ ] **Step 3: Implement**

```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ROOT } from './config'
import type { Usage } from './providers'
import type { SlimFinding } from './score'

export type Condition = 'alone' | 'dualkit'
export type BuildKey = { month: string; model: string; screen: string; condition: Condition; run: number }
export type BuildRecord = BuildKey & { at: string; reply: string | null; usage: Usage | null; ms: number }
  & ({ ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[] } | { ok: false; error: string })

export const RUNS_ROOT = join(ROOT, '..', '..', 'bench', 'runs')
const FILE = /^(alone|dualkit)-(\d+)\.json$/

const readRecord = (file: string): BuildRecord | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as BuildRecord
  } catch {
    return null
  }
}
const dirs = (path: string) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])

export function makeStore(root = RUNS_ROOT) {
  const paths = (k: BuildKey) => {
    const base = join(root, k.month, k.model, k.screen, `${k.condition}-${k.run}`)
    return { json: `${base}.json`, html: `${base}.html` }
  }
  const read = (k: BuildKey) => readRecord(paths(k).json)
  return {
    paths,
    read,
    isDone: (k: BuildKey) => read(k)?.ok === true,
    write(rec: BuildRecord, html: string | null) {
      const p = paths(rec)
      mkdirSync(dirname(p.json), { recursive: true })
      // HTML first, JSON last: the JSON marks the build done, so a crash in between leaves it to be redone.
      if (html !== null) writeFileSync(p.html, html)
      writeFileSync(p.json, `${JSON.stringify(rec, null, 2)}\n`)
    },
    list(month: string): BuildRecord[] {
      const out: BuildRecord[] = []
      for (const model of dirs(join(root, month)).sort())
        for (const screen of dirs(join(root, month, model)).sort())
          for (const name of readdirSync(join(root, month, model, screen)).filter((n) => FILE.test(n)).sort()) {
            const rec = readRecord(join(root, month, model, screen, name))
            if (rec) out.push(rec)
          }
      return out
    },
  }
}
export type Store = ReturnType<typeof makeStore>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- store && npm run typecheck -w @dualkit/bench`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench/src/store.ts packages/bench/test/store.test.ts
git commit -m "feat(bench): resumable build store under bench/runs"
```

---

### Task 7: The runner and its CLI

**Files:**
- Create: `packages/bench/src/system.ts`, `packages/bench/src/run.ts`, `packages/bench/src/cli.ts`, `packages/bench/src/fake.ts`
- Test: `packages/bench/test/run.test.ts`, `packages/bench/test/system.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces:
  - `BASE_SYSTEM: string`, `systemPrompt(condition: Condition, skillsDir?: string): string`
  - `runBench(opts: { month: string; models: ModelEntry[]; screens: Screen[]; generate: Generate; store: Store; score?: typeof scoreHtml; log?: (line: string) => void }): Promise<{ built: number; skipped: number; failed: number }>`
  - `fakeGenerate: Generate` (returns fixture pages by model id: `fake-good`, `fake-buggy`, `fake-incomplete`, `fake-garbage`; the `dualkit` condition of `fake-buggy` returns the good page)
  - `currentMonth(now?: Date): string` (UTC `YYYY-MM`)
  - CLI: `tsx src/cli.ts [--month YYYY-MM] [--model <id>] [--fake] [--summary-only]`. Exit 0 when done, 1 when every build failed, 2 on a `BenchError`.

`systemPrompt('alone')` is `BASE_SYSTEM`. `systemPrompt('dualkit')` is `BASE_SYSTEM` + `\n\n` + each of `plugin/skills/*/SKILL.md`, sorted by folder name, each preceded by `# Skill: <folder>\n\n`.

`BASE_SYSTEM`:
```
You are a front-end developer. Build exactly what the user asks for. Reply with one complete, self-contained HTML file in a single html code block, and nothing else.
```

The loop order is model, screen, condition, run. Each build: skip if done; call `generate`; extract; score with the screen's required parts; write the record. A model whose first three calls all fail with a missing key or HTTP 401/403/404 is skipped for the rest of the run (its later builds are not attempted, so the daily cap is not burned).

- [ ] **Step 1: Write the failing tests**

`test/system.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { BASE_SYSTEM, systemPrompt } from '../src/system'

describe('systemPrompt', () => {
  it('is the base prompt alone', () => {
    expect(systemPrompt('alone')).toBe(BASE_SYSTEM)
  })
  it('adds the four skills in folder order with Dualkit', () => {
    const s = systemPrompt('dualkit')
    const order = ['dualkit-bilingual-copy', 'dualkit-gulf-formats', 'dualkit-rtl-layout', 'dualkit-type-pairing'].map((n) => s.indexOf(`# Skill: ${n}`))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(s.startsWith(BASE_SYSTEM)).toBe(true)
  })
})
```

`test/run.test.ts`:
```ts
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadScreens, type ModelEntry } from '../src/config'
import { fakeGenerate } from '../src/fake'
import type { Generate } from '../src/providers'
import { currentMonth, runBench } from '../src/run'
import { makeStore } from '../src/store'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id, since: '2026-11' })
const screens = loadScreens().slice(0, 1)
const fastScore = async () => ({ ok: true as const, rulesPassed: 15, score: 40, missing: [], findings: [], screenshot: 'x', pageHeight: 800 })

describe('runBench', () => {
  it('builds every model, screen, condition and run, then skips them on a rerun', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore }
    expect(await runBench(opts)).toEqual({ built: 6, skipped: 0, failed: 0 })
    expect(await runBench(opts)).toEqual({ built: 0, skipped: 6, failed: 0 })
  })
  it('records garbage replies as failed builds and redoes them next time', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-garbage')], screens, generate: fakeGenerate, store, score: fastScore })
    expect(out.failed).toBe(6)
    expect(store.list('2026-11').every((r) => !r.ok && r.error === 'No HTML in the reply')).toBe(true)
  })
  it('stops calling a model after three auth failures, and carries on with the next', async () => {
    let calls = 0
    const deny: Generate = async (m) => (m.id === 'locked' ? (calls++, { ok: false, error: 'HTTP 401: no', ms: 1 }) : fakeGenerate(m, { system: '', prompt: '' }))
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('locked'), model('fake-good')], screens, generate: deny, store, score: fastScore })
    expect(calls).toBe(3)
    expect(out.built).toBe(6)
  })
  it('keeps going when scoring throws', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const boom = async () => { throw new Error('chromium died') }
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: boom })
    expect(out.failed).toBe(6)
  })
})

describe('currentMonth', () => {
  it('is the UTC month', () => {
    expect(currentMonth(new Date('2026-11-01T00:30:00+04:00'))).toBe('2026-10')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @dualkit/bench -- run system`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement `src/system.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config'
import type { Condition } from './store'

export const BASE_SYSTEM = 'You are a front-end developer. Build exactly what the user asks for. Reply with one complete, self-contained HTML file in a single html code block, and nothing else.'
const SKILLS = join(ROOT, '..', '..', 'plugin', 'skills')

/** With Dualkit, the four skills go in whole, as Claude Code loads them when they fire. */
export function systemPrompt(condition: Condition, skillsDir = SKILLS): string {
  if (condition === 'alone') return BASE_SYSTEM
  const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  return [BASE_SYSTEM, ...skills.map((name) => `# Skill: ${name}\n\n${readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8').trim()}`)].join('\n\n')
}
```

- [ ] **Step 4: Implement `src/fake.ts`**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config'
import type { Generate } from './providers'

const fixture = (name: string) => readFileSync(join(ROOT, 'test', 'fixtures', `${name}.html`), 'utf8')
const fenced = (html: string) => '```html\n' + html + '\n```'

/** A provider for dry runs and tests: no network, the same pages every time. */
export const fakeGenerate: Generate = async (model, req) => {
  const dualkit = req.system.includes('# Skill:')
  const page: Record<string, string> = {
    'fake-good': fenced(fixture('good')),
    'fake-buggy': fenced(fixture(dualkit ? 'good' : 'buggy')),
    'fake-incomplete': fenced(fixture('incomplete')),
    'fake-garbage': 'Sorry, I cannot build that.',
  }
  const text = page[model.id]
  return text ? { ok: true, text, usage: { input: 0, output: 0 }, ms: 0 } : { ok: false, error: `No fake page for ${model.id}`, ms: 0 }
}
```

- [ ] **Step 5: Implement `src/run.ts`**

```ts
import { chromium } from 'playwright'
import { RUN, type ModelEntry, type Screen } from './config'
import { extractHtml } from './extract'
import type { Generate } from './providers'
import { scoreHtml } from './score'
import type { BuildKey, BuildRecord, Condition, Store } from './store'
import { systemPrompt } from './system'

const CONDITIONS: readonly Condition[] = ['alone', 'dualkit']
const LOCKED = /^No [A-Z_]+_API_KEY$|^HTTP (401|403|404)\b/
const LOCK_AFTER = 3

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7)

type Options = { month: string; models: ModelEntry[]; screens: Screen[]; generate: Generate; store: Store; score?: typeof scoreHtml; log?: (line: string) => void }

export async function runBench({ month, models, screens, generate, store, score = scoreHtml, log = () => {} }: Options) {
  const counts = { built: 0, skipped: 0, failed: 0 }
  const browser = score === scoreHtml ? await chromium.launch() : undefined
  try {
    for (const model of models) {
      let locked = 0
      for (const screen of screens) for (const condition of CONDITIONS) for (let run = 1; run <= RUN.runs; run++) {
        const key: BuildKey = { month, model: model.id, screen: screen.id, condition, run }
        if (store.isDone(key)) { counts.skipped++; continue }
        if (locked >= LOCK_AFTER) continue
        const rec = await build(key, model, screen, generate, score, browser)
        locked = !rec.record.ok && LOCKED.test(rec.record.error) ? locked + 1 : 0
        store.write(rec.record, rec.html)
        if (rec.record.ok) counts.built++
        else counts.failed++
        log(`${key.model} ${key.screen} ${key.condition} ${key.run}: ${rec.record.ok ? `${rec.record.rulesPassed} rules` : rec.record.error}`)
      }
      if (locked >= LOCK_AFTER) log(`${model.id}: skipped for this run after ${LOCK_AFTER} access errors`)
    }
  } finally {
    await browser?.close().catch(() => {})
  }
  return counts
}

async function build(key: BuildKey, model: ModelEntry, screen: Screen, generate: Generate, score: typeof scoreHtml, browser?: import('playwright').Browser): Promise<{ record: BuildRecord; html: string | null }> {
  const base = { ...key, at: new Date().toISOString() }
  const gen = await generate(model, { system: systemPrompt(key.condition), prompt: screen.prompt })
  if (!gen.ok) return { record: { ...base, reply: null, usage: null, ms: gen.ms, ok: false, error: gen.error }, html: null }
  const meta = { ...base, reply: gen.text, usage: gen.usage, ms: gen.ms }
  const html = extractHtml(gen.text)
  if (html === null) return { record: { ...meta, ok: false, error: 'No HTML in the reply' }, html: null }
  try {
    const s = await score(html, screen.required, browser ? { browser } : {})
    if (!s.ok) return { record: { ...meta, ok: false, error: `Render failed: ${s.error}` }, html }
    return { record: { ...meta, ok: true, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, findings: s.findings }, html }
  } catch (e) {
    return { record: { ...meta, ok: false, error: `Render failed: ${e instanceof Error ? e.message : String(e)}` }, html }
  }
}
```

- [ ] **Step 6: Implement `src/cli.ts`**

The summary step is added in Task 8; leave a `--summary-only` branch that Task 8 fills.

```ts
import { parseArgs } from 'node:util'
import { BenchError, loadModels, loadScreens, type ModelEntry } from './config'
import { fakeGenerate } from './fake'
import { makeGenerate } from './providers'
import { currentMonth, runBench } from './run'
import { makeStore } from './store'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const FAKE_MODELS: ModelEntry[] = ['fake-good', 'fake-buggy', 'fake-incomplete', 'fake-garbage']
  .map((id) => ({ id, provider: 'openrouter' as const, model: id, label: id, since: '2026-11' }))

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { month: { type: 'string' }, model: { type: 'string' }, fake: { type: 'boolean' }, 'summary-only': { type: 'boolean' } } })
  const month = values.month || currentMonth()
  if (!MONTH.test(month)) throw new BenchError(`--month must be YYYY-MM, not "${month}".`)
  const all = values.fake ? FAKE_MODELS : loadModels()
  const models = values.model ? all.filter((m) => m.id === values.model) : all
  if (models.length === 0) throw new BenchError(`No model with id "${values.model}". Ids: ${all.map((m) => m.id).join(', ')}`)
  const store = makeStore()
  if (!values['summary-only']) {
    const generate = values.fake ? fakeGenerate : makeGenerate({ env: process.env })
    const out = await runBench({ month, models, screens: loadScreens(), generate, store, log: (l) => console.log(l) })
    console.log(`Built ${out.built}, skipped ${out.skipped}, failed ${out.failed}.`)
    if (out.built === 0 && out.skipped === 0) return 1
  }
  return 0
}

main().then((code) => process.exit(code), (e) => {
  console.error(e instanceof BenchError ? e.message : e)
  process.exit(e instanceof BenchError ? 2 : 1)
})
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- run system && npm run typecheck -w @dualkit/bench`
Expected: PASS.

- [ ] **Step 8: Dry-run the CLI end to end**

Run: `npm run bench -w @dualkit/bench -- --fake --month 2099-01` then `ls bench/runs/2099-01/*/payment-summary` then `rm -rf bench/runs/2099-01`
Expected: 120 builds logged (4 fake models x 5 screens x 2 x 3), `fake-garbage` all failed, `fake-incomplete` records with `missing` filled. Nothing committed.

- [ ] **Step 9: Commit**

```bash
git add packages/bench/src packages/bench/test
git commit -m "feat(bench): resumable runner, system prompts and the bench CLI"
```

---

### Task 8: The month summary and screenshots

**Files:**
- Create: `apps/site/lib/bench-schema.ts`
- Create: `packages/bench/src/summary.ts`
- Modify: `packages/bench/src/cli.ts` (run the summary after the run, and alone with `--summary-only`)
- Test: `packages/bench/test/summary.test.ts`, `apps/site/test/bench-schema.test.ts`

**Interfaces:**
- Consumes: `Store`, `BuildRecord` (Task 6); `cell`, `total`, `lift` (Task 5); `scoreHtml` (Task 4, re-renders the median build for its screenshot); `RULE_COUNT`.
- Produces, in `apps/site/lib/bench-schema.ts` (no imports, shared by the site and the bench):
```ts
export type BenchFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type BenchCell =
  | { ran: false; runs: number }
  | { ran: true; runs: number; rulesPassed: number; score: number; missing: string[]; findings: BenchFinding[]; shot: string | null; pageHeight: number; raw: string }
export type BenchTotal = { rulesPassed: number; outOf: number; score: number }
export type BenchModel = { id: string; label: string; provider: 'openrouter' | 'gemini'; isNew: boolean; alone: BenchTotal | null; dualkit: BenchTotal | null; lift: number | null; screens: { id: string; title: string; alone: BenchCell; dualkit: BenchCell }[] }
export type BenchMonth = { month: string; generatedAt: string; ruleCount: number; models: BenchModel[] }
export function parseBenchMonth(raw: unknown): BenchMonth  // throws Error naming the bad field
```
  - In `src/summary.ts`: `buildSummary(opts: { month: string; models: ModelEntry[]; screens: Screen[]; store: Store; shots?: (rec: BuildRecord, html: string) => Promise<{ file: string; pageHeight: number } | null> }): Promise<BenchMonth>` and `writeSummary(month: BenchMonth, siteRoot?: string): string` (returns the JSON path).
  - `shot` is a public path like `/bench/2026-11/gemma-4-31b/otp-alone.webp`; `raw` is a repo path like `bench/runs/2026-11/gemma-4-31b/otp/alone-2.json`.
  - Models sort by `dualkit.rulesPassed` desc, then `alone.rulesPassed` desc, then label; models with no totals sort last.

The default `shots` re-renders the median build's HTML with `scoreHtml`, converts the PNG with `sharp(buf).resize({ width: 390 }).webp({ quality: 90 })`, and writes to `apps/site/public/bench/<month>/<model>/<screen>-<condition>.webp`. A failed re-render gives `shot: null`, never a failed summary.

- [ ] **Step 1: Write the failing schema test**

`apps/site/test/bench-schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseBenchMonth } from '../lib/bench-schema'

const month = {
  month: '2026-11', generatedAt: '2026-11-01T06:00:00Z', ruleCount: 20,
  models: [{ id: 'g', label: 'G', provider: 'gemini', isNew: true, alone: { rulesPassed: 50, outOf: 100, score: 10 }, dualkit: null, lift: null,
    screens: [{ id: 'otp', title: 'OTP', alone: { ran: false, runs: 1 }, dualkit: { ran: true, runs: 3, rulesPassed: 18, score: 70, missing: [], findings: [], shot: null, pageHeight: 900, raw: 'bench/runs/x.json' } }] }],
}

describe('parseBenchMonth', () => {
  it('accepts a valid month', () => {
    expect(parseBenchMonth(month)).toEqual(month)
  })
  it('names the bad field', () => {
    expect(() => parseBenchMonth({ ...month, month: 'Nov' })).toThrow(/month/)
    expect(() => parseBenchMonth({ ...month, models: [{ ...month.models[0], provider: 'x' }] })).toThrow(/provider/)
  })
  it('rejects a ran cell with no score', () => {
    const bad = structuredClone(month)
    ;(bad.models[0]!.screens[0]!.dualkit as Record<string, unknown>).rulesPassed = 'many'
    expect(() => parseBenchMonth(bad)).toThrow(/rulesPassed/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/site -- bench-schema`
Expected: FAIL, cannot find `../lib/bench-schema`.

- [ ] **Step 3: Implement `apps/site/lib/bench-schema.ts`**

```ts
export type BenchFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type BenchCell =
  | { ran: false; runs: number }
  | { ran: true; runs: number; rulesPassed: number; score: number; missing: string[]; findings: BenchFinding[]; shot: string | null; pageHeight: number; raw: string }
export type BenchTotal = { rulesPassed: number; outOf: number; score: number }
export type BenchModel = { id: string; label: string; provider: 'openrouter' | 'gemini'; isNew: boolean; alone: BenchTotal | null; dualkit: BenchTotal | null; lift: number | null; screens: { id: string; title: string; alone: BenchCell; dualkit: BenchCell }[] }
export type BenchMonth = { month: string; generatedAt: string; ruleCount: number; models: BenchModel[] }

type Obj = Record<string, unknown>
const fail = (path: string): never => { throw new Error(`Bench data: bad ${path}`) }
const obj = (v: unknown, path: string): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : fail(path))
const num = (v: unknown, path: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(path))
const str = (v: unknown, path: string): string => (typeof v === 'string' ? v : fail(path))
const list = (v: unknown, path: string): unknown[] => (Array.isArray(v) ? v : fail(path))
const SEVERITIES = ['error', 'warning', 'note']

function total(v: unknown, path: string): BenchTotal | null {
  if (v === null) return null
  const o = obj(v, path)
  return { rulesPassed: num(o.rulesPassed, `${path}.rulesPassed`), outOf: num(o.outOf, `${path}.outOf`), score: num(o.score, `${path}.score`) }
}

function finding(v: unknown, path: string): BenchFinding {
  const o = obj(v, path)
  if (!SEVERITIES.includes(String(o.severity))) fail(`${path}.severity`)
  const box = o.box === null ? null : obj(o.box, `${path}.box`)
  return {
    rule: str(o.rule, `${path}.rule`), title: str(o.title, `${path}.title`), severity: o.severity as BenchFinding['severity'],
    box: box && { x: num(box.x, `${path}.box.x`), y: num(box.y, `${path}.box.y`), width: num(box.width, `${path}.box.width`), height: num(box.height, `${path}.box.height`) },
  }
}

function cell(v: unknown, path: string): BenchCell {
  const o = obj(v, path)
  const runs = num(o.runs, `${path}.runs`)
  if (o.ran !== true) return { ran: false, runs }
  return {
    ran: true, runs, rulesPassed: num(o.rulesPassed, `${path}.rulesPassed`), score: num(o.score, `${path}.score`),
    missing: list(o.missing, `${path}.missing`).map((m, i) => str(m, `${path}.missing.${i}`)),
    findings: list(o.findings, `${path}.findings`).map((f, i) => finding(f, `${path}.findings.${i}`)),
    shot: o.shot === null ? null : str(o.shot, `${path}.shot`), pageHeight: num(o.pageHeight, `${path}.pageHeight`), raw: str(o.raw, `${path}.raw`),
  }
}

export function parseBenchMonth(raw: unknown): BenchMonth {
  const o = obj(raw, 'month file')
  const month = str(o.month, 'month')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('month')
  return {
    month, generatedAt: str(o.generatedAt, 'generatedAt'), ruleCount: num(o.ruleCount, 'ruleCount'),
    models: list(o.models, 'models').map((mv, i) => {
      const m = obj(mv, `models.${i}`)
      if (m.provider !== 'openrouter' && m.provider !== 'gemini') fail(`models.${i}.provider`)
      return {
        id: str(m.id, `models.${i}.id`), label: str(m.label, `models.${i}.label`), provider: m.provider as BenchModel['provider'],
        isNew: m.isNew === true, alone: total(m.alone, `models.${i}.alone`), dualkit: total(m.dualkit, `models.${i}.dualkit`),
        lift: m.lift === null ? null : num(m.lift, `models.${i}.lift`),
        screens: list(m.screens, `models.${i}.screens`).map((sv, j) => {
          const s = obj(sv, `models.${i}.screens.${j}`)
          const p = `models.${i}.screens.${j}`
          return { id: str(s.id, `${p}.id`), title: str(s.title, `${p}.title`), alone: cell(s.alone, `${p}.alone`), dualkit: cell(s.dualkit, `${p}.dualkit`) }
        }),
      }
    }),
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -w @dualkit/site -- bench-schema`
Expected: PASS.

- [ ] **Step 5: Write the failing summary test**

`packages/bench/test/summary.test.ts`:
```ts
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBenchMonth } from '../../../apps/site/lib/bench-schema'
import { loadScreens, type ModelEntry } from '../src/config'
import { makeStore, type BuildKey, type Condition } from '../src/store'
import { buildSummary, writeSummary } from '../src/summary'

const screens = loadScreens()
const model = (id: string, since = '2026-10'): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id.toUpperCase(), since })

function seed(store: ReturnType<typeof makeStore>, id: string, passed: Record<Condition, number>, skip: string[] = []) {
  for (const s of screens) for (const condition of ['alone', 'dualkit'] as const) for (const run of [1, 2, 3]) {
    if (skip.includes(`${s.id}/${condition}`)) continue
    const k: BuildKey = { month: '2026-11', model: id, screen: s.id, condition, run }
    store.write({ ...k, at: 'now', reply: 'r', usage: null, ms: 1, ok: true, rulesPassed: passed[condition], score: passed[condition] * 4, missing: [], findings: [] }, '<html></html>')
  }
}

describe('buildSummary', () => {
  it('totals, lifts, ranks and marks new models, and validates against the site schema', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    seed(store, 'b', { alone: 12, dualkit: 15 })
    const out = await buildSummary({ month: '2026-11', models: [model('a'), model('b', '2026-11')], screens, store, shots: async () => null })
    expect(out.models.map((m) => m.id)).toEqual(['a', 'b'])
    expect(out.models[0]).toMatchObject({ alone: { rulesPassed: 40, outOf: 100 }, dualkit: { rulesPassed: 90 }, lift: 50, isNew: false })
    expect(out.models[1]!.isNew).toBe(true)
    expect(out.models[0]!.screens[0]!.alone).toMatchObject({ ran: true, raw: 'bench/runs/2026-11/a/payment-summary/alone-1.json' })
    expect(parseBenchMonth(JSON.parse(JSON.stringify(out)))).toEqual(out)
  })
  it('shows a model with a missing screen, with null totals, ranked last', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 }, ['otp/dualkit'])
    seed(store, 'b', { alone: 2, dualkit: 4 })
    const out = await buildSummary({ month: '2026-11', models: [model('a'), model('b')], screens, store, shots: async () => null })
    expect(out.models.map((m) => m.id)).toEqual(['b', 'a'])
    expect(out.models[1]).toMatchObject({ dualkit: null, lift: null })
    expect(out.models[1]!.screens.find((s) => s.id === 'otp')!.dualkit).toEqual({ ran: false, runs: 0 })
  })
  it('lists a model that never ran, so the page can say so', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const out = await buildSummary({ month: '2026-11', models: [model('gone')], screens, store, shots: async () => null })
    expect(out.models[0]).toMatchObject({ id: 'gone', alone: null, dualkit: null })
  })
  it('writes the month file under the site content folder', async () => {
    const site = mkdtempSync(join(tmpdir(), 'site-'))
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const path = writeSummary(await buildSummary({ month: '2026-11', models: [], screens, store, shots: async () => null }), site)
    expect(path).toBe(join(site, 'content', 'bench', '2026-11.json'))
    expect(JSON.parse(readFileSync(path, 'utf8')).month).toBe('2026-11')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- summary`
Expected: FAIL, cannot find `../src/summary`.

- [ ] **Step 7: Implement `src/summary.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import type { BenchCell, BenchModel, BenchMonth } from '../../../apps/site/lib/bench-schema'
import { cell, lift, total, type BuildScore } from './cells'
import { ROOT, RUN, type ModelEntry, type Screen } from './config'
import { RULE_COUNT, scoreHtml } from './score'
import type { BuildRecord, Condition, Store } from './store'

const REPO = join(ROOT, '..', '..')
export const SITE_ROOT = join(REPO, 'apps', 'site')
type Shots = (rec: BuildRecord, html: string) => Promise<{ file: string; pageHeight: number } | null>

const defaultShots = (month: string, screens: Screen[]): Shots => async (rec, html) => {
  const screen = screens.find((s) => s.id === rec.screen)
  if (!screen) return null
  const scored = await scoreHtml(html, screen.required)
  if (!scored.ok) return null
  const rel = join('bench', month, rec.model, `${rec.screen}-${rec.condition}.webp`)
  const out = join(SITE_ROOT, 'public', rel)
  mkdirSync(dirname(out), { recursive: true })
  await sharp(Buffer.from(scored.screenshot, 'base64')).resize({ width: RUN.width }).webp({ quality: 90 }).toFile(out)
  return { file: `/${rel.split('\\').join('/')}`, pageHeight: scored.pageHeight }
}

// The raw path is always the repo layout, so the page can link to it whatever root the store was given.
const rawPath = (r: BuildRecord) => `bench/runs/${r.month}/${r.model}/${r.screen}/${r.condition}-${r.run}.json`

async function benchCell(store: Store, records: BuildRecord[], shots: Shots): Promise<BenchCell> {
  const ok = records.filter((r): r is Extract<BuildRecord, { ok: true }> => r.ok)
  const c = cell(ok.map((r): BuildScore => ({ run: r.run, rulesPassed: r.rulesPassed, score: r.score, missing: r.missing })))
  if (!c.ran) return { ran: false, runs: c.runs }
  const rec = ok.find((r) => r.run === c.median.run)!
  const paths = store.paths(rec)
  let shot: { file: string; pageHeight: number } | null = null
  try {
    shot = await shots(rec, readFileSync(paths.html, 'utf8'))
  } catch {
    shot = null
  }
  return {
    ran: true, runs: c.runs, rulesPassed: c.rulesPassed, score: c.score, missing: rec.missing, findings: rec.findings,
    shot: shot?.file ?? null, pageHeight: shot?.pageHeight ?? 0, raw: rawPath(rec),
  }
}

const rank = (a: BenchModel, b: BenchModel) =>
  (b.dualkit?.rulesPassed ?? -1) - (a.dualkit?.rulesPassed ?? -1) || (b.alone?.rulesPassed ?? -1) - (a.alone?.rulesPassed ?? -1) || a.label.localeCompare(b.label)

export async function buildSummary({ month, models, screens, store, shots = defaultShots(month, screens) }: { month: string; models: ModelEntry[]; screens: Screen[]; store: Store; shots?: Shots }): Promise<BenchMonth> {
  const records = store.list(month)
  const out: BenchModel[] = []
  for (const m of models) {
    const rows: BenchModel['screens'] = []
    for (const s of screens) {
      const pick = (condition: Condition) => records.filter((r) => r.model === m.id && r.screen === s.id && r.condition === condition)
      rows.push({ id: s.id, title: s.title, alone: await benchCell(store, pick('alone'), shots), dualkit: await benchCell(store, pick('dualkit'), shots) })
    }
    const alone = total(rows.map((r) => r.alone), RULE_COUNT)
    const dualkit = total(rows.map((r) => r.dualkit), RULE_COUNT)
    out.push({ id: m.id, label: m.label, provider: m.provider, isNew: m.since === month, alone, dualkit, lift: lift(alone, dualkit), screens: rows })
  }
  return { month, generatedAt: new Date().toISOString(), ruleCount: RULE_COUNT, models: out.sort(rank) }
}

export function writeSummary(month: BenchMonth, siteRoot = SITE_ROOT): string {
  const file = join(siteRoot, 'content', 'bench', `${month.month}.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(month, null, 2)}\n`)
  return file
}
```

- [ ] **Step 8: Wire the summary into the CLI**

In `src/cli.ts`, after the run block and before `return 0`, add (with the imports `buildSummary`, `writeSummary` from `./summary` and `parseBenchMonth` from `../../../apps/site/lib/bench-schema`):
```ts
  if (values.fake) return 0
  const summary = await buildSummary({ month, models: loadModels(), screens: loadScreens(), store })
  parseBenchMonth(JSON.parse(JSON.stringify(summary)))
  console.log(`Summary written to ${writeSummary(summary)}`)
```
The summary always covers every model in `models.json`, even when `--model` reran just one.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test -w @dualkit/bench -- summary && npm test -w @dualkit/site -- bench-schema && npm run typecheck -w @dualkit/bench && npm run typecheck -w @dualkit/site`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/site/lib/bench-schema.ts apps/site/test/bench-schema.test.ts packages/bench/src/summary.ts packages/bench/src/cli.ts packages/bench/test/summary.test.ts
git commit -m "feat(bench): month summary with median screenshots, validated by the site schema"
```

---

### Task 9: The monthly workflow

**Files:**
- Create: `.github/workflows/bench.yml`
- Create: `packages/bench/test/workflow.test.ts`

**Interfaces:**
- Consumes: the CLI from Tasks 7 and 8; secrets `OPENROUTER_API_KEY`, `GEMINI_API_KEY`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../src/config'

const yml = readFileSync(join(ROOT, '..', '..', '.github', 'workflows', 'bench.yml'), 'utf8')

describe('bench workflow', () => {
  it('runs at 04:17 UTC on the 1st and by hand', () => {
    expect(yml).toContain("cron: '17 4 1 * *'")
    expect(yml).toContain('workflow_dispatch:')
  })
  it('pins Playwright and passes the keys only as secrets', () => {
    expect(yml).toContain('playwright@1.55.0')
    expect(yml).toContain('OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}')
    expect(yml).toContain('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}')
  })
  it('never runs two benches at once and stops within three hours', () => {
    expect(yml).toMatch(/concurrency:\s*\n\s*group: bench/)
    expect(yml).toContain('timeout-minutes: 180')
  })
  it('commits only when something changed', () => {
    expect(yml).toContain('git diff --cached --quiet ||')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/bench -- workflow`
Expected: FAIL, no such file.

- [ ] **Step 3: Write `.github/workflows/bench.yml`**

```yaml
name: Bench
on:
  schedule:
    - cron: '17 4 1 * *'
  workflow_dispatch:
    inputs:
      month:
        description: 'Month to run, YYYY-MM (default: this month, UTC)'
        required: false
      model:
        description: 'Only this model id from packages/bench/models.json'
        required: false
permissions:
  contents: write
concurrency:
  group: bench
  cancel-in-progress: false
jobs:
  bench:
    runs-on: ubuntu-latest
    timeout-minutes: 180
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build -w @dualkit/rules
      - run: npx playwright@1.55.0 install --with-deps chromium
      - name: Run the bench
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          MONTH: ${{ inputs.month }}
          MODEL: ${{ inputs.model }}
        run: |
          args=()
          [ -n "$MONTH" ] && args+=(--month "$MONTH")
          [ -n "$MODEL" ] && args+=(--model "$MODEL")
          npm run bench -w @dualkit/bench -- "${args[@]}"
      - name: Commit the results
        if: always()
        run: |
          git config user.name 'dualkit-bench[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add bench apps/site/content/bench apps/site/public/bench
          git diff --cached --quiet || git commit -m "chore(bench): results for ${MONTH:-$(date -u +%Y-%m)}"
          git pull --rebase
          git push
        env:
          MONTH: ${{ inputs.month }}
```

`if: always()` on the commit step keeps finished builds when the run step fails or times out, so the next manual run resumes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @dualkit/bench -- workflow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/bench.yml packages/bench/test/workflow.test.ts
git commit -m "ci: monthly bench run on the 1st, plus manual runs"
```

---

### Task 10: Figma frames for /bench (Sam's sign-off gate)

**Files:**
- Create: specs under `design/figma/gen/bench/` (figma-render JSON), in the Figma file "Dualkit" (key `7rRW4ajr465l8SObGP6rN1`).

Use the `figma-render` skill (declarative spec, auto-layout everywhere, Dualkit site tokens). Measure the existing /updates and check report styles before drawing. Draw with real data: run `npm run bench -w @dualkit/bench -- --fake --month 2099-01` locally (do not commit), then build a summary with `--summary-only --month 2099-01` pointed at fake models, or hand-make a realistic month JSON; label the frames as sample data.

- [ ] **Step 1:** Frame "Dualkit · Bench · Desktop" (1440): hero line under 30 words, leaderboard (model, alone, with Dualkit, lift, score; "didn't run this month" row; "New" mark), month picker, "How it works" with the small-sample note and a link to the raw files.
- [ ] **Step 2:** Frame "Dualkit · Bench · Row open · Desktop": one model expanded to its five screens, each with the screenshot, ringed evidence crops in the check report style, and the missing-parts note on an incomplete build.
- [ ] **Step 3:** The same two frames at 390.
- [ ] **Step 4:** Screenshot every frame and check it yourself (alignment, no clipping, sentence case, no em dashes, no shadows).
- [ ] **Step 5:** Show Sam labelled options where the direction is open (for example, the lift as a number vs a bar). **Stop until Sam signs off.** Record the rulings in the plan's progress notes.

---

### Task 11: The /bench page

**Files:**
- Create: `apps/site/lib/bench.ts` (load months), `apps/site/app/bench/page.tsx`, `apps/site/components/bench/*.tsx` as the approved frames need
- Modify: `apps/site/app/globals.css` (bench styles), the site nav/footer if the frames add a link
- Test: `apps/site/test/bench.test.ts`

**Interfaces:**
- Consumes: `parseBenchMonth`, `BenchMonth` (Task 8).
- Produces: `listBenchMonths(dir?: string): string[]` (newest first), `loadBenchMonth(month: string, dir?: string): BenchMonth | null`, `latestBenchMonth(dir?: string): BenchMonth | null`.

- [ ] **Step 1: Write the failing loader test**

```ts
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { latestBenchMonth, listBenchMonths, loadBenchMonth } from '../lib/bench'

const valid = (month: string) => JSON.stringify({ month, generatedAt: 'x', ruleCount: 20, models: [] })

describe('bench loader', () => {
  it('lists months newest first and ignores other files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bench-'))
    writeFileSync(join(dir, '2026-11.json'), valid('2026-11'))
    writeFileSync(join(dir, '2026-12.json'), valid('2026-12'))
    writeFileSync(join(dir, 'notes.txt'), '')
    expect(listBenchMonths(dir)).toEqual(['2026-12', '2026-11'])
    expect(latestBenchMonth(dir)?.month).toBe('2026-12')
  })
  it('returns null for a missing folder or month', () => {
    expect(latestBenchMonth('/nope')).toBeNull()
    expect(loadBenchMonth('2026-01', '/nope')).toBeNull()
  })
  it('fails the build loudly on a corrupt month', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bench-'))
    writeFileSync(join(dir, '2026-11.json'), '{"month":"2026-11"}')
    expect(() => loadBenchMonth('2026-11', dir)).toThrow(/Bench data/)
  })
  it('refuses a month name that is not YYYY-MM', () => {
    expect(loadBenchMonth('../secrets')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @dualkit/site -- bench.test`
Expected: FAIL, cannot find `../lib/bench`.

- [ ] **Step 3: Implement `apps/site/lib/bench.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBenchMonth, type BenchMonth } from './bench-schema'

const DIR = join(process.cwd(), 'content', 'bench')
const MONTH_FILE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.json$/

export const listBenchMonths = (dir = DIR): string[] =>
  existsSync(dir) ? readdirSync(dir).map((f) => MONTH_FILE.exec(f)?.[1]).filter((m): m is string => !!m).sort().reverse() : []

/** A corrupt month throws, so a bad commit fails the deploy instead of showing wrong numbers. */
export function loadBenchMonth(month: string, dir = DIR): BenchMonth | null {
  if (!MONTH_FILE.test(`${month}.json`)) return null
  const file = join(dir, `${month}.json`)
  return existsSync(file) ? parseBenchMonth(JSON.parse(readFileSync(file, 'utf8'))) : null
}

export const latestBenchMonth = (dir = DIR): BenchMonth | null => {
  const [latest] = listBenchMonths(dir)
  return latest ? loadBenchMonth(latest, dir) : null
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -w @dualkit/site -- bench.test`
Expected: PASS.

- [ ] **Step 5: Build the page from the approved frames**

`app/bench/page.tsx` is a server component: `latestBenchMonth()` for the default view, a static `?month=` picker over `listBenchMonths()` (or `/bench/[month]` with `generateStaticParams`, whichever the frames call for). Before the first real run it shows the empty state from the frames ("The first run lands on 1 November."). Cells with `ran: false` read "didn't run this month". Evidence crops position the WebP with `background-position` from each finding's `box` (CSS px at 390 wide). Copy goes through the copy hard rules.

- [ ] **Step 6: Verify in a browser**

Run: `npm run dev`, open `/bench` at 1440 and 390 with the fake month copied in as `content/bench/2099-01.json` (delete it after). Compare against the Figma frames side by side; fix every difference. Check keyboard focus on the row toggle and the month picker.

- [ ] **Step 7: Commit**

```bash
git add apps/site/lib/bench.ts apps/site/test/bench.test.ts apps/site/app/bench apps/site/components/bench apps/site/app/globals.css
git commit -m "feat(site): the /bench leaderboard"
```

---

### Task 12: Probe every "if wrong"

**Files:**
- Create: `packages/bench/test/probes.test.ts`

Each probe measures real behaviour and stays as a regression test. Report which held and which were real, and fix the real ones before Task 13.

- [ ] **Step 1: Write the probes**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cell } from '../src/cells'
import { loadScreens } from '../src/config'
import { extractHtml } from '../src/extract'
import { scoreHtml } from '../src/score'
import { readPng } from '../../cli/src/report/png'

const fixture = (n: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${n}.html`), 'utf8')
const screens = loadScreens()
let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(async () => { await browser.close() })

describe('probes', () => {
  it('omission never beats an honest buggy build, on every screen', async () => {
    for (const s of screens) {
      const blank = await scoreHtml(fixture('incomplete'), s.required, { browser })
      if (!blank.ok) throw new Error('should score')
      expect(blank.missing.length, s.id).toBeGreaterThan(0)
      const c = cell([1, 2, 3].map((run) => ({ run, rulesPassed: blank.rulesPassed, score: blank.score, missing: blank.missing })))
      expect(c.ran && c.rulesPassed, s.id).toBe(0)
    }
  })
  it('each prompt\'s required parts accept a faithful build', async () => {
    // One hand-built faithful page per screen lives in fixtures/faithful-<screen>.html.
    for (const s of screens) {
      const out = await scoreHtml(fixture(`faithful-${s.id}`), s.required, { browser })
      if (!out.ok) throw new Error(s.id)
      expect(out.missing, s.id).toEqual([])
    }
  })
  it('Arabic-Indic digits in a faithful build still meet the required text', async () => {
    const s = screens.find((x) => x.id === 'profile')!
    const html = fixture('faithful-profile').replace('+971', '+٩٧١')
    const out = await scoreHtml(html, s.required, { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.missing).toEqual([])
  })
  it('a reply with an explanation block and a full page picks the page', () => {
    const page = fixture('good')
    const reply = 'Notes:\n```html\n<!-- use this snippet -->\n<button>x</button>\n```\nFull file:\n```html\n' + page + '\n```'
    expect(extractHtml(reply)).toBe(page.trim())
  })
  it('the render is 390 css px wide, the phone width', async () => {
    const out = await scoreHtml(fixture('good'), [], { browser })
    if (!out.ok) throw new Error('should score')
    const png = readPng(out.screenshot)!
    expect([390, 780]).toContain(png.width)
  })
})
```

- [ ] **Step 2: Write the five `fixtures/faithful-<screen>.html` pages** (one correct Arabic page per prompt, built by hand to the prompt, with every required part present).

- [ ] **Step 3: Run the probes**

Run: `npm test -w @dualkit/bench -- probes`
Expected: record each result. A failing probe is a real defect: fix the code or the required-part pattern (never loosen a probe to pass), rerun, and list it in the progress notes.

- [ ] **Step 4: Probe the live providers once Sam's keys exist**

Run: `npm run bench -w @dualkit/bench -- --month 2099-02 --model gemini-flash` with the keys in the shell. Read every reply by hand: does extraction pick the right block, did any reply hit the 8000 token cap mid-page (truncated pages), are the required parts fair. Then delete `bench/runs/2099-02` and `apps/site/content/bench/2099-02.json`.

- [ ] **Step 5: Commit**

```bash
git add packages/bench/test
git commit -m "test(bench): probes for omission, extraction, required parts and the phone render"
```

---

### Task 13: First run and release surfaces

- [ ] **Step 1: Sam's one-time setup.** Ask Sam to: buy $10 of OpenRouter credit; create an OpenRouter key and a Gemini key (AI Studio); add both at github.com/dualkit/dualkit/settings/secrets/actions as `OPENROUTER_API_KEY` and `GEMINI_API_KEY`. Do not ask for the keys in chat.
- [ ] **Step 2:** Check main has no branch protection that blocks the workflow's push (`gh api repos/dualkit/dualkit/branches/main/protection`); if it does, add the Actions bot as an allowed pusher. Merge feat/bench into main (PR with the full summary and test plan). Recount the test strip in `apps/site/lib/copy.ts` with the new bench tests.
- [ ] **Step 3:** Trigger the first run: `gh workflow run bench.yml`. Watch with `gh run watch`. Check the results commit, the Vercel deploy, and /bench at 1440 and 390.
- [ ] **Step 4:** Tick the roadmap steps in `apps/site/lib/updates.ts` that are now true on main (Prompts, Monthly runner, Leaderboard page, First run). Add the /updates entry. Link /bench from the home page and the footer as the frames say.
- [ ] **Step 5:** README (a Bench section with a real visual from the first run), the org profile (`dualkit/.github` profile/README.md), the repo description if it changes.
- [ ] **Step 6:** Offer Sam launch posts for X and LinkedIn with the real numbers. Do not post without him.

---

## Progress notes

(Executors add rulings, probe results and deviations here.)
