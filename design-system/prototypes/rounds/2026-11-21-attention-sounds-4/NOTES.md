# Attention sounds, round 5

This is the fifth sound round, in the fourth directory of the
`attention-sounds` series. Jari's verdict on round 4 asked for three things.
The nine kept sounds should become more natural and richer still. The five
candidates sounded "digital" and need redoing. Every sound should come in a
short and a long variant. The set stays at 14 sounds (at most 15), with
Kalimba as the default and the loudness unchanged. The list, the decisions
and the questions for Jari are in `issues/attention-sound/result-sounds-4.md`.

The picker has three views. A Hyväksytyt shows the nine kept sounds, and
B Uudelleen tehdyt the five redone ones. Each card has its round 4 waveform
above the short and the long one, on a shared 1.6 s scale. ▶ Lyhyt,
▶ Pitkä and ▶ Kierros 4 play one render each, and *Vertaa* plays round 4,
then short, then long. C Koko valikoima lists the whole set in Settings
order. The header's *Pituus* toggle picks the length that *Neljästi*, the
set rows and *Soita kaikki* play.

## Build and check

From the repository root, after `npm ci --prefix web`:

```
node design-system/prototypes/rounds/2026-11-21-attention-sounds-4/build.mjs
# → design-system/prototypes/dist/2026-11-21-attention-sounds-4.html (~233 kB)
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-21-attention-sounds-4/check.mjs \
  design-system/prototypes/dist/2026-11-21-attention-sounds-4.html [out-dir] [--quick]
node design-system/prototypes/rounds/2026-11-21-attention-sounds-4/render.mjs [--wav <dir>] [--update]
```

`render.mjs` renders 42 recipes: two lengths of each of the 14 sounds, plus
round 4's 14 versions. Each length must pass all of these:

- duration within its band: short 0.5–0.8 s, long 1.2–1.6 s
- momentary loudness within ±0.5 LU of −17 LUFS (round 4 allowed ±1)
- peak under −3 dBFS
- no click at the onset
- last 50 ms under −50 dBFS after the final fade and under −45 dBFS
  before it, which proves the sound decayed by itself and was not cut off
- under −30 dB of its energy above 6 kHz
- stereo width at least 0.03

Round 4's versions are checked only against their fingerprints. While round
4's directory is still in the tree, they are also compared with its own
`fingerprints.json`. They matched when this round was built, so *Kierros 4*
plays exactly what Jari heard.

`check.mjs` runs `render.mjs` first, then checks five things:

- The round directory holds no audio, image or HTML file and nothing over
  100 KB.
- In headless Chromium at 1280 and 390 px, in all three themes: the picker,
  three waveforms per card, the set with the default marked once, the ids,
  and no overflow.
- Every render goes through the page's own buffer and gain chain in an
  `OfflineAudioContext`: length band, loudness, peak at 100 % and 50 %, tail,
  muted silence and onset.
- Clicks on Lyhyt, Pitkä, Kierros 4, Vertaa, Neljästi and Soita kaikki, in
  both positions of the length toggle.
- The console stays clean.

Screenshots go to `/var/tmp/agent-keep/attention-sounds-4/check`. WAVs
(48 kHz, 16-bit stereo, named `<id>-short.wav`, `<id>-long.wav` and
`r4-<id>.wav`) go to `/var/tmp/agent-keep/attention-sounds-4/wav`, outside
the repository.

## What changed in the renderer

Round 4's `renderModal` and its stages are carried verbatim for the `r4-`
recipes. Every round 5 sound uses a new voice, `struck`, plus one new stage.
The opening comment of `synth.mjs` gives the physics. In short:

- **contact**: the spectrum of a half-sine contact force (−12 dB/octave above
  ~0.6/contact time) weights each mode. A felt or rubber mallet darkens the
  high modes, and a hard tap on glass or ice keeps them. This is the largest
  single cause of the "digital" impression in round 4: every mode sat at its
  table level whatever struck it.
- **thump**: the contact pulse itself, a soft knock that excites the body.
- **split**: every mode is two components a few cents apart, and one of them
  decays faster. This models a string's two polarisations, or the
  near-degenerate pairs of a bowl, bar or tine. The beating and the two-stage
  decay replace round 4's single explicit "beating partner" row.
- **jitter**: seeded random detuning of each mode by a few cents (8 for
  ice), so the spectrum is slightly inharmonic and repeated notes are not
  copies.
- **pitch / rise**: a string's pitch settles after the pluck, and a bubble
  rises in pitch through its short life near the surface.
- **box**: resonant band-pass filters that the whole dry sound passes
  through: a kalimba box, a guitar body, a harp soundboard, a drum shell.
  Round 4 added fixed sines at those frequencies instead. A filter rings with
  whatever excites it, strike noise and thump included.

**Short and long** are the same object. `decays` (0.45–0.55 in the short
length) scales every mode's decay time, which is what damping does.
Arpeggios are a little tighter, and the Gaussian damping and the room
shrink with it. So a short sound dies away by itself. It is not a long
sound cut off, which the raw-tail check enforces.

**Room.** A denser small room (six early reflections, 6–34 ms) is used for
the indoor sounds. A new outdoor room for Kivi lampeen adds a far slap from
the shore (87 and 131 ms). Reverb T60 is 0.75–0.95 s for long sounds and
0.35–0.5 s for short ones.

## Redone candidates

- **Sävelrumpu**: tuned modes 1 : 2 : 3.01 plus two weak untuned plate modes,
  a 2.5 ms rubber mallet, and shell resonances at 150, 330 and 620 Hz.
- **Harppu**: a string pulled into a triangle (partials ∝ sin(πhp)/h²) with
  two polarisations, fingertip contact, settling pitch and a soundboard.
  The register moved down to F4, C5, A5 for warmth.
- **Kitara**: a six-string E major down-strum, E3–E5 13 ms apart, nylon
  string plucked nearer the bridge with a soft thumb, body resonances at 100,
  205, 410 and 800 Hz.
- **Kivi lampeen**: a splash, then the low cavity bubble rising from 260 Hz
  and a smaller bubble as the cavity pinches off. Splash droplets fall back
  at seeded random times, four in the short length and seven in the long,
  followed by two rising bubbles, all outdoors.
- **Jääpuikot**: modes of a tapered rod with strong detuning, a 0.12 ms
  tap, and sympathetic ringing of the neighbouring icicles.

## Reproducing in the product

Round 2's recommendation still holds: ship the renderer without the recipes
the product does not offer, or ship 64 kbit/s Opus files of the chosen set
and lengths. The fingerprints are SHA-256 over interleaved 16-bit PCM.

## Host needs

None. The sounds, the volume and the choice stay in the browser and are
personal, as in earlier rounds.
