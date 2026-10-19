// dualkit.dev v3 copy. Source of truth: docs/plans/2026-10-19-rebrand-copy.md (passed /no-ai-slop and /humanizer).
export const V3 = {
  nav: { links: ['Products', 'Docs', 'Bench', 'Updates'], github: 'GitHub', cta: 'Get started' },
  hero: {
    label: 'Arabic and English, one codebase',
    headline: 'Build for the Gulf.\nIn both directions.',
    lede: 'Skills, formats and checks that teach your coding agent to ship Arabic right the first time.',
    primary: 'Get started',
    secondary: 'View on GitHub',
  },
  window: {
    title: 'Claude Code',
    prompt: 'Build the payment summary in Arabic',
    steps: [['Loaded', 'dualkit-rtl-layout'], ['Loaded', 'dualkit-gulf-formats'], ['Edited', 'PaymentSummary.tsx']],
    reply: 'Mirrored the layout and isolated the phone number, so it stays left to right.',
  },
  how: {
    label: 'How it works',
    heading: 'Three steps to Arabic\nyou don’t have to fix.',
    lede: 'Dualkit plugs into the agent you already use, loads when a task touches Arabic, and checks the result before a user sees it.',
    steps: [
      ['01', 'Install the skills', 'One command adds four skills to Claude Code or Cursor. There is nothing to configure.'],
      ['02', 'Build as usual', 'Ask for the screen you need. The skills load on their own and handle direction, digits and type.'],
      ['03', 'Check before you ship', 'Run npx dualkit check. It scores the page against 20 rules and shows every failure next to its fix.'],
    ],
  },
  kit: {
    label: 'The kit',
    heading: 'Five parts, each\ninstalled on its own.',
    lede: 'Start with the skills, then add formats, components and checks when you need them.',
    open: {
      name: 'Skills', title: 'Teach your agent Arabic.',
      body: 'Four skills for Claude Code and Cursor: right-to-left layout, type pairing, Gulf formats and bilingual copy.',
      points: ['Load on their own when a task touches Arabic', 'Took a fresh agent from 0 of 3 to 3 of 3 on bidi bugs', 'Listed in the Claude plugin directory'],
    },
    rest: ['Format', 'Starter', 'Check', 'Bench'],
  },
  works: {
    label: 'Works with',
    heading: 'Installs into the tools\nyou already build with.',
    lede: 'Each one installs with a single command and needs no account.',
    action: 'Read the docs',
    tools: [['Claude Code', 'Plugin'], ['Cursor', 'Rules'], ['shadcn', 'Registry'], ['skills.sh', 'Skills'], ['npm', 'Packages']],
    ask: ['Your tool', 'Ask for it'],
  },
  mirror: {
    label: 'Both directions',
    heading: 'Every component,\nboth directions.',
    lede: 'Flip the direction and the layout, icons, gestures and numbers follow. Try the slider in either language.',
    en: 'Slide to pay', ar: 'اسحب للدفع', captions: ['Left to right', 'Right to left'],
  },
  bench: {
    label: 'The Bench',
    heading: 'How well does AI\nbuild Arabic?',
    lede: 'Every month, free models build five Arabic screens on their own, then again with Dualkit. The first results land on 1 November.',
    action: 'See the Bench',
    rows: [['Gemini Flash', 'google', 61, 92], ['Gemma 4 31B', 'google', 54, 88], ['Nemotron 3 Ultra', 'nvidia', 58, 85], ['Laguna S 2.1', 'poolside', 42, 71]],
  },
  closing: { heading: 'Ship in both directions today.', command: '/plugin install dualkit@dualkit', primary: 'Get started', secondary: 'Read the docs' },
  footer: {
    columns: [['Product', ['Skills', 'Format', 'Starter', 'Check', 'Bench']], ['Resources', ['Docs', 'Updates', 'Status', 'GitHub', 'npm']], ['Made by', ['Sam Santos']]],
    legal: 'MIT licensed · v0.1 beta',
  },
}
