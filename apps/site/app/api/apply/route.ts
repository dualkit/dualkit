import { APPLY_LIMITS, checkCvBytes, parseApplication, sendApplication, type CvMeta } from '../../../lib/apply'
import { rateLimiter } from '../../../lib/rate-limit'

// Three applications per hour per ip; nobody applies to two roles more than once.
const limited = rateLimiter(60 * 60 * 1000, 3)
// The CV cap plus room for the text fields and multipart framing.
const MAX_BODY = APPLY_LIMITS.cvBytes + 64 * 1024

type Reply = { ok: boolean; field?: string | null; error?: string }
const reply = (status: number, body: Reply) => Response.json(body, { status })

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CAREERS_TO ?? process.env.FEEDBACK_TO ?? 'hi@snts.im'
  if (!apiKey) {
    console.error('apply: RESEND_API_KEY is not set')
    return reply(503, { ok: false, error: 'Applications are offline right now. Try again later.' })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (limited(ip, Date.now())) return reply(429, { ok: false, error: 'Too many sends from here. Try again in an hour.' })
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return reply(413, { ok: false, field: 'cv', error: 'Your CV is over 4 MB. Try a smaller PDF.' })

  const form = await req.formData().catch(() => null)
  if (!form) return reply(400, { ok: false, error: 'Something went wrong. Try again.' })
  const file = form.get('cv')
  const cv: CvMeta | null = file instanceof File ? { name: file.name, size: file.size } : null
  const parsed = parseApplication({ role: form.get('role'), name: form.get('name'), email: form.get('email'), link: form.get('link'), note: form.get('note'), website: form.get('website'), cv })
  // Pretend a honeypot hit worked, so bots learn nothing.
  if (!parsed.ok) return parsed.error === 'spam' ? reply(200, { ok: true }) : reply(400, { ok: false, field: parsed.field, error: parsed.error })

  const bytes = new Uint8Array(await (file as File).arrayBuffer())
  if (!checkCvBytes(bytes, parsed.data.kind)) return reply(400, { ok: false, field: 'cv', error: 'That file does not open as a PDF or Word document.' })

  const sent = await sendApplication(parsed.data, bytes, { apiKey, to, post: (url, init) => fetch(url, init) })
  if (!sent.ok) {
    console.error('apply: Resend failed', { status: sent.status })
    return reply(502, { ok: false, error: 'It did not send. Try again in a moment.' })
  }
  return reply(200, { ok: true })
}
