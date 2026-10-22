import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import type { Answer } from '../../src/review/model'
import { cropPng, reflect } from '../../src/review/reflect'
import { finding } from '../helpers'

const MODEL = { provider: 'gemini', model: 'm' } as const
const png = (w: number, h: number): string => PNG.sync.write(new PNG({ width: w, height: h })).toString('base64')
const sizeOf = (b64: string) => { const p = PNG.sync.read(Buffer.from(b64, 'base64')); return { w: p.width, h: p.height } }
const reviewFinding = () => finding({ rule: 'review/date-reads-wrong', severity: 'warning', source: 'review', confidence: 0.9, line: null })
const says = (text: string) => async (): Promise<Answer> => ({ ok: true, text, costUsd: 0 })

describe('reflect', () => {
  it('keeps a confirmed finding with the reflection confidence', async () => {
    const kept = (await reflect(reviewFinding(), png(10, 10), null, says('{"confirmed": true, "confidence": 0.8}'), MODEL) as { kept: unknown }).kept
    expect(kept).toMatchObject({ rule: 'review/date-reads-wrong', confidence: 0.8, source: 'review' })
  })

  it('keeps a finding at exactly 0.7', async () => {
    expect(((await reflect(reviewFinding(), png(10, 10), null, says('{"confirmed": true, "confidence": 0.7}'), MODEL)) as { kept: unknown }).kept).not.toBeNull()
  })

  it('drops a finding confirmed below 0.7', async () => {
    expect(await reflect(reviewFinding(), png(10, 10), null, says('{"confirmed": true, "confidence": 0.5}'), MODEL)).toEqual({ kept: null })
  })

  it('drops a finding the model does not confirm', async () => {
    expect(await reflect(reviewFinding(), png(10, 10), null, says('{"confirmed": false, "confidence": 0.95}'), MODEL)).toEqual({ kept: null })
  })

  it('drops a finding when the reply is not JSON or the call fails', async () => {
    expect(await reflect(reviewFinding(), png(10, 10), null, says('looks fine to me'), MODEL)).toEqual({ kept: null })
    expect(await reflect(reviewFinding(), png(10, 10), null, async () => ({ ok: false, error: 'HTTP 500' }), MODEL)).toEqual({ failed: 'HTTP 500' })
  })

  it('sends the crop, the claim and the source excerpt', async () => {
    let seen: Parameters<Parameters<typeof reflect>[3]>[1] | undefined
    await reflect(reviewFinding(), png(10, 10), '<p>excerpt</p>', async (_m, ask) => { seen = ask; return { ok: true, text: '{}', costUsd: 0 } }, MODEL)
    expect(seen?.images).toHaveLength(1)
    expect(seen?.text).toContain('<p>excerpt</p>')
    expect(seen?.text).toContain(finding().message)
  })
})

describe('cropPng', () => {
  it('adds 48 CSS px each side, times the scale', () => {
    const out = cropPng(png(1000, 1000), { x: 100, y: 100, width: 40, height: 20 }, 2)
    expect(sizeOf(out!)).toEqual({ w: (40 + 96) * 2, h: (20 + 96) * 2 })
  })

  it('clamps to the image bounds', () => {
    const out = cropPng(png(300, 300), { x: 10, y: 10, width: 40, height: 20 }, 2)
    expect(sizeOf(out!)).toEqual({ w: (10 + 40 + 48) * 2, h: (10 + 20 + 48) * 2 })
  })

  it('clamps at the right and bottom edges', () => {
    const out = cropPng(png(300, 300), { x: 130, y: 120, width: 10, height: 10 }, 2)
    expect(sizeOf(out!)).toEqual({ w: 300 - (130 - 48) * 2, h: 300 - (120 - 48) * 2 })
  })

  it('is null when the box is outside the image', () => {
    expect(cropPng(png(100, 100), { x: 0, y: 500, width: 10, height: 10 }, 1)).toBeNull()
  })
})
