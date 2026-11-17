# Huomioäänet – kierros 1 (issue `attention-sound`)

This round's view is the sounds themselves and when they play. The page
shows twelve original sounds in three families behind the shared picker
(A Kellot, B Puu ja lasi, C Habitat). Beside them is a simulated rail
whose events show the recommended rules. The families, the
recommendation and the questions for Jari are in
`issues/attention-sound/result-sounds.md`.

## Build and check

From the repository root, after `npm ci --prefix web`:

```
node design-system/prototypes/rounds/2026-11-17-attention-sounds/build.mjs
# → design-system/prototypes/dist/2026-11-17-attention-sounds.html (~200 kB)
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-17-attention-sounds/check.mjs \
  design-system/prototypes/dist/2026-11-17-attention-sounds.html [out-dir] [--quick]
node design-system/prototypes/rounds/2026-11-17-attention-sounds/render.mjs [--wav <dir>] [--update]
```

`check.mjs` runs `render.mjs` first and then drives headless Chromium.
At 1280 and 390 px, in all three themes, it checks the picker, the
family lines, the cards and their waveforms, and that nothing overflows.
It renders every sound through the page's own buffer and gain chain in an
`OfflineAudioContext` and asserts duration under 1 s and peak at 100 %,
50 % and muted. It confirms that a click unlocks audio and starts real
playback. It also walks every rail scenario, and the console must stay
clean. Screenshots go to `/var/tmp/agent-keep/attention-sounds/check`, and
none are committed. `render.mjs --wav` writes 48 kHz 16-bit mono WAVs,
each 38–91 KB. The current set is in `/var/tmp/agent-keep/attention-sounds/wav`.

The page is plain JavaScript and uses no bundler or production components.
The sound is the subject here. The rail is a small sketch with production's
section names, and its rules map onto `railNow`'s transitions (see result).

## How the sounds are made

`synth.mjs` holds the whole definition: the recipes (`SOUNDS`), the
renderer (`renderSound`) and the volume curve (`volumeGain`). No
samples, system sounds or third-party material are involved. Each
sound is a list of voices rendered sample by sample with `Math.sin`,
`Math.exp` and a seeded PRNG (mulberry32) for the stick noise of struck
sounds:

- `modes`: a struck or rung object, made of damped sines at given frequency
  ratios. Each sine has its own amplitude and decay. Optional parts are a
  pitch glide (Pisara) and a short low-passed noise burst (wood and glass
  taps).
- `fm`: a two-operator FM mallet with carrier = modulator. Its index starts
  at 1.4 and decays in about 90 ms, giving a bright attack and a round
  tail. Family C uses only this timbre, so its motifs differ only in notes.

The mix gets a raised-cosine release over its last 30 %, so a ring cut to
stay under one second ends damped, not truncated. It is then
peak-normalised to 0.5 × `level` (−6 dBFS at most). The person's volume
maps to gain `(v/100)²`, so the default of 70 % gives gain 0.49.

The product can reproduce the sounds in either of two ways:

1. **Ship the renderer** (recommended). `synth.mjs` is about 5 kB of code
   with no dependencies. The browser renders a sound into an `AudioBuffer`
   at the context's own sample rate the first time it plays. Nothing
   binary goes into the repository, and a per-repository variant (round
   3) is just a transposed recipe.
2. **Ship the files.** `render.mjs --wav` writes the WAVs.
   `fingerprints.json` holds the SHA-256 of each sound's 16-bit PCM at
   48 kHz, and `render.mjs` fails if a recipe or the renderer changes the
   samples. Encoding to Opus would bring each file to a few KB.

The fingerprints are stable for one renderer and JavaScript engine. V8's
`Math.sin`/`Math.exp` come from fdlibm and do not depend on the platform.
Another engine may differ in the last bit, which 16-bit rounding nearly
always absorbs, but that has not been verified.

## Host needs

None. Sounds, volume, mute and the choice of sound are browser-side, and
the choice is a personal setting (the parallel Settings round). The rail
already knows when a conversation enters Sinun vuorosi (`railNow`), which
is where a product implementation would detect the edge. "Only one tab
plays" needs cross-tab coordination in the browser, such as a
`BroadcastChannel` or a Web Lock, not the host.
