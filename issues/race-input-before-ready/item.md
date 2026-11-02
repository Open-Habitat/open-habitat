---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: open
priority: high
lane: races-conversation
lane_seq: 2
preparation: ready
---

# Input before the conversation view is ready is lost (race group 2)

## Description

Sweep group 2: Enter in a just-opened conversation does nothing; typing during a turn loses focus. The loading and opened view share the elements a person uses; an input the view cannot act on yet is kept or refused visibly.

The analysis, cases and fix are in `issues/load-race-sweep/item.md` (## Sweep analysis, group named above) and `issues/load-race-sweep/orderings.md`.

## Acceptance Criteria

- [ ] Every case the sweep listed for this group passes under its detector (reply delay 250 ms, `--repeat-each 2`); counts before/after in result.md.
- [ ] The mechanism is pinned in Vitest with a controlled order where it is browser state logic.
