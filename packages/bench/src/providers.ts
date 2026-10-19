import { RUN, type ModelEntry, type Provider } from './config'

export type Usage = { input: number; output: number }
export type Generated = { ok: true; text: string; usage: Usage; ms: number } | { ok: false; error: string; ms: number }
export type Generate = (model: ModelEntry, req: { system: string; prompt: string }) => Promise<Generated>
type Options = { env: Record<string, string | undefined>; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; timeoutMs?: number }

export const MAX_RETRIES = 2
/** 20 a minute is the free-model cap; a little over 3 s apart stays under it. */
export const MIN_GAP_MS = 3100
const BACKOFF_MS = [10_000, 30_000]
export const REQUEST_TIMEOUT_MS = 120_000
/** A server asking for longer than this is capped, so one reply cannot stall the run for an hour. */
export const MAX_RETRY_AFTER_S = 120
const ERROR_BODY_CHARS = 200
const KEY: Record<Provider, string> = { openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY' }

type Call = { url: string; init: RequestInit; read: (body: any) => { text: string; usage: Usage } }

function request(model: ModelEntry, key: string, { system, prompt }: { system: string; prompt: string }): Call {
  if (model.provider === 'openrouter') return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    init: { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Dualkit Bench', 'http-referer': 'https://dualkit.dev/bench' },
      body: JSON.stringify({ model: model.model, temperature: RUN.temperature, max_tokens: RUN.maxTokens, reasoning: { max_tokens: RUN.reasoningTokens }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) },
    read: (b) => ({ text: String(b?.choices?.[0]?.message?.content ?? ''), usage: { input: Number(b?.usage?.prompt_tokens ?? 0), output: Number(b?.usage?.completion_tokens ?? 0) } }),
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent`,
    init: { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: RUN.temperature, maxOutputTokens: RUN.maxTokens, thinkingConfig: { thinkingBudget: RUN.reasoningTokens } } }) },
    read: (b) => ({
      text: (b?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''),
      usage: { input: Number(b?.usageMetadata?.promptTokenCount ?? 0), output: Number(b?.usageMetadata?.candidatesTokenCount ?? 0) },
    }),
  }
}

const retryable = (status: number) => status === 429 || status >= 500
/** Removes the key, then keeps at most ERROR_BODY_CHARS of the body. */
const clipBody = (body: string, key: string) => body.split(key).join('***').slice(0, ERROR_BODY_CHARS)

export function makeGenerate({ env, fetch: f = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, timeoutMs = REQUEST_TIMEOUT_MS }: Options): Generate {
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
        res = await f(call.url, { ...call.init, signal: AbortSignal.timeout(timeoutMs) })
      } catch (e) {
        error = `Network error: ${clipBody(e instanceof Error ? e.message : String(e), key)}`
        if (attempt < MAX_RETRIES) await sleep(BACKOFF_MS[attempt] ?? 30_000)
        continue
      }
      if (res.ok) {
        const { text, usage } = call.read(await res.json().catch(() => null))
        return text.trim() ? { ok: true, text, usage, ms: now() - started } : { ok: false, error: 'Empty reply', ms: now() - started }
      }
      error = `HTTP ${res.status}: ${clipBody(await res.text().catch(() => ''), key)}`
      if (!retryable(res.status)) break
      const after = Math.min(Number(res.headers.get('retry-after')), MAX_RETRY_AFTER_S)
      if (attempt < MAX_RETRIES) await sleep(after > 0 ? after * 1000 : BACKOFF_MS[attempt] ?? 30_000)
    }
    return { ok: false, error, ms: now() - started }
  }
}
