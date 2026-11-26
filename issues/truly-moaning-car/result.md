# Result

## 1. Attention sound and dictation's AudioContext: a spec assumption, not a product defect

The page has two contexts, and that is intended. The attention sound's context is made and resumed by a press (`unlockAudio`/`playSound`), stays running, and plays the reply's sound at the device volume. In the failing run, `plays` already showed `["kalimba", "kulho"]` (only `kalimba` at night), so the sound played and night quiet held. Dictation's `AudioInput` is warmed ahead of a press and suspended at once, so it does not hold the audio device. That `"suspended"` entry is the one the spec saw. Neither context waits on the other, and autoplay policy cannot block the sound, because its context is unlocked by the preview press.

The two are kept apart on purpose. Sharing one context would put dictation's `rest()` (suspend while nobody dictates) and the sound's need for a running context in conflict: a rest would cut off a playing sound, or the sound would keep dictation's device busy. It would also put the attention sound on the path of dictation's fast start for no gain. `dictation.ts` is unchanged, so round 2's timings stand. speech-input and dictation-bar were rerun (see below).

The spec now recognises the sound's context as the one that plays buffers (`createBufferSource`). It asserts that this is exactly one context, running and never remade across the conversation switch. It also asserts a new property: no other context runs while nobody dictates.

## 2. gofmt

`gofmt -w internal/gateway/views_linux_test.go`; `gofmt -l internal cmd` is empty.

## 3. Intermittent specs

- `loading-landing.spec.ts:249`, "Cannot fast-forward to the past". An installed Playwright clock follows real time in the page, so `pauseAt(new Date())` read in the test process can already be past when the page handles it. All four pauses now go through `pauseClock`, which pauses at the page's own `Date.now() + 1000`, the pattern context-ring already used. Every caller navigates next.
- `browser-terminal.spec.ts:175`. On the second pass (`tmux set mouse off`), the wait for the `80` row was already satisfied by the first pass's output, so the drags could start before tmux dropped mouse mode. tmux then took the drag and no xterm.js selection or Copy appeared. Adding `sleep 1;` before the command made it fail every time. Each pass now waits for its own marker (`ready-on-2`/`ready-off-2`), and with the injected sleep it passes. The wheel part's `clear; seq 1 300` waited for a `300` that an earlier command had left on screen; it now waits for `wheel-3`.

## Checks (umask 077)

- attention-sound.spec.ts, whole file, `--repeat-each 5`: 50/50
- loading-landing.spec.ts `--repeat-each 5`: 55/55
- browser-terminal.spec.ts `--repeat-each 5`, outside tmux: 30/30; `:175` with the sleep injected: 2/2
- speech-input.spec.ts + dictation-bar.spec.ts `--repeat-each 3 --workers 4`: speech-input green every run. dictation-bar's layout tests `:135`/`:218` failed in 2 of 4 runs. This change touches neither product code nor that spec, so the flake was there before it; filed as intake `immoderately-obsequious-bomb`.
- `scripts/test-focused.sh --area web`: passed; `--area go --go-package ./internal/gateway`: ok.
