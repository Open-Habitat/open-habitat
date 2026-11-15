---
created: 2026-11-15
updated: 2026-11-15
type: bug
status: untriaged
priority: normal
provenance: test-run
source_ref: taskfleet:01m7g8zpt0wa8f1n7j13ettb0s/test-failure:queue-readiness
originating_run: 01m7g8zpt0wa8f1n7j13ettb0s
originating_run_kind: spinoff
---

# Queue browser case intermittently submits before readiness

## Description

# Queue browser case intermittently presses Alt+Enter before send readiness

## Observed failure

`web/tests/browser-conversation.spec.ts`, case `steer, follow-up and clear return only removed texts`, intermittently fails at the assertion after its first Alt+Enter: the editor retains `jonoon yksi` instead of becoming empty. This occurred in the first-message-flicker worker and reproduced against the main browser bundle at `76080d473698cb948623c69336e9c5b32350bc07`, without that worker's changes. One of three repetitions failed; the other two passed.

The comparison used fresh synthetic hosts, two workers, `OH_REPLY_DELAY_MS=60`, `OH_REPLY_SEED=flicker-regressions`, and a bundle built from a complete export of that main commit with its own `npm ci`. No live accounts or provider calls were involved.

## Reproduction

Build the production web bundle and run the named browser case repeatedly with those jitter settings:

```
npx playwright test tests/browser-conversation.spec.ts --grep 'steer, follow-up and clear' --repeat-each 5
```

Use the repository scratch/umask setup and a dedicated `OH_PORT_BASE`.

## Impact and direction

This makes the focused browser gate intermittently red during unrelated work. The case waits for the stop control to be visible, then submits by keyboard; it does not establish that the fresh status allows queue submission. Visibility of a running turn is not proof of current write availability. Investigate that ordering, then synchronize the test on the actual precondition (or repair the product path if submission is refused despite readiness). Do not hide the race with a fixed sleep or a larger assertion timeout.
