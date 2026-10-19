"""Builds apps/site/public/v3/marks/osi-approved.svg from OSI's official OSIApproved.svg.

Usage: python3 -I osi-approved.py OSIApproved.svg OpenSans-ExtraBold.ttf out.svg

Source: https://opensource.org/wp-content/uploads/2009/06/OSIApproved.svg (linked from opensource.org/osi-logo-files).
Font:   https://github.com/googlefonts/opensans/raw/main/fonts/ttf/OpenSans-ExtraBold.ttf (OFL).

Two changes only, and no change to shape, proportion or arrangement:
1. Colour: OSI's own black-and-white treatment for light backgrounds (keyhole filled white, outline and words black),
   the same scheme as its "OSI logo B&W for light backgrounds" file. Black is in the OSI palette.
2. The live <text> "Approved License" (Open Sans 800, 54px) is converted to outlines with the same font, size and
   position, so it renders identically without the font installed. Inkscape metadata and empty flowRoots are dropped,
   and the viewBox is cropped to the artwork.
"""
import re
import subprocess
import sys
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

src, font_path, out = sys.argv[1:4]
svg = open(src, encoding='utf-8').read()

m = re.search(r'<text\b[^>]*>\s*<tspan\b[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"[^>]*font-size:([\d.]+)px[^>]*>([^<]+)</tspan>\s*</text>', svg, re.S)
if not m:
    sys.exit('no Approved License text element found')
x0, y0, size, words = float(m.group(1)), float(m.group(2)), float(m.group(3)), m.group(4)

font = TTFont(font_path)
upem = font['head'].unitsPerEm
glyphs = font.getGlyphSet()
order = font.getGlyphOrder()
shaped = json.loads(subprocess.run(['hb-shape', '--output-format=json', '--no-glyph-names', font_path, words], capture_output=True, text=True, check=True).stdout)
s = size / upem
pen = SVGPathPen(glyphs)
pen_x = 0
for g in shaped:
    # Font units are y-up; SVG is y-down with the baseline at y0.
    tp = TransformPen(pen, (s, 0, 0, -s, x0 + (pen_x + g['dx']) * s, y0 - g['dy'] * s))
    glyphs[order[g['g']]].draw(tp)
    pen_x += g['ax']
outlined = f'<path aria-label="{words}" fill="#000000" d="{pen.getCommands()}"/>'
svg = svg[:m.start()] + outlined + svg[m.end():]

svg = re.sub(r'<metadata\b.*?</metadata>', '', svg, flags=re.S)
svg = re.sub(r'<sodipodi:namedview\b.*?(/>|</sodipodi:namedview>)', '', svg, flags=re.S)
svg = re.sub(r'<flowRoot\b.*?</flowRoot>', '', svg, flags=re.S)
svg = re.sub(r'\s(?:sodipodi|inkscape):[\w-]+="[^"]*"', '', svg)
svg = re.sub(r'\sxmlns:(?:dc|cc|rdf|svg|sodipodi|inkscape)="[^"]*"', '', svg)
svg = re.sub(r'<\?xml[^>]*\?>\s*', '', svg)
svg = re.sub(r'<defs\b[^>]*/>', '', svg)
svg = svg.replace('fill:#3da638', 'fill:#ffffff').replace('stroke:#1c511c', 'stroke:#000000')
svg = re.sub(r'\s(width|height)="[^"]*in"', '', svg, count=2)
# An unfilled, unstroked ellipse (Inkscape leftover, invisible) only widens the bounds.
svg = re.sub(r'<ellipse\b[^>]*style="[^"]*fill:none[^"]*stroke:none[^"]*"[^>]*/>', '', svg, flags=re.S)
# The artwork's bounds measured in Chromium (paths 44.5,55.1 to 559.0,732.8) plus the keyhole's half stroke and 2 units.
svg = svg.replace('viewBox="0 0 576 792.00001"', 'viewBox="34 45 535 698"')
svg = re.sub(r'\n\s*\n', '\n', svg)
open(out, 'w', encoding='utf-8').write(svg)
