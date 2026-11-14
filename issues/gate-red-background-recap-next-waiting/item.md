---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
source_ref: conductor:2026-11-14/gate-46dcaffc
lane: gate-red
lane_seq: 3
preparation: ready
---

# Clean gate: background-recap one-at-a-time test and next-waiting-row case fail intermittently

## Description

## Observed (14.11.2026)

Clean gate on main `46dcaffc`: two failures, both new today and both
looking timing-dependent.

- Go: `TestBackgroundRecapsRunOneAtATime` (internal/daemon,
  `background_linux_test.go:181`, from `background-work-reserved-slot`)
  failed: "queued map[…]" with three idle-stopped conversations queued; it
  passed in the worker's own runs.
- Browser: `tests/next-waiting-row.spec.ts:79` — acceptance opens, live list
  empties and reopens, finish closes permanently (653 passed otherwise).

Output: `/var/tmp/agent-scratch/oh-gate.7DyEmI/gate.json` on Trude.
