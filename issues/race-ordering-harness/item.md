---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: open
priority: high
lane: races-harness
lane_seq: 1
preparation: ready
---

# Seeded reply jitter and an ordering test harness

## Description

Prevention from the sweep: the synthetic host's seeded reply delay (OH_REPLY_DELAY_MS, OH_REPLY_SEED printed on failure), opt-in now and default-on in focused runs once groups 1-5 are fixed; a Vitest controlled-transport helper for ordering tests; the rule text in web/AGENTS.md and the spec rule in TESTING.md; a periodic stress-run script (CPU 4x, 250 ms, timeouts x4) outside the gate.

The analysis, cases and fix are in `issues/load-race-sweep/item.md` (## Sweep analysis, group named above) and `issues/load-race-sweep/orderings.md`.

## Acceptance Criteria

- [ ] Every case the sweep listed for this group passes under its detector (reply delay 250 ms, `--repeat-each 2`); counts before/after in result.md.
- [ ] The mechanism is pinned in Vitest with a controlled order where it is browser state logic.
