import { describe, expect, it } from 'vitest'
import { APPLY_LIMITS, checkCvBytes, parseApplication, sendApplication, type ApplyInput } from '../lib/apply'
import type { Post } from '../lib/feedback'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
const DOC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1])

const cv = (name = 'cv.pdf', size = 1024) => ({ name, size })
const base = (over: Partial<ApplyInput> = {}): ApplyInput => ({
  role: 'arabic-translator', name: 'Layla Haddad', email: 'layla@example.com', link: '', note: '', website: '', cv: cv(), ...over,
})

describe('parseApplication', () => {
  it('accepts a full application and trims it', () => {
    const r = parseApplication(base({ name: '  Layla Haddad ', link: 'https://layla.dev', note: ' Hi ' }))
    expect(r).toEqual({ ok: true, data: { role: 'arabic-translator', name: 'Layla Haddad', email: 'layla@example.com', link: 'https://layla.dev', note: 'Hi', cvName: 'cv.pdf', kind: 'pdf' } })
  })

  it('leaves the optional fields empty as null', () => {
    const r = parseApplication(base())
    expect(r.ok && r.data.link).toBeNull()
    expect(r.ok && r.data.note).toBeNull()
  })

  it('rejects an unknown role', () => {
    expect(parseApplication(base({ role: 'ceo' }))).toEqual({ ok: false, field: 'role', error: 'That role is not open.' })
  })

  it('asks for a name, a valid email and a CV', () => {
    expect(parseApplication(base({ name: ' ' }))).toMatchObject({ ok: false, field: 'name' })
    expect(parseApplication(base({ email: 'nope' }))).toMatchObject({ ok: false, field: 'email' })
    expect(parseApplication(base({ cv: null }))).toMatchObject({ ok: false, field: 'cv', error: 'Attach your CV.' })
    expect(parseApplication(base({ cv: cv('cv.pdf', 0) }))).toMatchObject({ ok: false, field: 'cv' })
  })

  it('takes PDF and Word files only', () => {
    expect(parseApplication(base({ cv: cv('cv.docx') }))).toMatchObject({ ok: true, data: { kind: 'docx' } })
    expect(parseApplication(base({ cv: cv('CV.DOC') }))).toMatchObject({ ok: true, data: { kind: 'doc' } })
    expect(parseApplication(base({ cv: cv('cv.exe') }))).toMatchObject({ ok: false, field: 'cv' })
    expect(parseApplication(base({ cv: cv('cv.pdf.exe') }))).toMatchObject({ ok: false, field: 'cv' })
  })

  it('rejects a CV over the size limit', () => {
    expect(parseApplication(base({ cv: cv('cv.pdf', APPLY_LIMITS.cvBytes + 1) }))).toMatchObject({ ok: false, field: 'cv' })
  })

  it('only takes https links', () => {
    expect(parseApplication(base({ link: 'javascript:alert(1)' }))).toMatchObject({ ok: false, field: 'link' })
    expect(parseApplication(base({ link: 'http://x.dev' }))).toMatchObject({ ok: false, field: 'link' })
  })

  it('caps the name and the note', () => {
    expect(parseApplication(base({ name: 'x'.repeat(APPLY_LIMITS.name + 1) }))).toMatchObject({ ok: false, field: 'name' })
    expect(parseApplication(base({ note: 'x'.repeat(APPLY_LIMITS.note + 1) }))).toMatchObject({ ok: false, field: 'note' })
  })

  it('flags the honeypot as spam', () => {
    expect(parseApplication(base({ website: 'http://spam' }))).toEqual({ ok: false, field: null, error: 'spam' })
  })
})

describe('checkCvBytes', () => {
  it('matches the file to its extension', () => {
    expect(checkCvBytes(PDF, 'pdf')).toBe(true)
    expect(checkCvBytes(DOCX, 'docx')).toBe(true)
    expect(checkCvBytes(DOC, 'doc')).toBe(true)
  })

  it('rejects a renamed file', () => {
    expect(checkCvBytes(DOCX, 'pdf')).toBe(false)
    expect(checkCvBytes(new Uint8Array([0x4d, 0x5a]), 'pdf')).toBe(false)
  })
})

describe('sendApplication', () => {
  const data = { role: 'frontend-engineer', name: 'Omar\nBcc: x', email: 'omar@example.com', link: null, note: 'Hi <b>', cvName: 'my cv (final).pdf', kind: 'pdf' as const }

  it('mails the CV as an attachment in plain text with a reply-to', async () => {
    const calls: Parameters<Post>[] = []
    const post: Post = async (...args) => { calls.push(args); return { ok: true, status: 200 } }
    expect(await sendApplication(data, PDF, { apiKey: 'k', to: 'hi@snts.im', post })).toEqual({ ok: true })
    const body = JSON.parse(calls[0]![1].body)
    expect(body.to).toEqual(['hi@snts.im'])
    expect(body.reply_to).toBe('omar@example.com')
    expect(body.subject).toBe('Application: Frontend engineer, Omar Bcc: x')
    expect(body.text).toContain('Hi <b>')
    expect(body.html).toBeUndefined()
    expect(body.attachments).toEqual([{ filename: 'my_cv_final_.pdf', content: Buffer.from(PDF).toString('base64') }])
  })

  it('reports a failed send without details', async () => {
    const post: Post = async () => { throw new TypeError('fetch failed') }
    expect(await sendApplication(data, PDF, { apiKey: 'k', to: 'x@y.z', post })).toEqual({ ok: false, status: 0 })
  })
})
