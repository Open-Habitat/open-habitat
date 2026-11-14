---
created: 2026-11-11
updated: 2026-11-14
type: bug
status: fixed
priority: normal
commits:
- hash: 7291f2ec0
  summary: 'fix(web): keep closed hover help out of the tree so it cannot return'
preparation: ready
lane: tooltip-escape
lane_seq: 1
closed: 2026-11-11
---

# Escape does not close the editor's Save tooltip under load (gate red on ea674a66b)

## Description

Clean gate on main `ea674a66b` (Birch, 11.11.2026) failed twice in a row,
both runs while the machine's load was 15–18 (another conductor's four
workers): `web/tests/workspace-editor.spec.ts:317` "local header, both return
paths and draft retention" at 390 light (first run) and at 390 light and dark
(second run), line 415: after hovering Save, checking the tooltip and running
axe, `Escape` does not remove the tooltip (`expect(tip).toHaveCount(0)`,
received 1). The spec passes alone on the same tree (9/9, three runs), and
the gate on `d584e6e53` passed it. The trust change between them touches no
browser code, so this is a load-sensitive race in the tooltip's Escape
handling (or the spec pressing Escape before the tooltip owns focus/listens).
Related area: `tooltip-swallows-escape`.

It blocks the gate, and with it the pilot.28 release, whenever Birch is
loaded. Reproduce under the ordering detector and CPU throttle per TESTING.md
and fix the cause (product: Escape always closes an open tooltip; spec:
wait for the state it acts on). No relaxed assertions or timeouts.

## Acceptance Criteria

- [x] Escape closes the open tooltip under load; cause fixed in the product, no relaxed assertion or timeout.
- [x] `workspace-editor.spec.ts` "local header" cases pass `--repeat-each 10` under the CPU throttle that reproduced the failure.
