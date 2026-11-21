# Attention sounds, round 2

Twenty-one new original sounds in four families behind the shared picker
(A Soittimet, B Luonto ja esineet, C Tunnelmat, D Habitat-tunnus), plus
round 1's Ovi for comparison in family D. The families, the recommendation
and the questions for Jari are in `issues/attention-sound/result-sounds-2.md`.
The rules for when a sound plays were settled in round 1 and are not repeated
on this page.

## Build and check

From the repository root, after `npm ci --prefix web`:

```
node design-system/prototypes/rounds/2026-11-21-attention-sounds-2/build.mjs
# → design-system/prototypes/dist/2026-11-21-attention-sounds-2.html (~210 kB)
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-21-attention-sounds-2/check.mjs \
  design-system/prototypes/dist/2026-11-21-attention-sounds-2.html [out-dir] [--quick]
node design-system/prototypes/rounds/2026-11-21-attention-sounds-2/render.mjs [--wav <dir>] [--update]
```

`render.mjs` renders every recipe in Node and fails when a sound is longer
than 1.2 s, misses the loudness target by more than 1 LU, peaks above
−3 dBFS, starts with a click, has a tail that is not silent, carries more
than −30 dB of its energy above 6 kHz, has no stereo width, or when its
16-bit PCM no longer matches `fingerprints.json`. `check.mjs` runs it first,
asserts that the round directory holds no audio, image or HTML file and no
file over 100 KB, and then drives headless Chromium at 1280 and 390 px in
all three themes: picker, family lines, recommendation and shortlist,
cards with waveforms and ids, and no overflow. Every sound is rendered
through the page's own buffer and gain chain in an `OfflineAudioContext`
(duration, loudness, peak at 100 % and 50 %, muted silence, onset). The
check also clicks Soita, Neljästi, Ovi ensin and Soita kaikki. Screenshots
go to `/var/tmp/agent-keep/attention-sounds-2/check`. `render.mjs --wav`
writes 48 kHz 16-bit stereo WAVs (about 230 KB each, so they stay outside
the repository). The current set is in
`/var/tmp/agent-keep/attention-sounds-2/wav`, with 64 kbit/s Opus encodings
of 7–17 KB each in `…/opus` for size comparison.

## How the sounds are made

`synth.mjs` holds the whole definition: the recipes (`SOUNDS`), the
renderer (`renderSound`), the loudness meter (`momentaryMax`) and the volume
curve (`volumeGain`). It uses no samples, system sounds or third-party
material. Everything is computed sample by sample from `Math.sin`,
`Math.exp`, `Math.cos` and `Math.pow`, plus a seeded PRNG (mulberry32) for
noise. The renderer always works at 48 kHz, and the page wraps the result
in a 48 kHz `AudioBuffer` that the browser resamples, so the samples match
the fingerprints on every device.

Voice kinds:

- **modal**: a struck object as a bank of damped sines. The ratios are
  physical or measured: a tuned marimba bar 1 : 3.99 : 9.9, a kalimba tine
  1 : 5.95 : 13.3, a free-free tube 1 : 2.756 : 5.404 : 8.933, glass
  1 : 2.32 : 4.25 : 6.63, a bowl 1 : 2.74 : 5.17, a hollow block 0.5 : 1 :
  2.2 : 3.6, and a small bell on its nominal (hum 0.5, prime 1, major tierce
  1.25, quint 1.5, nominal 2, …). Each partial has its own amplitude and
  decay, and higher partials die faster. Close pairs (1 : 1.006) beat
  slowly the way a real bowl or glass does. Options: a raised-cosine attack,
  `spread` (alternate partials panned apart), `tremolo` (the vibraphone's
  motor) and `glide` (a water drop or bubble rising in pitch as it rings).
  `strike` adds the mallet or finger: a 1–6 ms band-passed noise burst.
- **fm**: two-operator FM with a decaying index (bright attack, round
  tail). An optional `tine` modulator at 14 × f adds a 20 ms metallic
  onset, which gives the electric piano. With a low index it is a soft
  ping.
- **pluck**: Karplus–Strong. One period of seeded noise is combed at the
  pick position and low-passed twice (a finger, not a pick), then
  recirculated through a two-tap averaging loop with an allpass that tunes
  the fractional delay exactly. The loop gain is set from T60.
- **pad**: an additive chord. Every note has up to seven harmonics in two
  copies detuned by ± a few cents with random phases, panned across the
  stereo field. Upper harmonics follow the envelope with an exponent, so
  the sound brightens as it swells ("bloom"), the way a filter opening
  would.
- **noise**: band-passed noise with its centre swept exponentially (the
  breath of Henkäys), using decorrelated noise in the two channels.

The bus:

1. Optional **ping-pong echo** (Kaiku): two cross-fed delay lines with a
   low-pass in the loop, so each repeat answers from the other side and is
   darker than the last.
2. **Feedback delay network reverb**: eight lines of 30–62 ms with
   mutually prime lengths and a Householder feedback matrix. A one-pole
   low-pass in every loop makes the highs die first, and per-line gains
   come from the recipe's T60 (0.5–1.6 s). Two Schroeder allpasses diffuse
   the input. Even lines feed the left output and odd lines the right, so
   the room is what gives most of the stereo width. The mix is 18–45 %.
   No convolution or impulse response is involved.
3. **Tone**: a 90 Hz high-pass (laptop speakers cannot play lower, and
   rumble only wastes headroom) and a 4th-order Butterworth low-pass at
   6.5 kHz. The two plucked sounds add a further 4–4.5 kHz low-pass,
   because Karplus–Strong's attack is broadband.
4. **Fades**: a 2 ms raised-cosine fade-in and a 120–350 ms fade-out, so
   neither end clicks.
5. **Loudness**: the ITU-R BS.1770 K-weighted momentary loudness (400 ms
   window, 10 ms hop) at its maximum is brought to −17 LUFS, with a peak
   ceiling of −3 dBFS. A short notification is heard at its loudest
   moment, which is what the momentary maximum measures. Integrated
   loudness would make sparse sounds such as Puupala or Kuplat louder than
   the rest. All 22 sounds land on −17.0 LUFS-M, with peaks between −5 and
   −11 dBFS.

The person's volume maps to gain `(v/100)²` as in round 1, so the default
70 % is gain 0.49.

Rendering all 22 sounds takes about 0.7 s in Node. The page renders each
one the first time it is shown or played, which costs about 30 ms.

## Reproducing in the product

Round 1's two options still hold. The recommended one is to **ship the
renderer**: `synth.mjs` minus the recipes the product does not offer is
about 15 kB of code and needs no binary assets. A per-repository variant
of the Habitat motif is then a transposed recipe. The other option is to
**ship the files**: Opus at 64 kbit/s is 7–17 KB per sound. The
fingerprints are SHA-256 over interleaved 16-bit PCM. V8's transcendental
functions are platform-independent. Another JavaScript engine has not been
verified bit-exact, and 16-bit rounding absorbs almost all of the
difference.

## Host needs

None. Sounds, volume and choice stay browser-side and personal, as in
round 1.
