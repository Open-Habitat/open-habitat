# caps-print

Capabilities: Documents and print. Two screens are drawn in full, and both
now show what the named programs really produce.

## What the reader sees

- **Swimming certificates** (Judy, Maple Lane School). She hands over the
  class lists and a photo of last year's certificate. The view shows class
  7B's PDF: three certificates large (three levels, three ribbon colours),
  all 21 pages of the class as a sheet, and the six class PDFs adding up to
  118.
- **Silent Night, lower** (Trent, Harbour Singers). The sopranos' part in
  both keys behind the toggle (top note G as written, F a whole tone lower).
  The lower one is the soprano practice track: one button plays it, and a
  playhead follows the notes while the soprano line sounds on a clarinet
  over the other three voices on a quiet piano. Under it, the first pages of
  the five books (score, soprano, alto, tenor, bass).

## What changed and why

- Round 6's CSS certificate and the eight-note SVG staff are gone; the view
  holds rendered pages. `certMock` and `scoreMock` and their use of the
  shared `.cert`/`.score` styles were replaced by `certView` and `scoreView`
  with `cp-` classes in `block.css`.
- The asks are in the person's words and name the thing ("Silent Night sits
  too high for our sopranos"); the left-hand text says what each person
  gets, not which files exist. The group line names both results.
- The choir scene no longer uses music21: LilyPond transposes by itself
  (`\transpose d c`), so the work is `musicxml2ly`, a one-line change per
  book, `lilypond`, `fluidsynth`. The program tags follow what the scenes
  use: `Typst` and `LilyPond, FluidSynth`.
- The work behind "Show work" is the real route: the tool outputs are the
  page counts Typst produced (19, 21, 20, 18, 21, 19), LilyPond's and
  FluidSynth's own log lines. Not run for the page: `xlsx2csv` and
  `musicxml2ly` (the sources here start as CSV and LilyPond); their command
  lines and the `musicxml2ly` messages are written from the programs'
  documented behaviour.
- The practice track has no browser controls, because they cover the music
  in a view this narrow; `client.js` gives it one play/pause button and
  stops it when the reader switches key. Nothing loads before the click.

## Sources in this directory

| File | What |
|---|---|
| `pupils.csv` | 118 invented pupils in six classes (7A–8C) with level and distance. Made once with a seeded script from two lists of first names and surnames; no real class list. |
| `certificate.typ` | The certificate: A5 landscape, one page per CSV row, `--input class=7B` picks a class. |
| `silent-night.ily` | The music: four voices and the words, in D major. |
| `assets.mjs` | Builds everything below from those three. |

## Assets and how they were made

`assets.mjs` writes into `$ETUSIVU_ASSETS/caps-print/` (1.0 MB in all):

| File | Made by | Size |
|---|---|---|
| `certificate-1.webp` … `-3.webp` | Typst → `pdftoppm -r 150` → ImageMagick, 1000×705 | 24–25 KB each |
| `certificates-7B-sheet.webp` | the 21 pages of `certificates-7B.pdf`, ImageMagick `montage` 7×3, 1200×387 | 25 KB |
| `soprano-d.webp`, `soprano-c.webp` | LilyPond (part book in D and in C) → `pdftoppm`, 1200×900; `soprano-c.webp` is the video's poster | 45–47 KB |
| `book-score.webp`, `book-soprano/alto/tenor/bass.webp` | LilyPond, the five books in C, first page, 360×270 | 10–12 KB each |
| `practice-soprano.mp4` | LilyPond MIDI → FluidSynth → ffmpeg; 32.9 s, 1200×900, H.264 + AAC 96 kbit/s, faststart | about 0.75 MB |

The audio track is the point of that file (budget rule: "no audio track
unless it matters").

The playhead is not guessed. `assets.mjs` engraves the same part once more
with red note heads, reads the x position of every head from that image
(ImageMagick), reads every note's length from `silent-night.ily`, and moves
an ffmpeg overlay from head to head in time with the MIDI tempo
(dotted crotchet = 46). It stops with an error if the number of heads found
and the number of notes in the source differ.

Programs and versions used (aarch64 host, everything in scratch, nothing
installed):

- **Typst 0.15.1**: official `typst-aarch64-unknown-linux-musl` release.
- **LilyPond 2.24.3**. LilyPond publishes Linux binaries for x86_64 only,
  so on this ARM host the route was Ubuntu 24.04's packages unpacked with
  `apt-get download` + `dpkg -x` (`lilypond`, `lilypond-data`,
  `lilypond-fonts`, `guile-2.2-libs`, `libgc1`) and a wrapper script that
  sets `LD_LIBRARY_PATH`, `GUILE_LOAD_PATH`, `GUILE_LOAD_COMPILED_PATH` and
  `LILYPOND_DATADIR`. On x86_64 the official tarball works as it is.
- **Ghostscript 10.08.0** and **FluidSynth 2.6.3**: conda-forge, with
  `micromamba create -p $S/tools/fs -c conda-forge fluidsynth ghostscript`
  (LilyPond calls `gs` from PATH).
- **ffmpeg 6.1.1**, **ImageMagick 6**, **poppler** (`pdftoppm`, `pdfinfo`):
  installed on the host.

```
S=/var/tmp/agent-scratch/<dir>; export TMPDIR=$S
TYPST=$S/tools/typst/typst LILYPOND=$S/tools/lilypond \
FLUIDSYNTH=$S/tools/fs/bin/fluidsynth \
SOUNDFONT=$S/tools/deb/usr/share/sounds/sf2/FluidR3_GM.sf2 \
URW_FONTS=$S/tools/deb/usr/share/fonts \
node blocks/caps-print/assets.mjs        # 19 s
```

## Sources and licences

- **Silent Night** (Stille Nacht): melody Franz Xaver Gruber, 1818; German
  words Joseph Mohr, 1816; English words John Freeman Young, 1859. Public
  domain. The four-part setting in `silent-night.ily` was written for this
  page (plain I–IV–V harmony under the tune, all voices in the same rhythm)
  and is given to the public domain (CC0). It is the only real-world name in
  the block: a public-domain carol, credited on the page as a printed part
  would credit it.
- **FluidR3_GM.sf2** soundfont by Frank Wen, MIT licence; from Ubuntu's
  `fluid-soundfont-gm` 3.1-5.3 (`apt-get download`, unpacked in scratch).
  Used to render the audio; the soundfont itself is not shipped.
- **URW base 35 fonts** (P052, Z003, Nimbus Sans on the certificate; C059 in
  the music), release 20200910, AGPL-3 with the font exception that lets
  documents embed them; from Ubuntu's `fonts-urw-base35`. Shipped only as
  pixels in the rendered images.
- **LilyPond's Emmentaler** music font: part of LilyPond, OFL; LilyPond's
  output is not covered by its GPL.
- No stock media, no third-party demo files, nothing hotlinked.

No field-standard claim is made about any program.

## Assumptions about the product

- The view can show a PDF's pages and play a short video with sound.
- The agent has `typst`, `lilypond`, `fluidsynth`, a General MIDI soundfont
  and `xlsx2csv` available: a configured environment, as the page's frame
  allows.

## For Jari

- I cannot listen to the practice track here. Its level is checked
  (mean −15 dB, peak −5 dB, not silent) and the playhead positions are
  checked against frames, but nobody has heard the mix (clarinet over quiet
  piano). Worth thirty seconds with sound before the page goes live.
- The four-part setting is mine and deliberately simple. A choir director
  would call it a plain hymn-book harmonisation; it is correct to read and
  sing, not an arrangement to admire.
- The other nine list rows are unchanged from round 6.

## Engine needs

- `check.mjs` allows no audio format, so a sound clip has to ship as an MP4.
  That suited this block (the video is the part with a playhead), but an
  audio-only capability would need `.m4a` or `.mp3` in `KIND`.
- `kit.mjs` `video()` is always `muted` with native controls. A clip whose
  sound matters, or whose picture the controls would cover, needs its own
  `<video>` and button (done here in `block.js` and `client.js`). A
  `video(src, { sound: true, controls: false })` with a kit play button
  would cover this block and `alice-04-market-video`.
- `check.mjs` presses a fixed list of button classes (`[data-set]`,
  `.ah-offer-b`, `.vid-play`, `.op-b`, `[data-undo]`). This block's
  `.cp-play` is not on it, so the check does not press it. It was pressed in
  headless Chromium at 1440 and 390 px: the clip plays with sound on, the
  label turns to Pause, and switching key pauses it; console clean.
- `build.mjs`'s block-CSS check splits selectors on every comma, so
  `:is(img, video)` is refused; two selectors work.
