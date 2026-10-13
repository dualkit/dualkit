// dualkit.dev v2: the minimal pass. A headline and at most one line per section.
export const V2 = {
  nav: { product: 'Product', links: ['Docs', 'Updates'], github: 'GitHub', cta: 'Get started' },
  drawer: [
    ['01', 'Skills', 'Teach Claude Code and Cursor to build right to left'],
    ['02', 'Format', 'AED, Hijri, Arabic digits, UAE phone and IBAN'],
    ['03', 'Starter', 'A bilingual design system, coming next'],
  ],
  hero: {
    headline: 'Build for the Gulf.\nIn both directions.',
    lede: 'Skills and formats that teach your agent to ship Arabic right the first time.',
    primary: 'Get started',
    secondary: 'View on GitHub',
  },
  window: {
    title: 'Claude Code · checkout',
    prompt: 'Build the payment summary in Arabic',
    steps: [
      ['Loaded', 'dualkit-rtl-layout'],
      ['Loaded', 'dualkit-gulf-formats'],
      ['Edited', 'PaymentSummary.tsx'],
    ],
    diff: ['+38', '-6'],
    reply: 'Mirrored the layout and isolated the phone number, so it stays left to right.',
    url: 'localhost:3000/checkout',
    inspector: 'bdi · phone',
    cliTitle: 'Terminal',
    cli: ['$ /plugin install dualkit@dualkit', '  installed 4 skills', '$ npm i @dualkit/format', '  added 1 package, 0 dependencies'],
  },
  parts: [
    {
      name: 'Skills', heading: 'Your agent writes React.\nDualkit teaches it Arabic.',
      skills: [
        ['dualkit-rtl-layout', 'Mirroring, logical properties and bidi isolation.'],
        ['dualkit-type-pairing', 'Arabic and Latin pairs, leading and tracking.'],
        ['dualkit-gulf-formats', 'Money, digits, Hijri, phone, Emirates ID and IBAN.'],
        ['dualkit-bilingual-copy', 'Six plural forms, gender and punctuation.'],
      ],
      lede: 'Four skills for Claude Code and Cursor. They load on their own when a task touches Arabic, and fix the bugs every model ships.',
      points: [
        ['Right to left, done right', 'Logical properties, mirrored icons and phone numbers that stay in order.'],
        ['Arabic that reads well', 'Font pairs, leading and tracking tuned for both scripts.'],
        ['Measured against a baseline', 'Fresh agents went from 0 of 3 to 3 of 3 on the bugs that matter.'],
      ],
    },
    {
      name: 'Format', heading: 'Gulf formats,\nsolved in 12 KB.',
      lede: 'One library for the formats Gulf products touch every day. Every parser reads Arabic digits the way people type them, with no dependencies.',
      points: [
        ['Money', 'AED and SAR, in English or Arabic, with either digit system.'],
        ['Dates', 'Umm al-Qura Hijri, pinned to the right time zone.'],
        ['Identity and payments', 'UAE phones, Emirates ID with its check digit, and Gulf IBANs.'],
      ],
    },
    {
      name: 'Starter', tag: 'Coming next', heading: 'Tokens in git.\nFigma and code follow.',
      lede: 'A bilingual design system you can fork. One token file feeds Figma and code, so neither drifts from the other.',
      points: [
        ['Tokens in git', 'One source of truth for both directions.'],
        ['A generated Figma library', 'Variables, text styles and components, never drawn by hand.'],
        ['AGENTS.md', 'Tells every agent how to build with the system.'],
      ],
    },
  ],
  mirror: {
    heading: 'Every component,\nboth directions.',
    lede: 'Flip the direction and every Dualkit pattern follows: layout, icons, gestures and numbers. The slider below works the same way in both languages.',
    slide: { en: 'Slide to pay', ar: 'اسحب للدفع' },
    toggle: ['LTR', 'RTL'],
  },
  strip: [['4', 'skills'], ['6', 'Gulf formats'], ['0', 'dependencies'], ['143', 'tests passing']],
  closing: { heading: 'Ship in both directions today.', primary: 'Get started', secondary: 'Read the docs' },
  footer: {
    columns: [['Product', ['Skills', 'Format', 'Starter', 'Updates']], ['Resources', ['Docs', 'Status', 'GitHub', 'npm']], ['Made by', ['Sam Santos', 'snts.im']]],
    status: 'All systems normal',
    legal: 'MIT licensed · v0.1 beta',
  },
}
