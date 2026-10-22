import type { Finding, NodeRef } from '@dualkit/rules'
import { PNG } from 'pngjs'
import type { Answer, Ask, VisionModel } from './model'
import { parseJson } from './position'

export type Vision = (model: VisionModel, ask: Ask) => Promise<Answer>

/** A finding survives reflection only when the model confirms it at least this firmly. */
export const MIN_CONFIDENCE = 0.7
/** CSS px of context kept around the finding's box in the crop. */
const CROP_MARGIN_PX = 48

const SYSTEM = [
  'You check one claimed problem on a right-to-left Arabic screen against a close-up crop of it.',
  'Confirm it only when you can see the problem in the crop. If you are unsure, do not confirm. Reply with JSON only, with no other text.',
].join(' ')
const REPLY = '{ "confirmed": <true or false>, "confidence": <0 to 1> }'

/** The box plus 48 CSS px each side, times the screenshot scale, clamped to the image. Null when nothing is left. */
export function cropPng(png: string, box: NodeRef['box'], scale: number): string | null {
  const src = PNG.sync.read(Buffer.from(png, 'base64'))
  const left = Math.max(0, Math.floor((box.x - CROP_MARGIN_PX) * scale))
  const top = Math.max(0, Math.floor((box.y - CROP_MARGIN_PX) * scale))
  const right = Math.min(src.width, Math.ceil((box.x + box.width + CROP_MARGIN_PX) * scale))
  const bottom = Math.min(src.height, Math.ceil((box.y + box.height + CROP_MARGIN_PX) * scale))
  if (right <= left || bottom <= top) return null
  const out = new PNG({ width: right - left, height: bottom - top })
  PNG.bitblt(src, out, left, top, out.width, out.height, 0, 0)
  return PNG.sync.write(out).toString('base64')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export type Reflection = { kept: Finding | null } | { failed: string }

/** Asks the model to confirm one finding on a crop. `kept` is the finding with the reflection's confidence, or null when the model rejects it. `failed` means the call itself failed, so the finding is unchecked. */
export async function reflect(f: Finding, crop: string, sourceExcerpt: string | null, vision: Vision, model: VisionModel): Promise<Reflection> {
  const parts = [
    `The image is a close-up of the screen around one element: ${f.node?.snippet ?? 'the page'}`,
    `The claimed problem (${f.rule}): ${f.message}`,
    sourceExcerpt === null ? 'The page source is not available.' : `The page source around the element:\n${sourceExcerpt}`,
    `Is the problem real? Reply with JSON in exactly this shape:\n${REPLY}`,
  ]
  const answer = await vision(model, { system: SYSTEM, text: parts.join('\n\n'), images: [{ mime: 'image/png', base64: crop }] })
  if (!answer.ok) return { failed: answer.error }
  const reply = parseJson(answer.text)
  if (!isObject(reply) || reply.confirmed !== true || typeof reply.confidence !== 'number' || !Number.isFinite(reply.confidence)) return { kept: null }
  const confidence = Math.min(1, Math.max(0, reply.confidence))
  return { kept: confidence >= MIN_CONFIDENCE ? { ...f, confidence } : null }
}
