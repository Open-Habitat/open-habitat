# Dictation starts quickly and keeps the first word: implemented

## Cause

The engine was already capturing at the press and buffering audio until the
Soniox stream opened. The first word was lost before that point, while the
microphone was still opening:

- The bar and the pill said "kuuntelee · yhdistää…" (listening · connecting)
  from the press, before `getUserMedia` had returned and before any audio was
  captured. A person who started talking at once was talking to a microphone
  that was not capturing yet.
- After the microphone was granted, the start still built a new AudioContext,
  resumed it and loaded the PCM worklet module, one step after another, before
  the first frame. The press had also already made a second AudioContext just
  for cues.

The key mint (gateway → daemon → Soniox temporary key), the WebSocket and the
service's first reply already ran in parallel, and their audio was buffered, so
they delay the text but do not lose words.

## Measured

Headless Chromium with a fake microphone (a throwaway script, not committed):
getUserMedia ≈ 1–13 ms, new AudioContext ≈ 0–1 ms, resume ≈ 0 ms, worklet
`addModule` ≈ 2 ms, first frame ≈ 1 ms. A fake device cannot show the slow step.
On real hardware the slow steps are the microphone start (on macOS, and with
Bluetooth headsets the switch to the headset's call profile) and opening an
audio device for each new AudioContext. Neither shows up headless. To make the
real-device delay readable, the start now writes `performance.measure` entries
from the press: `dictation: microphone`, `dictation: listening`,
`dictation: key`, `dictation: stream`, `dictation: first reply`. They appear in
DevTools' Performance panel.

## Change

- Listening is shown only once audio is being captured (phase `live`, whether
  or not the stream is up yet). While the microphone opens, the bar says
  "avataan mikrofonia…" and the pill "avataan…" in the busy style.
  `data-listening` on both carries the state.
- `AudioInput` (web/src/app/dictation.ts) owns one AudioContext per composer,
  used for both capture and cues. The engine readies it (context plus worklet
  module) at the press, in parallel with the microphone prompt. The hook also
  readies it ahead of the press, when the field box gets focus or a pointer
  goes over it. A context made ahead of the press is kept suspended until the
  press resumes it, and it never touches the microphone. A failed module load
  is retried at the next capture.

## Verification

Under `umask 077`:

- `./scripts/test-focused.sh --area web`: 266 files / 2,252 tests passed. New
  or changed tests, failing first: the engine readies the audio graph before
  the microphone answers; the bar and pill show listening only in `live`;
  `AudioInput` makes one context ahead of the press, keeps it quiet, reuses it
  and its module across dictations, closes it when the composer leaves, and
  retries a failed load.
- The existing unit tests "asks for the key … listens before the stream is
  ready" and "a stop before the stream opens still sends what was said" and
  the browser case "the microphone listens from the press: what is said while
  a slow key and stream open reaches Soniox, even after Valmis" (2 s mint
  delay) cover buffered audio reaching the service after a delayed connect.
- Browser: `speech-input.spec.ts` 14/14, plus `--repeat-each 3` 42/42;
  `dictation-bar.spec.ts` 5/5, plus `--repeat-each 3` 15/15. One 390 px layout
  run failed once in the first focused run and passed in every rerun.
  `account-sound-reasons.spec.ts` 4/4.
- UI references regenerated; `scripts/test-ui-reference.py` and the daemon's
  ui-skill Go tests pass.

## Live check

On a real Mac with the built-in microphone and with Bluetooth headphones: press
Sanele and start talking as soon as the bar says "kuuntelee". The first word is
in the text. If the start still feels slow, record it in the Performance panel
and read the `dictation:` timings to see which step it is.

## Decisions for later review

- No token is minted ahead of the press. A temporary key is single-use, lives
  a minute and counts against the per-minute mint limit, and focus events are
  frequent. Buffered audio already hides the mint's latency.
- The microphone is not opened ahead of the press. It would turn on the
  browser's and the OS's recording indicator without the person asking.
- After its first dictation, the shared context stays running until the
  composer leaves. The old cue context did the same, and a cue for a dropped
  stream can play right at the end.
