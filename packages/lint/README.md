# @dualkit/lint

Source rules that catch Arabic and right-to-left bugs before anything renders. It reads CSS, SCSS, HTML, JavaScript and TypeScript files, including JSX, and reports problems with a file, line and column.

Most people want the CLI, [`dualkit`](https://www.npmjs.com/package/dualkit). Use this package to run the rules yourself:

```ts
import { lint } from '@dualkit/lint'

const result = await lint(['src'], { cwd: process.cwd() })
for (const f of result.findings) console.log(`${f.file}:${f.line}:${f.column} ${f.rule} ${f.message}`)
```

Turn a rule off for one line with a `dualkit-disable-next-line <rule-id>` comment, or for a whole file with `dualkit-disable <rule-id>`. Leave the id out to turn off every rule.

Every rule is documented in [LINT.md](./LINT.md).
