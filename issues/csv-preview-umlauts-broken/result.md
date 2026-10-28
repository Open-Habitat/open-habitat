# Result

**What the file is.** Jari's `viikon-luvut.csv` on the test server
(`~/src/open-habitat/test-guide-files/`) is NFC UTF-8 without a BOM, separated
by semicolons: `päivä;käynnit;keskustelut` (`70 c3 a4 69 76 c3 a4 3b …`). The
strict UTF-8 decode accepts it, and the text that reaches the table is
correct.

**What was broken and is fixed.** The table split rows only at commas (and the
daemon counted columns the same way), so a semicolon file was shown as one
column: the whole header `päivä;käynnit;keskustelut` in one bold cell, and the
card said "1 saraketta". Both now choose the separator the first row uses most
outside quotes: comma, semicolon or tab, with a comma on a tie, and the same
rule in `csvSeparator` (web) and `countText` (daemon). A `.tsv` is still split
at tabs.

**Not reproduced: the missing dots.** With Jari's exact bytes, the preview in
Chromium on Linux shows `päivä` correctly, in both the bold header and normal
cells, and also with decomposed (NFD) input. The bundled Instrument Sans has
an intact `adieresis` (`a` + `uni0308`) at every weight from 400 to 700
(checked with fontTools instancing), so the font file is not missing the
dots. Jari uses Brave on macOS (maple), which this host cannot run. If the
dots still disappear after the fix, the next thing to check is the header row
on macOS (bold 600, Instrument Sans): does `ä` also lose its dots in other
bold Finnish UI text there?

**Evidence.** Unit tests for the separator rule (web `tableRows`, Go
`TestCountTextColumnsFollowTheFirstRowsSeparator`); `go test ./internal/daemon`
and the web area pass.

## Decisions for later review

- **Separator choice.** The most frequent of `,` `;` and tab in the first row,
  comma on a tie. Alternatives: sniffing several rows (more robust for odd
  files, but a second rule to keep in sync with the daemon), or a per-locale
  default (we have no locale signal for a file). The first row is what the
  daemon already reads for its column count.
