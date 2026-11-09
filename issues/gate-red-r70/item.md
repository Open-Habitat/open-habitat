---
created: 2026-11-09
updated: 2026-11-09
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet spinoff run
source_ref: taskfleet:01m6z9v60yg1wcefdgph2a5nhj/gate-red-r70
originating_run: 01m6z9v60yg1wcefdgph2a5nhj
originating_run_kind: spinoff
closed: 2026-11-09
---

# Gate red: new-conversation placeholder spec sees the composer move 35 px

## Description

The clean gate on db137fc33 failed only in
`web/tests/new-conversation-placeholder.spec.ts` (`@placeholder @a11y sidebar +
opens a stable conversation before creation replies`): the `.ah-composer` box's
y moved 35 px between the placeholder and the created conversation; the header
stayed put. A hotfix release to the pilots waits for a green gate.
