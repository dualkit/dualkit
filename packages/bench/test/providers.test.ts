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
