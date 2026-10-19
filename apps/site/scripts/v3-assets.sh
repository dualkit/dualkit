#!/usr/bin/env bash
# Regenerates the committed v3 assets in apps/site/public/v3 from the sources in design/assets.
# Usage: PEXELS_CLIP=/path/to/clip.mp4 GEO_JSON=/path/to/countries.geojson apps/site/scripts/v3-assets.sh
# The Natural Earth geojson and the Pexels clip are inputs only; neither is committed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/apps/site/public/v3"
: "${PEXELS_CLIP:?set PEXELS_CLIP to the Pexels 5483089 clip}"
: "${GEO_JSON:?set GEO_JSON to the Natural Earth countries geojson}"
mkdir -p "$OUT/video"

# Paintings. The footer keeps its alpha.
cwebp -quiet -q 90 "$ROOT/design/assets/dunes-dusk.png" -o "$OUT/dusk.webp"
cwebp -quiet -q 90 -resize 1200 0 "$ROOT/design/assets/dunes-dusk.png" -o "$OUT/dusk-1200.webp"
cwebp -quiet -q 90 -alpha_q 100 "$ROOT/design/assets/dunes-footer.png" -o "$OUT/footer.webp"
cwebp -quiet -q 90 -alpha_q 100 -resize 1200 0 "$ROOT/design/assets/dunes-footer.png" -o "$OUT/footer-1200.webp"

# Gulf land grid (STEP 9 over a 1440x900 frame), packed as a base64 bitset.
python3 -I "$ROOT/design/assets/gulf-map.py" "$GEO_JSON" "$OUT" >/dev/null
git -C "$ROOT" checkout -q -- design/assets/gulf-map.json 2>/dev/null || true

# Video: portrait source, centre crop to 1080x1620, warm grade, 12 s loop, no audio.
VF="crop=2160:3240:0:(ih-3240)/2,scale=1080:1620,colorbalance=rs=.06:gs=.02:bs=-.07:rm=.05:bm=-.05"
ffmpeg -v error -y -t 12 -i "$PEXELS_CLIP" -an -vf "$VF" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/video/region.mp4"
ffmpeg -v error -y -t 12 -i "$PEXELS_CLIP" -an -vf "$VF" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 "$OUT/video/region.webm"
ffmpeg -v error -y -ss 2 -i "$PEXELS_CLIP" -an -vf "$VF" -frames:v 1 "$OUT/video/region-poster.png"
cwebp -quiet -q 85 "$OUT/video/region-poster.png" -o "$OUT/video/region-poster.webp"
rm "$OUT/video/region-poster.png"

for f in "$OUT"/video/region.mp4 "$OUT"/video/region.webm; do
  [ "$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")" -lt 4000000 ] || { echo "$f is over 4 MB" >&2; exit 1; }
done
ls -l "$OUT" "$OUT/video"
