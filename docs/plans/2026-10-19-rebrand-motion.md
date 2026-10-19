# dualkit.dev v3 motion spec

Source: `/find-animation-opportunities` sweep of the v3 Figma frames, with timings measured frame by frame from the two reference clips (30 fps). The site has no motion library; everything below is CSS transitions, WAAPI, or a small rAF loop, on `transform`, `opacity`, `filter` and `clip-path` only. Existing curves are reused: `--ease-expo cubic-bezier(.16,1,.3,1)`, `--ease-ui cubic-bezier(.2,0,0,1)`, `--ease-odo cubic-bezier(.22,1,.36,1)`.

## Measured from the references

| Motion | Measurement |
| --- | --- |
| Tile wave (integrations grid) | Diagonal wave: each column starts 167 to 183 ms after the previous one, and row 2 lags row 1 by the same step. Each tile darkens over 300 ms (9 frames, ease-in-out) to near ink, then releases over 800 ms (24 frames, ease-out). Whole wave is 2.2 s, then the grid rests. |
| Glass panel build (deal brief) | Panel fades in empty over 100 ms. The header lands at 100 ms, then the rows cascade about 200 ms apart, each an opacity plus blur-in of about 300 ms. The bar fills 0 to 78% over 600 ms (1.0 to 1.6 s). The note card lands at 2.0 to 2.3 s and the button at 2.8 to 3.1 s, dim to solid white. About 3.2 s in all. |
| Connector pulses | A white dot with a short glowing tail runs along each wire from chip to node, one wire at a time (Calendar, Inbox, Chat), looping. The node holds an 8-dot spinner. |
| Ranked list | The top row fades out, the list moves up one slot, and the row re-enters at the bottom as number 3. Then the bars fill one at a time and row 1 takes the highlight. About 5 s per loop, with a fade reset. |
| Skeleton lines | Three lines draw left to right one after another. The status square blinks. Then the loop resets. |

## Opportunities

Marketing page, seen occasionally. So the Explanation purpose is allowed, and section sequences can run longer than the 300 ms UI budget. Every sequence starts when its section is 35% in view, runs once, then rests. Ambient loops (pulses, spinner) pause off screen and when the tab is hidden.

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | Hero headline | Static | Explanation | Rare, first view | One of the three concepts in the headline prototype (Sam to pick). It runs once on load and replays only on click, not on a loop. |
| 2 | Hero glass panel + checkout | Static | Explanation | Rare | The measured panel build. Panel opacity 0 to 1 over 100 ms. Rows: opacity 0 to 1, `filter: blur(6px)` to 0, translateY 6px to 0, 300 ms `--ease-expo`, 200 ms apart. The checkout card enters 400 ms after the last step: opacity plus a translateY of 12px, 500 ms `--ease-expo`. The phone row's `bdi` tag lands last, with a 1px ink ring drawing round the number (clip-path inset 100% to 0, 400 ms). |
| 3 | How it works, cell 01 | Static | Explanation | Rare | Connector pulses. An 8px white dot with a 24px tail (a linear gradient) moves along each SVG path using `offset-path`, 900 ms `--ease-ui`, wires 300 ms apart, then a 1.2 s rest. On arrival the node's ring flashes (opacity .4 to 1 to .4, 400 ms). |
| 4 | How it works, cell 02 | Static | Explanation | Rare | The measured ranked list. Rows reorder with a FLIP translateY, 450 ms `--ease-expo`. Bars fill with scaleX 0 to their value, 600 ms `--ease-odo`, 150 ms apart. Row 1's highlight fades in 200 ms after its bar. |
| 5 | How it works, cell 03 | Static | Explanation | Rare | Skeleton lines draw with clip-path inset(0 100% 0 0) to 0, 500 ms `--ease-ui`, 180 ms apart. The score square blinks twice. Then "Open report" goes from dim to solid, 300 ms. |
| 6 | Works with grid | Static | Explanation (it lists the tools) | Rare | The measured tile wave, once on reveal. The glyph box fill goes to ink and the mark to white over 300 ms (ease-in-out), then releases over 800 ms (`--ease-ui`), with a 175 ms diagonal step. On hover (pointer: fine only), the hovered tile alone goes to ink over 150 ms. |
| 7 | Products menu | Instant | Spatial consistency | Occasional | The drawer opens from under the nav: clip-path inset(0 0 100% 0) to 0 plus opacity, 220 ms `--ease-ui`. The preview pane crossfades over 150 ms when the pointer moves between rows, and the row highlight moves instantly. Close takes 150 ms. When opened from the keyboard there is no animation at all. |

## Rejected

- **Menu row highlight and keyboard moves.** Arrow keys are pressed many times in a row. They move instantly.
- **Bench range tracks.** People read these as data, so the dots never animate for style. The tracks render settled. The only motion is the live dot during a run, which is a state indicator.
- **Kit accordion content.** This is functional reading. The height opens over 250 ms with `--ease-ui` and the content does not cascade. The glass preview swaps with a 150 ms crossfade, not a rebuild.
- **Footer wordmark and mascot.** They stay as shipped (letters mirror, the eyes track, the 3.6 s bob). Nothing new is added there.
- **Scroll-linked parallax on the paintings.** It costs main-thread work, and the effect is decorative.

## Reduced motion

Every sequence renders its settled final state. The ambient loops stop. The menu opens and closes at once, with no transition: the drawer holds glass, and glass must never fade (a fading backdrop re-composites and flashes), so the 120 ms opacity change first planned here was dropped.

## Verdict

The page needs motion in seven places, and all of it explains the product: what loads, what gets fixed, what gets checked. The headline carries the most weight because everyone sees it. Next comes the hero panel build, which is the reference's strongest move and shows Dualkit's own story. Each row goes to `/animate` for the build, then `/review-animations` on the result.
