import { parseFeedback, sendFeedback } from '../../../lib/feedback'
import { rateLimiter } from '../../../lib/rate-limit'

// Five sends per ten minutes per ip.
const limited = rateLimiter(10 * 60 * 1000, 5)

const reply = (status: number, body: { ok: boolean; error?: string }) => Response.json(body, { status })

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.FEEDBACK_TO ?? 'hi@snts.im'
  if (!apiKey) {
    console.error('feedback: RESEND_API_KEY is not set')
    return reply(503, { ok: false, error: 'Feedback is offline right now. Try again later.' })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (limited(ip, Date.now())) return reply(429, { ok: false, error: 'That is a lot of feedback. Try again in a few minutes.' })

  const input = await req.json().catch(() => null)
  const parsed = parseFeedback(input)
  // Pretend a honeypot hit worked, so bots learn nothing.
  if (!parsed.ok) return parsed.error === 'spam' ? reply(200, { ok: true }) : reply(400, { ok: false, error: parsed.error })

  const sent = await sendFeedback(parsed.data, { apiKey, to, post: (url, init) => fetch(url, init) })
  if (!sent.ok) {
    console.error('feedback: Resend failed', { status: sent.status })
    return reply(502, { ok: false, error: 'It did not send. Try again in a moment.' })
  }
  return reply(200, { ok: true })
}
