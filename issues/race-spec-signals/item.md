---
created: 2026-11-02
updated: 2026-11-02
type: task
reporter: claude
status: done
priority: high
lane: races-specs
lane_seq: 1
preparation: ready
closed: 2026-11-02
---

# Specs wait for the state they assert (race groups 6-9)

## Description

Sweep groups 6-9 (`issues/load-race-sweep/item.md`): specs racing product timers on the wall clock (drive them with `page.clock`), assuming the synthetic Pi speed (hold the fixture transition), axe or screenshots during the 220 ms landing fade (`reducedMotion: "reduce"` in both Playwright configs, motion specs opt back in), and spec plumbing (response bodies after navigation, double routes). One helper pass, no product change. The r54 third gate failed `start-here.spec.ts:23` on exactly the fade contrast.

## Acceptance Criteria

- [x] Every case listed for groups 6-9 passes under its detector, counts in result.md; no assertion loosened without a stated reason.
