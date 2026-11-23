# alice-04-market-video

Alice · 09:02 · Market video. The view now plays a real 30-second clip that
ffmpeg cut, captioned and encoded; the stand-in player and its `client.js`
animation are gone.

## What changed and why

- **The showpiece is real.** `assets.mjs` makes `market-30s.mp4` the way the
  agent in the scene does: shots picked with ffmpeg's `scdet`, cropped to a
  vertical 9:16 frame (720 × 1280, the format a phone post wants), a title card
  (“Example Studio · Printed by hand.”) and an end card (“Come and say hello
  every Saturday · example.org/shop”) drawn with `drawtext` in Instrument Sans,
  five captions from an SRT burned in with libass, and a two-pass H.264 encode
  with `+faststart` and no audio. The poster is a frame of that file (the block
  going down on the cloth, its caption visible).
- **The player.** The clip sits in a phone-shaped frame with the poster and one
  play pill (“▶ 0:30”) on it. Native controls are not drawn over the poster,
  because Chromium otherwise paints its bar and a loading spinner over the
  captions. The first click adds the controls and plays it, muted. Nothing
  loads before that click (`preload="none"`) and nothing ever autoplays,
  so reduced motion needs no special case. When the clip ends it goes back
  to the poster. Beside the clip: the facts (0:30, 9:16, 5 captions, 1.7 MB),
  the five captions as text, and the footage credit. At phone width the
  captions list is hidden and the clip sits centred above the facts.
- **The story.** The ask now says what the video is for (“the shop page and our
  phone posts”). `did` tells what she gets (a title, the printing up close,
  captions you can read with the sound off) and ends on “posts it herself”:
  nothing is published by the agent. The reply says so too. The work, opened
  with Show work, now has two short thoughts (why vertical, why burned-in
  captions; the order of the cut) and seven tools: copy from the laptop,
  `ffmpeg` missing, installed into `~/.local/bin`, shot detection, the
  complete `captions.srt`, the cut and encode, and the poster. The timings in
  that SRT and the encode's numbers (30.0 s, 720×1280, 25 fps, 1.7 MB) match
  the real file. The market date moved from 14 Nov to Saturday 21 Nov 2026,
  the Saturday before the page's date.
- Captions in the clip avoid claims the footage can't back: no “linen”, no “our
  studio”. They describe what is on screen: printed by hand, one block and one
  colour at a time, a carved block for every pattern, new prints for winter.

## Assets

`$ETUSIVU_ASSETS/alice-04-market-video/` (default
`~/src/open-habitat-dev/worker-results/etusivu-assets/alice-04-market-video/`):

| File | What | Size |
|---|---|---|
| `market-30s.mp4` | 30.0 s, 720×1280, 25 fps, H.264 High, ~470 kbit/s, no audio, faststart | 1.75 MB |
| `market-30s.webp` | poster, frame at 7.6 s, WebP q80 | 44 KB |

Made with `TMPDIR=<scratch> node blocks/alice-04-market-video/assets.mjs`
using Ubuntu's `ffmpeg 6.1.1-3ubuntu5` (libx264, libass, libfreetype,
libwebp). The script downloads the two source files into
`$TMPDIR/alice-04-market-video-work/` (cached), then cuts, cards, captions,
encodes and takes the poster. The cut list, crops and captions are at the
top of the script. Two ffmpeg quirks are handled in it: drawtext in 6.1
drops the last glyph after a multibyte character (so card text is ASCII),
and libass picks up the design system's `.woff2` through `fontsdir`.

## Sources and licenses

Both are CC BY 3.0 (<https://creativecommons.org/licenses/by/3.0/>), which
allows reuse and modification with attribution. The credit is on the page
under the clip and here. Changes made: excerpted, cropped to 9:16, scaled,
colour-graded, captioned, combined with title and end cards; audio removed.

- **“Blockprinting in Bagru - India”** by Incredible India (originally on
  Vimeo, vimeo.com/311824682), via Wikimedia Commons:
  <https://commons.wikimedia.org/wiki/File:Blockprinting_in_Bagru_-_India.webm>.
  Shots used (source seconds): 14.75, 25.25, 36.45, 48.6, 58.15, 62.4, 64.45,
  69.8, 71.4, 93.95.
- **“Tampere Christmas Market”** by Sounds of Changes / Työväenmuseo Werstas
  (video recorder Kalle Pajula, sound recorder Henri Pyöriä, photographer
  Leena Ahonen), via Wikimedia Commons:
  <https://commons.wikimedia.org/wiki/File:Tampere_Christmas_Market.webm>.
  Shots used: 20.6 (stalls in the snow), 78.65 (evening lights).

Choices made to keep the fictional frame: the printing shots are hands,
blocks and cloth only, and faces are cropped out (the indigo shot is
cropped right to remove the carrier's face). Bagru's on-screen titles and
names are not used. No shop signs or landmarks appear: a night shot
showing a real vendor's sign was replaced by a close-up of the lights.
Passers-by at the market are seen walking, as in any stock market shot.

## For Jari

- The footage is real stock, not Example Studio. The printers are artisans
  in Bagru, India, and the market is in Tampere. Faces are out, and the
  captions never say “our studio” or name a place. Still, the clip shows
  real people's hands as Alice's studio work. If that is not acceptable,
  the fallback is generated footage (a Blender print-table scene), which
  takes more time and looks less real.
- The scene says the agent installed a static ffmpeg 7.1; the real render used
  the host's ffmpeg 6.1.1. The commands shown work with either.
- The duration “42 min 14 s” is kept from the port (08:20 → 09:02).

## Engine needs

- `kit.mjs` `video()` always renders `controls`. Before the first play,
  Chromium paints its control bar and a loading spinner over the poster,
  which hides burned-in captions. A `video(src, { …, poster-first: true })`
  variant (no controls until the first click, a play pill on the poster)
  would let other video blocks use the same player. This block draws its
  own `<video class="mv-video">` and a play button, wired in `client.js`.
- Without JavaScript the play pill does nothing, so the clip can't be
  played. The engine has no "JS is running" flag a block selector could
  use, which is what showing native controls in the no-JS case would need.
