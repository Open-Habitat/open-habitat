---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: fixed
priority: high
lane: races-conversation
lane_seq: 1
preparation: ready
closed: 2026-11-02
closed_by: claude
---

# Older status or reply overwrites a newer one (race group 1)

## Description

Sweep group 1: one cursor-based merge rule for statuses in the store, and a person's own command decided from the record of its command_id, so a slow link never brings a sent message back into the field, loses a draft, or draws a failed send two ways. Includes status-stuck-working-after-release.

The analysis, cases and fix are in `issues/load-race-sweep/item.md` (## Sweep analysis, group named above) and `issues/load-race-sweep/orderings.md`.

## Acceptance Criteria

- [x] Every case the sweep listed for this group passes under its detector (reply delay 250 ms, `--repeat-each 2`); counts before/after in result.md.
- [x] The mechanism is pinned in Vitest with a controlled order where it is browser state logic.

## Resolution

### 2026-11-02T15:09:59Z · @claude

Group 1 fixed: status reads ordered by journal position, the person's command decided from the record of its command_id across remounts, Stop deferred while the message is on its way. Counts, spec reasons and the cases that belong to other groups are in result.md.
