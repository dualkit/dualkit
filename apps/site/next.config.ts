import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Starter ships TypeScript source so people can copy it in; Next compiles it here.
  transpilePackages: ['@dualkit/starter'],
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  // The bench pages read their month files and the planned run from disk, so keep them in the server bundle.
  outputFileTracingIncludes: { '/bench': ['./content/bench/**', '../../packages/bench/models.json', '../../packages/bench/prompts/*.json'], '/bench/[month]': ['./content/bench/**'] },
}

export default config
