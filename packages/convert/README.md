# @dualkit/convert

Turns an English React or Next.js app into an Arabic one, on a new git branch.

It is the engine behind `dualkit convert`. Most people run it through the CLI:

```sh
npx dualkit@beta convert --mode bilingual --start "npm run dev" --port 3000
```

Convert makes no model calls. It rewrites the code it can rewrite safely, lists every English string for you or your agent to translate, and checks the result in a browser. Every Arabic string a model drafts is marked for a native speaker to check.

## The two modes

| Mode | What you get | Branch |
| --- | --- | --- |
| `bilingual` | English and Arabic in one app, with a language switch. English stays exactly as it is. | `dualkit/bilingual` |
| `arabic` | The whole app in Arabic and right to left, in place. There is no switch. | `dualkit/arabic` |

In a bilingual Next.js app the locale lives in the URL. English keeps its URLs, and Arabic pages sit under `/ar`. A bilingual Vite app keeps the locale in the `dk-locale` cookie and reads it before the first paint.

## The two phases

Phase 1, `dualkit convert --mode <mode>`:

1. Checks the repo. It needs a clean git working tree, and it refuses with a one-line reason if anything is uncommitted or the branch already exists.
2. Takes English screenshots of every page it can reach, at 390 and 1280 pixels wide, if you gave it a start command.
3. Makes the branch from your current commit. It never pushes and never touches your main branch.
4. Rewrites the code: physical Tailwind classes and CSS to logical ones, `dir="ltr"` on phone, email and url fields, `<bdi>` around prices and other numbers inside text, mirrored arrow icons from known icon packages, and every English string moved into `messages/en.json` behind a translation hook.
5. Wires in the translation library: next-intl for Next.js, react-i18next for Vite. It adds an Arabic font stylesheet scoped to Arabic pages.
6. Writes `dualkit-strings.json`, one entry per string with its Arabic left empty, and commits.

Then you fill the Arabic in `dualkit-strings.json`. The [dualkit-convert skill](../../plugin/skills/dualkit-convert/SKILL.md) walks an agent through it.

Phase 2, `dualkit convert --finish`:

1. Writes `messages/ar.json` from the filled ledger. It refuses while any string is still pending, unless you pass `--force`.
2. Starts the app and compares each English page with its screenshot from phase 1. A page passes when under 0.1% of its pixels differ.
3. Runs the 34 check rules on each Arabic page.
4. Runs your tests, if the config names a test command.
5. Writes `dualkit-convert.md` and commits. It exits 1 when an English page changed, an Arabic page has errors or the tests fail.

## The config block

Convert reads a `convert` block from `dualkit.config.json`. The `--start` and `--port` flags are saved there for you.

```json
{
  "convert": {
    "start": "npm run build && npm start",
    "port": 3000,
    "test": "npm test",
    "routes": ["/", "/pricing"],
    "params": { "/orders/[id]": "/orders/42" },
    "storageState": "auth.json"
  }
}
```

| Field | What it does |
| --- | --- |
| `start` | The command that starts your app. Without it there is no English baseline, and finish cannot run. A production build gives steadier screenshots than a dev server. |
| `port` | The port the app listens on. |
| `test` | Your test command. Finish runs it and puts the result in the report. |
| `routes` | The pages to check in a Vite app. Convert cannot read client-side routes, so it checks only `/` unless you list them. Next.js routes are read from the app folder. |
| `params` | A sample path for each dynamic route, such as `/orders/[id]`. Dynamic routes without one are listed in the report as not reached. |
| `storageState` | A Playwright storage state file, for pages behind a sign-in. |

## What it will not do

Convert flags these in the report instead of guessing:

- Text that shares an element with other elements, such as `Hello <b>{name}</b>`, or a plural built in code. These need rich text or a plural message, by hand. Rich text is not converted in this version.
- Text outside any component, such as a module-level constant or a Next.js `metadata` title, and the `<title>` in a Vite app's `index.html`.
- A `className` built at run time, which it cannot read in full.
- Classes with no logical form, inline SVG icons and files it cannot parse.
- Dates and numbers formatted in the browser's own locale or in US dollars, and date pickers with their own week start. These are regional suggestions only.
- Pages under `/api` and other paths the Next.js middleware skips. They stay English.

It refuses, with a one-line reason, when:

- The app is not Next.js App Router or Vite React. The Pages Router, Create React App, Remix, Vue, Svelte and Angular are refused.
- The app already has its own middleware or proxy file, or files with the names convert would write.
- The root layout is a client component, has no `<html>` element, or takes its props in a form convert cannot add params to.

## Known gaps

- Convert does not place the language switch, because that would change the English look. It writes `components/dualkit-language-switch.tsx` and tells you to add it.
- Next.js sends a visitor whose browser asks for Arabic from an English URL to the Arabic page. That is next-intl's locale detection, and convert leaves it on.
- In arabic mode, phase 1 still takes English screenshots when it has a start command, although finish does not compare them.

## Use from code

```ts
import { convert, finish } from '@dualkit/convert'
```

Both take an `io` object for the browser, the shell and logging, so the CLI and tests can supply their own. See the exported `ConvertIo` and `FinishIo` types.

MIT licensed.
