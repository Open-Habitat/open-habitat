---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m824zkytj3q68kszkkqaskfs/observed:duplicate-reply-start
originating_run: 01m824zkytj3q68kszkkqaskfs
originating_run_kind: spinoff
closed: 2026-11-22
---

# Same-workspace browser journey intermittently starts the reply sound twice

## Acceptance Criteria

- [x] Remove the artificial completion-time clock gap while keeping exact playback assertions; the full spec passes 15 repetitions (see result.md).

## Description

## Observed failure

The `same-workspace` non-open reply journey in `web/tests/attention-sound.spec.ts:231` intermittently records two `kulho` attention-sound starts after its initial `kalimba` preview. Its assertion at line 312 expects `[kalimba, kulho]`, but receives `[kalimba, kulho, kulho]`.

Observed twice while running the complete attention-sound spec with two workers and 60 ms response jitter, including one failure among three full-file repeats. This work changes only the Sounds settings status display and its actions, not attention playback, turn handling or the workspace strip.

## Impact

If the fixture sequence represents one real turn transition, the browser can notify the same completion twice. Alternatively, fixture turn transitions or test synchronization may be producing two legitimate notifications. The observed duplicate is confirmed; its cause and user-facing reach are not.

## Reproduction and limits

Run the complete `attention-sound.spec.ts` with `OH_BROWSER_WORKERS=2 OH_REPLY_DELAY_MS=60` and `--repeat-each 3`. No assertions were weakened.

An unchanged main-base archive at `ae56fcc9945990dbb4c17db829e51239614c0378` passed this case in six mixed repeats and ten isolated repeats. Thus baseline reproduction has NOT been established; do not classify this as a proven pre-existing failure. Investigate event delivery, turn identities and fixture transitions before choosing a fix.
