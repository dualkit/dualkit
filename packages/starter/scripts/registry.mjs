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

const STARTER_ITEMS = [
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

// The gulf set: plain shadcn items. They use the app's shadcn variables and primitives, not the Dualkit base,
// and take every word as a prop. They install side by side in components/gulf so ./gulf-field resolves.
const GULF_DIR = 'components/gulf'
const GULF_DOCS = 'Needs a shadcn project (Tailwind and the shadcn CSS variables). Works with and without `shadcn init --rtl`: set dir="rtl" on <html> or a parent for Arabic. Pass every label, help text and error message as props.'
const gulfFile = (name) => ({ path: `gulf/${name}.tsx`, type: 'registry:ui', target: `${GULF_DIR}/${name}.tsx` })

const GULF_FIELD = {
  name: 'gulf-field',
  type: 'registry:ui',
  title: 'Gulf field',
  description: 'The label, note and caret handling the gulf inputs share.',
  dependencies: [FORMAT],
  registryDependencies: ['label'],
  files: [gulfFile('gulf-field')],
  docs: GULF_DOCS,
}

const gulf = (name, title, description) => ({
  name,
  type: 'registry:ui',
  title,
  description,
  dependencies: [FORMAT],
  // Label comes in through gulf-field, which is the only file that imports it.
  registryDependencies: ['input', `${BASE_URL}/gulf-field.json`],
  files: [gulfFile(name)],
  docs: GULF_DOCS,
})

export const GULF_ITEMS = [
  GULF_FIELD,
  gulf('gulf-phone-input', 'Gulf phone input', 'A phone number from any of the six GCC countries. Reads Arabic-Indic digits, returns E.164 and stays left to right in Arabic.'),
  gulf('gulf-iban-input', 'Gulf IBAN input', 'Groups a Gulf IBAN in fours as it is typed and checks its length and checksum for each country.'),
  gulf('gulf-national-id-input', 'Gulf national ID input', 'An Emirates ID number, hyphenated as it is typed and checked against the 784 prefix and check digit.'),
  gulf('gulf-amount', 'Gulf amount', 'An amount in AED, SAR, QAR, KWD, BHD or OMR, with three decimals for the dinars and the rial and Arabic or Western digits.'),
  gulf('gulf-hijri-date', 'Gulf Hijri date', 'A date typed once and shown in Gregorian and Umm al-Qura Hijri. The time zone is required.'),
]

export const ITEMS = [...STARTER_ITEMS, ...GULF_ITEMS]

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
