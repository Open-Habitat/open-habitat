# Bundled UI fonts

Instrument Sans (400–600) and JetBrains Mono (400–500), Latin and Latin-ext WOFF2 subsets, are bundled for the accepted production UI. Both use the SIL Open Font License 1.1; the original license texts are in `instrument-sans-OFL.txt` and `jetbrains-mono-OFL.txt`. Retrieved from Google Fonts CSS/font delivery (`fonts.googleapis.com`, `fonts.gstatic.com`) at the font revisions indicated by those URLs on 2026-09-24; license originals from `google/fonts` under `ofl/instrumentsans/` and `ofl/jetbrainsmono/`. Runtime CSS references these files locally; it never requests Google Fonts.

`habitat-composer.woff2` is an OFL derivative named Habitat Composer, generated
from the bundled Latin JetBrains Mono by `build-composer-font.py` (FontTools
4.60.1 with WOFF support). Its contextual kerning adds one space advance after
an initial `!` or `!!`. This keeps the textarea's native text, offsets,
clipboard and input methods unchanged; no synthetic character enters a draft
or command. Rebuild the derivative when replacing its source font.
