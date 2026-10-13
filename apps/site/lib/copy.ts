// Every line on dualkit.dev. Signed off by Sam on 13 Oct 2026 after a /design-reply pass.
export const SKILLS_COMMAND = '/plugin marketplace add dualkit/dualkit'
// npm has the first publish on hold; until it lands, install the identical tarball from the GitHub release.
// Switch back to 'npm i @dualkit/format' once npm serves it.
export const FORMAT_COMMAND = 'npm i https://github.com/dualkit/dualkit/releases/download/format-v0.1.0-beta.0/dualkit-format-0.1.0-beta.0.tgz'

export const COPY = {
  nav: [['Skills', '/#skills'], ['Format', '/#format'], ['Starter', '/#starter'], ['Updates', '/updates'], ['Docs', '/docs']] as const,
  github: 'Star on GitHub',
  hero: {
    badge: 'v0.1 beta · free and open source',
    line1: 'Build for the Gulf.',
    lede: 'The skills, formats and starter behind products that ship in Arabic and English. Install once and your agent builds right to left on the first pass.',
    cta: 'Read the docs',
  },
  worksWith: 'Works with the tools your team already ships with',
  stageCaption: 'One component, flipping in place. The phone number stays left to right in Arabic, as it should.',
  strip: [
    { value: '4', label: 'skills for Claude Code and Cursor', source: 'skills/' },
    { value: '6', label: 'Gulf formats', source: '@dualkit/format' },
    { value: '0', label: 'dependencies', source: 'package.json' },
    { value: '143', label: 'tests passing', source: 'vitest' },
  ],
  skills: {
    heading: ['Your agent writes React.', 'Dualkit teaches it Arabic.'],
    lede: 'Four skills for Claude Code and Cursor that fix the bugs every model ships in Arabic. Phone numbers stop reversing, dates stop landing a day out, and digits stay in one system across the screen.',
    list: [
      ['dualkit-rtl-layout', 'Mirroring, logical properties and bidi isolation'],
      ['dualkit-type-pairing', 'Arabic and Latin pairs, leading and tracking'],
      ['dualkit-gulf-formats', 'Money, digits, Hijri, phone, Emirates ID, IBAN'],
      ['dualkit-bilingual-copy', 'Six plural forms, gender and punctuation'],
    ] as const,
    evalTitle: 'Measured against a baseline',
    evalNote: 'The same checkout screen, built three times without the skills and three times with them.',
    evalRows: [
      ['Phone numbers stay in order in Arabic', 0, 3],
      ['Dates pinned to a time zone', 1, 3],
      ['One digit system per screen', 1, 3],
      ['Arabic leading and tracking', 0, 3],
    ] as const,
  },
  format: {
    heading: ['Gulf formats,', 'solved in 12 KB.'],
    lede: 'Money in AED and SAR, Umm al-Qura dates, Arabic numerals, UAE phone numbers, Emirates ID and Gulf IBANs, in one library with no dependencies. Every parser reads Arabic digits the way people type them.',
  },
  starter: {
    heading: ['Tokens in git.', 'Figma and code follow.'],
    lede: 'A bilingual design system starter, right to left from the first commit. One token file generates the Figma library and the React components, and AGENTS.md tells every agent how to build with them.',
  },
  closing: { heading: ['Ship in both', 'directions today.'], lede: 'Free and open source, for the agents you already use.' },
  footer: {
    tagline: 'Build for the Gulf. In both directions.',
    columns: [
      ['Product', [['Skills', '/#skills'], ['Format', '/#format'], ['Starter', '/#starter'], ['Updates', '/updates']]],
      ['Resources', [['Docs', '/docs'], ['Status', '/status'], ['GitHub', 'https://github.com/dualkit/dualkit'], ['npm', 'https://www.npmjs.com/package/@dualkit/format']]],
      ['Made by', [['Sam Santos', 'https://snts.im'], ['snts.im', 'https://snts.im']]],
    ] as const,
    legal: 'MIT licensed · v0.1 beta',
    note: 'If any Arabic reads wrong, open an issue.',
    hint: 'Click a letter. It works in both directions.',
  },
} as const
