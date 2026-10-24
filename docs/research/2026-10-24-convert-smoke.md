# Convert smoke run, 24 October 2026

We ran `dualkit convert` on two fresh apps, end to end. One is a Next.js app in bilingual mode and one is a Vite app in arabic mode. Each defect we hit got a failing test first, then a fix in its own commit. Each time we fixed something, we reset both apps to a fresh base and ran them again. It took five full cycles. Cycles 4 and 5 gave identical reports, and both apps pass.

## The apps

Both apps were made with the official starters. We then added a small set of pages that hit each part of convert: a pricing card with a price, a renewal date, a phone field, a chevron link and a few headings.

| App | Made with | Mode |
| --- | --- | --- |
| next-smoke | `npx create-next-app@latest next-smoke --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes`, then `npm install -E lucide-react` | bilingual |
| vite-smoke | `npm create vite@latest vite-smoke -- --template react-ts --no-interactive`, then `npm install -E tailwindcss @tailwindcss/vite lucide-react` | arabic |

## Versions

| Package | next-smoke | vite-smoke |
| --- | --- | --- |
| next | 16.4.3, Turbopack, `cacheComponents` on | |
| vite | | 8.3.5 |
| react | 19.3.0 | 19.3.1 |
| tailwindcss | 4.3.3 | 4.3.3, with @tailwindcss/vite 4.3.3 |
| lucide-react | 1.61.0 | 1.61.0 |
| Translation library added by convert | next-intl 4.14.9 | react-i18next 17.1.6, i18next 26.5.8 |

Node v25.6.1, npm 11.17.0 and Playwright 1.55.0.

## Commands

Build the packages from the repo root:

```sh
npm run build -w @dualkit/rules -w @dualkit/lint -w @dualkit/format -w @dualkit/convert -w dualkit
```

In next-smoke:

```sh
node <repo>/packages/cli/dist/cli.js convert --mode bilingual --start "npm run build && npx next start -p 4610" --port 4610
node <repo>/packages/cli/dist/cli.js convert --finish
```

In vite-smoke:

```sh
node <repo>/packages/cli/dist/cli.js convert --mode arabic --start "npm run build && npx vite preview --port 4611 --strictPort" --port 4611
node <repo>/packages/cli/dist/cli.js convert --finish
```

Between the two phases, a script filled every string in `dualkit-strings.json` with real Modern Standard Arabic and set each one to drafted, as an agent following the skill would.

## Counts from the final cycle

| | next-smoke | vite-smoke |
| --- | --- | --- |
| Files changed | 22 | 13 |
| Edits | 52 | 27 |
| Tailwind edits | 17 | 11 |
| Markup edits | 5 | 4 |
| String edits | 14 | 9 |
| Wiring edits | 23 | 5 |
| Strings to translate | 10 | 7 |
| Flags | 3 | 3 |

The next-smoke flags were the English `metadata` title, the price text left for a `<bdi>` by hand, and a date formatted in the browser's own locale. The vite-smoke flags were the same price text, the same kind of date, and the English `<title>` in `index.html`.

## Pass or fail per phase

| Phase | next-smoke | vite-smoke |
| --- | --- | --- |
| Phase 1 | Pass | Pass |
| Filling the ledger | Pass | Pass |
| Build on the new branch | Pass | Pass |
| English pixel check | Pass. All four pages differ by 0.000%. | Not run in arabic mode |
| Arabic check rules | Pass. `/ar` scores 98 and `/ar/pricing` 96, with 0 errors and 0 warnings. | Pass. `/` scores 96, with 0 errors and 0 warnings. |
| Finish | Pass | Pass |
| Phase 1 again on the finished branch | Pass, with 0 changes | Pass, with 0 changes |
| Finish again | Pass | Pass |

In the first cycle, next-smoke failed in three places before finish could pass. All three are fixed below.

## Defects and their fixes

| Defect | Fix commit |
| --- | --- |
| Finish refused with "Finish needs a start command", because `--start` and `--port` were used for phase 1 but never saved. | `d37d698` fix: save --start and --port in the config so finish can find them |
| The Next build failed on the moved layout, because the typed `LayoutProps<'/'>` and `PageProps<'/pricing'>` still named the old routes. | `10b748b` fix: move typed LayoutProps and PageProps routes under [locale] |
| The Next prerender failed with `cacheComponents` on, because next-intl read the locale from the request. On Next 16.3 and later convert now reads it from `next/root-params`. | `30b5343` fix: read the locale from next/root-params on Next 16.3 and later |
| The Arabic hint in the phone field sat on the left. The field is `dir="ltr"` for the number, so its placeholder was too. The rule check raised a warning for it. | `80af9b5` fix: show the Arabic hint on the right of fields convert sets to ltr |
| "Renews on" stayed English, because the text sat next to a value formatted with `toLocaleDateString()`. | `1d60c89` fix: extract text around a value formatted with a text method |
| The root layout from the Next starter was flagged as a computed class, although its template only adds next/font classes. | `5ea75ac` fix: stop flagging className templates that only add next/font classes |
| The report said the tests were not run, but not why or how to run them. | `f58086e` fix: say why the app's tests were not run and how to run them |
| Progress lines said "1 things are left". | `2ce163d` fix: use the singular in convert's progress lines |
| The English `<title>` in the Vite `index.html` was not flagged. | `4fec490` fix: flag the English page title in a Vite app's index.html |
| A date formatted with no locale showed in US order on the Arabic page, and nothing flagged it. | `fb6625b` fix: suggest a locale for dates and numbers formatted in the browser's locale |
| The suggestion for that date named the next-intl locale in a react-i18next app. | `5f509eb` fix: name i18n.language in the browser locale suggestion for react-i18next |
| The `convert.params` error did not show the shape finish reads. | `2cff204` fix: describe convert.params as the route to sample path map finish reads |
| Phase 1 refused to run again on a finished branch, with a message about the branch already existing. | `693f8f9` fix: let convert run again on its branch after finish |

## What the screenshots show

We took 390 pixel wide screenshots of the Arabic pages in both apps and looked at each one.

- The headings and body text are Arabic and sit on the right.
- The chevron in the link points left. Its computed transform is a horizontal flip.
- The price reads "AED 49.50", with its digits in order.
- The renewal line reads "تتجدد في 11/1/2026". The words are Arabic, but the date is in US order. That is the flagged date.
- The phone field shows its Arabic hint on the right, and its padding and corners match the card.
- There are no console errors.

The computed font on `html`, `body`, `h1`, `p`, `a` and `input` on the Arabic pages of both apps is "IBM Plex Sans Arabic", system-ui, sans-serif. Tailwind v4 puts its utilities in a layer, so the unlayered Arabic font rule in the convert stylesheet wins. The English pages in next-smoke keep their own fonts.

## What is still not handled

These are known and either flagged or listed in the report. None of them blocked a pass.

- "AED" in the price stays in Latin letters. Convert flags the price for a `<bdi>` and an Arabic currency name by hand.
- A date or number formatted with no locale gets a suggestion only. Convert does not change the call.
- The Next.js `metadata` title and the Vite `index.html` title are flagged, not translated.
- Convert does not place the language switch. It writes the component and tells you to add it.
- In next-smoke, a browser that asks for Arabic, or has the `NEXT_LOCALE` cookie set, is sent from `/pricing` to `/ar/pricing`. That is next-intl's locale detection, and convert leaves it on.
- In arabic mode, phase 1 still takes English screenshots that finish does not use.
- A `dir="ltr"` field shows its Arabic hint on the right, but once you type, the text runs left to right. That is what a phone number needs, and convert does not change it.
