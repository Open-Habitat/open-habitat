# Result: terminal settings page, prototype round 2

## Saatesanat

Tässä on C uudestaan sinun kahdella muutoksellasi. Päätepaneelissa on vain
ratas, ja se avaa Asetukset › Pääte. Sivun alussa on silloin "Takaisin
päätteeseen", ja myös Asetusten sulkeminen vie takaisin. Paneeliin ei tule
yhtään asetusta.

Kierroksen akseli on tekstin koko ja sen esikatselu. Kaikissa kolmessa
versiossa elävä pääte vaihtaa kokoa heti, ja sivu kertoo, montako saraketta
päätepaneeliin mahtuu juuri tällä näytöllä. Luku on paneelin, ei
esikatselun, ja tarkistus vertaa sitä paneelin omaan sarakemäärään. A on
liukusäädin, B askelin, jossa on sarakeviivain ja 80 sarakkeen raja, ja C
neljä valmista kokoa pienoiskuvina. Suosittelen B:tä. Kokeile + -painiketta
muutaman kerran ja katso, miten pitkä `alarm_test.go`-rivi alkaa rivittyä ja
sarakeluku pienenee. Puhelimessa B kertoo, kun luku putoaa alle 80:n.

## Axis and variants

One view, Settings › Pääte, as chosen in round 1 (C). Axis: **how text size
is chosen and previewed.** Everything else on the page is the same in all
three.

- **A Liukusäädin** (slider): 10–18 px in half-pixel steps, the value at
  the right, and the live terminal directly below resizing while you drag.
  A chip in the preview's caption gives the columns that fit the panel.
- **B Askelin** (stepper and columns): − 12,5 px + and Oletus. The preview
  carries a column ruler aligned to xterm's own cells and a dashed line at
  column 80 while the preview is wider than that. A sentence below reads
  "Päätepaneeliin mahtuu tällä näytöllä N saraketta", followed by either
  "80 merkkiä leveät ohjelmat mahtuvat" or, under 80, a warning that wide
  programs (htop, `git log --graph`) wrap.
- **C Valmiit koot** (presets): Pieni, Normaali, Iso and Suurin as radio
  cards (desktop 11 / 12,5 / 14 / 16 px, phone 10,5 / 12 / 13 / 15 px). Each
  card has a thumbnail at its real size and the columns that fit the panel.
  The chosen size shows in the live preview below.

## What stayed from round 1

- Kopioi valitsemalla: Pois / Päällä, off by default, account-wide. It can
  be tried in the preview.
- Kohdistin and Usean rivin liittäminen, both still marked Ehdotus.
- "Näin pääte toimii": colours follow the theme, address card, tmux
  history, Shift to select.
- Settings search finds the section's rows. Kokeelliset loses copy on
  select and open-URLs.
- The gear in the panel sits before the maximise button and only
  navigates.

## How the column count works

The count is for the terminal panel on this screen, not for the narrower
preview. It is the width of the main area less xterm's 14 px scrollbar,
divided by the cell width that a hidden xterm gets at that size, so font
hinting and xterm's device-pixel rounding are both included. `check.mjs`
asserts that it equals the panel's own fitted columns at the default size
in every theme and width, and after each variant's control has set 16 px.
In production the same number could come from the live panel itself
whenever one is open.

On headless Linux the mono font is hinted to whole pixels, so 12,5 and 14 px
can give the same columns there (C's Normaali and Iso both read 141). On a
Mac they differ. The number follows the browser you are in, which is the
point.

## Recommendation

**B.** The column count answers the question that usually sits behind a
size change: does my program still fit? B puts that answer in a sentence
right under the control, and its ruler and 80-column line make it visible
in the preview. The stepper is exact, works from the keyboard without a
slider's fiddly drag, and fits on one row on a phone. Oletus gives an easy
way back.

A is the most direct to play with, but on a phone or a trackpad it is hard
to land on an exact value, and the chip is easy to overlook. C has the
nicest overview and fewest decisions, but four steps may not be enough on
a large external display. Its thumbnails are also the least like the real
terminal. If B feels too technical, C's cards with B's sentence below the
preview would be the fallback.

## Host assumptions

As in round 1: text size is stored in the browser (like the theme), and
copy on select, cursor and paste become account preferences
(`contracts/v1/account-preferences.schema.json`). No authority changes.
`TerminalSurface` gains `fontSize` and `cursorStyle` props, and the preview
is a second `TerminalSurface` writing a fixed synthetic sample that talks
to no host.

## Decisions for later review

- **Range 10–18 px in 0,5 px steps (A and B).** Alternatives were whole
  pixels or a wider range. Half pixels keep today's 12,5 px default
  reachable, and below 10 or above 18 the panel stops being useful at the
  supported widths.
- **Default 12,5 px on desktop, 12 px on a phone.** These are round 1's
  Normaali values. Because the size is per browser, the phone's value is
  simply that browser's.
- **The count is the panel's, not the preview's.** The preview is narrower
  than the panel, so its own columns would mislead. The alternative was to
  make the preview as wide as the panel, which would break the Settings
  layout.
- **The preview stays pinned to its first line.** A real terminal shows the
  bottom, but pinned to the top the command and the wrapping line stay
  visible at any size.
- **Back button only when arriving from the gear.** Arriving through the
  account menu, Settings works as before. The alternative, always showing
  it, would point to a terminal the person may not have opened.
- **Four presets in C.** Round 1's three left no step for a large display.
  Four still fit as a 2 × 2 grid on a phone.

## Questions for Jari

1. B, A or C? Or C's cards with B's sentence?
2. Is 10–18 px the right range, or should it go further at either end?
3. Should the count say "N saraketta" alone, or "N × M" with rows too? Rows
   depend on the panel's height, which the person drags, so the count
   leaves them out.
4. Should there be a keyboard shortcut in the terminal (Ctrl/⌘ +/−) that
   changes the same setting? Today the browser's own zoom catches those.
5. Are cursor and paste still welcome as proposals, or should the first
   version have copy on select and text size only?

## Evidence and build

- Round: `design-system/prototypes/rounds/2026-11-21-terminal-settings-2/`.
  `NOTES.md` has the build and check commands.
- Built page (kept outside the worktree):
  `/var/tmp/agent-keep/terminal-settings-page/round-2/terminal-settings-2.html`.
- `check.mjs`: 440 checks passed. It covers 1440 and 390 px in Päivä, Yö and
  Kontrasti, the column count against the panel, each variant's control at
  16 px, gear → Settings → back, copy on select in the preview, the paste
  question, search, English, a phone preset flow, and a clean console.
- Screenshots: `/var/tmp/agent-keep/terminal-settings-page/round-2/check/`.
  None are committed.
