# Attention sounds, round 3

This round polishes the nine sounds Jari kept from round 2 and adds five new
candidates in the styles that worked. The picker has three views: A Ennen ja
jälkeen shows each polished sound as a pair with its round 2 version, B Uudet
ehdokkaat shows the new candidates, and C Koko valikoima shows the whole set
in the order Settings would list it, with Kalimba as the default. The list,
the decisions and the questions for Jari are in
`issues/attention-sound/result-sounds-3.md`.

## Build and check

From the repository root, after `npm ci --prefix web`:

```
node design-system/prototypes/rounds/2026-11-21-attention-sounds-3/build.mjs
# → design-system/prototypes/dist/2026-11-21-attention-sounds-3.html (~215 kB)
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-21-attention-sounds-3/check.mjs \
  design-system/prototypes/dist/2026-11-21-attention-sounds-3.html [out-dir] [--quick]
node design-system/prototypes/rounds/2026-11-21-attention-sounds-3/render.mjs [--wav <dir>] [--update]
```

`render.mjs` renders all 23 recipes: 14 offered sounds and 9 round 2
versions. For every offered sound it fails on any of these:

- longer than 1.6 s
- momentary loudness more than 1 LU off −17 LUFS
- peak above −3 dBFS
- a click at the onset
- **a last 50 ms peak above −50 dBFS**
- **a last 50 ms peak above −45 dBFS measured before the final fade**
- more than −30 dB of its energy above 6 kHz
- stereo width below 0.03

The fade check proves that a sound has died away by itself and that the fade
is not what silences it. The round 2 versions are checked only against their
fingerprints. When this round was built, all nine matched round 2's own
`fingerprints.json`, so the "before" side of each pair is exactly what Jari
heard.

`check.mjs` runs `render.mjs` first. It then asserts that the round directory
holds no audio, image or HTML file and no file over 100 KB. After that it
drives headless Chromium at 1280 and 390 px in all three themes and checks
the picker, the view lines, the pairs with both waveforms, the candidates,
the set with the default marked once, the ids and overflow. It also renders
every sound through the page's own buffer and gain chain in an
`OfflineAudioContext`, measuring duration, loudness, peak at 100 % and 50 %,
the last 50 ms, muted silence and the onset. Finally it clicks Uusi,
Kierros 2, Vertaa, Neljästi and Soita kaikki. Screenshots go to
`/var/tmp/agent-keep/attention-sounds-3/check`. WAVs (48 kHz, 16-bit stereo)
go to `/var/tmp/agent-keep/attention-sounds-3/wav` and stay outside the
repository.

## What changed in the renderer

`synth.mjs` is round 2's renderer with four additions, all opt-in so that the
round 2 recipes render unchanged. The fm, pluck, pad and noise voices and the
ping-pong echo were removed because no kept or new sound uses them; round 2's
directory or git history still has them.

- **Per-mode attack.** An optional fourth number in a mode row makes that
  partial swell in instead of starting with the strike. This is how a
  marimba or vibraphone resonator tube, or the body of a bowl, behaves.
- **`body`.** Fixed-frequency resonances in Hz, not ratios, that every strike
  excites, such as a kalimba's box (240 and 520 Hz) or a guitar body (205
  and 410 Hz).
- **`early`.** A few low-passed early reflections of 7–44 ms, fed from the
  same or the opposite side, with the right side's taps 9 % later. They
  place a dry strike in a small room and give it gentle stereo width before
  the diffuse reverb takes over.
- **`damp`.** A Gaussian damping of the dry sound, which is a parabola in
  dB. It does nothing until `from`, then speeds up and reaches −60 dB at
  `to`. A touched glass or bowl dies the same way. Round 2 ended with a
  raised-cosine fade over the last 0.25–0.35 s while the bowl and the
  reverb were still at −20…−30 dBFS. That fade falls off a cliff in dB,
  which is the "into a wall" ending.

Each polished recipe damps its dry sound early enough, and keeps its reverb
T60 short enough (0.75–1.0 s, down from up to 1.4 s), that the room has gone
quiet before the buffer ends. The final 100–120 ms fade only guards against
a stray sample. Before that fade, the last 50 ms of round 2's sounds sat at
−21…−29 dBFS (Pisara −57, Kuplat −81). In round 3 they are −58…−105 dBFS.

**Depth.** Each kept instrument or object has three additions:

- a slowly beating partner of the fundamental (ratio 1.001–1.003), spread to
  the other side
- where the object has one, a resonator that swells in
- a low partial an octave down, 25–33 dB below the strike

The K-weighted meter hardly counts the low partial, so loudness
normalisation leaves the strike where it was. All sounds still land on
−17.0 LUFS-M. Peaks rise by 1–2 dB, still at least 6 dB under the ceiling.
The person hears more weight at the same loudness.

## New candidates

- **Sävelrumpu.** Steel tongue drum, nearly harmonic modes (1 : 2 : 3.01)
  and a rubber mallet.
- **Harppu.** Plucked strings as modes: stiffened harmonics h·√(1 + B·h²),
  amplitude from the pluck point |sin(π·h·p)|/h^roll, and higher partials
  dying first. This replaces round 2's Karplus–Strong kantele, which Jari
  rejected, with a cleaner, rounder model.
- **Kitara.** The same string model plucked nearer the bridge and darker,
  with a body.
- **Kivi lampeen.** A large low Minnaert bubble with a rising pitch ("plump")
  and two small bubbles after it.
- **Jääpuikot.** Thin rods, crisper and shorter than Tuulikello.

## Reproducing in the product

Round 2's recommendation still holds. Ship the renderer without the recipes
the product does not offer, or ship 64 kbit/s Opus files. The fingerprints
are SHA-256 over interleaved 16-bit PCM.

## Host needs

None. The sounds, the volume and the choice stay in the browser and are
personal to each person, as in rounds 1–2.
