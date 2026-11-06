// Builds the plugin into dist/: code.js for Figma's main thread, and ui.html with its script inlined, since a plugin UI
// with networkAccess "none" cannot load files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const MARKER = '/* UI_SCRIPT */'
const root = new URL('.', import.meta.url)
const dist = new URL('dist/', root)
const common = { bundle: true, write: false, target: 'es2020', minify: true, legalComments: 'none', logLevel: 'warning' }

const bundle = async (entry, platform) => {
  const result = await build({ ...common, entryPoints: [new URL(entry, root).pathname], format: 'iife', platform })
  return result.outputFiles[0].text
}

const [code, ui, template] = await Promise.all([
  bundle('src/code.ts', 'neutral'),
  bundle('src/ui.ts', 'browser'),
  readFile(new URL('src/ui.html', root), 'utf8'),
])
if (!template.includes(MARKER)) throw new Error(`src/ui.html has no ${MARKER} marker`)

await mkdir(dist, { recursive: true })
await writeFile(new URL('code.js', dist), code)
// A literal </script> inside the bundle would close the tag early.
await writeFile(new URL('ui.html', dist), template.replace(MARKER, () => ui.replace(/<\/script/gi, '<\\/script')))
console.log(`Built dist/code.js (${(code.length / 1024).toFixed(1)} KB) and dist/ui.html (${(ui.length / 1024).toFixed(1)} KB of script)`)
