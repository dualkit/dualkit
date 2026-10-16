# @dualkit/starter

A bilingual design system you can fork. One DTCG token file in git feeds Figma and code, so neither drifts.

v0.1 is the token pipeline and eight bilingual React components, drawn and approved in Figma first (file "Dualkit Starter").

## Use

```css
@import '@dualkit/starter/tokens.css';
@import 'tailwindcss';
@import '@dualkit/starter/theme.css';
```

Then `<html lang="ar" dir="rtl">` gives you Arabic type, and `data-theme="dark"` gives you dark mode. Without `data-theme`, the system setting decides.

## Change a token

Edit a file under `tokens/`, run `npm run build -w @dualkit/starter`, and commit the source and `generated/` together. CI fails if they disagree.

To update Figma, run `figma-render tokens tokens/dualkit.resolver.json`. `generated/figma-variables.json` holds the same variables for any other importer.

## Layout

- `tokens/dualkit.resolver.json`: the resolver. Sets are primitives, semantic and script; modifiers are theme (light, dark) and script (en, ar).
- `scripts/tokens.mjs`: reads the resolver and writes CSS, the Tailwind theme and the Figma variables.
- `generated/`: the output. Never edit by hand.

## Components

Eight React 19 components in `components/`, each with a real right-to-left problem solved:

| Component | What it gets right |
| --- | --- |
| `Button` | `icon="forward"` and `"back"` flip with the reading direction; close and check never do. |
| `Field` | The value takes `dir="auto"`, so an email or IBAN stays left to right in an Arabic form. |
| `DigitInput` | Reads Western, Arabic-Indic and Persian digits, typed or pasted. Boxes stay left to right. Reports Western digits. |
| `Amount` | All six Gulf currencies through `@dualkit/format`, isolated in a `bdi`, Arabic-Indic digits in Arabic. |
| `DateDisplay` | Gregorian with Umm al-Qura Hijri, pinned to Gulf time, never shifted by the visitor's clock. |
| `Tabs` | WAI-ARIA tabs. ArrowLeft moves forward in Arabic. |
| `Sheet` | Modal side sheet from the inline end. Traps focus, closes on Escape, the scrim or a swipe back to its edge, returns focus. |
| `Toast` | `role="status"`, swipes away towards the inline end, Escape dismisses, the timer pauses on hover and focus. |

They are source you copy in, not a compiled package, so you own them and change them like your own code.

### Copy them in

With the shadcn CLI, one at a time:

```sh
npx shadcn@latest add https://dualkit.dev/r/amount.json
```

That brings in the shared base and `@dualkit/format` too. Or take all of them at once:

```sh
npx degit dualkit/dualkit/packages/starter/components src/components/dualkit
npm i @dualkit/format
```

(Or copy `node_modules/@dualkit/starter/components` after `npm i @dualkit/starter`.)

Then load the tokens and the component styles once, and set `lang` and `dir` together:

```tsx
import '@dualkit/starter/tokens.css'
import './components/dualkit/styles.css'
import { Amount, Button } from './components/dualkit'

<html lang="ar" dir="rtl">
  <Amount amount={1250} currency="AED" locale="ar" label="المبلغ المستحق" />
  <Button icon="forward">متابعة</Button>
</html>
```

`styles.css` is plain CSS on the `--dk-` tokens, so it works with or without Tailwind. Mirroring comes from `dir` through logical properties and `:dir()`; no component has an RTL branch except where the behaviour itself differs (arrow keys in Tabs, the swipe direction). `Amount`, `DateDisplay` and `DigitInput` take a `locale` prop rather than reading the page, so server and client render the same thing.

Tests: `npm test -w @dualkit/starter` runs the token tests and the component tests in jsdom, each behaviour in English and Arabic.
