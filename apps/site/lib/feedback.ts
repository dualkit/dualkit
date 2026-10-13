// Feedback from the site, mailed to Sam through Resend. Plain text only, so nothing a visitor types is ever rendered as HTML.

export const LIMITS = { message: 4000, email: 254, page: 200 } as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAGE = /^\/[\w\-./]*$/

export type Feedback = { message: string; email: string | null; page: string | null }
export type Parsed = { ok: true; data: Feedback } | { ok: false; error: string }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function parseFeedback(input: unknown): Parsed {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Something went wrong. Try again.' }
  const raw = input as Record<string, unknown>
  if (str(raw.website)) return { ok: false, error: 'spam' }
  const message = str(raw.message)
  if (!message) return { ok: false, error: 'Write a message first.' }
  if (message.length > LIMITS.message) return { ok: false, error: `Keep it under ${LIMITS.message} characters.` }
  const email = str(raw.email)
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) return { ok: false, error: 'That email does not look right.' }
  const page = str(raw.page)
  const safePage = page && page.length <= LIMITS.page && PAGE.test(page) ? page : null
  return { ok: true, data: { message, email: email || null, page: safePage } }
}

export type Post = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>
export type SendResult = { ok: true } | { ok: false; status: number }

export async function sendFeedback(data: Feedback, { apiKey, to, post }: { apiKey: string; to: string; post: Post }): Promise<SendResult> {
  const text = [data.message, '', `From: ${data.email ?? 'no email given'}`, `Page: ${data.page ?? 'unknown'}`].join('\n')
  const body = {
    from: 'Dualkit feedback <onboarding@resend.dev>',
    to: [to],
    subject: `Dualkit feedback: ${data.message.slice(0, 60).replace(/\s+/g, ' ')}`,
    text,
    ...(data.email ? { reply_to: data.email } : {}),
  }
  try {
    const res = await post('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok ? { ok: true } : { ok: false, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}
