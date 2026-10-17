// Every line on dualkit.dev v2. Signed off in Figma by Sam on 13 Oct 2026.
export const FORMAT_COMMAND = 'npm i @dualkit/format'
export const STARTER_COMMAND = 'npm i @dualkit/starter'
export const SKILLS_COMMAND = '/plugin marketplace add dualkit/dualkit'
export const REPO_URL = 'https://github.com/dualkit/dualkit'

export const COPY = {
  nav: { product: 'Product', links: [['Docs', '/docs'], ['Updates', '/updates']] as const, github: 'GitHub', cta: 'Get started' },
  drawer: [
    { name: 'Skills', line: 'Teach Claude Code and Cursor to build right to left', href: '/#skills' },
    { name: 'Format', line: 'Gulf money, Hijri, Arabic digits, phones and IBAN', href: '/#format' },
    { name: 'Starter', line: 'Eight components that read both ways', href: '/#starter' },
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
      ['Money', 'All six Gulf currencies, in English or Arabic, with either digit system.'],
      ['Dates', 'Umm al-Qura Hijri, pinned to the right time zone.'],
      ['Identity and payments', 'UAE and Saudi phones, Emirates ID with its check digit, and Gulf IBANs.'],
    ] as const,
  },
  starter: {
    heading: ['A design system', 'that reads both ways.'],
    lede: 'Eight React components on one token file. Copy them in and Arabic works from the first commit.',
  },
  mirror: {
    heading: ['Every component,', 'both directions.'],
    lede: 'Flip the direction and every Dualkit pattern follows: layout, icons, gestures and numbers. The slider below works the same way in both languages.',
    slide: { en: 'Slide to pay', ar: 'اسحب للدفع', enDone: 'Paid', arDone: 'تم الدفع' },
    hint: 'Move over it. Click to switch.',
    hintTouch: 'Tap to switch.',
  },
  worksWith: { label: 'Works with', line: 'Installs into the tools you already build with.' },
  strip: [['4', 'skills'], ['6', 'Gulf formats'], ['0', 'dependencies'], ['699', 'tests passing']] as const,
  closing: { heading: 'Ship in both directions today.', primary: 'Get started', secondary: 'Read the docs' },
  feedback: {
    open: 'Send feedback',
    heading: 'Tell me what to fix.',
    lede: 'A bug, a wrong format, a missing piece. It comes straight to me.',
    message: 'What broke, or what is missing?',
    email: 'Email, if you want a reply',
    send: 'Send',
    sending: 'Sending',
    sent: 'Sent. Thank you, I read every one.',
    failed: 'It did not send. Try again in a moment.',
  },
  footer: {
    columns: [
      ['Product', [['Skills', '/#skills'], ['Format', '/#format'], ['Starter', '/#starter'], ['Updates', '/updates']]],
      ['Resources', [['Docs', '/docs'], ['Status', '/status'], ['GitHub', REPO_URL], ['npm', 'https://www.npmjs.com/package/@dualkit/format']]],
    ] as const,
    maker: { label: 'Made by', name: 'Sam Santos', href: 'https://snts.im' },
    legal: 'MIT licensed · v0.1 beta',
    tagline: 'Build for the Gulf. In both directions.',
  },
} as const
