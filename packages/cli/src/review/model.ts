import type { Ledger } from './spend'

export type { Ledger } from './spend'
export { fileLedger } from './spend'

export type VisionModel = { provider: 'openrouter' | 'gemini'; model: string }
export type Ask = { system: string; text: string; images: { mime: 'image/png'; base64: string }[] }
export type Answer = { ok: true; text: string; costUsd: number } | { ok: false; error: string }

export const DEFAULT_REVIEW_MODEL: VisionModel = { provider: 'gemini', model: 'gemini-flash-lite-latest' }
export const BUDGET_SPENT = 'Monthly review budget spent'

type Options = {
  env: Record<string, string | undefined>
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  ledger?: Ledger
}

const MAX_RETRIES = 4
/** 20 a minute is the free-model cap; a little over 3 s apart stays under it. */
const MIN_GAP_MS = 3100
const BACKOFF_MS = [15_000, 30_000, 60_000, 120_000]
const REQUEST_TIMEOUT_MS = 600_000
const MAX_RETRY_AFTER_S = 120
const MAX_TOKENS = 4096
const ERROR_BODY_CHARS = 200
const KEY: Record<VisionModel['provider'], string> = { openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY' }

const asRecord = (v: unknown): Record<string, any> => (typeof v === 'object' && v !== null ? (v as Record<string, any>) : {})

type Call = { url: string; init: RequestInit; read: (body: unknown) => { text: string; costUsd: number; finish: string | null } }

/** OpenRouter says length and Gemini says MAX_TOKENS when the reply ran into the output cap. */
const CAPPED = ['length', 'MAX_TOKENS']
const finishOf = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

function request(model: VisionModel, key: string, { system, text, images }: Ask): Call {
  if (model.provider === 'openrouter') return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    init: { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Dualkit Review', 'http-referer': 'https://dualkit.dev' },
      body: JSON.stringify({ model: model.model, temperature: 0, max_tokens: MAX_TOKENS, usage: { include: true }, messages: [
        { role: 'system', content: system },
        { role: 'user', content: [{ type: 'text', text }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))] },
      ] }) },
    read: (raw) => { const b = asRecord(raw); return { text: String(b?.choices?.[0]?.message?.content ?? ''), costUsd: Number(b?.usage?.cost) || 0, finish: finishOf(b?.choices?.[0]?.finish_reason) } },
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`,
    init: { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text }, ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.base64 } }))] }], generationConfig: { temperature: 0, maxOutputTokens: MAX_TOKENS } }) },
    read: (raw) => { const b = asRecord(raw); return { text: (b?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''), costUsd: 0, finish: finishOf(b?.candidates?.[0]?.finishReason) } },
  }
}

const retryable = (status: number) => status === 429 || status >= 500
const clipBody = (body: string, key: string) => body.split(key).join('***').slice(0, ERROR_BODY_CHARS)
const overCap = (l?: Ledger) => !!l && l.capUsd !== null && l.spent() >= l.capUsd

export function makeVision({ env, fetch: f = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, ledger }: Options) {
  let last = -Infinity
  let queue: Promise<void> = Promise.resolve()
  // Calls share one chain so each starts at least MIN_GAP_MS after the one before it.
  const pace = (): Promise<void> => {
    const slot = queue.then(async () => {
      const wait = last + MIN_GAP_MS - now()
      if (wait > 0) await sleep(wait)
      last = now()
    })
    queue = slot.catch(() => {})
    return slot
  }
  // Paid calls run one at a time, from the cap check through the ledger write, so the next one sees the new spend.
  let paidQueue: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = paidQueue.then(job, job)
    paidQueue = run.catch(() => {})
    return run
  }

  async function send(model: VisionModel, key: string, ask: Ask): Promise<Answer> {
    const call = request(model, key, ask)
    const paid = model.provider === 'openrouter'
    let error = 'No attempt made'
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (paid && overCap(ledger)) return { ok: false, error: BUDGET_SPENT }
      await pace()
      const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      let res: Response
      try {
        res = await f(call.url, { ...call.init, signal })
      } catch (e) {
        if (signal.aborted) return { ok: false, error: `Timed out after ${REQUEST_TIMEOUT_MS / 1000} s` }
        error = `Network error: ${clipBody(e instanceof Error ? e.message : String(e), key)}`
        if (attempt < MAX_RETRIES) await sleep(BACKOFF_MS[attempt] ?? 120_000)
        continue
      }
      if (res.ok) {
        // The cost is lost when the reply fails to parse or the request times out: the body is the only place it is reported.
        const body: unknown = await res.json().catch(() => null)
        const { text, costUsd, finish } = call.read(body)
        // A reply that cost money is recorded even if it is empty or cut off.
        ledger?.add(costUsd)
        if (finish !== null && CAPPED.includes(finish)) return { ok: false, error: 'Hit the token cap' }
        if (text.trim()) return { ok: true, text, costUsd }
        const message = asRecord(asRecord(body).error).message
        return { ok: false, error: typeof message === 'string' && message ? `Provider error: ${clipBody(message, key)}` : 'Empty reply' }
      }
      const text = await res.text().catch(() => '')
      error = `HTTP ${res.status}: ${clipBody(text, key)}`
      if (!retryable(res.status)) break
      const after = Math.min(Number(res.headers.get('retry-after')), MAX_RETRY_AFTER_S)
      if (attempt < MAX_RETRIES) await sleep(after > 0 ? after * 1000 : BACKOFF_MS[attempt] ?? 120_000)
    }
    return { ok: false, error }
  }

  return async (model: VisionModel, ask: Ask): Promise<Answer> => {
    const key = env[KEY[model.provider]]
    if (!key) return { ok: false, error: `No ${KEY[model.provider]}` }
    // The cap stops paid calls only; Gemini costs nothing and is never blocked.
    return model.provider === 'openrouter' ? exclusive(() => send(model, key, ask)) : send(model, key, ask)
  }
}
