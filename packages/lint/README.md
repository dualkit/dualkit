# @dualkit/lint

Source rules that catch Arabic and right-to-left bugs before anything renders. It reads CSS, SCSS, HTML, JavaScript and TypeScript files, including JSX, plus Vue and Svelte files and CSS inside styled, css, createGlobalStyle and injectGlobal templates, and reports problems with a file, line and column. It needs no browser.

Most people want the CLI, [`dualkit`](https://www.npmjs.com/package/dualkit):

```sh
npx dualkit@beta lint .
```

## Rules

8 source rules. Each one, why it matters and how to fix it is in [LINT.md](./LINT.md), with the known limits.

A note is listed and counted in the summary, but it does not fail the run unless you set `--fail-on note`. `source/physical-css` is a note because on real repositories most of its findings were sides that were already handled or did not matter.

When a build step such as rtlcss already flips your CSS, `source/physical-css` is skipped with one summary line.

| Rule | Severity | Catches |
| --- | --- | --- |
| `source/physical-css` | note | Left and right in CSS, such as `margin-left` or `text-align: left`, where a logical property follows the reading direction |
| `source/arabic-letter-spacing` | error | Letter-spacing on a selector that targets Arabic |
| `source/dir-attribute-selector` | note | A `[dir]` attribute selector where `:dir()` also catches inherited direction. Off by default; pass `RULES` to `lint()` to run it |
| `source/physical-tailwind` | warning | Physical Tailwind classes such as `ml-4` or `text-left`. The fix follows your installed Tailwind version |
| `source/intl-digits` | warning | An Arabic `Intl` number or date format that leaves the digits to the runtime |
| `source/islamic-calendar` | warning | The bare `islamic` calendar instead of `islamic-umalqura`, the Hijri calendar CLDR ranks first for Saudi Arabia, the UAE, Bahrain, Kuwait and Qatar |
| `source/hijri-time-zone` | warning | A Hijri date format with no `timeZone` |
| `source/old-rial-sign` | warning | U+FDFC, the old rial sign, used as the Saudi riyal sign |

## API

```ts
import { lint, lintText, RULES } from '@dualkit/lint'

// Walk folders and files under cwd. A folder walk skips what .gitignore skips.
const result = await lint(['src'], { cwd: process.cwd() })
for (const f of result.findings) console.log(`${f.file}:${f.line}:${f.column} ${f.rule} ${f.message}`)
console.log(result.files, 'files read,', result.skipped.length, 'skipped')

// Lint one file's text without touching the disk.
const findings = lintText('card.css', '.card { margin-left: 8px }')
// [{ rule: 'source/physical-css', severity: 'warning', line: 1, column: 9, message: '`margin-left: 8px` is tied to one side. Use `margin-inline-start`.', ... }]
```

Both take `rules` to run a subset of `RULES`, and `ignore` to leave rule ids out. A finding has the same shape as a `dualkit check` finding, with a file, line and column in place of a page node.

## Turning a rule off

Turn a rule off for the next line with a comment, and say why after `--`:

```css
/* dualkit-disable-next-line source/physical-css -- a map does not mirror */
.pin { left: var(--x); }
```

Use `dualkit-disable <rule-id>` for a whole file. Leave the id out to turn off every rule. A `dualkit.config.json` `ignore` list accepts lint rule ids too.

MIT licensed.
