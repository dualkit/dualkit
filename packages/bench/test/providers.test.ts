import { describe, expect, it } from 'vitest'
import { RUN, type ModelEntry } from '../src/config'
import { makeGenerate, MAX_RETRIES, MIN_GAP_MS, REQUEST_TIMEOUT_MS } from '../src/providers'

const or: ModelEntry = { id: 'g', provider: 'openrouter', model: 'google/gemma-4-31b-it:free', label: 'G', since: '2026-11', by: 'Fake', mark: 'google' }
const gm: ModelEntry = { id: 'f', provider: 'gemini', model: 'gemini-flash-latest', label: 'F', since: '2026-11', by: 'Fake', mark: 'google' }
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
  it('takes the caps from RUN', () => {
    expect(RUN).toMatchObject({ maxTokens: 12000, reasoningTokens: 4000 })
  })
  it('sends the model, messages, temperature and token cap, and reads the reply', async () => {
    const { f, calls } = fakeFetch([json(200, { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 5, completion_tokens: 7 } })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: true, text: 'hi', usage: { input: 5, output: 7 } })
    const body = JSON.parse(String(calls[0]!.init.body))
    expect(body).toMatchObject({ model: or.model, temperature: 0.4, max_tokens: 12000, reasoning: { max_tokens: 4000 }, messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'build it' }] })
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })
})

describe('gemini', () => {
  it('sends a system instruction and reads every text part', async () => {
    const { f, calls } = fakeFetch([json(200, { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(gm, req)
    expect(out).toMatchObject({ ok: true, text: 'ab', usage: { input: 1, output: 2 } })
    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent')
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ systemInstruction: { parts: [{ text: 'sys' }] }, generationConfig: { temperature: 0.4, maxOutputTokens: 12000, thinkingConfig: { thinkingBudget: 4000 } } })
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
  it('still spaces calls made at the same time from one shared instance', async () => {
    let clock = 0
    const starts: number[] = []
    // A virtual clock: a sleep wakes on a later tick at the time it asked for, so concurrent sleepers really overlap.
    const sleep = async (ms: number) => { const wake = clock + ms; await new Promise((r) => setTimeout(r, 0)); clock = Math.max(clock, wake) }
    const f = (async () => { starts.push(clock); return json(200, { choices: [{ message: { content: 'x' } }] }) }) as unknown as typeof fetch
    const gen = makeGenerate({ env, fetch: f, sleep, now: () => clock })
    await Promise.all([gen(or, req), gen(gm, req), gen(or, req), gen(gm, req)])
    expect(starts).toHaveLength(4)
    const sorted = [...starts].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(MIN_GAP_MS)
  })
})

describe('request timeout', () => {
  it('gives each request 600 s in total', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(600_000)
  })
  it('aborts a hung request and does not retry it', async () => {
    const calls: RequestInit[] = []
    const hang = (async (_url: string, init: RequestInit) => {
      calls.push(init)
      return new Promise<Response>((_, reject) => {
        if (!init.signal) return reject(new Error('no signal'))
        init.signal.addEventListener('abort', () => reject(init.signal!.reason))
      })
    }) as unknown as typeof fetch
    const out = await makeGenerate({ env, fetch: hang, timeoutMs: 50, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: 'Timed out after 0.05 s' })
    expect(calls).toHaveLength(1)
  })
  it('counts a body that stalls past the timeout as a timeout, not an empty reply', async () => {
    const calls: RequestInit[] = []
    const slowBody = (async (_url: string, init: RequestInit) => {
      calls.push(init)
      const body = new ReadableStream({ start(c) { init.signal!.addEventListener('abort', () => c.error(init.signal!.reason)) } })
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    const out = await makeGenerate({ env, fetch: slowBody, timeoutMs: 50, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: 'Timed out after 0.05 s' })
    expect(calls).toHaveLength(1)
  })
  it('still retries other network errors', async () => {
    let n = 0
    const flaky = (async () => { n++; throw new Error('socket hang up') }) as unknown as typeof fetch
    const out = await makeGenerate({ env, fetch: flaky, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: 'Network error: socket hang up' })
    expect(n).toBe(1 + MAX_RETRIES)
  })
})

describe('retry-after clamp', () => {
  it('caps a long Retry-After at 120 seconds', async () => {
    const waits: number[] = []
    const { f } = fakeFetch([json(429, {}, { 'retry-after': '3600' }), json(200, { choices: [{ message: { content: 'ok' } }] })])
    await makeGenerate({ env, fetch: f, sleep: async (ms) => { waits.push(ms) }, now: () => 0 })(or, req)
    expect(waits).toContain(120000)
    expect(waits).not.toContain(3600000)
  })
})

describe('key and length in errors', () => {
  it('keeps the Gemini key out of a 403 body', async () => {
    const { f } = fakeFetch([json(403, { error: 'bad key gm-secret' })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(gm, req)
    expect(out.ok).toBe(false)
    expect(JSON.stringify(out)).not.toContain('gm-secret')
  })
  it('keeps the key out of a network error message', async () => {
    const f = (async () => { throw new Error('failed for key or-secret') }) as unknown as typeof fetch
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(JSON.stringify(out)).not.toContain('or-secret')
  })
  it('clips a network error message to 200 characters', async () => {
    const f = (async () => { throw new Error('x'.repeat(500)) }) as unknown as typeof fetch
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: `Network error: ${'x'.repeat(200)}` })
  })
})

describe('reply metadata', () => {
  it('reads the finish reason, reasoning tokens and served model from OpenRouter', async () => {
    const { f } = fakeFetch([json(200, { model: 'google/gemma-4-31b-it-20261001', choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 7, completion_tokens_details: { reasoning_tokens: 3 } } })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(or, req)).toMatchObject({ ok: true, finish: 'stop', reasoningTokens: 3, servedModel: 'google/gemma-4-31b-it-20261001' })
  })
  it('reads the finish reason, thought tokens and model version from Gemini', async () => {
    const { f } = fakeFetch([json(200, { modelVersion: 'gemini-2.5-flash-001', candidates: [{ content: { parts: [{ text: 'a' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, thoughtsTokenCount: 9 } })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(gm, req)).toMatchObject({ ok: true, finish: 'STOP', reasoningTokens: 9, servedModel: 'gemini-2.5-flash-001' })
  })
  it('defaults the metadata when the provider leaves it out', async () => {
    const { f } = fakeFetch([json(200, { choices: [{ message: { content: 'hi' } }] })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(or, req)).toMatchObject({ ok: true, finish: null, reasoningTokens: 0, servedModel: null })
  })
})

describe('token cap', () => {
  it('fails an OpenRouter reply cut off at the cap, once, and keeps what came back', async () => {
    const { f, calls } = fakeFetch([json(200, { model: 'm', choices: [{ message: { content: '<html><body>half' }, finish_reason: 'length' }], usage: { prompt_tokens: 1, completion_tokens: 12000, completion_tokens_details: { reasoning_tokens: 4000 } } }), json(200, {})])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out).toMatchObject({ ok: false, error: 'Hit the token cap', reply: { text: '<html><body>half', finish: 'length', reasoningTokens: 4000, servedModel: 'm' } })
    expect(calls).toHaveLength(1)
  })
  it('fails a Gemini reply cut off at MAX_TOKENS', async () => {
    const { f, calls } = fakeFetch([json(200, { candidates: [{ content: { parts: [{ text: 'half' }] }, finishReason: 'MAX_TOKENS' }] }), json(200, {})])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(gm, req)).toMatchObject({ ok: false, error: 'Hit the token cap' })
    expect(calls).toHaveLength(1)
  })
  it('calls an empty reply at the cap a token cap, not an empty reply', async () => {
    const { f } = fakeFetch([json(200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] })])
    expect(await makeGenerate({ env, fetch: f, ...noSleep })(or, req)).toMatchObject({ ok: false, error: 'Hit the token cap' })
    const g = fakeFetch([json(200, { candidates: [{ finishReason: 'MAX_TOKENS' }] })])
    expect(await makeGenerate({ env, fetch: g.f, ...noSleep })(gm, req)).toMatchObject({ ok: false, error: 'Hit the token cap' })
  })
})

describe('error inside a 200', () => {
  it('keeps the provider message, without the key, clipped', async () => {
    const { f } = fakeFetch([json(200, { error: { message: `Upstream rejected or-secret ${'y'.repeat(400)}`, code: 502 } })])
    const out = await makeGenerate({ env, fetch: f, ...noSleep })(or, req)
    expect(out.ok).toBe(false)
    const error = out.ok ? '' : out.error
    expect(error).toMatch(/^Provider error: Upstream rejected \*\*\* y+$/)
    expect(error).not.toContain('or-secret')
    expect(error.length).toBeLessThanOrEqual('Provider error: '.length + 200)
  })
})
