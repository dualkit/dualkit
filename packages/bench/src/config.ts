import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Provider = 'openrouter' | 'gemini'
export type ModelEntry = { id: string; provider: Provider; model: string; label: string; since: string; by: string; mark: string }
export type RequiredPart = { label: string; selector?: string; text?: string; min?: number }
export type Screen = { id: string; title: string; prompt: string; required: RequiredPart[] }

/** A problem with the bench's own files or arguments. The CLI prints it and exits 2. */
export class BenchError extends Error {}

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SCREENS = ['payment-summary', 'otp', 'address-form', 'profile', 'order-history'] as const
/** maxTokens is the whole reply; reasoning models may spend at most reasoningTokens of it thinking, so the page keeps about 8000. */
export const RUN = { temperature: 0.4, maxTokens: 12000, reasoningTokens: 4000, runs: 3, minRuns: 2, width: 390, height: 844 } as const
export const MARKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'design', 'assets', 'marks')
const PROVIDERS: readonly string[] = ['openrouter', 'gemini']
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new BenchError(`Could not read ${file}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export function loadModels(file = join(ROOT, 'models.json'), marksDir = MARKS_DIR): ModelEntry[] {
  const raw = readJson(file)
  if (!Array.isArray(raw)) throw new BenchError(`${file} must be a list of models.`)
  const models = raw.map((m: Record<string, unknown>, i) => {
    if (!isText(m.id) || !isText(m.model) || !isText(m.label)) throw new BenchError(`Model ${i} needs id, model and label.`)
    if (!PROVIDERS.includes(String(m.provider))) throw new BenchError(`Model ${m.id} has an unknown provider "${String(m.provider)}".`)
    if (!isText(m.since) || !MONTH.test(m.since)) throw new BenchError(`Model ${m.id} needs since as YYYY-MM.`)
    if (!isText(m.by)) throw new BenchError(`Model ${m.id} needs by (the maker's name).`)
    if (!isText(m.mark) || !/^[a-z0-9-]+$/.test(m.mark) || !existsSync(join(marksDir, `${m.mark}.svg`))) throw new BenchError(`Model ${m.id} needs mark to be a file id in ${marksDir}.`)
    return { id: m.id, provider: m.provider as Provider, model: m.model, label: m.label, since: m.since, by: m.by, mark: m.mark }
  })
  if (new Set(models.map((m) => m.id)).size !== models.length) throw new BenchError('Model ids must be unique.')
  return models
}

const toPart = (p: Record<string, unknown>, screen: string): RequiredPart => {
  if (!isText(p.label) || (!isText(p.selector) && !isText(p.text))) throw new BenchError(`A required part in ${screen} needs a label and a selector or text.`)
  return {
    label: p.label,
    ...(isText(p.selector) ? { selector: p.selector } : {}),
    ...(isText(p.text) ? { text: p.text } : {}),
    ...(typeof p.min === 'number' ? { min: p.min } : {}),
  }
}

export function loadScreens(dir = join(ROOT, 'prompts')): Screen[] {
  return SCREENS.map((id) => {
    const meta = readJson(join(dir, `${id}.json`)) as { title?: unknown; required?: unknown }
    if (!isText(meta.title) || !Array.isArray(meta.required)) throw new BenchError(`${id}.json needs a title and a required list.`)
    const prompt = readFileSync(join(dir, `${id}.md`), 'utf8').trim()
    return { id, title: meta.title, prompt, required: meta.required.map((p) => toPart(p as Record<string, unknown>, id)) }
  })
}
