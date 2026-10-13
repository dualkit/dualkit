// Every line on dualkit.dev v2. Signed off in Figma by Sam on 13 Oct 2026.
// npm has the first publish on hold; until it lands, install the identical tarball from the GitHub release.
// Switch back to 'npm i @dualkit/format' once npm serves it.
export const FORMAT_COMMAND = 'npm i https://github.com/dualkit/dualkit/releases/download/format-v0.1.0-beta.0/dualkit-format-0.1.0-beta.0.tgz'
export const SKILLS_COMMAND = '/plugin marketplace add dualkit/dualkit'
export const REPO_URL = 'https://github.com/dualkit/dualkit'

export const COPY = {
  nav: { product: 'Product', links: [['Docs', '/docs'], ['Updates', '/updates']] as const, github: 'GitHub', cta: 'Get started' },
  drawer: [
    { name: 'Skills', line: 'Teach Claude Code and Cursor to build right to left', href: '/#skills' },
    { name: 'Format', line: 'AED, Hijri, Arabic digits, UAE phone and IBAN', href: '/#format' },
    { name: 'Starter', line: 'A bilingual design system, coming next', href: '/#starter' },
  ],
  hero: {
    headline: ['Build for the Gulf.', 'In both directions.'],
    lede: 'Skills and formats that teach your agent to ship Arabic right the first time.',
    primary: 'Get started',
    secondary: 'View on GitHub',
  },
  skills: {
    heading: ['Your agent writes React.', 'Dualkit teaches it Arabic.'],
    lede: 'Four skills for Claude Code and Cursor. They load on their own when a task touches Arabic, and fix the bugs every model ships.',
    cells: [
      { name: 'dualkit-rtl-layout', line: 'Mirroring, logical properties and bidi isolation.', without: 0 },
      { name: 'dualkit-type-pairing', line: 'Arabic and Latin pairs, leading and tracking.', without: 1 },
      { name: 'dualkit-gulf-formats', line: 'Money, digits, Hijri, phone, Emirates ID and IBAN.', without: 1 },
      { name: 'dualkit-bilingual-copy', line: 'Six plural forms, gender and punctuation.', without: 0 },
    ],
  },
  format: {
    heading: ['Gulf formats,', 'solved in 12 KB.'],
    lede: 'One library for the formats Gulf products touch every day. Every parser reads Arabic digits the way people type them, with no dependencies.',
    points: [
      ['Money', 'AED and SAR, in English or Arabic, with either digit system.'],
      ['Dates', 'Umm al-Qura Hijri, pinned to the right time zone.'],
      ['Identity and payments', 'UAE phones, Emirates ID with its check digit, and Gulf IBANs.'],
    ] as const,
  },
  starter: {
    tag: 'Coming next',
    heading: ['Tokens in git.', 'Figma and code follow.'],
    lede: 'A bilingual design system you can fork. One token file feeds Figma and code, so neither drifts from the other.',
  },
  mirror: {
    heading: ['Every component,', 'both directions.'],
    lede: 'Flip the direction and every Dualkit pattern follows: layout, icons, gestures and numbers. The slider below works the same way in both languages.',
    slide: { en: 'Slide to pay', ar: 'اسحب للدفع', enDone: 'Paid', arDone: 'تم الدفع' },
    hint: 'Move over it. Click to switch.',
  },
  strip: [['4', 'skills'], ['6', 'Gulf formats'], ['0', 'dependencies'], ['141', 'tests passing']] as const,
  closing: { heading: 'Ship in both directions today.', primary: 'Get started', secondary: 'Read the docs' },
  footer: {
    columns: [
      ['Product', [['Skills', '/#skills'], ['Format', '/#format'], ['Starter', '/#starter'], ['Updates', '/updates']]],
      ['Resources', [['Docs', '/docs'], ['Status', '/status'], ['GitHub', REPO_URL], ['npm', 'https://www.npmjs.com/package/@dualkit/format']]],
      ['Made by', [['Sam Santos', 'https://snts.im'], ['snts.im', 'https://snts.im']]],
    ] as const,
    legal: 'MIT licensed · v0.1 beta',
    tagline: 'Build for the Gulf. In both directions.',
  },
} as const
