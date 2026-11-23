# caps-video-sound

Capabilities: Video and sound. Both showpieces are now real files made by the
program the row names. The reader can play the film, and can play the song as
released, then without the voice, then the voice alone.

## What changed and why

- **Slideshow (row 22, FFmpeg).** The round-6 mock was a time-lapse of a
  façade renovation: six grey boxes with scaffolding icons. No free daily photo
  series of one façade exists, so the scene is now the other half of the
  row's title, a slideshow. Mallory (Birchwood Housing Company) asks for a
  short film for the annual meeting made from the photos residents sent of the
  street through the year. The view plays a real 27-second FFmpeg film made
  from ten CC0 street photos: a slow zoom or pan on each, cross-fades, the
  month in the corner in the design system's Instrument Sans, and a title over
  the first photo. The work shows exiftool sorting by date, the agent picking
  ten photos (leaving out close-up faces, so nobody has to be asked), the
  ffmpeg filter graph as it really is (zoompan, drawtext, xfade), and a list
  of the chosen ten.
- **Stems (row 24, Demucs).** The ask used to be "the concert recording has my
  voice on it". A real CC BY song cannot be passed off as Sara's own voice, so
  the ask now says what a teacher would really ask for: the pupils want to sing
  this song at the spring concert, and she wants it without the singing plus the
  voice alone for practising. The song's credit is in the view and in the
  reply. Its CC BY licence also gives the reply something honest to say: the
  concert programme should name the artists. The view has three playable
  14-second clips (original, backing, vocal), all cut from the same seconds.
  Each has its real waveform, which fills in as the clip plays, and only one
  plays at a time (`client.js`). The vocal's waveform shows the gaps where the
  voice rests. The Demucs output in the work is the program's real output from
  this run (3 min 21 s on an 8-core arm64 CPU for the 5 min 06 s song), only shortened.
- The group line now leads with the two showpieces ("Photos become a film, a
  song comes apart, …"). The other rows are unchanged.
- The offered `street-year.mp4` says 1080p / 18 MB, which is what a meeting
  copy would be. The page plays a 960 × 540 web copy so it stays within the
  2 MB budget.

## Assets (`$ETUSIVU_ASSETS/caps-video-sound/`, 2.5 MB in all)

`node blocks/caps-video-sound/assets.mjs` makes everything (set `TMPDIR`; work
dir `$CAPS_VIDEO_SOUND_WORK`, default `$TMPDIR/caps-video-sound-work`; about
1.5 GB, network on the first run).

| File | Made by | Size |
|---|---|---|
| `street-year.mp4` | FFmpeg 6.1.1 (Ubuntu): `zoompan` on each still (scaled to 2× first so the motion is smooth), `drawtext` with Instrument Sans (woff2 → TTF with fontTools 4.55.3), `xfade` 0.8 s, fade out; libx264 two-pass 520 kb/s, 960 × 540, 30 fps, faststart, no audio | 1.79 MB |
| `street-year.webp` | FFmpeg, the July frame (red bicycle) as the poster | 119 KB |
| `song-mix.mp4`, `song-backing.mp4`, `song-vocal.mp4` | Demucs 4.0.1 (`htdemucs`, torch 2.5.1 CPU, `--two-stems=vocals -d cpu`) on the whole song; the 14 s where the vocal stem has the most energy (193–207 s) are cut from the original and both stems; AAC 112 kb/s in MP4 with no video track | ~200 KB each |
| `wave-mix.svg`, `wave-backing.svg`, `wave-vocal.svg` | `assets.mjs` from each clip's own samples (ffmpeg → f32le, 112 peak bars, all on the original's scale) | 6 KB each |

The torch model weights go to `$CAPS_VIDEO_SOUND_WORK/torch` (`TORCH_HOME`),
not `~/.cache`.

## Sources and licences

**Song:** “The Delicacy Of Gratitude” by Radioontheshelf, vocals from “Words
of Gratitude Vocals” by SackJo22. ccMixter,
https://ccmixter.org/files/Radioontheshelf/68570 (vocal source
https://ccmixter.org/files/SackJo22/40015), both **CC BY 3.0**
(https://creativecommons.org/licenses/by/3.0/). Changes: separated into stems
with Demucs, 14 s excerpts cut, re-encoded. The credit is shown in the view.
(ccMixter returns 403 to a download without a referer; `assets.mjs` sends the
song page as the referer.)

**Photos:** ten photographs by Fons Heijnsbroek on Wikimedia Commons, each
marked **CC0 1.0** (public domain dedication). The full file titles are in
`assets.mjs` (`SHOTS`) and can be found at
`https://commons.wikimedia.org/wiki/File:<title>`. In film order:
snow evening by a canal; Bellamyplein urban nature; Kadijken facade garden in
spring; pot garden on Plantage Kerklaan; sunlight on leaves along
Sarphatistraat; back-gardens between Hoogte and Laagte Kadijk; hollyhocks on
Hoogte Kadijk; red bicycle with hollyhocks; facade garden with butterfly bush
and fig; playground square with plane trees in autumn (Herenmarkt). The film's
captions name months only, no places. Two candidates were dropped: a CC BY-SA
photo, and an ivy wall with a car in front of it.

**Font in the film:** Instrument Sans from `design-system/fonts/` (OFL).

## Assumptions about the product

- The agent installs Demucs with `uv tool install` and runs it on the CPU. That
  is what a well-set-up account can do and is not shipped by Open Habitat.
- An audio file shown in a view: the product's view has no audio player of its
  own, so the three-row player is this block's own markup, styled with the
  tokens.

## Engine needs

- **Audio as an asset kind.** `check.mjs` allows no audio format, so the clips
  are AAC in `.mp4` (audio only). That works in every browser, but `.m4a`
  (or `.opus`) with a small audio budget (for example 300 KB per clip) would
  say what the file is. The kit could also have an `audio()` helper.
- **check.mjs does not press this block's play buttons** (`[data-vs-play]`).
  Its button list is fixed (`[data-set]`, `.ah-offer-b`, `.vid-play`…). I
  tested them separately with Playwright at 1440 (sticky screen) and 390:
  playing, the countdown, one clip at a time, clean console. A generic hook,
  such as pressing every `button` inside `.scr-view`, would cover blocks like
  this one.
- A CSS `mask-image` with an asset URL is refused under `file://` (CORS), so
  the waveforms are `<img>` with the token colours written into the SVG. If
  the page is ever served over http, masks would let them follow a theme.
