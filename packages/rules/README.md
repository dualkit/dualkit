# @dualkit/rules

Twenty rules that catch Arabic and right-to-left bugs in a rendered interface: numbers that reverse, layouts that do not mirror, icons pointing the wrong way, cramped Arabic type, and missing language tags.

Most people want the CLI: `npx dualkit check <url>`. Use this package to run the rules yourself:

```ts
import { runRules, score } from '@dualkit/rules'
// model comes from the reader: inject require.resolve('@dualkit/rules/reader') into a page,
// then call globalThis.dualkitReader.readScreen(document).
const findings = runRules(model)
console.log(score(findings))
```

Every rule is documented in [RULES.md](./RULES.md).
