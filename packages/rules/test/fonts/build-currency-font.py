"""Builds CurrencySigns.woff, a test-only font with glyphs for U+20C1, U+20C3 and U+20C4 and nothing else.

No OFL font had U+20C1 when this was written (checked 20 Oct 2026: Noto Sans 2.015 has U+20C0 only; Noto Sans Arabic,
Noto Sans Symbols and Noto Sans Symbols 2 have none of U+20C1 to U+20C4), so the font is drawn here with fontTools.
Each glyph is a 700-unit-wide box; .notdef is 500 wide, so the signs are told apart from the missing-glyph box by width.

Run: python3 build-currency-font.py   (needs fontTools)
"""
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPEM = 1000
SIGNS = {0x20C1: "uni20C1", 0x20C3: "uni20C3", 0x20C4: "uni20C4"}


def box(width: int, inset: int) -> object:
    pen = TTGlyphPen(None)
    pen.moveTo((inset, 0))
    pen.lineTo((inset, 700))
    pen.lineTo((width - inset, 700))
    pen.lineTo((width - inset, 0))
    pen.closePath()
    return pen.glyph()


names = [".notdef", *SIGNS.values()]
fb = FontBuilder(UPEM, isTTF=True)
fb.setupGlyphOrder(names)
fb.setupCharacterMap(SIGNS)
fb.setupGlyf({".notdef": box(500, 80), **{n: box(700, 120) for n in SIGNS.values()}})
fb.setupHorizontalMetrics({".notdef": (500, 80), **{n: (700, 120) for n in SIGNS.values()}})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({"familyName": "Test Currency Signs", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
fb.setupPost()
fb.font.flavor = "woff"
fb.save(str(Path(__file__).with_name("CurrencySigns.woff")))
