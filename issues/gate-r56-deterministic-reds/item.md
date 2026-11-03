---
created: 2026-11-03
updated: 2026-11-03
type: bug
reporter: claude
status: fixed
priority: high
lane: gate-reds
lane_seq: 1
preparation: ready
closed: 2026-11-03
---

# Integrated main: title animation and scroll specs fail every run

## Description

Clean gate on integrated main (3.11., after race-spec-signals and the
race-input-before-ready harvest) failed 2/539 ordinary and 7/164 lab cases.
Rerun alone on main, three fail every time:

- `title-regeneration.spec.ts:74` and `lab-title-generation.spec.ts:8` (×4):
  `arrow.getAnimations().length` is 0. Likely the new default
  `reducedMotion: "reduce"` in both Playwright configs (race-spec-signals,
  `d2132a6c`): these are motion specs that should have opted back in.
- `lab-conversation-scroll.spec.ts:233` (a followed conversation does not
  bounce): `frames.filter(gap > 2)` is not empty (4 gaps). Possibly the
  one-view change (`f30e49ab`) or reduced motion.

Load-only in the gate, pass alone: `rail-running-after-done.spec.ts:17`
(Send disabled after opening; group 2 shape) and `lab-composer-area.spec.ts:349`
×2 (attachment picker). Logs: Birch `~/.local/state/oh-conductor/gate-r56/`.

## Acceptance Criteria

- [x] The deterministic three pass; the cause of each named; a real product regression is fixed in the product, a spec gap in the spec.
- [x] The two load-only cases checked with the seeded reply delay (`OH_REPLY_DELAY_MS=250`, `--repeat-each 2`); fixed or filed with their mechanism.
