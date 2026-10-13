import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Starter ships TypeScript source so people can copy it in; Next compiles it here.
  transpilePackages: ['@dualkit/starter'],
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
}

export default config
