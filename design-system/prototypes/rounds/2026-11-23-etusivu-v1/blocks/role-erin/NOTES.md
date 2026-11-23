# role-erin

Erin, teacher of Example Studio's printing courses. The three glimpses the
page shows: a real Manim animation of block printing, a small interactive ink
overlap page, and the January sign-ups turned into welcome drafts.

## What changed and why

- **Animation (09:10), the showpiece.** The hand-drawn three-frame strip is
  replaced by a real video rendered with Manim: `block-print.mp4`, 19.8 s,
  1280×720, 0.8 MB, no audio. It covers five steps, each with a one-line
  caption and a step row along the bottom. (1) The drawing turns over onto the
  block, so the carving is its mirror image. (2) A roller inks the raised wood.
  (3) The block goes face down onto linen and the print reads the right way
  round. (4) Eight repeats along the register marks. (5) A rust block lines up
  on the same marks, and where rust lands on indigo the overlap goes slate:
  "Where two inks overlap, a third colour appears." The motif is a sprig that
  leans right, with the berries low on the left. It is lopsided on purpose, so
  the mirror image is obvious. The colours are the studio inks already used in
  this block (indigo, rust), on linen, with Erin's brown for the wood, and the
  captions are in the page's Instrument Sans. The ask now matches the video
  (how a block print is made, from carving to second colour). The Show work
  rows are the real script, the real `manim render` command and output, and
  the ffmpeg step to the shipped size. The download offer was dropped because
  the video is already open in the view and the card pushed the video below
  the sticky screen's fold.
- **Ink overlap page (11:50).** The three static swatch sums are replaced by a
  small course page. Pick a first and a second ink (indigo, rust, weld
  yellow), switch the ink between Thin and Full, and drag the second print
  across the first (or use the Overlap slider). The overlap is the browser's
  `mix-blend-mode: multiply` over the linen at the chosen ink strength, which
  is how transparent inks overprint: the cloth shows through both. The result
  line gives the overlap colour and a name ("Indigo, then rust make a warm
  slate"). The swatch is computed with the same formula, server-side in
  `block.js` and live in `client.js`. **Consent:** round 6 published the page
  in the same turn as the request. The screen now ends at the preview ("Say
  yes and it goes up at courses.example.org/ink-overlap"), and the sidebar
  shows the publish afterwards (11:56 run "Publishing", 11:57 quiet "Live at
  …"). Nothing goes out before her yes.
- **January sign-ups (13:30).** Content unchanged. The reply now shows two of
  the welcome drafts, so the reader sees the welcome messages the ask is
  about. The participants are invented names.
- Not shown on the page (sidebar only): autumn feedback and the terms cards,
  unchanged.

## Assets (`$ETUSIVU_ASSETS/role-erin/`)

| File | Made by | Size |
|---|---|---|
| `block-print.mp4` | Manim Community v0.22.1 (cairo renderer) from `block_print.py`, then ffmpeg (libx264, CRF 24, `+faststart`, `-an`) | ~0.8 MB |
| `block-print.webp` | ffmpeg, last frame of the render (the finished two-colour cloth), as the poster | ~40 KB |

`assets.mjs` reproduces both. It converts the page's
`design-system/fonts/instrument-sans-latin.woff2` to TTF with fontTools in
scratch, runs `python -m manim render -r 1280,720 --fps 30 block_print.py
BlockPrint`, and encodes. `block_print.py` is committed beside it.

**How Manim was installed (no root).** `uv tool install manim` / pip fails on
this aarch64 host: `glcontext` needs X11 headers, and `manimpango` has no
aarch64 wheel. conda-forge has prebuilt cairo, pango and manimpango, so:

```
S=/var/tmp/agent-scratch/<task>
micromamba create -p $S/menv -c conda-forge python=3.12 manim fonttools brotli-python
BLOCK_PRINT_PY=$S/menv/bin/python TMPDIR=$S node blocks/role-erin/assets.mjs
```

The render takes about 6 s.

## Sources and licences

No third-party media. The animation, motif and page are drawn in code here.
Manim Community is MIT-licensed. Instrument Sans (SIL OFL 1.1,
`design-system/fonts/instrument-sans-OFL.txt`) is used to set the captions,
which end up as pixels in the video. The font file is not redistributed.

## Product assumptions

- Erin's account has Manim, ffmpeg and a `publish` route to the studio's
  course site (`courses.example.org`), installed or configured beforehand.
  None of this ships with Open Habitat, which the content rules allow.
- `studio/inks.md` (the studio's ink list) is an invented file in her
  workspace.

## For Jari

- In the check's headless Chromium, the video poster shows a loading ring
  under the native controls once the checker interacts with it. That is
  either Playwright's Chromium (no proprietary H.264 decoder) or the click.
  The poster itself is right. Worth one look in a real browser.
- The ink page's Full strength (0.85) makes indigo plus rust quite dark,
  which is true to real overprinting. Thin (0.55) shows the softer mix.

## Engine needs

None blocking. If the engine ever lets a view grow taller than the sticky
screen, the animation glimpse could show the download offer again.
