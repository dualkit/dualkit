// A PostCSS config file replaces Next's default plugins entirely, so this one lists them again after Tailwind.
// The two defaults are the copies Next itself compiles CSS with, with the options from Next's getDefaultPlugins
// (next/dist/build/webpack/config/blocks/css/plugins.js), so every stylesheet but the gulf demos builds as before.
// next build gives those defaults the browsers from getSupportedBrowsers (the site's browserslist, or Next's
// modern list); a config file gets nothing, so the same list is read here.
// Tailwind only touches stylesheets that import it, which today is components/gulf/gulf.css.
// test/postcss-config.test.ts fails if Next's own defaults drift from these.
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { getSupportedBrowsers } = require('next/dist/build/utils')
const SITE = dirname(fileURLToPath(import.meta.url))

export const NEXT_DEFAULT_PLUGINS = [
  'next/dist/compiled/postcss-flexbugs-fixes',
  [
    'next/dist/compiled/postcss-preset-env',
    {
      browsers: getSupportedBrowsers(SITE, process.env.NODE_ENV === 'development'),
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3,
      features: { 'custom-properties': false },
    },
  ],
]

export default { plugins: ['@tailwindcss/postcss', ...NEXT_DEFAULT_PLUGINS] }
