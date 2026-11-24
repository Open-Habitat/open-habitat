# alice-04-market-video

Alice · 09:02 · Market video. The view plays a real 30-second vertical clip.
Every frame in it is the block's own render; no third-party footage is used.

## What changed and why

- **24.11.: the footage is now our own renders.** Jari decided the page must
  not present anyone's real work as the fictional studio's, so the earlier
  stock footage (real block printers and a real market) is gone. `assets.mjs`
  renders the studio's work with Mitsuba 3 and cuts it with ffmpeg: the stall at
  dusk with the Example Studio sign, a carved block in a slow orbit, indigo
  rolled onto it with a brayer, the block pressed onto linen and lifted off a
  fresh print, the repeat growing print by print from above, six carved blocks
  (one per pattern), a stack of finished pieces, and the stall in the evening.
  The patterns and colours (indigo, rust, ochre, sage on oat linen; sprigs,
  suns, chevrons, dots) echo the products on Alice's order page
  (`alice-11-wholesale-order-page`), so the studio's prints look the same
  wherever they appear.
- The five captions, the story and the view are unchanged; caption timings
  follow the new cut (the SRT in the scene matches the file), the shot-picking
  line and the reply describe the new shots, the poster is the six carved
  blocks with their caption, and the footage credit is gone from the page.
- **The player** (from the previous pass): the clip sits in a phone-shaped
  frame with the poster and one play pill (“▶ 0:30”). Native controls are not
  drawn over the poster, because Chromium otherwise paints its bar and a
  loading spinner over the captions. The first click adds the controls and
  plays it, muted. Nothing loads before that click (`preload="none"`) and
  nothing autoplays, so reduced motion needs no special case. When the clip
  ends it goes back to the poster.

## Assets

`$ETUSIVU_ASSETS/alice-04-market-video/` (default
`~/src/open-habitat-dev/worker-results/etusivu-assets/alice-04-market-video/`):

| File | What | Size |
|---|---|---|
| `market-30s.mp4` | 30.0 s, 720×1280, 25 fps, H.264 High, two-pass ~480 kbit/s, no audio, faststart | 1.75 MB (1,794 KB) |
| `market-30s.webp` | poster, frame at 21.0 s, WebP q80 | 31 KB |

Made with `TMPDIR=<scratch> node blocks/alice-04-market-video/assets.mjs`:

- **Mitsuba 3.9.1** (pip, `llvm_ad_rgb` variant, in a venv the script makes
  under `$TMPDIR`) renders the scenes. Everything is built in the embedded
  Python: the blocks are heightfield meshes from the pattern rasters on a
  wooden body, the linen is a procedural weave with each print composited in
  where the block lands (uneven inking, grain), the stall is boxes, cylinders
  and planes with string lights as small emitters and a thin-lens camera for
  the out-of-focus market behind. The sign texture is drawn with ffmpeg
  `drawtext` in Instrument Sans. Four shots are animated (75–95 frames each at
  540×960, 112 spp, one seed per frame), four are stills (×1.4–1.5 size, 224–448
  spp) that get a slow push or pan. About 25 minutes on this host's 8 aarch64
  cores; `RENDERED=<dir>` reuses earlier renders, `SPP` sets the quality.
- **ffmpeg 6.1.1** (Ubuntu `6.1.1-3ubuntu5`: libx264, libass, libfreetype,
  libwebp) scales and lightly denoises the frame sequences (`hqdn3d`), moves
  over the stills (`zoompan` on a 4× upscale so it does not step), adds the
  title and end card with `drawtext`, burns in the five captions from the SRT
  with libass (`fontsdir` picks up the design system's `.woff2`), and encodes
  two-pass H.264 with `+faststart`. Card text is ASCII because drawtext in 6.1
  drops the last glyph after a multibyte character.

## Sources and licences

None. All footage is the block's own renders; the only outside inputs are the
design system's Instrument Sans (OFL, in `design-system/fonts/`) and the
open-source programs above.

## Assumptions about the product

- The scene says the agent installed a static ffmpeg 7.1 into `~/.local/bin`;
  the real cut used the host's ffmpeg 6.1.1. The commands shown work with
  either.
- In the story the clips are Alice's own phone footage from the market; on the
  page they are renders standing in for it. Nothing in the clip claims to be
  filmed.
- The duration “42 min 14 s” is kept from the port (08:20 → 09:02).

## Engine needs

- `kit.mjs` `video()` always renders `controls`. Before the first play,
  Chromium paints its control bar and a loading spinner over the poster,
  which hides burned-in captions. A `video(src, { …, posterFirst: true })`
  variant (no controls until the first click, a play pill on the poster)
  would let other video blocks use the same player. This block draws its
  own `<video class="mv-video">` and a play button, wired in `client.js`.
- Without JavaScript the play pill does nothing, so the clip can't be
  played. The engine has no "JS is running" flag a block selector could
  use, which is what showing native controls in the no-JS case would need.
- `check.mjs --only alice-04-market-video` reports six console failures
  (`ERR_FILE_NOT_FOUND`). They are the sidebar templates of other glimpses
  (`alice-02`, `alice-03`… images) that an `--only` build does not copy, not
  this block's files; everything else passes, and the clip, poster and budget
  are fine. A full-page build does not have them.

## For Jari

- The renders are clean and stylised, not photoreal: wood, linen and ink
  read clearly at phone size, and nothing in them pretends to be someone's
  real work. Known small flaws: the brayer starts its pass in the air beside
  the block, and the block's knob has a thin dark seam where it meets the
  handle.
