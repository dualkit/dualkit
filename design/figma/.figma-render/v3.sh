#!/bin/sh
# Regenerate and render the v3 specs. Usage: sh .figma-render/v3.sh [spec ...]
cd "$(dirname "$0")/.." && for g in home glass-options menu hero-graphic hero-options mobile kit-previews; do node gen/v3/$g.mjs >/dev/null; done
for s in ${@:-home-v3-desktop hero-v3-warm glass-options-v3 menu-v3-desktop hero-graphic-v3 hero-options-v3 home-v3-phone menu-v3-phone kit-previews-v3}; do
  node ~/.claude/skills/figma-render/bin/figma-render.mjs validate specs/$s.json --manifest .figma-render/manifest.json --tokens .figma-render/tokens.plan.json | tail -3
  node ~/.claude/skills/figma-render/bin/figma-render.mjs render specs/$s.json --manifest .figma-render/manifest.json --tokens .figma-render/tokens.plan.json --file "Dualkit" | tail -1
done
