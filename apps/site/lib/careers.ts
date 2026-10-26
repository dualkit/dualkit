// Open roles and the copy for /careers. Pay is left out on purpose; it is agreed with each person.

export type RoleSection = { heading: string; items: readonly string[] }

export type Role = {
  slug: string
  title: string
  /** The title in Arabic, shown beside the English on the translator role. */
  titleAr?: string
  summary: string
  meta: readonly string[]
  intro: readonly string[]
  sections: readonly RoleSection[]
  /** Hint under the optional link field on the apply form. */
  linkHint: string
}

export const ROLES: readonly Role[] = [
  {
    slug: 'frontend-engineer',
    title: 'Frontend engineer',
    summary: 'Build the React components, the site and the screens that prove Arabic and English work side by side.',
    meta: ['Remote', 'React and TypeScript', 'RTL and design systems'],
    intro: [
      'Most people meet Dualkit through its frontend: the Starter components they fork, the report dualkit check writes, and dualkit.dev itself. You would own that layer.',
      'The work is React and TypeScript, CSS written with logical properties so one stylesheet serves both directions, and motion that still reads correctly when the page runs right to left. You would work directly with Sam Santos, who made Dualkit.',
    ],
    sections: [
      {
        heading: 'What you will do',
        items: [
          'Build and maintain the eight Starter components and the token file that feeds CSS, Tailwind and Figma.',
          'Build pages on dualkit.dev, including the monthly Bench results and the Convert proof.',
          'Fix bidi bugs as they turn up, like a phone number reversed inside Arabic text or an icon that should mirror and does not.',
          'Write tests for what you ship. The kit has over a thousand and every change keeps them green.',
        ],
      },
      {
        heading: 'What we are looking for',
        items: [
          'Three or more years shipping production React and TypeScript.',
          'You can explain why a string renders backwards, and you know dir, CSS logical properties and the Unicode bidi algorithm well enough to fix it.',
          'You have built or maintained a component library or a design system.',
          'You notice when an animation is too slow, and you can say by how much.',
          'Reading Arabic script helps. You do not need to be fluent.',
        ],
      },
      {
        heading: 'Nice to have',
        items: [
          'Next.js App Router in production.',
          'Open-source work you can link to.',
          'Enough Figma to keep design tokens in sync with code.',
        ],
      },
    ],
    linkHint: 'GitHub, a portfolio or something you built',
  },
  {
    slug: 'arabic-translator',
    title: 'Arabic translator',
    titleAr: 'مترجم عربي',
    summary: 'Translate and review the Arabic in the docs, on the site and in the copy our skills teach agents to write.',
    meta: ['Remote', 'English to Arabic', 'Software and docs'],
    intro: [
      'Dualkit teaches coding agents to write Arabic interfaces, so the Arabic in our own docs and examples is the standard they copy. When it reads like machine translation, so does everything built on it.',
      'You would translate English into Arabic for product screens and developer docs, and review the Arabic that agents and contributors write. A button label or an error message gets the same care as a full page. You would work directly with Sam Santos, who made Dualkit.',
    ],
    sections: [
      {
        heading: 'What you will do',
        items: [
          'Translate the docs, the site and release notes from English into Arabic.',
          'Review the bilingual copy skill and its examples, and rewrite whatever sounds translated.',
          'Check the Arabic screens from the monthly Bench for wrong terms, broken gender agreement and badly written numbers or dates.',
          'Keep a glossary of the software terms we use, so one English word maps to one Arabic word everywhere.',
          'Flag right-to-left layout problems you spot while reading. Fixing them is not your job.',
        ],
      },
      {
        heading: 'What we are looking for',
        items: [
          'Native Arabic, with Modern Standard Arabic you would put in a published product.',
          'A feel for how Gulf users read an interface, and for where formal Arabic sounds stiff on a button.',
          'Experience translating app interfaces, websites or developer documentation.',
          'Care with Arabic and Latin numerals, Hijri and Gregorian dates, and currency formats.',
          'Comfort with Markdown and GitHub, or the patience to learn them. We will help.',
        ],
      },
      {
        heading: 'Nice to have',
        items: [
          'A translation qualification or membership of a professional body.',
          'Emirati or Saudi dialect, for copy that should sound local.',
          'Time spent with Claude Code, Cursor or another coding agent.',
        ],
      },
    ],
    linkHint: 'A portfolio, LinkedIn or a sample translation',
  },
]

export function roleBySlug(slug: string): Role | null {
  return ROLES.find((r) => r.slug === slug) ?? null
}

export const CAREERS = {
  title: 'Careers',
  description: 'Open roles at Dualkit: a frontend engineer and an Arabic translator. Both remote.',
  label: 'Careers',
  headline: ['Help Arabic ship', 'right the first time.'],
  lede: 'Dualkit makes free, open-source tools for products that ship in Arabic and English. Two roles are open, both remote.',
  listLabel: 'Open roles',
  listHeading: 'Two roles open.',
  open: 'Read the role',
  role: {
    back: 'All roles',
    apply: 'Apply for this role',
    closingHeading: 'Sound like you?',
    closingLede: 'Send your CV and, if you have one, a link to your work. The form takes about two minutes.',
  },
  form: {
    back: 'Back to the role',
    label: 'Apply',
    lede: 'Your name, your email and your CV. Everything else is optional.',
    name: 'Full name',
    email: 'Email',
    cv: 'CV',
    cvHint: 'PDF or Word, up to 4 MB',
    cvEmpty: 'Choose a file or drop it here',
    cvChange: 'Change',
    link: 'Link to your work',
    optional: 'optional',
    note: 'Anything else we should know',
    send: 'Send application',
    sending: 'Sending',
    sentHeading: 'Application sent.',
    sent: (name: string, email: string) => `Thanks, ${name}. If it is a fit, we will reply to ${email}.`,
    sentBack: 'Back to careers',
    failed: 'It did not send. Try again in a moment.',
  },
} as const
