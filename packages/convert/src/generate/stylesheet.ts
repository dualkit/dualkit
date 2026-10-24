import { MIN_ARABIC_SIZE } from '@dualkit/rules'
import { posix } from 'node:path'
import type { SourceFile } from '@dualkit/lint'
import type { Edit, Project } from '../types'

const FONT_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'
const SMALL_TEXT = ['.text-xs', '.text-\\[10px\\]', '.text-\\[11px\\]', '.text-\\[12px\\]', '.text-\\[13px\\]']

/** Where the generated stylesheet goes, relative to the project root. */
export function stylesheetPath(project: Project): string {
  return project.appDir ? `${project.appDir}/dualkit.css` : 'src/dualkit.css'
}

/** The Arabic stylesheet. Every rule is scoped to `:lang(ar)` or `[dir="rtl"]`, so English is untouched. */
export function dualkitCss(project: Project): string {
  const blocks = [
    `@import url('${FONT_URL}');`,
    `:lang(ar) {\n  font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;\n  line-height: 1.7;\n}`,
    ':lang(ar) * {\n  letter-spacing: 0;\n}',
  ]
  if (project.tailwind) {
    const selectors = SMALL_TEXT.map((s) => `:lang(ar) ${s}`).join(', ')
    blocks.push(`${selectors} {\n  font-size: ${MIN_ARABIC_SIZE}px;\n}`)
  }
  blocks.push('[dir="rtl"] [data-dk-mirror] {\n  scale: -1 1;\n}')
  // A field convert set to dir="ltr" shows its Arabic hint at the right, with the page's padding and corners, until someone types.
  blocks.push('[dir="rtl"] input[dir="ltr"]:placeholder-shown, [dir="rtl"] textarea[dir="ltr"]:placeholder-shown {\n  direction: rtl;\n}')
  return blocks.join('\n\n') + '\n'
}

type Node = { type: string; start: number; end: number; source?: { value: string } }

/** The import specifier from the entry file to the stylesheet. */
function specifier(entry: SourceFile, cssPath: string): string {
  const rel = posix.relative(posix.dirname(entry.path), cssPath)
  return rel.startsWith('.') ? rel : `./${rel}`
}

/** An edit that imports the stylesheet in the entry file, or null when it is already imported. */
export function importEdit(entry: SourceFile, cssPath: string): Edit | null {
  const block = entry.js[0]
  if (!block) return null
  const spec = specifier(entry, cssPath)
  const body = block.ast.program.body as unknown as Node[]
  const imports = body.filter((node) => node.type === 'ImportDeclaration')
  if (imports.some((node) => node.source?.value === spec)) return null
  const statement = (end: number): string => `import '${spec}'${entry.text[end - 1] === ';' ? ';' : ''}`
  const last = imports.at(-1)
  if (last) {
    const at = block.offset + last.end
    return { start: at, end: at, text: `\n${statement(last.end)}` }
  }
  const directive = (block.ast.program.directives as unknown as Node[]).at(-1)
  if (directive) {
    const at = block.offset + directive.end
    return { start: at, end: at, text: `\n${statement(directive.end)}` }
  }
  return { start: 0, end: 0, text: `${statement(0)}\n` }
}
