# @dualkit/starter

A bilingual design system you can fork. One DTCG token file in git feeds Figma and code, so neither drifts.

v0.1 is the token pipeline. Components come next, after they are approved in Figma.

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
