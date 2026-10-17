# dualkit

Check any screen for Arabic and right-to-left bugs, and get a shareable Gulf-ready report.

```sh
npx playwright@1.55.0 install chromium   # once
npx dualkit check https://example.com/ar
```

It opens the page in Chromium, runs 20 rules (bidi, layout, icons, type, content), prints a summary and writes `dualkit-report.html` with a score out of 100 and every issue marked on a screenshot.

| Option | Default | |
| --- | --- | --- |
| `--out <file>` | `dualkit-report.html` | Where the report goes |
| `--json` | | Print the result as JSON |
| `--width`, `--height` | `1280`, `800` | Viewport, for example `--width 390 --height 844` for a phone |
| `--min-score <n>` | `0` | Exit 1 below this score, for CI |
| `--config <file>` | `dualkit.config.json` | Ignore rules or regions |

```json
{ "ignore": ["type/arabic-size"], "exclude": [".third-party-widget"] }
```

Every rule, why it matters and how to fix it: [RULES.md](https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md). Exit codes: 0 done, 1 below `--min-score`, 2 a problem with the input.
