---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in taskfleet run whole-suite browser check
source_ref: taskfleet:01m5mak6k7fd6d360q1prr5btc/observed:spin
originating_run: 01m5mak6k7fd6d360q1prr5btc
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# spinoffs.spec.ts strip case fails deterministically on main

## Description

# spinoffs.spec.ts strip case fails deterministically on main

## Observed

On main `bd5f5571` (2026-10-23), in a clean disposable worktree, `./scripts/test-focused.sh --area browser --spec spinoffs.spec.ts` fails 2/2 runs (and in a whole-suite run on a branch off the same commit) in
`@spinoffs strip keeps a spinoff created before the loaded page, across leaving, incomplete reads and settling` (tests/spinoffs.spec.ts:342):

    Expected substring: "Myöhempi viesti 0."
    Received: "...Lataa vanhempi historiasivu Sinä Vastaus valmis Myöhempi viesti 1. Sinä Vastaus valmis Myöhempi viesti 3. ..."

The conversation shows messages 1 and 3 but not 0 (nor 2): the first page after creating the spinoff misses entries, or the assertion expects entries the page no longer loads. The other three cases in the spec pass.

## Impact

The maintained browser suite is red on main independently of the change under test, so every whole-suite run reports this failure.
