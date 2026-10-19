import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Starter ships TypeScript source so people can copy it in; Next compiles it here.
  transpilePackages: ['@dualkit/starter'],
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  // Pages read files from disk when they regenerate: the v3 Nav on every page reads the Bench month files and planned run
  // (for its next-run line), and the home's numbers count the skill folders. Keep those files in each server bundle.
  outputFileTracingIncludes: Object.fromEntries(['/', '/docs', '/updates', '/status', '/bench', '/bench/[month]'].map((route) => [route, [
    './content/bench/**', '../../packages/bench/models.json', '../../packages/bench/prompts/*.json',
    ...(route === '/' ? ['../../plugin/skills/*/SKILL.md'] : []),
  ]])),
}

export default config
