---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.15 clean gate run
source_ref: taskfleet:01m64akne6b0b1xysrxstj3enk/gate:settings-search-partial
originating_run: 01m64akne6b0b1xysrxstj3enk
originating_run_kind: spinoff
closed: 2026-10-29
---

# settings-search spec reads the second result of a partially typed query under load

## Description

The pilot.15 clean gate on Birch (1f385566, 29.10. evening) failed
`settings-search.spec.ts:73`: URL expected `#default-model`, received
`/settings/recap#recap-model`.

The spec typed "malli" letter by letter and read `options.nth(1)` at once;
under load it read the second result of a partial query, while the arrows
then moved through the settled list.

Fix: fill the query in one input event and wait until the previous search's
result has left the list before reading the second result. 12/12 passed with
`--repeat-each 12 --workers 6` and eight busy loops.

## Resolution

### 2026-10-29T19:15:36Z · @issuectl

fill + wait for the previous result to leave; 12/12 under load.
