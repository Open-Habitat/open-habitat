#!/usr/bin/env python3
"""Build the shell editor's presentation-only prefix spacing.

Run with fonttools[woff]==4.60.1. No runtime dependency: the source OFL font
and the generated WOFF2 are bundled. Keep the native textarea, including its
value, clipboard, selection, undo and IME, rather than mapping synthetic text.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

root = Path(__file__).resolve().parent
font = TTFont(root / "jetbrains-mono-latin.woff2", recalcTimestamp=False)
# Preserve the original outlines and advances. Replace positioning only; code
# ligatures stay disabled by the application's existing typography policy.
if "GPOS" in font:
    del font["GPOS"]
glyphs = " ".join(font.getGlyphOrder())
bang = font.getBestCmap()[ord("!")]
space = font["hmtx"].metrics[font.getBestCmap()[ord(" ")]][0]
addOpenTypeFeaturesFromString(font, f"""
languagesystem DFLT dflt;
languagesystem latn dflt;
@any = [{glyphs}];
feature kern {{
  lookup single {{
    ignore pos @any {bang}';
    ignore pos {bang}' {bang};
    pos {bang}' <0 0 {space} 0>;
  }} single;
  lookup double {{
    ignore pos @any {bang} {bang}';
    pos {bang} {bang}' <0 0 {space} 0>;
  }} double;
}} kern;
""")
# A derivative gets its own family name; retain copyright and OFL metadata.
for record in font["name"].names:
    if record.nameID in (1, 4, 6, 16, 17):
        name = {
            1: "Habitat Composer", 4: "Habitat Composer Regular",
            6: "HabitatComposer-Regular", 16: "Habitat Composer", 17: "Regular",
        }[record.nameID]
        record.string = name.encode(record.getEncoding())
font.save(root / "habitat-composer.woff2")
