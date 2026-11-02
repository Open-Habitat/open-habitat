---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: open
priority: high
lane: gate-load-flakes
lane_seq: 2
preparation: ready
---

# Clean gate: next-waiting-row stop button and settings-search preview fail under load

## Description

Second clean gate on integrated main `dbe63514` (2.11., Birch, 6 min 32 s):
2 of 537 ordinary browser cases failed, lab 163/163 passed. Log: Birch
`~/.local/state/oh-conductor/gate-r54b/stdout.json`.

1. `next-waiting-row.spec.ts:228` (question, failed send and archive close
   the window): after the fixture scenario returns to `ready`, the composer's
   Stop button stayed visible for 30 s (`composer-stop` count 1, expected 0).
   Either the page never learns the run ended (a real stuck-working state)
   or the spec's route/unroute dance loses the event.
2. `settings-search.spec.ts:70`: arrowing to the second result previewed
   `/settings/recap#recap-model` instead of `#default-model`. The same spec
   already failed in whole-suite runs (`suite-flakes-settings-trash`) and the
   gate-in-minutes worker fixed one race in it (`574596b7`), so the order of
   results under load is still not stable — either the result list reorders
   after it is shown (a product defect: arrows jump to a different setting)
   or the spec reads it too early. `suite-flakes-settings-trash`'s other case
   (workspace-trash undo notice) belongs to this issue too.

## Acceptance Criteria

- [ ] Root cause of each named with evidence; product defects fixed in product code, specs kept strict.
- [ ] Both specs (and workspace-trash's undo case) pass repeatedly under gate-like load, before/after counts in result.md.
