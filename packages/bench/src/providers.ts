import { RUN, type ModelEntry, type Provider } from './config'

export type Usage = { input: number; output: number }
/** What the provider said about the reply: why it stopped, how much it spent thinking, and which model actually answered. */
export type ReplyMeta = { finish: string | null; reasoningTokens: number; servedModel: string | null }
export type Reply = { text: string; usage: Usage } & ReplyMeta
export type Generated = ({ ok: true; ms: number } & Reply) | { ok: false; error: string; ms: number; reply?: Reply }
export type Generate = (model: ModelEntry, req: { system: string; prompt: string }) => Promise<Generated>
type Options = { env: Record<string, string | undefined>; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; timeoutMs?: number
  /** Epoch ms. Once it passes no retry starts; the call returns its last error. */
  deadline?: number }

export const MAX_RETRIES = 2
/** 20 a minute is the free-model cap; a little over 3 s apart stays under it. */
export const MIN_GAP_MS = 3100
const BACKOFF_MS = [10_000, 30_000]
/** The whole request, body included. Reasoning models can take minutes, and a timeout is not retried. */
export const REQUEST_TIMEOUT_MS = 600_000
/** A server asking for longer than this is capped, so one reply cannot stall the run for an hour. */
export const MAX_RETRY_AFTER_S = 120
const ERROR_BODY_CHARS = 200
const KEY: Record<Provider, string> = { openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY' }
/** OpenRouter says length and Gemini says MAX_TOKENS when the reply ran into the output cap. */
const CAPPED = ['length', 'MAX_TOKENS']
const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

type Call = { url: string; init: RequestInit; read: (body: any) => Reply }

function request(model: ModelEntry, key: string, { system, prompt }: { system: string; prompt: string }): Call {
  if (model.provider === 'openrouter') return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    init: { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Dualkit Bench', 'http-referer': 'https://dualkit.dev/bench' },
      body: JSON.stringify({ model: model.model, temperature: RUN.temperature, max_tokens: RUN.maxTokens, reasoning: { max_tokens: RUN.reasoningTokens }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) },
    read: (b) => ({
      text: String(b?.choices?.[0]?.message?.content ?? ''),
      usage: { input: Number(b?.usage?.prompt_tokens ?? 0), output: Number(b?.usage?.completion_tokens ?? 0) },
      finish: textOrNull(b?.choices?.[0]?.finish_reason), reasoningTokens: Number(b?.usage?.completion_tokens_details?.reasoning_tokens ?? 0), servedModel: textOrNull(b?.model),
    }),
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`,
    init: { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: RUN.temperature, maxOutputTokens: RUN.maxTokens, thinkingConfig: { thinkingBudget: RUN.reasoningTokens } } }) },
    read: (b) => ({
      text: (b?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''),
      usage: { input: Number(b?.usageMetadata?.promptTokenCount ?? 0), output: Number(b?.usageMetadata?.candidatesTokenCount ?? 0) },
      finish: textOrNull(b?.candidates?.[0]?.finishReason), reasoningTokens: Number(b?.usageMetadata?.thoughtsTokenCount ?? 0), servedModel: textOrNull(b?.modelVersion),
    }),
  }
}

const retryable = (status: number) => status === 429 || status >= 500
/** Removes the key, then keeps at most ERROR_BODY_CHARS of the body. */
const clipBody = (body: string, key: string) => body.split(key).join('***').slice(0, ERROR_BODY_CHARS)

/** A 200 can still be a failure: a reply cut off at the cap is never scored, and an error object says why there is no reply. */
function settle(body: any, call: Call, key: string, ms: number): Generated {
  const reply = call.read(body)
  if (reply.finish !== null && CAPPED.includes(reply.finish)) return { ok: false, error: 'Hit the token cap', ms, reply }
  if (reply.text.trim()) return { ok: true, ms, ...reply }
  const message = body?.error?.message
  if (typeof message === 'string' && message) return { ok: false, error: `Provider error: ${clipBody(message, key)}`, ms }
  return { ok: false, error: 'Empty reply', ms }
}

export function makeGenerate({ env, fetch: f = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, timeoutMs = REQUEST_TIMEOUT_MS, deadline = Infinity }: Options): Generate {
  // Models run concurrently through this one instance, so slots are handed out one at a time on a chain:
  // each caller waits for the slot before it, then starts at least MIN_GAP_MS after that one started.
  let last = -Infinity
  let queue: Promise<void> = Promise.resolve()
  const pace = (): Promise<void> => {
    const slot = queue.then(async () => {
      const wait = last + MIN_GAP_MS - now()
      if (wait > 0) await sleep(wait)
      last = now()
    })
    queue = slot.catch(() => {})
    return slot
  }
  return async (model, req) => {
    const started = now()
    const key = env[KEY[model.provider]]
    if (!key) return { ok: false, error: `No ${KEY[model.provider]}`, ms: 0 }
    const call = request(model, key, req)
    let error = 'No attempt made'
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0 && now() >= deadline) break
      await pace()
      const signal = AbortSignal.timeout(timeoutMs)
      const timedOut = (): Generated => ({ ok: false, error: `Timed out after ${timeoutMs / 1000} s`, ms: now() - started })
      let res: Response
      try {
        res = await f(call.url, { ...call.init, signal })
      } catch (e) {
        if (signal.aborted) return timedOut()
        error = `Network error: ${clipBody(e instanceof Error ? e.message : String(e), key)}`
        if (attempt < MAX_RETRIES && now() < deadline) await sleep(BACKOFF_MS[attempt] ?? 30_000)
        continue
      }
      if (res.ok) {
        const body = await res.json().catch(() => null)
        return signal.aborted ? timedOut() : settle(body, call, key, now() - started)
      }
      const text = await res.text().catch(() => '')
      if (signal.aborted) return timedOut()
      error = `HTTP ${res.status}: ${clipBody(text, key)}`
      if (!retryable(res.status)) break
      const after = Math.min(Number(res.headers.get('retry-after')), MAX_RETRY_AFTER_S)
      if (attempt < MAX_RETRIES && now() < deadline) await sleep(after > 0 ? after * 1000 : BACKOFF_MS[attempt] ?? 30_000)
    }
    return { ok: false, error, ms: now() - started }
  }
}
