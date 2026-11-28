# Attention-sound quality, round 1

The current ten attention sounds (production's `web/src/app/soundSynth.ts`,
imported as is) beside three candidate sets of the same sounds, rendered on
the page from `candidates.mjs`. The picker switches the candidate set;
every row has ▶ for the current and the candidate sound with their
waveforms, *Vertaa* (current, then candidate), and ▶ for the other two
sets. The decision material is in `issues/attention-sounds-quality/`
(`research.md`, `result.md`).

## Files

- `analyze.mjs`: the measurement tool behind `research.md`; renders and
  measures every sound of every set (loudness, true peak, attack, decay,
  spectrum, partials, stereo). `--json <file>`, `--set <id>`,
  `--wav <dir>` (outside the repository).
- `candidates.mjs`: the candidate renderer and recipes; its opening comment
  says what each set changes.
- `round.tsx`, `round.css`: the page, from production components
  (SoundEmblem, ControlButton, Icon, the sound texts, the volume curve).
- `build.mjs`, `check.mjs`: build and check.

## Build and check

From the repository root, after `npm ci --prefix web`:

```
node design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/check.mjs \
  design-system/prototypes/dist/2026-11-28-aanet-laatu-1/offline.html <out-dir> [--quick]
node design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/analyze.mjs
```

`check.mjs`'s opening comment lists what it proves.

## Reproducing in the product

The chosen set replaces the recipes in `soundSynth.ts` under the same ids.
The renderer stages the candidates need beyond production's are small: no
damping curve (decay per voice instead), four allpasses instead of early
taps, and a wider low-pass. The fingerprints in `soundSynth.test.ts` change
with it.
