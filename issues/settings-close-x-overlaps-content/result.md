# Result

On the desktop the settings X has a column of its own right of the
section (6 px from it) instead of lying over the section's heading row,
so it stays sticky in reach while a long page scrolls and never covers the
content. On a phone (≤ 760 px) it sits at the right end of the section
list's or the back row's first line as before, but scrolls away with it
instead of floating over the text.

`web/tests/settings-close.spec.ts` walks every settings page in the
navigation at 1280×600 and 390×700, scrolls each from top to bottom in
120 px steps and fails if any visible glyph or control of the section lies
under the X (clipped overflow excluded). Against the previous CSS it fails
on Avaimet, Tekoäly and others; with the fix it passes. Evidence:
`evidence/{desktop,phone}-vieritetty-{light,dark}.png`, the long
Kokeelliset ominaisuudet page scrolled, at device scale factor 2.

The walk found an unrelated defect: Tilannekatsaus's rows overflow their
card in a narrow desktop column and are clipped (filed as intake
`notably-ten-sheet`).

## Decisions for later review

- **Desktop: a reserved gutter column, not a header bar.** Alternatives: an
  opaque sticky header across the section (content scrolls under a bar
  rather than under a lone X, but it costs a row of height and a second
  surface). The gutter costs about 38 px of width that the section's
  720 px measure rarely needs.
- **Phone: the X scrolls away with the top row instead of staying sticky.**
  A phone has no width for a gutter, and a sticky bar would take a row of
  the small screen. Closing then needs a scroll to the top, Esc, or the
  browser's back, all of which already close Settings.
