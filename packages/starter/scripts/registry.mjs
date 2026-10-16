// Builds the shadcn registry served at dualkit.dev/r/ from the Starter's own source, so the two never drift.
// `node scripts/registry.mjs` writes apps/site/public/r/; the test in test/registry.test.ts fails if it is stale.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const STARTER = join(dirname(fileURLToPath(import.meta.url)), '..')
export const OUT_DIR = join(STARTER, '../../apps/site/public/r')
const BASE_URL = 'https://dualkit.dev/r'
const TARGET_DIR = 'components/dualkit'
const FORMAT = '@dualkit/format'

const SETUP = `Import ${TARGET_DIR}/tokens.css, then ${TARGET_DIR}/styles.css, once in your root layout. Set lang and dir on <html>: lang="ar" dir="rtl" switches to Arabic type and mirrors the layout.`

const file = (path, type) => ({ path, type, target: `${TARGET_DIR}/${path.split('/').pop()}` })

const BASE = {
  name: 'base',
  type: 'registry:lib',
  title: 'Dualkit base',
  description: 'Tokens, component styles, icons and the direction helpers every Dualkit component shares.',
  files: [
    file('generated/tokens.css', 'registry:file'),
    file('components/styles.css', 'registry:file'),
    file('components/direction.ts', 'registry:lib'),
    file('components/icons.tsx', 'registry:ui'),
    file('components/useSwipeDismiss.ts', 'registry:hook'),
  ],
  docs: SETUP,
}

const component = (name, title, source, description, usesFormat = false) => ({
  name,
  type: 'registry:ui',
  title,
  description,
  ...(usesFormat ? { dependencies: [FORMAT] } : {}),
  registryDependencies: [`${BASE_URL}/base.json`],
  files: [file(`components/${source}.tsx`, 'registry:ui')],
})

export const ITEMS = [
  BASE,
  component('amount', 'Amount', 'Amount', 'Money in all six Gulf currencies, isolated from the sentence, with Arabic-Indic digits in Arabic.', true),
  component('button', 'Button', 'Button', 'Forward and back icons flip with the reading direction; close and check never do.'),
  component('date-display', 'Date display', 'DateDisplay', 'Gregorian with Umm al-Qura Hijri, pinned to Gulf time.', true),
  component('digit-input', 'Digit input', 'DigitInput', 'One-time code boxes that read Western, Arabic-Indic and Persian digits, typed or pasted.', true),
  component('field', 'Field', 'Field', 'A text field whose value keeps its own direction, so an email or IBAN stays left to right in an Arabic form.'),
  component('sheet', 'Sheet', 'Sheet', 'A modal side sheet from the inline end: right in English, left in Arabic. Traps focus and swipes back to close.'),
  component('tabs', 'Tabs', 'Tabs', 'WAI-ARIA tabs where the arrow keys follow the reading direction.'),
  component('toast', 'Toast', 'Toast', 'A status toast that swipes away towards the inline end and pauses on hover and focus.'),
]

const REGISTRY_SCHEMA = 'https://ui.shadcn.com/schema/registry.json'
const ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json'
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/** Every file the registry serves, keyed by name, as the exact text written to disk. */
export function buildRegistry() {
  const out = new Map()
  out.set('registry.json', json({ $schema: REGISTRY_SCHEMA, name: 'dualkit', homepage: 'https://dualkit.dev', items: ITEMS }))
  for (const item of ITEMS) {
    const files = item.files.map((f) => ({ ...f, content: readFileSync(join(STARTER, f.path), 'utf8') }))
    out.set(`${item.name}.json`, json({ $schema: ITEM_SCHEMA, ...item, files }))
  }
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, text] of buildRegistry()) writeFileSync(join(OUT_DIR, name), text)
  console.log(`Wrote ${ITEMS.length} items to ${OUT_DIR}`)
}
