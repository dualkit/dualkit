import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import postcss, { type AcceptedPlugin } from 'postcss'
import { afterAll, describe, expect, it } from 'vitest'

// The site has a postcss.config.mjs only so Tailwind can build the gulf demos. A config file switches off Next's
// default plugins, so this checks the site's chain gives byte-identical output to Next's defaults everywhere else.
const require = createRequire(import.meta.url)
const { getPostCssPlugins } = require('next/dist/build/webpack/config/blocks/css/plugins') as {
  getPostCssPlugins: (dir: string, supportedBrowsers?: string[]) => Promise<AcceptedPlugin[]>
}
// next build hands its CSS loader the browsers from the site's browserslist, or its own modern list.
const { getSupportedBrowsers } = require('next/dist/build/utils') as {
  getSupportedBrowsers: (dir: string, isDevelopment: boolean) => string[]
}

const SITE = join(__dirname, '..')
const GULF = join(SITE, 'components/gulf/gulf.css')
const empty = mkdtempSync(join(tmpdir(), 'no-postcss-config-'))
afterAll(() => rmSync(empty, { recursive: true, force: true }))

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : cssFiles(path)
    return path.endsWith('.css') ? [path] : []
  })
}

describe('postcss.config.mjs', () => {
  it('builds every stylesheet but the gulf demos exactly as next build does with no config', async () => {
    const browsers = getSupportedBrowsers(SITE, false)
    const [defaults, site] = await Promise.all([getPostCssPlugins(empty, browsers), getPostCssPlugins(SITE, browsers)])
    const files = cssFiles(SITE).filter((f) => f !== GULF)
    expect(files.length).toBeGreaterThan(5)
    for (const from of files) {
      const css = readFileSync(from, 'utf8')
      const [a, b] = await Promise.all([postcss(defaults).process(css, { from }), postcss(site).process(css, { from })])
      expect(b.css, relative(SITE, from)).toBe(a.css)
    }
  })

  it('still runs Next’s autoprefixer, which a bare Tailwind config would drop', async () => {
    const site = await getPostCssPlugins(SITE)
    const out = await postcss(site).process('.x{user-select:none}', { from: join(SITE, 'x.css') })
    expect(out.css).toContain('-webkit-user-select:none')
  })

  it('builds the gulf utilities', async () => {
    const site = await getPostCssPlugins(SITE)
    const out = await postcss(site).process(readFileSync(GULF, 'utf8'), { from: GULF })
    expect(out.css).toContain('.ps-2')
    expect(out.css).toContain('padding-inline-start')
  })
})
