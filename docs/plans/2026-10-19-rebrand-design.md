# dualkit.dev v3 rebrand: design

Approved by Sam in Figma and in live prototypes on 19 Oct 2026. This is the source the build plan argues from.

## Intent

Make dualkit.dev feel grand, official and modern: hard edges, ruled frames, frosted glass on a golden-hour painting, plenty of open space, and motion that explains what Dualkit does rather than decorating it. References: two Kevser "Altura" clips (measured, see the motion spec), solidroad.com (full-viewport sections), the Ironclad and Fernand footers (painted landscape under the columns), Obsidian's seals row.

## Where everything is

- Figma file "Dualkit" (key 7rRW4ajr465l8SObGP6rN1), page Web: "Dualkit · Home · Desktop · v3" and "Dualkit · Menu open · Desktop · v3". Rejected boards are on the Archive page.
- Generators: `design/figma/gen/v3/` (`home.mjs`, `sections.mjs`, `menu.mjs`, `parts.mjs`, `copy.mjs`). Every string and every number on the page is in `copy.mjs`, `sections.mjs` and `menu.mjs`.
- Copy: `docs/plans/2026-10-19-rebrand-copy.md`, passed `/no-ai-slop` and `/humanizer`.
- Motion: `docs/plans/2026-10-19-rebrand-motion.md` (measured reference timings, the seven animated moments, what stays still).
- Hero animation: the approved prototype `hero3/index.html` (vanilla JS, about 57 KB), copied into the repo at `design/prototypes/hero3/` by the plan.
- Assets: `design/assets/dunes-dusk.png` (painting), `dunes-footer.png` (grainy footer painting, alpha top), `gulf-map.json` (dot map from Natural Earth 1:50m), the Pexels clip 5483089 (portrait, 29.6 s, Pexels licence).

## Rulings (Sam, 19 Oct 2026)

- Ground is warm `#efece4`. Ink `#09090b`. Hairlines `rgba(0,0,0,.12)`. Hard edges everywhere: no radius on buttons, panels or media. The only round things are the seals and the mascot.
- Glass is option A, Smoked: `rgba(11,10,9,.46)` fill, `backdrop-filter: blur(24px) saturate(140%)`, 1px ring `rgba(255,255,255,.14)`. No drop shadows anywhere.
- Type: Switzer 400 for display (64 px hero and statement, 48 px sections, tracking -0.032em and -0.028em), Switzer for UI, IBM Plex Sans Arabic for Arabic, mono is Berkeley Mono. Berkeley Mono files may not be committed or served until Sam supplies the web licence; until then the mono stack is `'Berkeley Mono', var(--font-plex-mono), monospace` so it shows only where it is installed locally.
- Section labels: a 7 px ink square plus a 14 px sentence-case label. No uppercase anywhere, no em dashes.
- Text animation is simple: a one-time word blur-up. The depth goes into the hero graphic.
- Hero graphic: one glass panel on the painting, telling the story "without Dualkit → install → six fixes → checked → both directions" with a camera that dollies to each fault, numbered pins without leader lines, and a caption rail with six ticks.
- Sections alternate contained and full-viewport (900 px at 1440): hero, statement (full), how it works, Gulf map (full width), the kit, works with, video split (full), both directions, the Bench, numbers, closing, footer.
- Footer: brand, line, square social buttons, four link columns, six round seals with real icons and the note that they are standards, not certifications, the legal row with "Made by Sam Santos" and the mascot, then the grainy painting with a huge white wordmark.
- Real numbers only. No certification badges Dualkit does not hold. No adoption claims. The Bench teaser shows real data once a run exists and says "Sample data until 1 November" until then.
- The video is Pexels 5483089, laid out as a split (words left, video 640 px wide right), graded slightly warm, muted, looping, poster frame first.

## Not designed yet (gates in the plan)

- Phone layouts (390) for the home page and the menu.
- The kit previews for Format, Starter, Check and Bench (only Skills is drawn).
- The inner pages (docs, updates, status, bench) keep their v2 content; only the shell (ground, nav, footer) changes in this release.
