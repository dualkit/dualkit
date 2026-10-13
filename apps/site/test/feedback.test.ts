import { describe, expect, it } from 'vitest'
import { LIMITS, parseFeedback, sendFeedback, type Post } from '../lib/feedback'

describe('parseFeedback', () => {
  it('accepts a message with no email', () => {
    expect(parseFeedback({ message: '  The Hijri date is a day out  ' })).toEqual({ ok: true, data: { message: 'The Hijri date is a day out', email: null, page: null } })
  })

  it('keeps a valid email and the page it came from', () => {
    const r = parseFeedback({ message: 'Hi', email: 'a@b.co', page: '/docs' })
    expect(r).toEqual({ ok: true, data: { message: 'Hi', email: 'a@b.co', page: '/docs' } })
  })

  it('rejects an empty message', () => {
    expect(parseFeedback({ message: '   ' })).toEqual({ ok: false, error: 'Write a message first.' })
  })

  it('rejects a message over the limit', () => {
    expect(parseFeedback({ message: 'x'.repeat(LIMITS.message + 1) }).ok).toBe(false)
  })

  it('rejects a malformed email', () => {
    expect(parseFeedback({ message: 'Hi', email: 'not-an-email' })).toEqual({ ok: false, error: 'That email does not look right.' })
  })

  it('rejects anything that is not an object', () => {
    for (const bad of [null, 'hi', 42, []]) expect(parseFeedback(bad).ok).toBe(false)
  })

  it('flags the honeypot as spam', () => {
    expect(parseFeedback({ message: 'Hi', website: 'http://spam' })).toEqual({ ok: false, error: 'spam' })
  })

  it('drops a page that is not a site path', () => {
    const r = parseFeedback({ message: 'Hi', page: 'https://evil.example' })
    expect(r.ok && r.data.page).toBe(null)
  })
})

describe('sendFeedback', () => {
  const data = { message: 'Hi <b>there</b>', email: 'a@b.co', page: '/' }

  it('posts to Resend with the key, the inbox and a reply-to', async () => {
    const calls: Parameters<Post>[] = []
    const post: Post = async (...args) => { calls.push(args); return { ok: true, status: 200 } }
    const r = await sendFeedback(data, { apiKey: 'k', to: 'hi@snts.im', post })
    expect(r).toEqual({ ok: true })
    const [url, init] = calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['hi@snts.im'])
    expect(body.reply_to).toBe('a@b.co')
    expect(body.text).toContain('Hi <b>there</b>')
    expect(body.html).toBeUndefined()
  })

  it('reports a provider failure without leaking details', async () => {
    const post: Post = async () => ({ ok: false, status: 500 })
    expect(await sendFeedback(data, { apiKey: 'k', to: 'x@y.z', post })).toEqual({ ok: false, status: 500 })
  })

  it('reports a dropped connection', async () => {
    const post: Post = async () => { throw new TypeError('fetch failed') }
    expect(await sendFeedback(data, { apiKey: 'k', to: 'x@y.z', post })).toEqual({ ok: false, status: 0 })
  })
})
