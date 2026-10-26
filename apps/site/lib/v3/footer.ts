import { REPO_URL } from '../copy'
import { compactCount } from '../counters'
import { V3 } from './copy'

export const NPM_ORG_URL = 'https://www.npmjs.com/org/dualkit'
/** No public Claude plugin directory listing exists in lib/copy.ts, so the Claude button opens the skills docs. */
export const CLAUDE_URL = '/docs#skills'

/** Where each footer link goes. */
export const FOOTER_LINKS: Record<string, string | null> = {
  Skills: '/docs#skills',
  Format: '/docs#format',
  Starter: '/docs#starter',
  Check: '/docs#check',
  Lint: '/docs#lint',
  Convert: '/convert',
  Bench: '/bench',
  Docs: '/docs',
  Updates: '/updates',
  Status: '/status',
  Careers: '/careers',
  Registry: '/r/registry.json',
  GitHub: REPO_URL,
  Discussions: `${REPO_URL}/discussions`,
  npm: NPM_ORG_URL,
  'Plugin directory': CLAUDE_URL,
  'MIT licence': `${REPO_URL}/blob/main/LICENSE`,
}

export const MAKER_URL = 'https://snts.im'

export type FooterColumn = { title: string; links: { label: string; href: string | null }[] }

export function footerColumns(): FooterColumn[] {
  return V3.footer.columns.map(([title, labels]) => ({
    title,
    links: labels.map((label) => {
      if (!(label in FOOTER_LINKS)) throw new Error(`footer link "${label}" has no destination`)
      return { label, href: FOOTER_LINKS[label] ?? null }
    }),
  }))
}

/** The npm downloads line under the status: shown only once npm reports a real count above zero. */
export function downloadsLine(downloads: number | null): string | null {
  return downloads !== null && downloads > 0 ? `${compactCount(downloads)} npm downloads last week` : null
}
