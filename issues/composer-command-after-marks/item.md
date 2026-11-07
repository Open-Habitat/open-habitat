---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: conductor
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Command chosen after marked paths does not go first in the composer

## Description

Lab suite on integrated main (151327fec, 7.11.2026) fails deterministically,
also on c33a0e0da before this round's landings, so it predates them:

`web/tests/lab-composer-lists-in-field.spec.ts:71` (experimental "lists inside
the field"): after Tab-marking two paths and Enter, the field holds
`Katso @tests/ @tests/test_status_rows.py ` (the test expects
`Katso @${first} @${second} `; note the first mark resolved to a folder,
`tests/`), and choosing *fix-tests* from Komennot then leaves the field
without `/fix-tests` at the start (expected `/^\/fix-tests Katso @/`).
Recent changes in the area: `29ac730f6` (keep folder navigation independent
of marks) and `872507353` (open the lists inside the field).

Find whether the product or the test is wrong against the agreed behaviour
(the feature's prototype/issue in history via those commits' trailers) and fix
it so the spec passes reliably.

## Acceptance Criteria

- [ ] `lab-composer-lists-in-field.spec.ts` passes three runs in a row.
- [ ] Root cause stated in `result.md`.
