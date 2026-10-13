import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACKAGE_ROOT, build } from './tokens.mjs'

const OUT = join(PACKAGE_ROOT, 'generated')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const [name, content] of Object.entries(build(join(PACKAGE_ROOT, 'tokens/dualkit.resolver.json')))) {
  writeFileSync(join(OUT, name), content)
  console.log(`packages/starter/generated/${name}`)
}
