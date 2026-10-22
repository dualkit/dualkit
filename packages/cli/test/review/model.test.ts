import { describe, expect, it } from 'vitest'
import { DEFAULT_REVIEW_MODEL, makeVision, type Ledger } from '../../src/review/model'

const ask = { system: 'sys', text: 'look', images: [{ mime: 'image/png' as const, base64: 'QUJD' }] }
const openrouter = { provider: 'openrouter' as const, model: 'x/vision' }
const gemini = { provider: 'gemini' as const, model: 'gemini-flash-lite-latest' }
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
const sleep = async () => {}

function memoryLedger(spent: number, capUsd: number | null): Ledger & { calls: number } {
  const l = { calls: 0, spent: () => spent, add: (usd: number) => { spent += usd; l.calls++ }, capUsd }
  return l
}

describe('makeVision', () => {
  it('sends images in the OpenRouter shape and reads usage.cost into the ledger', async () => {
    let sent: any
    const ledger = memoryLedger(0, 3)
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, ledger, fetch: (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      return json({ choices: [{ message: { content: 'hi' } }], usage: { cost: 0.002 } })
    }) as any })
    expect(await vision(openrouter, ask)).toEqual({ ok: true, text: 'hi', costUsd: 0.002 })
    expect(sent.temperature).toBe(0)
    expect(sent.usage).toEqual({ include: true })
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(sent.messages[1].content).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    ])
    expect(ledger.spent()).toBeCloseTo(0.002)
  })

  it('sends inline_data parts to Gemini, costs 0 and still counts the call', async () => {
    let sent: any
    let url = ''
    const ledger = memoryLedger(0, 3)
    const vision = makeVision({ env: { GEMINI_API_KEY: 'k' }, sleep, ledger, fetch: (async (u: string, init: RequestInit) => {
      url = u
      sent = JSON.parse(String(init.body))
      return json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    }) as any })
    expect(await vision(gemini, ask)).toEqual({ ok: true, text: 'ok', costUsd: 0 })
    expect(url).toContain('gemini-flash-lite-latest:generateContent')
    expect(sent.systemInstruction).toEqual({ parts: [{ text: 'sys' }] })
    expect(sent.contents[0].parts).toEqual([{ text: 'look' }, { inline_data: { mime_type: 'image/png', data: 'QUJD' } }])
    expect(sent.generationConfig.temperature).toBe(0)
    expect(ledger.spent()).toBe(0)
    expect(ledger.calls).toBe(1)
  })

  it('names the missing key variable', async () => {
    const vision = makeVision({ env: {}, sleep, fetch: (async () => { throw new Error('no request') }) as any })
    expect(await vision(openrouter, ask)).toEqual({ ok: false, error: 'No OPENROUTER_API_KEY' })
    expect(await vision(gemini, ask)).toEqual({ ok: false, error: 'No GEMINI_API_KEY' })
  })

  it('retries a 429 then fails', async () => {
    let calls = 0
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, fetch: (async () => { calls++; return json({ error: 'busy' }, 429) }) as any })
    const answer = await vision(openrouter, ask)
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error).toMatch(/^HTTP 429/)
    expect(calls).toBe(5)
  })

  it('recovers when a retry succeeds', async () => {
    let calls = 0
    const vision = makeVision({ env: { GEMINI_API_KEY: 'k' }, sleep, fetch: (async () => {
      calls++
      return calls < 3 ? json({}, 503) : json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    }) as any })
    expect((await vision(gemini, ask)).ok).toBe(true)
    expect(calls).toBe(3)
  })

  it('does not retry a 401', async () => {
    let calls = 0
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, fetch: (async () => { calls++; return json({}, 401) }) as any })
    expect((await vision(openrouter, ask)).ok).toBe(false)
    expect(calls).toBe(1)
  })

  it('sends no request once the cap is reached', async () => {
    let calls = 0
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, ledger: memoryLedger(3, 3), fetch: (async () => { calls++; return json({}) }) as any })
    expect(await vision(openrouter, ask)).toEqual({ ok: false, error: 'Monthly review budget spent' })
    expect(calls).toBe(0)
  })

  it('has no cap when capUsd is null', async () => {
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, ledger: memoryLedger(99, null), fetch: (async () => json({ choices: [{ message: { content: 'hi' } }], usage: { cost: 0 } })) as any })
    expect((await vision(openrouter, ask)).ok).toBe(true)
  })

  it('stops mid-run when a call pushes spend to the cap', async () => {
    let calls = 0
    const ledger = memoryLedger(2.9, 3)
    const vision = makeVision({ env: { OPENROUTER_API_KEY: 'k' }, sleep, ledger, fetch: (async () => { calls++; return json({ choices: [{ message: { content: 'hi' } }], usage: { cost: 0.1 } }) }) as any })
    expect((await vision(openrouter, ask)).ok).toBe(true)
    expect(await vision(openrouter, ask)).toEqual({ ok: false, error: 'Monthly review budget spent' })
    expect(calls).toBe(1)
  })

  it('fails on an empty reply', async () => {
    const vision = makeVision({ env: { GEMINI_API_KEY: 'k' }, sleep, fetch: (async () => json({ candidates: [] })) as any })
    expect(await vision(gemini, ask)).toEqual({ ok: false, error: 'Empty reply' })
  })

  it('defaults to Gemini flash lite', () => {
    expect(DEFAULT_REVIEW_MODEL).toEqual({ provider: 'gemini', model: 'gemini-flash-lite-latest' })
  })
})
