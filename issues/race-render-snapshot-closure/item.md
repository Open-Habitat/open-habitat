---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: fixed
priority: high
lane: races-snapshot
lane_seq: 1
preparation: ready
closed: 2026-11-02
---

# Side effects from render snapshots and stale render-time values (race groups 3 and 4)

## Description

Sweep groups 3 and 4: the editor misses an agent's edit when the tool's succeeded state is never rendered (take the side effect where the event is handled); Undo on a workspace page navigates home from a stale route (read moving values when the callback runs).

The analysis, cases and fix are in `issues/load-race-sweep/item.md` (## Sweep analysis, group named above) and `issues/load-race-sweep/orderings.md`.

## Acceptance Criteria

- [x] Every case the sweep listed for this group passes under its detector (reply delay 250 ms, `--repeat-each 2`); counts before/after in result.md.
- [x] The mechanism is pinned in Vitest with a controlled order where it is browser state logic.
