---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate failure on main e6270104
source_ref: taskfleet:01m68emc49wbq82ksmt8e94yar/gate-failure:http-fallback-send
originating_run: 01m68emc49wbq82ksmt8e94yar
originating_run_kind: spinoff
preparation: ready
closed: 2026-10-31
---

# HTTP fallback send spec counts zero sends under suite load

## Description

The clean gate on main e6270104 (whole browser suite, default workers, Birch
load about 5–10) failed once in `web/tests/browser-conversation.spec.ts`,
`HTTP fallback permits one send while journal is unavailable`:
`expect(sends).toBe(1)` received 0 right after the editor emptied. Alone the
case passed 5/5 and the whole spec file 75/75.

Either the product empties the editor before the POST is made (a
user-visible race: the text leaves the field but nothing was sent), or the
test reads its request counter before Playwright has delivered the request
event.

## Acceptance Criteria

- [x] The side at fault is identified and fixed.
- [x] The case passes 10 runs under parallel load.
