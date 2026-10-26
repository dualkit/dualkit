// Job applications from /careers, mailed with the CV attached through Resend. Plain text only, like feedback.

import { roleBySlug } from './careers'
import type { Post, SendResult } from './feedback'

export const APPLY_LIMITS = { name: 120, email: 254, link: 300, note: 1000, cvBytes: 4 * 1024 * 1024 } as const
export const CV_KINDS = ['pdf', 'doc', 'docx'] as const
export type CvKind = (typeof CV_KINDS)[number]
/** For the file input's accept attribute. */
export const CV_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Leading bytes of each format: PDF, the OLE2 container of .doc, and the zip container of .docx.
const MAGIC: Record<CvKind, readonly number[]> = { pdf: [0x25, 0x50, 0x44, 0x46], doc: [0xd0, 0xcf, 0x11, 0xe0], docx: [0x50, 0x4b, 0x03, 0x04] }

export type Field = 'role' | 'name' | 'email' | 'cv' | 'link' | 'note'
export type CvMeta = { name: string; size: number }
export type ApplyInput = { role: unknown; name: unknown; email: unknown; link: unknown; note: unknown; website: unknown; cv: CvMeta | null }
export type Application = { role: string; name: string; email: string; link: string | null; note: string | null; cvName: string; kind: CvKind }
export type ParsedApplication = { ok: true; data: Application } | { ok: false; field: Field | null; error: string }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fail = (field: Field | null, error: string): ParsedApplication => ({ ok: false, field, error })

function cvKind(filename: string): CvKind | null {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  return (CV_KINDS as readonly string[]).includes(ext) ? (ext as CvKind) : null
}

function httpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

/** Checks one field on its own, so the form and the server give the same message. Returns the error or null. */
export function fieldError(field: Exclude<Field, 'role'>, value: unknown): string | null {
  if (field === 'name') {
    const name = str(value)
    if (!name) return 'Add your name.'
    return name.length > APPLY_LIMITS.name ? `Keep your name under ${APPLY_LIMITS.name} characters.` : null
  }
  if (field === 'email') {
    const email = str(value)
    if (!email) return 'Add your email.'
    return email.length > APPLY_LIMITS.email || !EMAIL.test(email) ? 'That email does not look right.' : null
  }
  if (field === 'link') {
    const link = str(value)
    if (!link) return null
    return link.length > APPLY_LIMITS.link || !httpsUrl(link) ? 'Use a full link that starts with https://.' : null
  }
  if (field === 'note') return str(value).length > APPLY_LIMITS.note ? `Keep it under ${APPLY_LIMITS.note} characters.` : null
  const cv = value as CvMeta | null
  if (!cv || cv.size <= 0) return 'Attach your CV.'
  if (!cvKind(cv.name)) return 'Your CV needs to be a PDF or Word file.'
  return cv.size > APPLY_LIMITS.cvBytes ? 'Your CV is over 4 MB. Try a smaller PDF.' : null
}

export function parseApplication(input: ApplyInput): ParsedApplication {
  if (str(input.website)) return fail(null, 'spam')
  const role = str(input.role)
  if (!roleBySlug(role)) return fail('role', 'That role is not open.')
  for (const field of ['name', 'email', 'cv', 'link', 'note'] as const) {
    const error = fieldError(field, field === 'cv' ? input.cv : input[field])
    if (error) return fail(field, error)
  }
  const cv = input.cv as CvMeta
  return {
    ok: true,
    data: { role, name: str(input.name), email: str(input.email), link: str(input.link) || null, note: str(input.note) || null, cvName: cv.name, kind: cvKind(cv.name) as CvKind },
  }
}

/** True when the file starts with the bytes its extension promises, so a renamed executable is turned away. */
export function checkCvBytes(bytes: Uint8Array, kind: CvKind): boolean {
  return MAGIC[kind].every((b, i) => bytes[i] === b)
}

const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

function safeFilename(name: string, kind: CvKind): string {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 80) || 'cv'
  return `${stem}.${kind}`
}

export async function sendApplication(data: Application, cv: Uint8Array, { apiKey, to, post }: { apiKey: string; to: string; post: Post }): Promise<SendResult> {
  const title = roleBySlug(data.role)?.title ?? data.role
  const text = [
    `Role: ${title}`,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Link: ${data.link ?? 'none given'}`,
    '',
    data.note ?? 'No note.',
  ].join('\n')
  const body = {
    from: 'Dualkit careers <onboarding@resend.dev>',
    to: [to],
    reply_to: data.email,
    subject: `Application: ${title}, ${oneLine(data.name)}`,
    text,
    attachments: [{ filename: safeFilename(data.cvName, data.kind), content: Buffer.from(cv).toString('base64') }],
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
