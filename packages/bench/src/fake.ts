import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config'
import type { Generate } from './providers'

const fixture = (name: string) => readFileSync(join(ROOT, 'test', 'fixtures', `${name}.html`), 'utf8')
const fenced = (html: string) => '```html\n' + html + '\n```'

/** A provider for dry runs and tests: no network, the same pages every time. */
export const fakeGenerate: Generate = async (model, req) => {
  const dualkit = req.system.includes('# Skill:')
  const page: Record<string, string> = {
    'fake-good': fenced(fixture('good')),
    'fake-buggy': fenced(fixture(dualkit ? 'good' : 'buggy')),
    'fake-incomplete': fenced(fixture('incomplete')),
    'fake-garbage': 'Sorry, I cannot build that.',
  }
  const text = page[model.id]
  return text ? { ok: true, text, usage: { input: 0, output: 0 }, ms: 0 } : { ok: false, error: `No fake page for ${model.id}`, ms: 0 }
}
