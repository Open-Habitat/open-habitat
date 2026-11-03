# Result — 2026-11-03

Spec changes only; no product code changed. Birch, base `4ac5e6a0`, 2 workers,
`OH_PORT_BASE=11550`, detector `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r56-reds`.

## Causes

- **title-regeneration `:74`, lab-title-generation `:8` (×4)**: motion specs
  that missed the opt-in after `d2132a6c` made `reducedMotion: "reduce"` the
  config default. The lab spec only switched to `no-preference` at the end of
  its first loop, so its first pass always saw no animation. Both now opt in
  (the ordinary case per test, the lab file with `test.use`); each still turns
  reduced motion on once to see the animation stop.
- **lab-conversation-scroll `:233`** (does not bounce): the same commit. The
  gate's four received lines were two jumps of 12 px (`-1004→-992`), not gaps.
  When a shrunken live tail's hold expires, `useReadingPosition` lets it go
  with a 240 ms glide, which `components.css` makes instant under reduced
  motion. `jumps()` skips gliding frames only, so the instant release counted
  as a bounce. Deterministic 2/2 on main; 2/2 pass with normal motion. The
  case now opts in for itself; the rest of the file stays reduced.
- **rail-running-after-done `:73`** (load-only; Send disabled after opening):
  a spec readiness gap. After the rail click, `toBeEnabled()` could match the
  field of the conversation still on screen; `fill` went into it and the swap
  to the returned conversation brought an empty field. A probe saw the left
  field still connected and enabled right after the click in 4/4 runs, and
  with that extra round trip the unfixed case failed 3/8 with the gate's error.
  The spec marks the field it leaves and waits until it is gone. After: 8/8,
  and 6/6 with the same widened window.
- **lab-composer-area `:349`** (attachment picker, load-only): the known
  `singularly-rough-flag` (no `filechooser` event although the page clicks the
  input). 2/20 here under the detector, same hang. Left to that issue.

## Evidence (failures / runs)

| Case | Before | After, D250 ×2 |
| --- | --- | --- |
| title-regeneration `:74` | 1/1 (D0) | 0/2 |
| lab-title-generation `:8` ×4 | 4/4 (D0) | 0/8 |
| lab-conversation-scroll `:233` | 2/2 (D0) | 0/2 |
| rail-running-after-done `:17` | 0/8 CPU4 D250; 3/8 widened | 0/2, 0/8, 0/6 widened |
| lab-composer-area `:349` ×4 | — | 2/20 (filed) |

Whole touched specs under D250 ×2: title-regeneration and rail-running 8/8,
lab-title-generation and lab-conversation-scroll 19/20. The one failure is
`:201` (below). `test-focused.sh --area web` and `--area browser --spec` for
each of the four specs passed.

## Found on the way

- lab-conversation-scroll `:201` (first turn followed before history is read)
  fails under D250: 4/6 on main, 3/6 with web/src at `f30e49ab^`, 3/6 with
  normal motion, 0/4 without jitter. Neither suspect commit. Filed as
  `positively-flawless-horse`.

## Decisions for later review

- **The bounce case tests normal motion rather than accepting the
  reduced-motion release step.** Alternative: record the hold height per frame
  and treat a frame whose hold dropped as a release under both settings. Not
  done: that oracle would also excuse a hold dropping too early, the very
  bounce the hold exists to prevent. Under reduced motion the release is one
  12 px step down at the end of a turn by the CSS's explicit choice; whether
  that reads as a jump to a person is in KOKEILTAVAA.
- **rail-running waits for the left field to go, not for the URL.** The URL
  changes before React commits the new view, and the DOM carries no
  conversation id to wait for. Typing into the view still on screen is right
  for a person, so this is not a product fix.

Focused self-review (spec-only change).
